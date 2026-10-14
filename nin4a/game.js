(function () {
  'use strict';
  const {World,LEVELS,WEAPONS,BUFFS,clamp}=window.KageCore;
  const $=id=>document.getElementById(id);
  const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
  const screens={menu:$('menu-screen'),hub:$('hub-screen'),work:$('work-screen'),pause:$('pause-screen'),result:$('result-screen')};
  const input={left:false,right:false};
  const held=new Set();
  let mode='menu',world=new World(0),camera=0,viewW=1280,scale=1,dpr=1,time=0,last=0,accumulator=0,toastTime=0;
  let soundEnabled=false,blood=1,reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let audioCtx=null,audioMaster=null;
  try{blood=localStorage.getItem('kage-blood')==='low'?0:1;soundEnabled=localStorage.getItem('kage-sound')==='on';}catch{}
  world.blood=blood;
  let storage=null;try{storage=window.localStorage;}catch{}
  const campaign=new window.KageCampaign.Campaign(storage);
  const touches=new Set();
  const rain=Array.from({length:115},(_,i)=>({x:hash(i*2)*2200,y:hash(i*2+1)*800,speed:420+hash(i+150)*380,len:9+hash(i+4)*14}));
  function hash(n){const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.closePath();ctx.fill();}
  function box(x,y,w,h,front,top,side,depth=4){rect(x,y,w,h,front);poly([[x,y],[x+depth,y-depth],[x+w+depth,y-depth],[x+w,y]],top);poly([[x+w,y],[x+w+depth,y-depth],[x+w+depth,y+h-depth],[x+w,y+h]],side);}
  function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function resize(){dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);scale=innerHeight/720;viewW=innerWidth/scale;ctx.imageSmoothingEnabled=false;}
  addEventListener('resize',resize);resize();

  function initAudio(){
    if(audioCtx)return;
    try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioMaster=audioCtx.createGain();audioMaster.gain.value=soundEnabled?.35:0;audioMaster.connect(audioCtx.destination);}catch{}
  }
  function tone(freq,duration=.1,type='sine',volume=.16,end=0){
    if(!soundEnabled||!audioCtx)return;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(),now=audioCtx.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,now);if(end)o.frequency.exponentialRampToValueAtTime(end,now+duration);
    g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);
    o.connect(g);g.connect(audioMaster);o.start();o.stop(now+duration);
  }
  function noise(duration,volume,lowpass=1800){
    if(!soundEnabled||!audioCtx)return;
    const frames=Math.floor(audioCtx.sampleRate*duration),buffer=audioCtx.createBuffer(1,frames,audioCtx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
    const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=lowpass;g.gain.value=volume;source.connect(filter);filter.connect(g);g.connect(audioMaster);source.start();
  }
  function playEvent(event){
    switch(event.type){
      case 'swing':noise(.12,.4,3600);tone(390,.08,'triangle',.09,110);break;
      case 'hit':noise(event.kill?.22:.12,.8,1100);tone(event.kill?105:160,.14,'triangle',.38,40);break;
      case 'jump':tone(event.second?280:200,.12,'sine',.16,event.second?560:350);break;
      case 'dash':noise(.19,.36,2400);tone(210,.13,'sine',.1,70);break;
      case 'hurt':noise(.18,.65,700);tone(140,.2,'sawtooth',.17,40);break;
      case 'enemySwing':noise(.1,.18,2100);break;
      case 'clear':tone(440,.5,'sine',.23);setTimeout(()=>tone(660,.6,'sine',.2),140);setTimeout(()=>tone(880,.8,'sine',.17),280);break;
      case 'dead':tone(150,.7,'sawtooth',.18,35);break;
      case 'revive':tone(440,.5,'sine',.25,880);document.querySelector('.vignette').classList.add('revive-flash');setTimeout(()=>document.querySelector('.vignette').classList.remove('revive-flash'),700);$('live-status').textContent='Второе дыхание: ты воскрес. Заряд потрачен.';break;
    }
  }
  function updateSoundButton(){
    $('audio-button').classList.toggle('audio-on',soundEnabled);$('audio-button').setAttribute('aria-pressed',String(soundEnabled));
    $('audio-button').setAttribute('aria-label',soundEnabled?'Выключить звук':'Включить звук');$('audio-button').title=soundEnabled?'Выключить звук':'Включить звук';
  }
  function updateBloodButton(){$('blood-button').innerHTML=`КРОВЬ: <strong>${blood?'МНОГО':'МЕНЬШЕ'}</strong> <span>↔</span>`;}
  updateSoundButton();updateBloodButton();
  $('audio-button').addEventListener('click',()=>{soundEnabled=!soundEnabled;initAudio();if(audioCtx){audioCtx.resume();audioMaster.gain.value=soundEnabled?.35:0;}updateSoundButton();try{localStorage.setItem('kage-sound',soundEnabled?'on':'off');}catch{}tone(620,.09);});
  $('blood-button').addEventListener('click',()=>{blood=1-blood;world.blood=blood;updateBloodButton();try{localStorage.setItem('kage-blood',blood?'high':'low');}catch{}});

  function clearInput(){held.clear();touches.clear();input.left=false;input.right=false;}
  function setMode(next){
    mode=next;clearInput();
    for(const [name,element] of Object.entries(screens))element.classList.toggle('hidden',name!==next);
    $('hud').classList.toggle('hidden',!['playing','pause','result'].includes(next));
    $('pause-button').classList.toggle('hidden',next!=='playing'&&next!=='pause');
    $('controls-strip').classList.toggle('hidden',next!=='playing');
    $('touch-controls').classList.toggle('hidden',next!=='playing'||!matchMedia('(pointer:coarse)').matches);
    if(next==='playing')canvas.focus({preventScroll:true});
    else if(next==='pause')$('resume-button').focus({preventScroll:true});
    else if(next==='result')$('next-button').focus({preventScroll:true});
    else if(next==='menu')$('start-button').focus({preventScroll:true});
    else if(next==='hub'){$(hub.tab+'-tab').focus({preventScroll:true});hub.refresh();}
    else if(next==='work')$(campaign.work.phase==='ready'?'work-map-button':'work-start-button').focus({preventScroll:true});
  }
  function startLevel(index){
    const entry=campaign.beginRaid(index);if(!entry){showWork();return;}
    updateDayLabels();
    initAudio();if(audioCtx)audioCtx.resume();
    world=new World(index,{blood,...entry});camera=0;accumulator=0;toastTime=1.8;
    $('level-number').textContent=`ГЛАВА ${String(index+1).padStart(2,'0')} / 03`;
    $('level-name').textContent=world.level.name;
    $('equipped-control').textContent=world.weapon.name.toUpperCase();
    $('chapter-toast-small').textContent=`ГЛАВА ${String(index+1).padStart(2,'0')}`;
    $('chapter-toast-title').textContent=world.level.name;
    $('chapter-toast').querySelector('em').textContent=world.level.subtitle;
    $('chapter-toast').classList.remove('hidden');
    $('live-status').textContent=`${world.level.name}. Устраните ${world.enemies.length} врагов.`;
    setMode('playing');updateHUD();
  }
  function pause(){if(mode==='playing')setMode('pause');else if(mode==='pause')setMode('playing');}
  function showResult(){
    const dead=world.status==='dead',offer=dead?null:campaign.raidOffer(world.levelIndex),reward=campaign.claimRaid(world),final=!dead&&campaign.clears.every(count=>count>0);
    if(dead)campaign.abandonRaid();
    updateDayLabels();hub.refresh();
    $('result-seal').textContent=dead?'死':'斬';
    $('result-eyebrow').textContent=dead?'ТЕНЬ ТОЖЕ МОЖЕТ УПАСТЬ':final?'НОЧЬ ПРИНАДЛЕЖИТ ТЕБЕ':'НИ ОДНОГО СВИДЕТЕЛЯ';
    $('result-title').innerHTML=dead?'Ещё одна<br>попытка<span>.</span>':final?'Город стал тише<span>.</span>':'Набег завершён<span>.</span>';
    $('result-description').textContent=dead?'Один удар — один шанс. Завтра новая смена и новый набег.':final?'Все три группировки побеждены. Возвращайся за новыми трофеями.':world.level.name+' затих. '+(reward?'Добыча уже в твоём кошельке.':'На этот раз тяирэ не нашлось.');
    $('stat-kills').textContent=world.kills+' / '+world.enemies.length;
    $('stat-time').textContent=formatTime(world.elapsed);$('stat-combo').textContent='× '+world.bestCombo;
    $('result-reward').classList.toggle('hidden',dead);
    $('result-reward').classList.toggle('empty-loot',!reward);
    $('result-loot-note').classList.toggle('hidden',dead);
    $('result-loot-note').textContent=dead?'':'Шанс добычи был '+offer.chance+'%. '+(reward?(offer.multiplier===2?'Найдено '+reward/2+' ×2 = '+reward+' тяирэ. ':'')+'Бонус за пустые зачистки сброшен.':'Следующий набег: +'+campaign.pityBonus+' п.п. за пустые зачистки, до 100%.');
    $('reward-balance').textContent='Баланс: '+campaign.balance;
    $('reward-amount').textContent=reward?'+'+reward+' тяирэ':'Без добычи';
    $('next-button').innerHTML='СЛЕДУЮЩИЙ ДЕНЬ'+' <span>→</span>';
    $('chapter-toast').classList.add('hidden');$('live-status').textContent=dead?'Вы погибли. Награда не получена.':'Набег завершён. Получено '+reward+' тяирэ. Баланс: '+campaign.balance;
    setMode('result');
  }
  function formatTime(value){const s=Math.floor(value);return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function menu(){if(campaign.work.phase==='raid')campaign.abandonRaid();toastTime=0;$('chapter-toast').classList.add('hidden');updateDayLabels();setMode('menu');}
  const hub=new window.KageHub({campaign,levels:LEVELS,weapons:WEAPONS,onRaid:startLevel,onMenu:menu});
  const kitchen=new window.KageKitchenUI({campaign,onMap:()=>showHub(),onMenu:menu,isActive:()=>mode==='work',onFinish:()=>{hub.refresh();updateDayLabels();}});
  function updateDayLabels(){$('top-day-label').textContent='ДЕНЬ '+String(campaign.work.day).padStart(2,'0');$('start-label').textContent=campaign.work.phase==='ready'?'ПОДГОТОВИТЬ НАБЕГ':'НАЧАТЬ ДЕНЬ';}
  function showWork(){if(campaign.work.phase==='raid')campaign.abandonRaid();kitchen.open();updateDayLabels();setMode('work');$('work-screen').scrollTop=0;}
  function showHub(tab='map'){toastTime=0;$('chapter-toast').classList.add('hidden');hub.show(tab);setMode('hub');}
  $('start-button').onclick=()=>campaign.work.phase==='ready'?showHub():showWork();$('pause-button').onclick=pause;$('resume-button').onclick=pause;
  $('restart-button').onclick=()=>{campaign.abandonRaid();showWork();};$('menu-button').onclick=()=>{campaign.abandonRaid();updateDayLabels();showHub();};$('result-menu-button').onclick=menu;
  $('brand').onclick=e=>{e.preventDefault();if(mode==='playing')pause();else if(mode!=='menu')menu();};
  $('next-button').onclick=showWork;
  updateDayLabels();

  function updateMovement(){input.left=held.has('KeyA')||held.has('ArrowLeft')||touches.has('left');input.right=held.has('KeyD')||held.has('ArrowRight')||touches.has('right');}
  const actionCodes=new Set(['Space','ArrowUp','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD','KeyJ','KeyX','KeyK','ShiftLeft','ShiftRight','Escape']);
  addEventListener('keydown',e=>{
    if(mode==='playing'&&actionCodes.has(e.code))e.preventDefault();
    if(e.code==='Escape'){e.preventDefault();if(e.repeat)return;if(mode==='playing'||mode==='pause')pause();else if(mode==='hub'){if(hub.tab==='shop')hub.show('map');else menu();}else if(mode==='work')kitchen.togglePause();return;}
    if(mode!=='playing'||e.repeat)return;
    held.add(e.code);updateMovement();
    if(['Space','ArrowUp','KeyW'].includes(e.code))world.jump();
    if(['KeyJ','KeyX'].includes(e.code))world.attack();
    if(['ShiftLeft','ShiftRight','KeyK'].includes(e.code))world.dash();
  });
  addEventListener('keyup',e=>{held.delete(e.code);updateMovement();});
  canvas.addEventListener('pointerdown',e=>{if(mode==='playing'&&e.button===0){e.preventDefault();world.attack();canvas.focus({preventScroll:true});}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('blur',()=>{clearInput();if(mode==='playing')setMode('pause');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')setMode('pause');});
  for(const button of document.querySelectorAll('[data-control]')){
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(mode!=='playing')return;button.setPointerCapture(e.pointerId);
      const action=button.dataset.control;touches.add(action);updateMovement();
      if(action==='jump')world.jump();else if(action==='attack')world.attack();else if(action==='dash')world.dash();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{touches.delete(button.dataset.control);updateMovement();});
  }

  function updateHUD(){
    const p=world.player;
    if($('health').dataset.hp!==p.hp+'/'+p.maxHp){
      $('health').dataset.hp=p.hp+'/'+p.maxHp;$('health').innerHTML=Array.from({length:p.maxHp},(_,i)=>`<i class="health-segment${i>=p.hp?' empty':''}"></i>`).join('');$('health-label').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
    }
    $('active-buff').classList.toggle('hidden',!world.buff);$('active-buff-caption').classList.toggle('hidden',!world.buff);
    if(world.buff){const buff=BUFFS[world.buff];$('active-buff-icon').textContent=buff.icon;$('active-buff-icon').style.color=buff.color;$('active-buff-name').textContent=buff.name;$('active-buff-caption').textContent=world.buff==='revive'?(p.revives?'ВОСКРЕШЕНИЕ: 1':'ВОСКРЕШЕНИЕ ПОТРАЧЕНО'):buff.description;}
    $('remaining').textContent=String(world.enemies.length-world.kills).padStart(2,'0');
    $('level-fill').style.width=`${world.kills/world.enemies.length*100}%`;
    $('dash-fill').style.width=`${clamp(1-p.dashCooldown/.82,0,1)*100}%`;
    $('dash-label').textContent=p.dashCooldown>0?'РЫВОК ЗАРЯЖАЕТСЯ':'РЫВОК ГОТОВ';
    $('combo').classList.toggle('hidden',world.combo<2);$('combo-number').textContent=`${world.combo}×`;
    const alive=world.enemies.filter(e=>!e.dead);
    const visible=alive.some(e=>e.x>camera+20&&e.x<camera+viewW-20);
    const direction=$('enemy-direction');
    if(!visible&&alive.length&&toastTime<=0){
      const closest=alive.reduce((a,b)=>Math.abs(a.x-p.x)<Math.abs(b.x-p.x)?a:b);
      direction.classList.remove('hidden');direction.textContent=closest.x<p.x?'← ВРАГИ СЛЕВА':'ВРАГИ СПРАВА →';
      direction.style.left=closest.x<p.x?'28px':'auto';direction.style.right=closest.x<p.x?'auto':'28px';
    }else direction.classList.add('hidden');
  }

  function background(cam,isMenu){
    const gradient=ctx.createLinearGradient(0,0,0,720);gradient.addColorStop(0,'#0b1120');gradient.addColorStop(.55,'#202332');gradient.addColorStop(1,'#1a2532');ctx.fillStyle=gradient;ctx.fillRect(0,0,viewW,720);
    const mx=viewW*(isMenu?.71:.73)-cam*.028,my=190;
    glow(mx,my,240,'#b9415120');
    // A stepped silhouette keeps even the moon in the voxel world.
    const radius=83;
    for(let yy=-radius;yy<radius;yy+=6){const half=Math.sqrt(Math.max(0,radius*radius-yy*yy));rect(mx-Math.floor(half/6)*6,my+yy,Math.floor(half/6)*12,6,yy>20?'#b75060':yy>-32?'#cd6270':'#d4757f');}
    for(let i=0;i<16;i++){const x=mx-63+hash(i+99)*118,y=my-65+hash(i+10)*125;if((x-mx)**2+(y-my)**2<radius*radius-700)rect(x,y,9+hash(i)*19,6+hash(i+14)*16,'#af4c5b35');}
    // Layered block mountains and distant rooftops.
    for(let layer=0;layer<3;layer++){
      const segment=layer===0?160:layer===1?115:85,parallax=.07+layer*.11,base=350+layer*67;
      const colors=['#171d2b','#192330','#1d2935'];
      for(let i=-3;i<Math.ceil(viewW/segment)+5;i++){
        const id=i+Math.floor(cam*parallax/segment),x=i*segment-(cam*parallax%segment),height=45+hash(id+layer*80)*100;
        rect(x,base-height,segment+1,720-base+height,colors[layer]);
        if(layer>0){
          poly([[x-9,base-height+5],[x+segment*.25,base-height-14],[x+segment*.8,base-height-14],[x+segment+12,base-height+5]],colors[layer]);
          rect(x+segment*.5,base-height-38,4,25,colors[layer]);
        }
        if(layer===2){
          for(let j=0;j<3;j++)if(hash(id*5+j)>.54)rect(x+14+j*22,base-height+19,7,14,'#b878643b');
        }
      }
    }
    // Thin cloud bands travel across the moon.
    for(let i=0;i<6;i++){const x=((hash(i+71)*2200+time*(4+i*.3)-cam*.04)%(viewW+400))-200,y=130+i*39;rect(x,y,130+hash(i+87)*250,7,'#10182760');rect(x+32,y-5,110,5,'#121a2850');}
    for(let i=0;i<32;i++){const x=((hash(i+340)*2200-cam*.17)%(viewW+40)+viewW+40)%(viewW+40);rect(x,270+hash(i+301)*230,2,3,'#8c59693b');}
    distantPagoda(viewW*.83-cam*.18,490,.72);
    distantPagoda(viewW*.28-cam*.12,459,.47);
    const fog=ctx.createLinearGradient(0,360,0,625);fog.addColorStop(0,'#3b536400');fog.addColorStop(1,'#42607522');ctx.fillStyle=fog;ctx.fillRect(0,360,viewW,265);
  }
  function distantPagoda(x,y,s){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    for(let i=0;i<4;i++){const w=150-i*28,yy=-i*57;rect(-w*.38,yy-50,w*.76,55,'#121e2a');rect(-w*.31,yy-43,w*.62,3,'#3c4350');poly([[-w*.67,yy-43],[-w*.43,yy-51],[-w*.30,yy-65],[w*.30,yy-65],[w*.43,yy-51],[w*.67,yy-43]],'#111c28');rect(-w*.65,yy-43,w*1.3,5,'#303242');for(let j=-1;j<=1;j++)rect(j*23-4,yy-29,8,14,'#9b575142');}
    rect(-2,-273,4,38,'#171b29');ctx.restore();
  }
  function torii(x,y,s=1,lit=false){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    const red=lit?'#97404c':'#673342',bright=lit?'#c25b60':'#95414e';
    box(-91,-262,15,262,red,bright,'#3e2937',7);box(77,-262,15,262,red,bright,'#3e2937',7);
    box(-97,-25,28,25,'#302837','#5c3b48','#19232c');box(71,-25,28,25,'#302837','#5c3b48','#19232c');
    box(-120,-245,241,15,red,bright,'#422633',7);box(-139,-280,277,21,red,bright,'#422633',7);
    poly([[-153,-292],[-127,-280],[125,-280],[151,-292],[144,-269],[-147,-269]],'#252331');
    rect(-130,-281,264,4,'#a34953');box(-12,-263,24,62,'#242331','#b46558','#191e29',3);rect(-7,-252,14,33,'#ba7b62');
    ctx.font='17px serif';ctx.fillStyle='#542e39';ctx.fillText('影',-8,-231);
    ctx.strokeStyle='#766053';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-80,-221);ctx.quadraticCurveTo(0,-184,85,-221);ctx.stroke();
    for(let j=-2;j<=2;j++){const xx=j*27,yy=-205+Math.abs(j)*-3;poly([[xx,yy],[xx+6,yy+2],[xx+3,yy+10],[xx+9,yy+12],[xx+3,yy+21],[xx-2,yy+16],[xx+1,yy+8],[xx-4,yy+7]],'#b8ada075');}
    ctx.restore();
  }
  function lantern(x,y,size=1){
    glow(x,y,62*size,'#ed7c4d17');glow(x,y,29*size,'#fa795332');
    rect(x-1,y-40*size,2,27*size,'#262735');box(x-9*size,y-15*size,18*size,29*size,'#be4d49','#ee8b67','#6b3440',3*size);rect(x-6*size,y-12*size,10*size,23*size,'#eb8660');
    rect(x-10*size,y-16*size,21*size,4*size,'#392c36');rect(x-10*size,y+12*size,21*size,4*size,'#392c36');rect(x-2*size,y+17*size,3*size,10*size,'#a75653');
    for(let i=0;i<3;i++)rect(x-9*size,y+(-7+i*7)*size,19*size,1*size,'#7e404866');
  }
  function scenery(cam,isMenu){
    if(isMenu){
      torii(viewW*.72,582,1.05,true);lantern(viewW*.72-117,386,.85);lantern(viewW*.72+120,386,.85);
      drawTree(viewW*.91,585,1.1);drawTree(viewW*.47,580,.6);
      drawBuilding(viewW*.43,582,150,177,13);
    }else{
      for(let x=180;x<world.level.width;x+=520){
        const sx=x-cam;if(sx < -400||sx>viewW+300)continue;
        drawBuilding(sx,582,180+hash(x)*100,150+hash(x+1)*130,x);
      }
      torii(world.level.exit-cam,582,1,true);
      drawTree(60-cam,582,.88);drawTree(world.level.exit+160-cam,584,1.2);
    }
  }
  function drawBuilding(x,y,w,h,seed){
    rect(x,y-h,w,h,'#1b242f');rect(x+7,y-h+11,w-14,h-11,'#232b35');
    for(let i=1;i<5;i++)rect(x+i*w/5,y-h+8,5,h-8,'#141e2a');
    for(let row=0;row<3;row++){
      rect(x,y-h+row*48+20,w,4,'#15202d');
      for(let col=0;col<4;col++)if(hash(seed+row*5+col)>.48){const xx=x+14+col*(w-20)/4,yy=y-h+row*48+27;rect(xx,yy,24,29,'#78524c');rect(xx+3,yy+3,18,23,'#b47a5842');rect(xx+11,yy,2,29,'#2c2b34');rect(xx,yy+13,24,2,'#2c2b34');}
    }
    poly([[x-23,y-h+8],[x-6,y-h-3],[x+w/2,y-h-44],[x+w+6,y-h-3],[x+w+23,y-h+8]],'#18212c');rect(x-23,y-h+6,w+46,5,'#44515a');rect(x-18,y-h+11,w+36,4,'#111b28');
    for(let j=0;j<9;j++)rect(x-5+j*w/8,y-h+1,10,3,'#5a566033');
    if(hash(seed+9)>.4)lantern(x+w-21,y-h+53,.63);
  }
  function drawTree(x,y,s){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    poly([[-13,0],[-11,-100],[1,-165],[-5,-235],[7,-250],[15,-155],[10,-92],[20,0]],'#151c2a');
    poly([[4,-139],[-53,-185],[-83,-188],[-106,-215],[-71,-197],[-37,-200],[11,-162]],'#171e2b');
    poly([[5,-183],[60,-226],[107,-239],[57,-214],[8,-164]],'#171e2b');
    for(let i=0;i<27;i++){const xx=-126+hash(i+11)*245,yy=-260+hash(i+231)*75;box(xx,yy,20+hash(i)*42,8+hash(i+1)*13,i%3===0?'#633746':'#422d3d','#69404d','#2e2536',4);}
    ctx.restore();
  }
  function drawPlatform(s,cam){
    const x=s.x-cam,y=s.y,w=s.w;
    if(x+w < -30||x>viewW+30)return;
    if(s.kind==='ground'){
      box(x,y,w,s.h,'#1c2633','#63737a','#0e1724',8);
      rect(x,y,w,4,'#78838a');rect(x,y+5,w,9,'#384352');rect(x,y+15,w,4,'#131f2c');
      for(let row=0;row<4;row++)for(let col=0;col<Math.ceil(w/45);col++){
        const offset=row%2?22:0,xx=x+col*45-offset,yy=y+23+row*30;
        rect(Math.max(x,xx),yy,Math.min(42,w-(xx-x)),27,row%2?'#222e3b':'#25313e');
        if(hash(col+row*31+s.x)>.6)rect(Math.max(x,xx)+4,yy+3,30,2,'#394452');
      }
      for(let i=0;i<w/72;i++){const xx=x+i*72+13;rect(xx,y-2,18+hash(i+s.x)*22,2,'#a4b2af4f');}
    }else{
      box(x,y,w,24,'#29323f','#60717b','#18222f',7);rect(x-7,y,w+14,5,'#78888c');rect(x-3,y+6,w+6,5,'#374553');rect(x,y+20,w,5,'#151e2c');
      for(let i=0;i<w/24;i++){rect(x+i*24,y+3,2,8,'#202d3e');rect(x+i*24+3,y-4,13,2,'#a3a5a64a');}
      box(x+14,y+25,9,582-y-25,'#29303c','#45404a','#192331',3);box(x+w-25,y+25,9,582-y-25,'#29303c','#45404a','#192331',3);
      rect(x+17,y+49,w-41,5,'#302f3d');
      if(w>205)lantern(x+w-42,y+50,.65);
    }
  }

  function character(actor,isPlayer=false,alpha=1){
    const baseX=actor.x,baseY=actor.y,unit=actor.h/52,face=actor.facing||1;
    ctx.save();ctx.translate(Math.round(baseX+actor.w/2),Math.round(baseY));ctx.scale(face*unit,unit);ctx.globalAlpha=alpha;
    const flash=actor.hitFlash>0;
    const upgraded=isPlayer&&actor.weaponId==='akatsuki';
    const element=isPlayer?actor.element:null;
    const front=flash?'#f9d9ca':isPlayer?'#1b2935':actor.type==='brute'?'#713f4f':'#6b354b';
    const top=flash?'#fff5e5':isPlayer?'#455561':'#986171';
    const side=flash?'#f3b6b5':isPlayer?'#101e2b':'#3c283c';
    const moving=Math.abs(actor.vx||0)>20&&actor.grounded,step=moving?Math.sin(actor.run)*7:0;
    const crouch=actor.dashTime>0?10:0,tilt=actor.dashTime>0?.35:0;
    ctx.translate(0,crouch);ctx.rotate(tilt);
    if(isPlayer){
      const trail=actor.dashTime>0?16:0;
      for(let i=4;i>=0;i--){const yy=18+Math.sin(time*7-i*.8)*3+i*.7;box(-15-i*(6+trail*.08),yy,9,5,i%2?'#b83048':'#df4558','#ec5c65','#72243b',2);}
    }
    box(-10,34+Math.min(0,step),8,15-step*.3,side,top,'#13202e',3);
    box(3,34+Math.min(0,-step),8,15+step*.3,front,top,side,3);
    box(-12,47-step*.4,12,5,'#101c27','#47505b','#0b1422',2);box(3,47+step*.4,13,5,'#101c27','#47505b','#0b1422',2);
    box(-12,17,24,19,front,top,side,4);
    if(!isPlayer){rect(-12,22,24,3,'#aa7f743d');rect(-10,30,22,3,'#272435');box(-16,17,9,7,front,top,side,3);if(actor.type==='brute')box(10,16,10,8,front,top,side,4);}
    rect(-12,33,25,5,isPlayer?'#bd354a':'#292838');rect(-2,33,4,5,isPlayer?'#e25a61':'#9f7472');
    box(-9,0,19,17,isPlayer?'#1c2834':'#382d40',isPlayer?'#4f5c64':'#86616b','#15202c',4);
    if(isPlayer){rect(-10,5,22,4,'#cb3a50');rect(1,10,12,4,'#d5d7c7');rect(3,11,3,2,'#18232c');}
    else{rect(-8,6,19,10,'#9b8d8c');rect(0,8,12,3,'#24232e');rect(3,8,5,2,actor.state==='windup'?'#ffb380':'#ef6374');rect(-5,15,15,3,'#493344');if(actor.type==='brute'){rect(-13,0,26,5,'#6c3d4d');box(-15,-5,5,9,'#b9a28f','#d8c7a9','#68505c',2);box(10,-5,5,9,'#b9a28f','#d8c7a9','#68505c',2);}}
    const attacking=isPlayer?actor.attackTime>0:actor.state==='strike';
    const windup=!isPlayer&&actor.state==='windup';
    if(!actor.missingArm)box(-16,20,7,17,front,top,side,3);
    ctx.save();ctx.translate(13,24);
    const angle=attacking?(-1.8+(1-(actor.attackTime||.1)/.2)*3.5):windup?-2.3:actor.dashTime>0?.6:-.45;
    ctx.rotate(angle);box(-3,-1,8,13,front,top,side,2);rect(3,8,5,6,isPlayer?'#bba49b':'#95848c');
    rect(5,6,11,4,upgraded?'#b23a52':'#352c35');rect(14,2,3,12,upgraded?'#e6b25f':'#c39873');rect(17,5,isPlayer?43:33,4,element==='fire'?'#ffb363':element==='ice'?'#b9f2ff':upgraded?'#e3ddbc':'#cedcda');rect(17,4,isPlayer?42:32,1,'#f2f0dc');rect(17,8,isPlayer?43:33,2,upgraded?'#c6995d':'#637e92');poly([[isPlayer?60:50,4],[isPlayer?67:57,3],[isPlayer?60:50,9]],'#e5e7d6');
    if(element){for(let i=0;i<5;i++){const y=2+Math.sin(time*11+i*2)*4;rect(22+i*8,y,3,element==='fire'?5:3,element==='fire'?'#f7a350':'#bdebf2');}glow(40,5,24,element==='fire'?'#ff92532c':'#87dfea2c');}ctx.restore();
    ctx.restore();
    if(!isPlayer&&actor.hp<actor.maxHp&&actor.hp>0){rect(baseX-4,baseY-17,actor.w+8,3,'#201e2d');rect(baseX-4,baseY-17,(actor.w+8)*actor.hp/actor.maxHp,3,'#cf5369');}
    if(windupSafe(actor,isPlayer)){
      const progress=1-clamp(actor.timer/(actor.windupDuration||(actor.type==='brute'?.45:.28)),0,1);glow(baseX+actor.w/2,baseY+20,38,'#f347622b');
      ctx.font='bold 20px monospace';ctx.textAlign='center';ctx.fillStyle='#fc7c77';ctx.fillText('!',baseX+actor.w/2,baseY-22);
      rect(baseX-4,baseY-14,(actor.w+8)*progress,3,'#f57970');ctx.textAlign='left';
    }
  }
  function windupSafe(actor,isPlayer){return!isPlayer&&actor.state==='windup';}

  function drawEffects(cam){
    for(const s of world.stains){if(s.x<cam-20||s.x>cam+viewW+20)continue;rect(s.x-cam,s.y-2,s.w,s.h,s.color);if(s.drip)rect(s.x-cam+2,s.y+2,2,s.drip,s.color);}
    for(const ghost of world.ghosts)character({...world.player,x:ghost.x-cam,y:ghost.y,facing:ghost.facing,dashTime:.1},true,ghost.life*.9);
    for(const c of world.chunks){ctx.save();ctx.translate(Math.round(c.x-cam),Math.round(c.y));ctx.rotate(c.angle);ctx.globalAlpha=clamp(c.life,0,1);box(-c.w/2,-c.h/2,c.w,c.h,c.color,'#936072','#382a3b',3);if(c.part==='head')rect(-c.w/2+3,-3,c.w-4,4,'#a5958f');if(c.part==='arm'||c.part==='leg')rect(-c.w/2,-c.h/2,c.w,3,'#da3d50');ctx.restore();}
    for(const p of world.particles){ctx.globalAlpha=clamp(p.life*3,0,1);rect(p.x-cam,p.y,p.size,p.size,p.color);if(p.blood&&Math.abs(p.vx)>200)rect(p.x-cam-p.vx*.01,p.y,Math.abs(p.vx)*.009,2,p.color);}ctx.globalAlpha=1;
    for(const slash of world.slashes){
      const age=1-slash.life/slash.maxLife;
      ctx.save();ctx.translate(slash.x-cam,slash.y);ctx.scale(slash.facing,slash.step===1?-1:1);ctx.globalAlpha=(1-age)*.88;
      ctx.rotate(-1.25+age*2.4);
      ctx.beginPath();ctx.arc(0,0,slash.step===2?108:88,-.95,.7);ctx.arc(0,0,slash.step===2?93:75,.7,-.95,true);ctx.closePath();ctx.fillStyle=slash.element==='fire'?'#ffad68':slash.element==='ice'?'#a8e9f5':slash.weapon==='akatsuki'?'#f0ce97':slash.step===2?'#f16b76':'#e4f1ea';ctx.fill();
      ctx.beginPath();ctx.arc(0,0,slash.step===2?112:92,-.85,.4);ctx.strokeStyle='#d8fcfa';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
    for(const popup of world.popups){ctx.globalAlpha=clamp(popup.life*2,0,1);ctx.font='27px serif';ctx.fillStyle=popup.color;ctx.fillText(popup.text,popup.x-cam,popup.y-(.85-popup.life)*43);}ctx.globalAlpha=1;
  }
  function atmospheric(cam){
    if(!reducedMotion){
      ctx.lineWidth=1;ctx.strokeStyle='#9bb0c71d';ctx.beginPath();
      for(const drop of rain){const x=((drop.x-time*95-cam*.25)%(viewW+80)+viewW+80)%(viewW+80),y=(drop.y+time*drop.speed)%740;ctx.moveTo(x,y);ctx.lineTo(x-4,y+drop.len);}ctx.stroke();
      for(let i=0;i<13;i++){const x=((hash(i+21)*2200+time*(12+hash(i)*20)-cam*.3)%(viewW+60)+viewW+60)%(viewW+60),y=300+Math.sin(time*.4+i)*110+hash(i+40)*190;ctx.save();ctx.translate(x,y);ctx.rotate(time*.5+i);rect(-2,-1,5,3,'#b65a6965');ctx.restore();}
    }
    const groundFog=ctx.createLinearGradient(0,600,0,720);groundFog.addColorStop(0,'#0a122000');groundFog.addColorStop(1,'#060d1aca');ctx.fillStyle=groundFog;ctx.fillRect(0,600,viewW,120);
  }
  function render(){
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
    const isMenu=mode==='menu'||mode==='hub'||mode==='work',cam=isMenu?0:camera;
    ctx.save();
    if(!isMenu&&!reducedMotion&&world.shake>0){const s=world.shake;ctx.translate(Math.sin(time*157)*s,Math.cos(time*183)*s*.6);}
    background(cam,isMenu);scenery(cam,isMenu);
    if(isMenu){
      drawPlatform({x:-100,y:582,w:viewW+200,h:180,kind:'ground'},0);
      const px=viewW*.64;
      // A quiet tableau on the start screen.
      for(let i=0;i<23;i++)rect(px+30+hash(i+60)*115,580,4+hash(i)*13,2,i%2?'#7e293c':'#a6384b');
      box(px+103,569,26,12,'#653547','#83505e','#2b2737',3);box(px+124,571,17,10,'#46303f','#70525d','#2b2737',3);
      character({x:px,y:508,w:35,h:74,vx:0,facing:1,run:0,grounded:true,weaponId:campaign.equipped},true);
      lantern(viewW*.72-87,558,.55);
      rect(viewW*.72-125,585,65,2,'#c5635b25');rect(viewW*.72+88,590,83,3,'#c5635b18');
    }else{
      for(const s of world.platforms)drawPlatform(s,cam);
      for(const e of world.enemies){if(e.dead||e.x<cam-100||e.x>cam+viewW+100)continue;rect(e.x-cam-4,e.y+e.h-2,e.w+13,4,'#0a13234d');character({...e,x:e.x-cam});}
      const p=world.player;
      rect(p.x-cam-5,p.y+p.h-2,p.w+13,4,'#0a13234d');
      const flash=p.invincible>0&&p.dashTime<=0&&Math.floor(p.invincible*14)%2===0;
      character({...p,x:p.x-cam},true,flash?.42:1);
      drawEffects(cam);
      if(world.kills===world.enemies.length){glow(world.level.exit-cam,466,150,'#e55a6240');}
    }
    atmospheric(cam);ctx.restore();
  }
  function frame(now){
    const dt=Math.min((now-last)/1000||0,0.05);last=now;time+=dt;
    if(mode==='playing'){
      accumulator+=dt;
      // Fixed steps make movement and collisions stable at any refresh rate.
      while(accumulator>=1/120){
        world.update(1/120,input);accumulator-=1/120;
        if(world.status!=='playing')break;
      }
      if(held.has('KeyJ')||held.has('KeyX')||touches.has('attack'))world.attack();
      const target=clamp(world.player.x-viewW*.39,0,Math.max(0,world.level.width-viewW));
      camera+=(target-camera)*(1-Math.exp(-dt*7));
      toastTime-=dt;if(toastTime<=0)$('chapter-toast').classList.add('hidden');
      updateHUD();
      for(const event of world.events)playEvent(event);world.events.length=0;
      if(world.status==='dead'||world.status==='cleared')showResult();
    }else if(mode==='result')world.updateEffects(dt);
    else if(mode==='work')kitchen.update(dt);
    render();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
