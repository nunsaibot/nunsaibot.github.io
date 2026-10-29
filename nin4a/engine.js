/* Bushido: deterministic game simulation, independent of the renderer. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const platform = (x, y, w, h = 26, kind = 'roof') => ({ x, y, w, h, kind });
  const BUFFS = {
    vitality:{name:'Крепкий дух',description:'+1 жизнь: всего 3 на один набег',icon:'心',color:'#ee8883'},
    haste:{name:'Лёгкий шаг',description:'+10% к скорости движения',icon:'風',color:'#b7d6a4'},
    revive:{name:'Второе дыхание',description:'Одно воскрешение на уровне',icon:'命',color:'#d6abea'},
    bounty:{name:'Двойной трофей',description:'Выпавшие тяирэ ×2 за одну зачистку',icon:'福',color:'#e1bd79'},
    fire:{name:'Огненный меч',description:'+3% урона на один набег',icon:'火',color:'#ffac65'},
    ice:{name:'Ледяной меч',description:'+3% урона на один набег',icon:'氷',color:'#9ddfea'}
  };
  const WEAPONS = {
    fists: {id:'fists',name:'Кулаки',damage:.8,finisher:1.6,reach:53,finishReach:69,duration:.24},
    katana: {id:'katana',name:'Катана',damage:1,finisher:2},
    akatsuki: {id:'akatsuki',name:'Акацуки',damage:2,finisher:3}
  };
  const LEVELS = [
    {name:'Старый квартал',subtitle:'Не оставляй никого.',color:'#ed5662'},
    {name:'Багряные крыши',subtitle:'Выше крыш. Тише ветра.',color:'#ef7854'},
    {name:'Врата рассвета',subtitle:'Последний рубеж. Закончи начатое.',color:'#e85674'}
  ];

  const content=typeof module!=='undefined'&&module.exports?require('./world-content.js'):root.BushidoContent;
  const {REGIONS,ENEMY_TYPES}=content;content.extend(LEVELS,platform);
  const traps=typeof module!=='undefined'&&module.exports?require('./traps.js'):root.BushidoTraps;
  const bosses=typeof module!=='undefined'&&module.exports?require('./bosses.js'):root.BushidoBosses;
  bosses.extendLevels(LEVELS,REGIONS,platform);

  class World {
    constructor(level = 0, options = {}) {
      this.random = options.random || Math.random;
      this.blood = options.blood ?? 1;
      this.weapon = WEAPONS[options.weapon] || WEAPONS.fists;
      this.amulets=Object.fromEntries(['omamori','dash','fury','ronin'].map(id=>[id,options.amulets?.[id]===true]));
      this.inventory={shuriken:clamp(Math.floor(options.inventory?.shuriken||0),0,1),potion:clamp(Math.floor(options.inventory?.potion||0),0,2)};
      this.consumeItem=typeof options.consumeItem==='function'?options.consumeItem:null;
      this.buff=BUFFS[options.buff]?options.buff:null;this.runId=options.runId||null;
      this.speedMultiplier=this.buff==='haste'?1.1:1;this.damageMultiplier=(['fire','ice'].includes(this.buff)?1.03:1)*(this.amulets.fury?1.08:1);
      this.load(level);
    }
    load(index) {
      this.levelIndex = clamp(index, 0, LEVELS.length - 1);
      this.level = LEVELS[this.levelIndex];
      this.platforms = this.level.platforms;
      this.player = { x:this.level.spawn[0], y:this.level.spawn[1], w:25,h:52,vx:0,vy:0,facing:1,hp:this.buff==='vitality'?3:2,maxHp:this.buff==='vitality'?3:2,grounded:false,jumps:0,coyote:0,jumpBuffer:0,invincible:0,attackTime:0,attackCooldown:0,attackId:0,comboStep:0,comboClock:0,dashTime:0,dashCooldown:0,run:0 };
      this.player.weaponId=this.weapon.id;this.player.element=['fire','ice'].includes(this.buff)?this.buff:null;this.player.revives=this.buff==='revive'?1:0;this.player.attackDuration=this.weapon.duration||.2;this.player.healTime=0;
      this.nav=this.platforms.map((from,i)=>this.platforms.flatMap((to,j)=>{const gap=Math.max(0,to.x-(from.x+from.w),from.x-(to.x+to.w));return i!==j&&from.y-to.y<=145&&to.y-from.y<=340&&gap<=205?[j]:[];}));
      this.enemies = this.level.enemies.map(([x, floor, type,patrol], id) => ({ id,patrol,x,y:floor-(type==='brute'?62:50),w:type==='brute'?32:25,h:type==='brute'?62:50,vx:0,vy:0,facing:-1,hp:ENEMY_TYPES[type].hp,maxHp:ENEMY_TYPES[type].hp,type,grounded:false,state:'patrol',timer:0,cooldown:0,hitFlash:0,lastAttack:-1,home:x,run:id*1.9,dead:false,missingArm:false,alert:0,jumpCooldown:0,jumpTarget:null,dropTarget:null,dropUntil:0,defenseCooldown:0,strikeHit:false,windupDuration:type==='brute'?.45:.28 }));
      this.traps=traps.create(this.level);
      this.boss=this.level.boss?bosses.create(this.level.boss):null;this.bossHazards=[];
      if(this.boss)this.enemies=[this.boss];
      this.projectiles=[];this.windProjectiles=[];this.particles=[];this.chunks=[];this.stains=[];this.slashes=[];this.ghosts=[];this.popups=[];this.events=[];
      this.elapsed=0;this.kills=0;this.combo=0;this.bestCombo=0;this.comboTimer=0;this.shake=0;this.hitstop=0;this.endDelay=-1;this.status='playing';this.tick=0;
    }
    rand(a,b){return a+(b-a)*this.random();}
    emit(type, data={}){this.events.push({type,...data});}
    jump(){this.player.jumpBuffer=.13;}
    attack(){
      const p=this.player;
      if(this.status!=='playing'||p.attackCooldown>0||p.dashTime>0)return false;
      p.comboStep=p.comboClock>0?(p.comboStep+1)%3:0;p.comboClock=.75;
      p.attackTime=p.attackDuration;p.attackCooldown=p.comboStep===2?.34:Math.max(.235,p.attackDuration+.01);p.attackId++;
      if(p.grounded)p.vx+=p.facing*135;
      this.slashes.push({x:p.x+p.w/2,y:p.y+p.h*.45,facing:p.facing,step:p.comboStep,life:p.attackDuration,maxLife:p.attackDuration,weapon:this.weapon.id,element:this.player.element});
      this.emit('swing',{step:p.comboStep,weapon:this.weapon.id});return true;
    }
    dash(){
      const p=this.player;
      if(this.status!=='playing'||!this.amulets.dash||p.dashCooldown>0)return false;
      p.dashTime=.16;p.dashCooldown=.82;p.invincible=Math.max(p.invincible,.23);p.vy=0;
      this.emit('dash');return true;
    }
    spendItem(id){
      if(!['shuriken','potion'].includes(id)||this.inventory[id]<1||this.consumeItem&&!this.consumeItem(id))return false;
      this.inventory[id]--;return true;
    }
    heal(){
      const p=this.player;if(this.status!=='playing'||p.hp>=p.maxHp||p.hp<=0||!this.spendItem('potion'))return false;
      p.hp++;p.healTime=.55;this.popups.push({x:p.x-20,y:p.y-20,text:'+1 ЖИЗНЬ',life:.8,color:'#a6dcb4'});this.emit('heal');return true;
    }
    throwShuriken(){
      const p=this.player;if(this.status!=='playing'||!this.spendItem('shuriken'))return false;
      this.windProjectiles.push({x:p.x+p.w/2,y:p.y+p.h*.48,vx:p.facing*980,hit:new Set(),angle:0});this.emit('shuriken');return true;
    }
    roninTarget(){
      const p=this.player,box={x:p.facing>0?p.x:p.x-112,y:p.y-18,w:p.w+112,h:p.h+36};
      return this.enemies.filter(e=>!e.dead&&!e.bossId&&overlap(box,e)).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||null;
    }
    execute(){
      if(this.status!=='playing'||!this.amulets.ronin||this.combo<10||this.comboTimer<=0)return false;
      const target=this.roninTarget();if(!target)return false;
      this.hurtEnemy(target,target.hp,this.player.facing,true,'execution');this.combo=0;this.comboTimer=0;
      this.popups.push({x:target.x-25,y:target.y-35,text:'РОНИН',life:.7,color:'#e9bd83'});this.emit('execute');return true;
    }
    updateWind(dt){
      for(const star of this.windProjectiles){
        const previous=star.x;star.x+=star.vx*dt;star.angle+=dt*25;
        const sweep={x:Math.min(previous,star.x)-18,y:star.y-20,w:Math.abs(star.x-previous)+36,h:40};
        for(const e of this.enemies)if(!e.dead&&!star.hit.has(e.id)&&overlap(sweep,e)){
          star.hit.add(e.id);this.hurtEnemy(e,WEAPONS.akatsuki.damage*this.damageMultiplier,Math.sign(star.vx),true,'shuriken');
        }
      }
      this.windProjectiles=this.windProjectiles.filter(star=>star.x>-70&&star.x<this.level.width+70);
    }
    move(body,dt){
      const oldBottom=body.y+body.h;
      body.x+=body.vx*dt;body.x=clamp(body.x,0,this.level.width-body.w);
      body.y+=body.vy*dt;body.grounded=false;
      if(body.vy>=0){
        for(const s of this.platforms){
          if(body.x+body.w>s.x&&body.x<s.x+s.w&&oldBottom<=s.y+3&&body.y+body.h>=s.y){
            body.y=s.y-body.h;body.vy=0;body.grounded=true;break;
          }
        }
      }
    }
    spray(x,y,direction,power=1){
      const count=Math.floor((this.blood?64:12)*power);
      for(let i=0;i<count;i++)this.particles.push({x,y,vx:direction*this.rand(60,470)*power+this.rand(-160,130),vy:this.rand(-360,80)*power,size:this.rand(2,5.8),life:this.rand(.45,1.5),color:this.random()<.4?'#ed3b52':this.random()<.5?'#a71e38':'#681d32',blood:true});
      if(this.particles.length>1350)this.particles.splice(0,this.particles.length-1350);
    }
    sparks(x,y,direction){
      for(let i=0;i<13;i++)this.particles.push({x,y,vx:direction*this.rand(70,400)+this.rand(-90,90),vy:this.rand(-200,170),size:this.rand(1,3),life:this.rand(.1,.35),color:i%2?'#ffe6bb':'#eefaff',blood:false});
    }
    sever(enemy,part,direction){
      const geometry={arm:[enemy.w*.8,enemy.h*.35,9,22],leg:[enemy.w*.6,enemy.h*.72,10,23],head:[enemy.w*.5,5,18,17],torso:[enemy.w*.5,enemy.h*.4,enemy.w-1,26]};
      const [ox,oy,w,h]=geometry[part];
      this.chunks.push({x:enemy.x+ox,y:enemy.y+oy,w,h,vx:direction*this.rand(110,360)+this.rand(-120,120),vy:this.rand(-430,-180),angle:this.rand(-1,1),spin:this.rand(-12,12),life:13,color:enemy.type==='brute'?'#714751':'#693b50',part,settled:false});
      if(this.chunks.length>100)this.chunks.shift();
    }
    hurtEnemy(e,damage,direction,heavy=false,source='melee'){
      if(e.dead)return;
      e.hp=Math.max(0,Math.round((e.hp-damage)*10000)/10000);e.hitFlash=.16;e.alert=4;
      const armored=e.hp>0&&(e.bossId||e.type==='brute'&&['windup','strike'].includes(e.state)&&!heavy);
      if(!armored){e.state='stunned';e.timer=e.type==='brute'?.10:.14;e.vx=direction*(e.type==='brute'?95:210);e.vy=-55;}
      else if(!e.bossId){this.popups.push({x:e.x,y:e.y-12,text:'БРОНЯ',life:.55,color:'#e4ba78'});}
      this.spray(e.x+e.w/2,e.y+e.h*.38,direction,e.hp<=0?1.4:1);
      this.sparks(e.x+e.w/2,e.y+e.h*.4,direction);
      this.shake=e.hp<=0?9:5;this.hitstop=e.hp<=0?.065:.04;
      if(source!=='trap'&&source!=='execution'){this.combo++;this.comboTimer=2.2;this.bestCombo=Math.max(this.bestCombo,this.combo);}
      if(e.hp<=1&&!e.missingArm){this.sever(e,'arm',direction);e.missingArm=true;}
      this.emit('hit',{kill:e.hp<=0});
      if(e.hp<=0){
        e.dead=true;this.kills++;
        if(e.bossId){this.bossHazards=[];this.projectiles=[];}
        for(const part of ['head','torso','leg','leg'])this.sever(e,part,direction);
        if(!e.missingArm)this.sever(e,'arm',direction);
        this.popups.push({x:e.x,y:e.y-15,text:'斬',life:.85,color:'#f25b69'});
        if(this.kills===this.enemies.length)this.endDelay=.9;
      }
    }
    hurtPlayer(direction,fall=false){
      const p=this.player;
      if(this.status!=='playing'||(!fall&&(p.invincible>0||p.dashTime>0)))return false;
      p.hp--;p.invincible=1.1;p.vx=direction*310;p.vy=-230;this.shake=11;this.hitstop=.07;
      this.combo=0;this.spray(p.x+p.w/2,p.y+22,direction,.6);this.emit('hurt');
      if(p.hp<=0){
        if(p.revives>0){p.revives--;p.hp=1;p.invincible=1.8;p.vx=0;p.vy=-120;
          for(const e of this.enemies)if(!e.dead&&Math.abs(e.x-p.x)<180&&!e.bossId){e.state='stunned';e.timer=.65;e.vx=Math.sign(e.x-p.x)*220;}
          this.popups.push({x:p.x-45,y:p.y-25,text:'ВОЗРОЖДЕНИЕ',life:.85,color:'#dfb1ed'});this.emit('revive');
        }else{this.status='dead';this.emit('dead');}
      }
      return true;
    }
    update(dt,input={}){
      dt=clamp(dt,0,.035);this.tick+=dt;
      this.updateEffects(dt);
      this.shake=Math.max(0,this.shake-dt*35);
      if(this.status!=='playing')return;
      if(this.hitstop>0){this.hitstop-=dt;return;}
      this.elapsed+=dt;
      const p=this.player;
      for(const key of ['invincible','attackTime','attackCooldown','comboClock','dashTime','dashCooldown','jumpBuffer','healTime'])p[key]=Math.max(0,p[key]-dt);
      this.comboTimer-=dt;if(this.comboTimer<=0)this.combo=0;
      if(p.grounded){p.coyote=.10;p.jumps=0;}else p.coyote=Math.max(0,p.coyote-dt);
      if(!p.grounded&&p.coyote<=0&&p.jumps===0)p.jumps=1;
      if(p.jumpBuffer>0&&p.jumps<(this.amulets.omamori?2:1)){
        // One jump reaches the existing roof steps; Omamori adds another impulse in midair.
        p.vy=p.jumps===0?-790:-680;p.jumps++;p.jumpBuffer=0;p.coyote=0;p.grounded=false;
        this.emit('jump',{second:p.jumps===2});
        for(let i=0;i<9;i++)this.particles.push({x:p.x+12,y:p.y+p.h,vx:this.rand(-100,100),vy:this.rand(10,70),size:this.rand(2,5),life:.25,color:'#7791a0',blood:false});
      }
      const axis=(input.right?1:0)-(input.left?1:0);
      if(axis&&p.attackTime<=.05&&p.dashTime<=0)p.facing=axis;
      if(p.dashTime>0){
        p.vx=p.facing*940*this.speedMultiplier;p.vy=0;
        if(this.ghosts.length===0||this.ghosts[this.ghosts.length-1].life<.17)this.ghosts.push({x:p.x,y:p.y,facing:p.facing,life:.22});
      }else{
        const acceleration=p.grounded?2400:1600,target=axis*300*this.speedMultiplier;
        p.vx+=clamp(target-p.vx,-acceleration*dt,acceleration*dt);
        p.vy=Math.min(1100,p.vy+2200*dt);
      }
      this.move(p,dt);p.run+=Math.abs(p.vx)*dt*.035;
      if(p.y>790&&this.status==='playing'){
        this.hurtPlayer(-p.facing,true);
        if(this.status==='playing'){
          const safe=this.platforms.filter(s=>s.kind==='ground'&&s.x<p.x).sort((a,b)=>b.x-a.x)[0]||this.platforms[0];
          p.x=clamp(p.x,safe.x+35,safe.x+safe.w-45);p.y=safe.y-p.h-2;p.vy=0;p.vx=0;p.jumps=0;p.invincible=1.3;
        }
      }
      if(p.attackTime>.025){
        const reach=p.comboStep===2?(this.weapon.finishReach||108):(this.weapon.reach||91);
        const box={x:p.facing>0?p.x+p.w-5:p.x-reach+5,y:p.y-9,w:reach,h:p.h+24};
        for(const e of this.enemies)if(!e.dead&&e.lastAttack!==p.attackId&&overlap(box,e)){
          e.lastAttack=p.attackId;this.hurtEnemy(e,(p.comboStep===2?this.weapon.finisher:this.weapon.damage)*this.damageMultiplier,p.facing,p.comboStep===2);
        }
        traps.disarm(this,box);
        bosses.disarm(this,box);
      }
      for(const e of this.enemies)if(!e.dead)this.updateEnemy(e,dt);
      this.updateProjectiles(dt);
      this.updateWind(dt);
      traps.update(this,dt);
      bosses.updateHazards(this,dt);
      if(this.endDelay>=0&&this.status==='playing'){
        this.endDelay-=dt;if(this.endDelay<=0){this.status='cleared';this.emit('clear');}
      }
    }
    floorFor(body){
      const cx=body.x+body.w/2,feet=body.y+body.h;
      let index=-1,distance=Infinity;
      this.platforms.forEach((s,i)=>{if(cx>=s.x&&cx<=s.x+s.w&&s.y>=feet-5&&s.y-feet<distance){index=i;distance=s.y-feet;}});
      return index;
    }
    routeNext(from,to){
      if(from<0||to<0||from===to)return null;
      const queue=[[from,null]],seen=new Set([from]);
      while(queue.length){const [current,first]=queue.shift();for(const next of this.nav[current]){
        if(seen.has(next))continue;if(next===to)return first??next;seen.add(next);queue.push([next,first??next]);
      }}return null;
    }
    pursue(e,p){
      const speed=e.bossId?e.speed:ENEMY_TYPES[e.type].speed,ex=e.x+e.w/2,px=p.x+p.w/2;
      if(e.dropTarget!==null){e.vx=clamp((e.dropTarget-ex)*5,-speed,speed);return;}
      const from=this.floorFor(e),to=this.floorFor(p),next=this.routeNext(from,to);
      let target=px+clamp(p.vx*.18,-55,55);
      const nearby=this.enemies.some(other=>other!==e&&!other.dead&&Math.abs(other.x-p.x)<85&&Math.abs(other.y-p.y)<60);
      if(nearby&&Math.abs(px-ex)>125)target+=(e.id%2?68:-68);
      if(!e.grounded&&e.jumpTarget!==null){target=e.jumpTarget;e.vx=clamp((target-ex)*5,-285,285);return;}
      if(next!==null&&e.grounded){
        const current=this.platforms[from],dest=this.platforms[next],rise=current.y-dest.y;
        const entry=clamp(ex,dest.x+22,dest.x+dest.w-22);
        if(rise>8){
          target=entry;
          if(Math.abs(entry-ex)<155&&e.jumpCooldown<=0){
            e.vy=-865;e.grounded=false;e.jumpTarget=entry;e.jumpCooldown=.85;e.vx=clamp((entry-ex)*4,-285,285);return;
          }
        }else if(rise < -8){
          const left=current.x-32,right=current.x+current.w+32;
          const safeExits=[left,right].filter(x=>x>dest.x+10&&x<dest.x+dest.w-10);
          if(safeExits.length){
            target=safeExits.sort((a,b)=>Math.abs(px-a)-Math.abs(px-b))[0];e.dropTarget=target;e.dropUntil=current.y+32;
          }else{
            const edge=entry>ex?current.x+current.w:current.x;
            target=edge;
            if(Math.abs(edge-ex)<48&&Math.abs(entry-ex)<225&&e.jumpCooldown<=0){
              e.vy=-640;e.grounded=false;e.jumpTarget=entry;e.jumpCooldown=.8;e.vx=Math.sign(entry-ex)*285;return;
            }
          }
        }else{
          target=entry;
          const edge=entry>ex?current.x+current.w:current.x;
          if(Math.abs(edge-ex)<48&&Math.abs(entry-ex)<205&&e.jumpCooldown<=0){
            e.vy=-700;e.grounded=false;e.jumpTarget=entry;e.jumpCooldown=.8;e.vx=Math.sign(entry-ex)*285;return;
          }
        }
      }
      e.vx=clamp((target-ex)*5,-speed,speed);
      if(e.grounded&&from===to&&Math.abs(px-ex)<64)e.vx=0;
      if(e.grounded){
        const probe=ex+Math.sign(e.vx)*(e.w/2+13);
        const floor=this.platforms.some(s=>probe>=s.x&&probe<=s.x+s.w&&Math.abs(s.y-e.y-e.h)<6);
        if(!floor&&next===null)e.vx=0;
      }
    }
    updateEnemy(e,dt){
      if(e.bossId){bosses.update(this,e,dt);return;}
      const p=this.player,stats=ENEMY_TYPES[e.type];
      for(const key of ['cooldown','hitFlash','jumpCooldown','defenseCooldown','alert'])e[key]=Math.max(0,e[key]-dt);
      e.timer-=dt;
      const dx=p.x+p.w/2-(e.x+e.w/2),dy=(p.y+p.h)-(e.y+e.h);
      const sees=Math.abs(dx)<(e.type==='archer'?620:450)&&Math.abs(dy)<250;
      if(sees){
        e.alert=3.5;
        for(const ally of this.enemies)if(!ally.dead&&ally.patrol===e.patrol&&Math.abs(ally.x-e.x)<360&&Math.abs(ally.y-e.y)<140)ally.alert=Math.max(ally.alert,2.5);
      }
      if(e.state==='stunned'){
        e.vx*=Math.pow(.03,dt);if(e.timer<=0)e.state='patrol';
      }else if(e.state==='evade'){
        if(e.timer<=0){e.state='patrol';e.cooldown=0;}
      }else if(e.state==='aim'){
        e.vx=0;
        if(e.timer>.18){e.aimX=p.x+p.w/2;e.aimY=p.y+p.h*.45;e.facing=dx<0?-1:1;}
        if(e.timer<=0){
          const x=e.x+e.w/2,y=e.y+22,angle=Math.atan2(e.aimY-y,e.aimX-x);
          this.projectiles.push({x,y,vx:Math.cos(angle)*430,vy:Math.sin(angle)*430,life:2.5});
          e.state='recover';e.timer=1.05;this.emit('enemySwing');
        }
      }else if(e.state==='windup'){
        e.vx=0;
        if(e.timer>.15)e.facing=dx<0?-1:1;
        if(e.timer<=0){e.state='strike';e.timer=e.type==='brute'?.22:.17;e.strikeHit=false;e.vx=e.facing*stats.lunge;this.emit('enemySwing');}
      }else if(e.state==='strike'){
        if(e.timer<=0){e.state='recover';e.timer=stats.recover;e.vx=0;}
      }else if(e.state==='recover'){
        e.vx=0;if(e.timer<=0){e.state='patrol';e.cooldown=.13;}
      }else if(e.alert>0){
        e.facing=dx<0?-1:1;
        if(e.type==='archer'&&Math.abs(dx)>140&&Math.abs(dx)<620&&Math.abs(dy)<180&&e.grounded&&e.cooldown<=0&&this.clearShot(e,p)){
          e.state='aim';e.windupDuration=.85;e.timer=.85;e.aimX=p.x+p.w/2;e.aimY=p.y+p.h*.45;e.vx=0;
        }else if(['guard','assassin'].includes(e.type)&&e.grounded&&Math.abs(dx)>90&&Math.abs(dx)<155&&Math.abs(dy)<45&&p.attackTime>.1&&e.defenseCooldown<=0){
          e.state='evade';e.timer=.18;e.vx=-e.facing*(e.type==='assassin'?320:230);e.defenseCooldown=e.type==='assassin'?.85:1.8;
        }else if(Math.abs(dx)<stats.range&&Math.abs(dy)<52&&e.cooldown<=0&&e.grounded){
          e.state='windup';e.windupDuration=stats.windup;e.timer=e.windupDuration;e.vx=0;
        }else this.pursue(e,p);
      }else{
        if(Math.abs(e.x-e.home)>52)e.facing=e.x>e.home?-1:1;
        e.vx=e.facing*43;
        if(e.grounded){const probe=e.x+(e.facing>0?e.w+13:-13);if(!this.platforms.some(s=>probe>=s.x&&probe<=s.x+s.w&&Math.abs(s.y-e.y-e.h)<6)){e.facing*=-1;e.vx=0;}}
      }
      e.vy=Math.min(1100,e.vy+2200*dt);this.move(e,dt);e.run+=Math.abs(e.vx)*dt*.03;
      if(e.grounded)e.jumpTarget=null;
      if(e.dropTarget!==null&&e.y+e.h>e.dropUntil)e.dropTarget=null;
      if(e.state==='strike'&&!e.strikeHit){
        const reach=stats.reach;
        const attackBox={x:e.facing>0?e.x+e.w-4:e.x-reach+4,y:e.y-4,w:reach,h:e.h+12};
        if(overlap(attackBox,p)&&this.hurtPlayer(e.facing))e.strikeHit=true;
      }
      if(e.y>800)this.hurtEnemy(e,99,1);
    }
    clearShot(e,p){
      const ax=e.x+e.w/2,ay=e.y+22,bx=p.x+p.w/2,by=p.y+p.h*.45,steps=Math.ceil(Math.hypot(bx-ax,by-ay)/8);
      for(let i=1;i<steps;i++){const x=ax+(bx-ax)*i/steps,y=ay+(by-ay)*i/steps;if(this.platforms.some(s=>x>s.x&&x<s.x+s.w&&y>s.y&&y<s.y+s.h))return false;}
      return true;
    }
    updateProjectiles(dt){
      for(const arrow of this.projectiles){
        // Substeps prevent fast arrows tunnelling through a body or a thin roof.
        const steps=Math.max(1,Math.ceil(Math.hypot(arrow.vx,arrow.vy)*dt/5));
        for(let i=0;i<steps&&arrow.life>0;i++){
          arrow.x+=arrow.vx*dt/steps;arrow.y+=arrow.vy*dt/steps;
          const box={x:arrow.x-4,y:arrow.y-3,w:8,h:6};
          if(this.platforms.some(s=>overlap(box,s)))arrow.life=0;
          else if(overlap(box,this.player)){this.hurtPlayer(Math.sign(arrow.vx));arrow.life=0;}
        }
        arrow.life-=dt;
      }
      this.projectiles=this.projectiles.filter(p=>p.life>0);
    }
    updateEffects(dt){
      for(const particle of this.particles){
        const oldY=particle.y;particle.vy+=1200*dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.life-=dt;
        if(particle.blood&&particle.vy>0){
          for(const s of this.platforms)if(particle.x>=s.x&&particle.x<s.x+s.w&&oldY<=s.y&&particle.y>=s.y){
            this.stains.push({x:particle.x,y:s.y,w:particle.size*this.rand(1,3.8),h:this.rand(2,4),drip:this.random()<.21?this.rand(5,24):0,color:particle.color});particle.life=0;break;
          }
        }
      }
      this.particles=this.particles.filter(p=>p.life>0&&p.y<820);
      if(this.stains.length>1600)this.stains.splice(0,this.stains.length-1600);
      for(const c of this.chunks){
        c.life-=dt;if(c.settled)continue;
        const oldY=c.y;c.vy+=1600*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.angle+=c.spin*dt;
        for(const s of this.platforms)if(c.x>=s.x&&c.x<s.x+s.w&&oldY+c.h/2<=s.y+5&&c.y+c.h/2>=s.y&&c.vy>0){
          c.y=s.y-c.h/2;c.vy*=-.23;c.vx*=.6;c.spin*=.5;
          if(Math.abs(c.vy)<65){c.settled=true;c.angle=0;}
          break;
        }
      }
      this.chunks=this.chunks.filter(c=>c.life>0&&c.y<850);
      for(const key of ['slashes','ghosts','popups']){for(const item of this[key])item.life-=dt;this[key]=this[key].filter(item=>item.life>0);}
    }
  }
  const api={World,LEVELS,WEAPONS,BUFFS,REGIONS,ENEMY_TYPES,clamp,overlap};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.KageCore=api;
})(typeof window!=='undefined'?window:globalThis);
