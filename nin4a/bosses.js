/* Boss encounters: distance-aware decisions, branching combos and physical animation tells. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const FLOOR=582;
  const DEFS=[
    {id:'akaoni',name:'Акаони',title:'Красный палач',hp:32,speed:235,spacing:110,evade:.15,color:'#e96670',armor:'#803d50',symbol:'鬼',moves:['cut','charge','waves'],description:'Дуэлянт с тяжёлым мечом. Меняет ритм разрезов, разворачивается между ударами и преследует отступающих.',tip:'Не терпит поспешности.'},
    {id:'kageha',name:'Кагэха',title:'Бамбуковая тень',hp:28,speed:320,spacing:180,evade:.8,color:'#b2e9a7',armor:'#3e685b',symbol:'影',moves:['blink','kunai','charge'],description:'Теневой убийца. Обходит с фланга, исчезает из-под клинка и соединяет кунаи с выпадами.',tip:'Тень никогда не стоит на месте.'},
    {id:'kuroshio',name:'Куросио',title:'Чёрный прилив',hp:36,speed:205,spacing:230,evade:.3,color:'#88d8df',armor:'#396a80',symbol:'潮',moves:['hook','anchor','waves'],description:'Пират с якорем. Держит среднюю дистанцию, притягивает крюком и встречает сближение приливом.',tip:'Прилив возвращается.'},
    {id:'shirayuki',name:'Сираюки',title:'Хозяйка метели',hp:30,speed:275,spacing:360,evade:.9,color:'#d2f5ff',armor:'#7b98b9',symbol:'雪',moves:['frost','icicles','freeze'],description:'Ледяная лучница. Отступает с залпом и перекрывает пути преследования льдом.',tip:'Холод не прощает остановок.'},
    {id:'raizen',name:'Райдзэн',title:'Хранитель колокола',hp:34,speed:220,spacing:280,evade:.45,color:'#dbc2ff',armor:'#6c4d8a',symbol:'雷',moves:['lightning','bell','verdict'],description:'Монах грома. Меняет позиции, чередует разряды и волны, достаёт противника на возвышениях.',tip:'Тишина бывает обманчивой.'},
    {id:'genzo',name:'Гэндзо',title:'Хозяин шахт',hp:38,speed:195,spacing:210,evade:.2,color:'#ffcc86',armor:'#8a6245',symbol:'砕',moves:['mines','beams','hammer'],description:'Подрывник. Оставляет мины на пути, обрушивает балки и резко сокращает дистанцию молотом.',tip:'В шахте нет надёжного укрытия.'},
    {id:'momiji',name:'Момидзи',title:'Алая танцовщица',hp:30,speed:310,spacing:160,evade:.85,color:'#ffb4bc',armor:'#a25267',symbol:'紅',moves:['dance','blades','petals'],description:'Танцовщица с парными клинками. Меняет длину серий, проходит за спину и атакует на возврате лезвий.',tip:'Последний шаг не всегда последний.'},
    {id:'enma',name:'Энма',title:'Сердце пепла',hp:44,speed:245,spacing:140,evade:.25,color:'#ffb269',armor:'#923e37',symbol:'炎',moves:['slam','eruption','breath'],description:'Огненный воин. Преследует прыжками, связывает извержения с дыханием и давит в ближнем бою.',tip:'Пепел ещё хранит жар.'}
  ];
  const MOVES={
    cut:{windup:.46,kind:'melee'},charge:{windup:.48,kind:'rush'},waves:{windup:.53,kind:'wave'},
    blink:{windup:.42,kind:'leap'},kunai:{windup:.43,kind:'shot'},hook:{windup:.54,kind:'shot'},anchor:{windup:.55,kind:'area'},
    frost:{windup:.46,kind:'shot'},icicles:{windup:.51,kind:'area'},freeze:{windup:.49,kind:'area'},
    lightning:{windup:.52,kind:'area'},bell:{windup:.56,kind:'wave'},verdict:{windup:.61,kind:'area'},
    mines:{windup:.47,kind:'area'},beams:{windup:.58,kind:'area'},hammer:{windup:.5,kind:'leap'},
    dance:{windup:.43,kind:'rush'},blades:{windup:.48,kind:'shot'},petals:{windup:.44,kind:'shot'},
    slam:{windup:.56,kind:'leap'},eruption:{windup:.58,kind:'area'},breath:{windup:.65,kind:'melee'}
  };
  function extendLevels(levels,regions,platform){
    DEFS.forEach((d,region)=>levels.push({name:'Босс — '+d.name,subtitle:d.title+' · '+d.tip,boss:d.id,region,theme:regions[region].id,tier:3,color:d.color,width:1800,spawn:[130,530],exit:1660,
      platforms:[platform(-100,FLOOR,2000,180,'ground'),platform(430,456,150,26),platform(1240,456,150,26)],enemies:[],traps:[],props:[{x:45,y:FLOOR-110,w:62,h:110,type:'lantern',seed:region},{x:1420,y:FLOOR-110,w:62,h:110,type:'lantern',seed:region+8}]}));
  }
  function create(id){
    const d=DEFS.find(b=>b.id===id);
    return{id:0,bossId:id,type:'boss',name:d.name,def:d,x:1150,y:FLOOR-78,w:44,h:78,hp:d.hp,maxHp:d.hp,speed:d.speed,vx:0,vy:0,facing:-1,grounded:true,state:'sleep',timer:0,phase:1,attackIndex:0,move:null,run:0,hitFlash:0,lastAttack:-1,dead:false,missingArm:false,alert:0,jumpCooldown:0,jumpTarget:null,dropTarget:null,dropUntil:0,recent:[],readyAt:{},chain:0,followup:false,maneuverCooldown:0,decisionTime:0,actionClock:0,swingTime:0};
  }
  function hazard(w,b,type,box,delay=0,life=.2,extra={}){
    const h={type,...box,delay,warning:delay,life,duration:life,age:0,vx:0,vy:0,color:b.def.color,hit:false,owner:b,...extra};
    w.bossHazards.push(h);return h;
  }
  function area(w,b,x,width,delay=.45,height=90,type='area',life=.22){
    const falling=['anchor','beam','icefall'].includes(type);
    return hazard(w,b,type,{x:clamp(x,0,w.level.width-width),y:falling?92:FLOOR-height,w:width,h:falling?({anchor:88,beam:35,icefall:70}[type]):height},delay,falling?1.2:life,falling?{falling:true,vy:type==='icefall'?1180:1000}:{});
  }
  function shot(w,b,angle,speed=370,extra={}){
    return hazard(w,b,'bolt',{x:b.x+b.w/2-8,y:b.y+25,w:16,h:12},0,3.6,{vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,...extra});
  }
  function fan(w,b,count,spread=.2,type='bolt'){
    const angle=Math.atan2(b.target.y-(b.y+31),b.target.x-(b.x+b.w/2));
    for(let i=0;i<count;i++)shot(w,b,angle+(i-(count-1)/2)*spread,440+b.phase*25,{type});
  }
  function waves(w,b,delay=0){for(const dir of [-1,1])hazard(w,b,'wave',{x:b.x+b.w/2,y:FLOOR-32,w:26,h:32},delay,3.5,{vx:dir*(365+b.phase*30)});}
  function chooseMove(w,b){
    const distance=Math.abs(w.player.x-b.x),above=w.player.y+w.player.h<b.y+b.h-85;
    const options=b.def.moves.map(move=>{
      const kind=MOVES[move].kind;let weight=3;
      if(kind==='melee')weight=above?.08:distance<190?8:distance<310?1:.02;
      if(kind==='rush')weight=above?.18:distance>160&&distance<650?6:1;
      if(kind==='leap')weight=above||distance>250?6:2;
      if(kind==='shot')weight=distance>180?5:1.4;
      if(kind==='wave')weight=above?.3:distance<250?5:3;
      if(kind==='area')weight=above?6:3;
      if(move===b.recent.at(-1))weight*=.08;else if(b.recent.includes(move))weight*=.65;
      if((b.readyAt[move]||0)>w.elapsed)weight*=.1;
      return{move,weight};
    });
    let roll=w.random()*options.reduce((n,o)=>n+o.weight,0);
    for(const option of options){roll-=option.weight;if(roll<=0)return option.move;}return options.at(-1).move;
  }
  function aim(w,b){
    // Aim follows movement early, then commits before the strike. No homing turn during a hit.
    b.target={x:clamp(w.player.x+w.player.w/2+clamp(w.player.vx*.12,-40,40),55,w.level.width-55),y:w.player.y+w.player.h/2};
    b.facing=b.target.x>b.x+b.w/2?1:-1;
    if(b.move==='blink')b.target.x=clamp(b.target.x-b.facing*85,55,w.level.width-55);
  }
  function windup(w,b,move=chooseMove(w,b)){
    b.move=move;b.attackIndex++;b.recent.push(move);if(b.recent.length>2)b.recent.shift();b.readyAt[move]=w.elapsed+2.3;
    const delayed=['cut','charge','hammer','slam','breath','dance'].includes(move)&&w.random()<.3;
    b.state='windup';b.windupDuration=MOVES[move].windup*(b.phase===2?.88:1)+w.rand(0,.09)+(delayed?.24:0);b.timer=b.windupDuration;b.lockTime=.19;b.vx=0;aim(w,b);
  }
  function recover(w,b,heavy=false){
    // A bounded chain always ends with a real opening; recovery cannot be cancelled by input-reading.
    b.followup=b.chain<(b.phase===2?2:1)&&Math.abs(w.player.x-b.x)<720&&w.random()<(b.phase===2?.68:.42);
    b.state='recover';b.vx=0;b.timer=b.followup?w.rand(.25,.36):w.rand(heavy?.78:.56,heavy?1:.8);b.actionClock=0;
  }
  function melee(w,b){
    const dir=b.facing;hazard(w,b,'slash',{x:dir>0?b.x+b.w-4:b.x-125,y:b.y-8,w:129,h:b.h+16},0,.14);b.swingTime=.2;b.vx=dir*200;w.emit('enemySwing');
  }
  function rush(w,b){b.state='rush';b.timer=b.move==='dance'?.26:.34;b.vx=b.facing*(b.move==='dance'?780:850);b.swingTime=.25;w.emit('enemySwing');}
  function execute(w,b){
    const n=b.phase===2?1:0,tx=b.target.x,dir=b.facing;
    b.state='action';b.timer=.22;b.actionClock=0;b.swingTime=.24;b.vx=0;
    w.emit('enemySwing');
    switch(b.move){
      case 'cut':
        b.cutLeft=1+(w.random()<(n?.7:.3)?1:0);melee(w,b);b.state='cutRecover';b.timer=.21;break;
      case 'charge':case 'dance':
        b.rushLeft=b.move==='dance'?2+Math.floor(w.random()*(2+n)):1+(n&&w.random()<.6?1:0);rush(w,b);break;
      case 'blink':
        b.x=tx-b.w/2;b.y=FLOOR-b.h;b.vy=0;b.facing=w.player.x>b.x?1:-1;
        b.state='blinkTell';b.timer=.3;b.windupDuration=.3;b.swingTime=0;
        for(let i=0;i<12;i++)w.particles.push({x:b.x+w.rand(-18,55),y:b.y+w.rand(0,75),vx:w.rand(-60,60),vy:-50,size:5,life:.3,color:'#486c62',blood:false});break;
      case 'kunai':fan(w,b,3+n*2,.2);break;
      case 'frost':fan(w,b,3+n*2,.27,'ice');break;
      case 'petals':fan(w,b,5+n*2,.16,'petal');break;
      case 'hook':{
        const angle=Math.atan2(b.target.y-(b.y+31),tx-(b.x+b.w/2));shot(w,b,angle,540,{type:'hook'});break;
      }
      case 'anchor':area(w,b,tx-55,110,.15,370,'anchor');if(n)area(w,b,tx+145*dir,90,.42,370,'anchor');b.timer=.48;break;
      case 'waves':case 'bell':waves(w,b);if(n||b.move==='bell')waves(w,b,.52);b.timer=.57;break;
      case 'icicles':case 'beams':case 'verdict':{
        const type={icicles:'icefall',beams:'beam',verdict:'lightning'}[b.move],spacing=b.move==='beams'?210:175,width=b.move==='beams'?100:65;
        for(let i=-1-n;i<=1+n;i++)area(w,b,tx+i*spacing-width/2,width,(type==='lightning'?.38:.12)+Math.abs(i)*.14,430,type);
        b.timer=.55;break;
      }
      case 'freeze':for(let i=0;i<2+n;i++)area(w,b,tx-65+(i-1)*195,130,.4+i*.18,28,'frost',1.2);b.timer=.55;break;
      case 'lightning':b.sequence={left:3+n,clock:0};b.timer=1.45+n*.42;break;
      case 'mines':
        for(let i=-1;i<=1+n;i++)hazard(w,b,'mine',{x:clamp(tx+i*180-14,50,1720),y:FLOOR-18,w:28,h:18},.4,7,{armed:false});
        break;
      case 'hammer':case 'slam':
        b.state='leap';b.leapDuration=n?.56:.64;b.timer=b.leapDuration;b.leap={x:b.x,y:b.y,to:clamp(tx-b.w/2,35,1720)};
        area(w,b,tx-83,166,b.leapDuration,95,b.move==='slam'?'fire':'impact',.2);break;
      case 'blades':{
        const a=Math.atan2(b.target.y-(b.y+31),tx-(b.x+b.w/2));
        for(let i=0;i<2+n;i++)shot(w,b,a+(i-(1+n)/2)*.2,500,{type:'blade',returnAt:.72,life:1.75});b.timer=.35;break;
      }
      case 'eruption':for(let i=0;i<3+n;i++)area(w,b,tx-55+(i-1)*180,110,.38+i*.21,165,'fire',.35);b.timer=.75;break;
      case 'breath':hazard(w,b,'fire',{x:dir>0?b.x+b.w:b.x-360,y:b.y-18,w:360,h:b.h+18},0,.68);b.timer=.68;break;
    }
  }
  function update(w,b,dt){
    const p=w.player;
    for(const key of ['hitFlash','jumpCooldown','maneuverCooldown','decisionTime','swingTime'])b[key]=Math.max(0,b[key]-dt);
    b.timer-=dt;b.actionClock+=dt;b.speed=b.def.speed*(b.phase===2?1.08:1);
    if(b.state==='sleep'){
      if(p.x>340||b.hp<b.maxHp){b.state='recover';b.timer=.75;}return;
    }
    if(b.hp<=b.maxHp*.5&&b.phase===1){
      b.phase=2;b.state='recover';b.timer=.8;b.vx=0;b.sequence=null;b.chain=0;b.followup=false;w.bossHazards=[];w.emit('bossPhase');
    }
    if(b.sequence){b.sequence.clock-=dt;if(b.sequence.clock<=0){area(w,b,p.x-25,75,.38,440,'lightning');b.sequence.left--;b.sequence.clock=.42;if(!b.sequence.left)b.sequence=null;}}
    if(b.state==='leap'){
      const t=clamp(1-b.timer/b.leapDuration,0,1);b.x=b.leap.x+(b.leap.to-b.leap.x)*t;b.y=b.leap.y+(FLOOR-b.h-b.leap.y)*t-Math.sin(t*Math.PI)*225;
      if(t>=1){b.vy=0;w.shake=9;if(b.move==='slam')waves(w,b,.12);recover(w,b,true);}return;
    }
    if(b.state==='rush'){
      if(b.timer<=0){
        if(--b.rushLeft>0){b.state='rushTell';b.timer=w.rand(.29,.44);b.windupDuration=b.timer;b.vx=0;aim(w,b);}
        else recover(w,b,true);
      }else if(overlap({x:b.x-20,y:b.y,w:b.w+40,h:b.h},p))w.hurtPlayer(b.facing);
    }else if(['rushTell','cutTell','blinkTell'].includes(b.state)){
      b.vx=0;if(b.timer>.16)aim(w,b);
      if(b.timer<=0){
        if(b.state==='rushTell')rush(w,b);
        else{melee(w,b);if(b.state==='cutTell'){b.cutLeft--;b.state='cutRecover';b.timer=.18;}else{b.state='action';b.timer=.22;}}
      }
    }else if(b.state==='cutRecover'){
      b.vx*=Math.pow(.002,dt);
      if(b.timer<=0){if(b.cutLeft>0){b.state='cutTell';b.timer=w.rand(.26,.4);b.windupDuration=b.timer;aim(w,b);}else recover(w,b,true);}
    }else if(b.state==='windup'){
      if(b.timer>b.lockTime)aim(w,b);
      b.vx=MOVES[b.move].kind==='melee'&&b.timer>b.lockTime?b.facing*b.speed*.2:0;
      if(b.timer<=0)execute(w,b);
    }else if(b.state==='action'){
      b.vx*=Math.pow(.005,dt);if(b.timer<=0)recover(w,b,['anchor','beams','verdict','breath'].includes(b.move));
    }else if(b.state==='evade'){
      if(b.timer<=0)windup(w,b);
    }else if(b.state==='recover'||b.state==='stunned'){
      b.vx=0;
      if(b.timer<=0){
        if(b.followup){b.chain++;b.followup=false;windup(w,b);}
        else{b.chain=0;b.state='approach';b.timer=.8;b.decisionTime=w.rand(.07,.16);b.pendingMove=chooseMove(w,b);}
      }
    }else{
      b.facing=p.x>b.x?1:-1;const distance=Math.abs(p.x-b.x);
      if(b.decisionTime<=0&&b.grounded&&distance<b.def.spacing*.7&&b.maneuverCooldown<=0&&w.random()<b.def.evade){
        let direction=-b.facing;if(b.x+direction*140<30||b.x+direction*140>w.level.width-b.w-30)direction=b.facing;
        b.state='evade';b.timer=w.rand(.18,.25);b.vx=direction*b.speed*1.7;b.vy=-210;b.maneuverCooldown=w.rand(2.1,3.1);
      }else{
        w.pursue(b,p);
        const next=b.pendingMove||chooseMove(w,b),range=MOVES[next].kind==='melee'?190:650;
        if(b.decisionTime<=0&&((distance<range&&b.grounded)||b.timer<=0)){windup(w,b,distance>range?chooseMove(w,b):next);}
      }
    }
    b.vy=Math.min(1100,b.vy+2200*dt);w.move(b,dt);b.run+=Math.abs(b.vx)*dt*.03;
    if(b.grounded)b.jumpTarget=null;if(b.dropTarget!==null&&b.y+b.h>b.dropUntil)b.dropTarget=null;
  }
  function updateHazards(w,dt){
    if(!w.boss||w.boss.dead||w.status!=='playing'){w.bossHazards=[];return;}
    for(const h of w.bossHazards){
      if(h.delay>0){h.delay=Math.max(0,h.delay-dt);continue;}
      h.life-=dt;h.age+=dt;
      if(h.type==='mine'){
        if(!h.armed&&Math.abs(w.player.x+w.player.w/2-(h.x+h.w/2))<82&&w.player.y+w.player.h>FLOOR-90){
          h.armed=true;h.delay=.48;h.warning=.48;h.type='blast';h.x-=60;h.y-=80;h.w=148;h.h=98;h.life=.2;
        }continue;
      }
      if(h.type==='blade'&&!h.returning&&h.age>=h.returnAt){h.returning=true;h.vx*=-1;h.vy*=-1;h.hit=false;}
      const steps=Math.max(1,Math.ceil(Math.hypot(h.vx,h.vy)*dt/6));
      for(let i=0;i<steps;i++){
        h.x+=h.vx*dt/steps;h.y+=h.vy*dt/steps;
        if(h.falling&&h.y+h.h>=FLOOR){h.y=FLOOR-h.h;h.vy=0;h.life=Math.min(h.life,.12);}
        if(!h.hit&&overlap(h,w.player)&&w.hurtPlayer(Math.sign(w.player.x-h.owner.x)||1)){
          h.hit=true;if(h.type==='hook')w.player.vx=Math.sign(h.owner.x-w.player.x)*560;
        }
      }
    }
    w.bossHazards=w.bossHazards.filter(h=>h.life>0&&h.x>-500&&h.x<w.level.width+500&&h.y<820);
  }
  function disarm(w,box){
    for(const h of w.bossHazards)if((h.type==='mine'||h.type==='blast'&&h.delay>0)&&overlap(h,box)){h.life=0;w.sparks(h.x+h.w/2,FLOOR-15,1);w.emit('trapDisarmed');}
    w.bossHazards=w.bossHazards.filter(h=>h.life>0);
  }
  function drawHazards(ctx,w,cam){
    ctx.save();ctx.translate(-cam,0);
    for(const h of w.bossHazards){
      const warning=h.delay>0;ctx.fillStyle=h.color;ctx.strokeStyle=h.color;ctx.lineWidth=2;
      // Only physical objects and particles: no aiming lines, hitboxes, timers or warning glyphs.
      if(warning&&!h.falling&&h.type!=='mine'){
        ctx.globalAlpha=.65;
        if(h.type==='blast'){ctx.fillStyle='#65523f';ctx.fillRect(h.x+60,FLOOR-18,28,18);ctx.fillStyle=Math.sin(w.elapsed*35)>0?'#fff2ab':'#a85e3b';ctx.fillRect(h.x+71,FLOOR-22,6,5);}
        else if(['fire','frost','lightning'].includes(h.type)){
          const base=h.type==='lightning'?120:FLOOR;
          for(let i=0;i<4;i++)ctx.fillRect(h.x+h.w/2+Math.sin(w.elapsed*15+i*3)*16,base-5-(w.elapsed*40+i*7)%22,3,3);
        }
        continue;
      }
      if(h.type==='mine'){
        ctx.globalAlpha=1;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle='#301d29';ctx.fillRect(h.x+5,h.y+5,h.w-10,6);ctx.fillStyle='#fff0c4';ctx.fillRect(h.x+11,h.y-4,6,5);
      }else if(['bolt','ice','hook','blade','petal'].includes(h.type)){
        ctx.globalAlpha=1;ctx.save();ctx.translate(h.x+h.w/2,h.y+h.h/2);ctx.rotate(h.type==='blade'?h.age*18:Math.atan2(h.vy,h.vx));
        ctx.fillRect(-13,-3,26,6);if(h.type==='blade')ctx.fillRect(-3,-13,6,26);if(h.type==='hook'){ctx.fillRect(5,-3,5,15);ctx.fillRect(-3,8,12,5);}ctx.restore();
      }else if(['anchor','beam','icefall'].includes(h.type)){
        const y=h.y,cx=h.x+h.w/2;ctx.globalAlpha=1;
        if(h.type==='beam'){ctx.fillStyle='#a8885f';ctx.fillRect(h.x,y,h.w,35);ctx.fillStyle='#4f4135';ctx.fillRect(h.x,y+13,h.w,5);ctx.fillRect(h.x+12,y,6,35);ctx.fillRect(h.x+h.w-18,y,6,35);}
        else if(h.type==='anchor'){ctx.fillRect(cx-4,y,8,82);ctx.fillRect(cx-34,y+76,68,8);ctx.fillRect(cx-38,y+53,8,30);ctx.fillRect(cx+30,y+53,8,30);ctx.fillRect(cx-18,y+13,36,6);}
        else{ctx.beginPath();ctx.moveTo(cx-h.w/2,y);ctx.lineTo(cx+h.w/2,y);ctx.lineTo(cx,y+h.h);ctx.closePath();ctx.fill();ctx.fillStyle='#ffffff';ctx.fillRect(cx-3,y+5,4,40);}
      }else if(h.type==='lightning'){
        ctx.globalAlpha=1;ctx.lineWidth=6;ctx.beginPath();
        for(let i=0;i<=8;i++){const x=h.x+h.w/2+(i%2?20:-15),y=h.y+h.h*i/8;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
        ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(h.x+h.w/2,h.y+h.h*.6);ctx.lineTo(h.x+5,h.y+h.h*.8);ctx.lineTo(h.x+h.w-5,FLOOR);ctx.stroke();
      }else if(h.type==='slash'||h.type==='wave'){
        ctx.globalAlpha=.8;ctx.lineWidth=h.type==='slash'?8:5;ctx.beginPath();ctx.ellipse(h.x+h.w/2,h.y+h.h/2,h.w/2,h.h/2,0,-Math.PI*.85,Math.PI*.85);ctx.stroke();
      }else if(h.type==='frost'){
        ctx.globalAlpha=.9;for(let x=0;x<h.w;x+=20){ctx.beginPath();ctx.moveTo(h.x+x,FLOOR);ctx.lineTo(h.x+x+10,h.y);ctx.lineTo(h.x+x+20,FLOOR);ctx.closePath();ctx.fill();}
      }else if(h.type==='fire'){
        ctx.globalAlpha=.9;
        for(let x=0;x<h.w;x+=24){const height=h.h*(.6+.3*Math.sin(x+h.age*25));ctx.fillStyle=x%48?'#ffd087':'#f48453';ctx.fillRect(h.x+x,h.y+h.h-height,15,height);ctx.fillRect(h.x+x+4,h.y+h.h-height-9,7,12);}
      }else{
        ctx.globalAlpha=clamp(1-h.age/h.duration,0,1);
        for(let i=0;i<12;i++){const spread=(i-5.5)*h.w/12;ctx.fillRect(h.x+h.w/2+spread*(.4+h.age*4),FLOOR-Math.sin((i+1)*2)*h.age*230-8,6,6);}
      }
    }
    ctx.restore();
  }
  function drawActor(ctx,b,time){
    const d=b.def,region=DEFS.indexOf(d);ctx.save();ctx.translate(Math.round(b.x+b.w/2),Math.round(b.y));ctx.scale(b.facing,1);
    const preparing=['windup','cutTell','rushTell','blinkTell'].includes(b.state),kind=MOVES[b.move]?.kind;
    const charge=preparing?clamp(1-b.timer/(b.windupDuration||.5),0,1):0,release=clamp(b.swingTime/.24,0,1);
    const crouch=preparing&&['rush','leap'].includes(kind)?8*charge:0;
    ctx.translate(0,crouch);ctx.rotate(b.state==='rush'?.16:b.state==='evade'?-.12:preparing?(kind==='shot'?-.09:-.13)*charge:release*.13);
    const color=b.hitFlash>0?'#fff4df':d.armor,light=d.color,step=Math.abs(b.vx)>20?Math.sin(b.run)*6:0;
    const block=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);ctx.fillStyle='#ffffff22';ctx.fillRect(x,y,w,3);ctx.fillStyle='#00000038';ctx.fillRect(x+w-4,y,4,h);};
    // Distinct silhouettes: heavy armour, scarf, captain coat, hood, halo, miner helmet, fans, horns.
    block(-17,53,13,25-step,'#252b3e');block(5,53,13,25+step,'#252b3e');block(-23,22,46,35,color);
    block(-16,0,32,23,color);block(-13,8,28,11,'#cfb9a3');block(2,10,14,4,light);block(-24,49,48,7,light);
    block(-29,25,10,25,color);block(22,25,11,25,color);
    if(region===0||region===7){block(-28,15,18,15,color);block(14,15,20,15,color);block(-19,-12,7,16,light);block(14,-12,7,16,light);}
    if(region===1){for(let i=0;i<5;i++)block(-22-i*12,15+Math.sin(time*8-i)*5,16,7,light);block(-18,-4,36,9,'#243f3b');}
    if(region===2){block(-29,-7,58,9,'#263949');block(-17,-18,34,13,'#263949');block(-26,48,16,22,color);block(12,48,16,22,color);}
    if(region===3){block(-20,-7,40,10,light);block(-23,0,9,32,light);block(-26,49,52,12,light);}
    if(region===4){ctx.strokeStyle=light;ctx.lineWidth=4;ctx.strokeRect(-30,-24,60,58);block(-10,-8,20,8,light);block(-24,51,48,19,color);}
    if(region===5){block(-22,-8,44,10,'#ae8a4b');block(1,-8,12,10,'#fff4b2');block(-28,24,58,8,'#534035');}
    if(region===6){block(-24,46,48,17,color);block(-27,-5,12,13,light);block(18,-3,13,11,light);}
    ctx.save();ctx.translate(29,31);
    const raised=kind==='area'||kind==='wave'||kind==='leap';
    ctx.rotate(preparing?(kind==='shot'?-.1:raised?-1.25*charge:-1.7*charge):release?-.9+(1-release)*2.4:b.state==='rush'?.25:-.2);
    if(region===2){block(0,-30,6,86,light);block(-20,37,46,8,light);block(-25,23,7,20,light);block(22,23,7,20,light);}
    else if(region===3){ctx.strokeStyle=light;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(22,0);ctx.lineTo(0,33);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(0,33);ctx.stroke();}
    else if(region===4){block(4,-53,5,94,'#b9a07f');block(-8,-52,30,23,light);}
    else if(region===5){block(0,-28,7,73,'#bca687');block(-18,-37,45,25,light);}
    else if(region===6){block(0,-4,55,6,light);block(-65,-21,47,6,light);}
    else{block(0,0,15,5,'#c69b77');block(13,-5,5,15,light);block(18,-1,region===1?38:69,7,light);}
    ctx.restore();
    if(b.phase===2){ctx.fillStyle=light;for(let i=0;i<5;i++)ctx.fillRect(-32+i*16,71+Math.sin(time*8+i)*5,4,4);}
    ctx.restore();
  }
  const api={DEFS,MOVES,extendLevels,create,chooseMove,update,updateHazards,disarm,drawActor,drawHazards};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BushidoBosses=api;
})(typeof window!=='undefined'?window:globalThis);
