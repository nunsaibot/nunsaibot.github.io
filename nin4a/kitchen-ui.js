(function(root){
  'use strict';
  const $=id=>document.getElementById(id),{BUFFS}=root.KageCore;
  const recipes={
    fish:{title:'Разделка рыбы',index:'01 / ПОДГОТОВКА РЫБЫ',heading:'Ровная рука.<br>Чистый срез.',intro:'Три филе для вечерних заказов. Проведи нож по светлой дорожке от начала дорожки до зелёной метки.',steps:['Нож движется сам. Поворачивай стрелками или WASD.','Не сходи с дорожки: каждый промах снимает 7% качества.','Заверши все три филе. После ошибки можно поправить направление.'],hint:'Поворачивай нож по светлой дорожке. Три филе.'},
    rice:{title:'Идеальный рис',index:'02 / РИС ДЛЯ РОЛЛОВ',heading:'Тише огонь.<br>Больше терпения.',intro:'Прогрей рис, поддерживай температуру и не забывай помешивать. Холодный или забытый рис не готовится.',steps:['Регулируй огонь ползунком или A / D. Зелёная зона — 65–82 °C.','Помешивай пробелом или кнопкой каждые 4–5 секунд.','Доведи готовность до 100%. Перегрев и долгое ожидание снижают качество.'],hint:'Держи 65–82 °C. Помешивай пробелом.'}
  };
  class KitchenUI{
    constructor({campaign,onMap,onMenu,isActive,onFinish}){
      this.campaign=campaign;this.onMap=onMap;this.onMenu=onMenu;this.isActive=isActive;this.onFinish=onFinish;this.game=null;this.paused=false;this.keys=new Set();
      this.canvas=$('work-canvas');this.ctx=this.canvas.getContext('2d');this.ctx.scale(2,2);this.ctx.imageSmoothingEnabled=false;
      $('work-start-button').onclick=()=>this.start();$('work-pause-button').onclick=()=>this.togglePause();
      $('work-back-button').onclick=()=>{this.suspend();onMenu();};$('work-map-button').onclick=onMap;
      $('heat-control').oninput=e=>this.game?.setHeat(e.target.value);$('stir-button').onclick=()=>this.game?.stir();
      for(const b of document.querySelectorAll('[data-work-dir]'))b.onpointerdown=e=>{e.preventDefault();this.game?.turn(b.dataset.workDir);};
      addEventListener('keydown',e=>{
        if(!isActive())return;
        const direction={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'}[e.code];
        if(direction||e.code==='Space')e.preventDefault();
        if(e.repeat)return;
        if(direction){this.keys.add(direction);if(!this.paused)this.game?.turn(direction);}
        if(e.code==='Space'){if(this.game?.status==='ready'||this.paused)this.start();else this.game?.stir();}
      });
      addEventListener('keyup',e=>{const d={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'}[e.code];if(d)this.keys.delete(d);});
      addEventListener('blur',()=>{if(isActive())this.suspend();});
      document.addEventListener('visibilitychange',()=>{if(document.hidden&&isActive())this.suspend();});
    }
    open(){
      const w=this.campaign.work;
      if(!this.game||this.game.day!==w.day)this.game=new root.KageKitchen.Kitchen(w);
      this.paused=this.game.status==='playing';this.keys.clear();
      const r=recipes[w.job];
      $('work-day').textContent='ДЕНЬ '+String(w.day).padStart(2,'0');
      $('work-title').innerHTML=r.title+'<span>.</span>';$('recipe-index').textContent=r.index;$('recipe-title').innerHTML=r.heading;$('recipe-intro').textContent=r.intro;
      $('recipe-steps').innerHTML=r.steps.map(s=>'<li>'+s+'</li>').join('');
      $('work-order').textContent=w.rare?'СЛОЖНЫЙ ЗАКАЗ':'ОБЫЧНЫЙ ЗАКАЗ';$('work-order').classList.toggle('rare',w.rare);
      $('fish-tools').classList.toggle('hidden',w.job!=='fish');$('rice-tools').classList.toggle('hidden',w.job!=='rice');
      $('work-instructions').classList.toggle('hidden',w.phase==='ready');$('work-completion').classList.toggle('hidden',w.phase!=='ready');
      if(w.phase==='ready')this.showCompleted();
      this.refresh();this.draw();
    }
    start(){
      if(this.campaign.work.phase!=='work')return;
      this.game.start();this.paused=false;this.keys.clear();this.canvas.focus({preventScroll:true});this.refresh();$('work-screen').scrollTop=0;
    }
    togglePause(){if(this.game?.status!=='playing')return;if(this.paused)this.start();else this.suspend();}
    suspend(){this.keys.clear();if(this.game?.status==='playing'){this.paused=true;this.refresh();}}
    showCompleted(){
      const w=this.campaign.work,buff=BUFFS[w.buff];
      $('work-instructions').classList.add('hidden');$('work-completion').classList.remove('hidden');
      $('final-quality').textContent=w.quality+'%';
      $('earned-buff-icon').textContent=buff?.icon||'—';$('earned-buff-icon').style.color=buff?.color||'#8b927c';
      $('earned-buff-name').textContent=buff?.name||'Без усиления';
      $('earned-buff-description').textContent=buff?.description||'Качество ниже 80%. Набег открыт.';
      $('work-buff-rule').textContent=buff?'Баф действует на один набег и расходуется при его завершении, смерти или выходе.':'Завтра будет новое задание и ещё один шанс получить баф.';
      $('work-save-note').textContent=this.campaign.persisted?'Результат смены сохранён.':'Сохранение недоступно: не закрывай страницу.';
    }
    update(dt){
      if(!this.game)return;
      if(!this.paused&&this.campaign.work.phase==='work')this.game.update(dt,{left:this.keys.has('left'),right:this.keys.has('right')});
      if(this.game.status==='done'&&this.campaign.work.phase==='work'&&this.campaign.completeWork(this.game)){
        this.showCompleted();this.onFinish();if(innerWidth<=700||innerHeight<=480)requestAnimationFrame(()=>{if(this.isActive())$('work-completion').scrollIntoView({block:'center'});});$('live-status').textContent='Смена завершена. Качество '+this.game.quality+'%.';
      }
      this.refresh();this.draw();
    }
    refresh(){
      if(!this.game)return;
      const g=this.game,done=this.campaign.work.phase==='ready';
      $('work-screen').classList.toggle('working',g.status==='playing'&&!done);
      $('work-quality').innerHTML=(done?this.campaign.work.quality:g.quality)+'<small>%</small>';
      $('work-progress-label').textContent=done?'ЗАКАЗ ГОТОВ':g.job==='fish'?'ФИЛЕ '+Math.min(3,g.portion+1)+' / 3':'ГОТОВО '+Math.floor(g.progress*100)+'%';
      $('work-progress').style.width=(done?100:g.progress*100)+'%';
      const waiting=!done&&(g.status==='ready'||this.paused);
      $('work-start-overlay').classList.toggle('hidden',!waiting);
      $('work-start-hint').textContent=this.paused?'Работа на паузе. Продолжим, когда будешь готов.':recipes[g.job].hint;
      $('work-start-button').innerHTML=(this.paused?'ПРОДОЛЖИТЬ РАБОТУ':'ПРИСТУПИТЬ К РАБОТЕ')+' <span>→</span>';
      $('work-pause-button').disabled=done||g.status!=='playing';
      let message=done?'Заказ принят. Теперь можно выбрать цель набега.':g.status==='ready'?'Приготовь заказ, чтобы открыть карту набегов.':this.paused?'Работа приостановлена.':g.job==='fish'?(g.flash>0?'Задет край филе: −7% качества. Поправь направление.':g.wait>0?'Следующее филе. Приготовься.':'Веди нож по светлой дорожке. Не задень края.'):(g.stirAge>(g.rare?4:4.8)?'Пора помешать рис! Без помешивания готовка остановится.':g.temperature>82?'Убавь огонь: рис перегревается.':g.temperature<55?'Разогреваем рис. Поддерживай огонь.':'Температура под контролем. Следи за рисом.');
      if($('work-status').textContent!==message)$('work-status').textContent=message;
      $('work-status').classList.toggle('warning',!done&&(g.flash>0||g.temperature>82||g.stirAge>4.8));
      if(g.job==='rice'){$('heat-control').value=String(Math.round(g.heat));$('heat-value').textContent=Math.round(g.heat)+'%';$('stir-button').disabled=done||g.status!=='playing'||this.paused||g.stirCooldown>0;}
    }
    draw(){
      const c=this.ctx,g=this.game;if(!g)return;
      const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
      const poly=(points,color)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
      rect(0,0,720,400,'#37362d');
      for(let i=0;i<10;i++){rect(0,i*44,720,2,'#524a3670');rect((i*97)%300,i*44+15,330,1,'#8a74551b');}
      if(g.job==='fish'){
        rect(31,34,663,342,'#1e2924');rect(26,24,662,341,'#766c4d');rect(34,31,646,324,'#ada07a');rect(40,37,634,312,'#b8aa83');
        for(let i=0;i<18;i++)rect(47,46+i*17,618,1,i%2?'#83755322':'#e7d6a51b');
        poly([[96,199],[129,105],[226,79],[516,86],[608,147],[648,104],[635,199],[648,290],[605,247],[524,315],[220,323],[125,286]],'#687c72');
        poly([[109,196],[142,113],[232,92],[504,99],[599,155],[599,240],[513,303],[222,309],[136,276]],'#c88265');
        for(let i=0;i<16;i++)poly([[161+i*25,111],[171+i*25,111],[198+i*23,291],[188+i*23,291]],'#f2c2a045');
        const ox=102,oy=65,tile=23;
        g.path.forEach(([x,y],i)=>{
          const done=i<g.index;rect(ox+x*tile,oy+y*tile,22,22,done?'#92a579':'#e1c89b');
          rect(ox+x*tile+2,oy+y*tile+2,18,2,done?'#b3c393':'#f5ddb0');
          if(i%3===0&&i>g.index)rect(ox+x*tile+10,oy+y*tile+10,3,3,'#9d8b61');
        });
        const endpoint=g.path.at(-1);rect(ox+endpoint[0]*tile+5,oy+endpoint[1]*tile+5,12,12,'#668b73');
        for(let i=Math.max(0,g.index-7);i<g.index;i++){const [x,y]=g.path[i];rect(ox+x*tile+9,oy+y*tile+8,6,6,'#6a765a');}
        const [x,y]=g.path[g.index];
        c.save();c.translate(ox+x*tile+11,oy+y*tile+11);c.rotate({right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[g.direction]);
        rect(-12,-4,12,8,'#413c35');rect(-10,-4,2,8,'#c5a979');rect(0,-4,20,8,g.flash>0?'#ed8c78':'#e6ebe1');poly([[20,-4],[28,-4],[20,4]],'#b5ceca');rect(0,-4,21,2,'#f9f1d9');c.restore();
        c.font='10px monospace';c.fillStyle='#665b43';c.fillText('КОХАКУ / СВЕЖАЯ РЫБА',48,339);c.fillText('СВЕТЛАЯ ДОРОЖКА = ЧИСТЫЙ СРЕЗ',411,339);
        if(g.flash>0){c.strokeStyle='#e18c75';c.lineWidth=5;c.strokeRect(29,27,656,335);}
      }else{
        rect(130,325,332,32,'#1b2526');rect(149,315,297,12,'#424d45');rect(191,303,213,13,'#181e21');
        for(let i=0;i<11;i++){const h=8+g.heat*.21+Math.sin(g.elapsed*8+i)*5;rect(207+i*16,317-h,9,h,i%2?'#edb46d':'#c66e4e');rect(209+i*16,317-h*.5,5,h*.5,'#ebd099');}
        rect(178,174,243,126,'#1e292d');rect(187,183,224,116,'#536763');rect(190,193,12,94,'#6c8074');rect(204,281,196,13,'#334a47');
        rect(152,187,34,15,'#283632');rect(154,195,15,23,'#283632');rect(415,187,35,15,'#283632');rect(437,195,14,23,'#283632');
        for(let y=-40;y<=40;y+=5){const width=Math.sqrt(Math.max(0,1-y*y/1600))*118;rect(300-width,174+y,width*2,5,y<-28?'#93a28d':'#3e5551');}
        for(let y=-32;y<=32;y+=4){const width=Math.sqrt(Math.max(0,1-y*y/1024))*103;rect(300-width,174+y,width*2,4,'#d5cfab');}
        for(let i=0;i<70;i++){const angle=i*2.39,r=Math.sqrt((i+1)/70);rect(300+Math.cos(angle)*r*98,174+Math.sin(angle)*r*26,6,3,i%3?'#f0e6c5':'#b6b58e');}
        for(let i=0;i<5;i++){const rise=(g.elapsed*22+i*21)%86;c.globalAlpha=(1-rise/100)*.27;rect(245+i*23+Math.sin(g.elapsed+i)*7,133-rise,8,20,'#e0e7d6');}c.globalAlpha=1;
        if(g.stirCooldown>.65){c.save();c.translate(300,168);c.rotate(Math.sin(g.elapsed*9)*.3);rect(-3,-68,7,94,'#b88e5c');rect(-7,15,15,23,'#b88e5c');c.restore();}
        const tx=551,ty=103,th=193;rect(tx-10,ty-12,46,th+26,'#202d2c');rect(tx,ty,19,th,'#44524a');
        const mapTemp=t=>ty+th-(t-20)/90*th;
        rect(tx-5,mapTemp(82),29,mapTemp(65)-mapTemp(82),'#6d8c644e');
        rect(tx+3,mapTemp(g.temperature),13,Math.max(0,ty+th-mapTemp(g.temperature)),g.temperature>82?'#d99966':g.temperature<65?'#9aab93':'#bad397');
        for(const temp of [65,82]){rect(tx-6,mapTemp(temp),32,1,'#b2ce8a');c.font='10px monospace';c.fillStyle='#bac79e';c.fillText(String(temp),tx+39,mapTemp(temp)+3);}
        c.font='28px monospace';c.fillStyle=g.temperature>82?'#e0a16d':'#d4d9b7';c.fillText(Math.round(g.temperature)+'°',530,79);
        c.font='10px monospace';c.fillStyle='#a3aa8e';c.fillText('ТЕМПЕРАТУРА',522,329);c.fillText('ОГОНЬ '+Math.round(g.heat)+'%',144,378);
        c.fillStyle=g.stirAge>4.8?'#e1af78':'#a3aa8e';c.fillText('ПОСЛЕ ПОМЕШИВАНИЯ: '+g.stirAge.toFixed(1)+' с',341,378);
      }
      if(this.campaign.work.phase==='ready'){rect(198,160,324,69,'#172821e8');c.font='bold 24px sans-serif';c.fillStyle='#d0ddbc';c.textAlign='center';c.fillText('ЗАКАЗ ГОТОВ',360,204);c.textAlign='left';}
    }
  }
  root.KageKitchenUI=KitchenUI;
})(window);
