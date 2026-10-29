/* A peaceful visit never advances the working day or consumes the raid buff. */
(function(root){
  const $=id=>document.getElementById(id);
  class OkusanVisit{
    constructor({campaign,isActive,onMenu,onChange}){
      this.campaign=campaign;this.isActive=isActive;this.onMenu=onMenu;this.onChange=onChange;this.canvas=$('courtyard-canvas');this.c=this.canvas.getContext('2d');this.x=240;this.keys=new Set();this.target=null;this.dialog=false;this.paid=false;this.time=0;this.camera=0;this.scale=1;this.face=1;
      $('courtyard-menu').onclick=()=>this.leave();$('okusan-leave').onclick=()=>this.leave();$('courtyard-talk').onclick=()=>this.approach();$('okusan-person').onclick=()=>this.approach();
      $('okusan-offer').onclick=()=>{
        if(!this.dialog||this.paid)return;const result=campaign.offerOkusan();
        if(!result.ok){$('okusan-response').textContent='Для подношения нужна 1 тяирэ. Можно вернуться позже.';return;}
        this.paid=true;$('okusan-response').textContent='«'+result.quote+'»';$('okusan-offer').disabled=true;$('okusan-offer').textContent='Подношение принято';$('okusan-leave').focus({preventScroll:true});onChange();$('live-status').textContent='Отдана 1 тяирэ. Окусан: '+result.quote;
      };
      addEventListener('keydown',e=>{if(!isActive())return;if(['ArrowLeft','ArrowRight','KeyA','KeyD','KeyE','Escape'].includes(e.code))e.preventDefault();if(e.code==='Escape'){this.leave();return;}if(e.repeat)return;if(e.code==='KeyE'){this.approach();return;}if(!this.dialog){this.keys.add(e.code);this.target=null;}});
      addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>{this.keys.clear();this.target=null;});
      $('okusan-dialog').addEventListener('keydown',e=>{if(e.code!=='Tab')return;const buttons=[...$('okusan-dialog').querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
      for(const b of document.querySelectorAll('[data-yard-move]')){
        b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.keys.add(b.dataset.yardMove);this.target=null;};
        for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>this.keys.delete(b.dataset.yardMove));
      }
      this.canvas.onpointerdown=e=>{if(this.dialog)return;const rect=this.canvas.getBoundingClientRect();this.target=Math.max(60,Math.min(1180,(e.clientX-rect.left)/this.scale+this.camera));this.autoTalk=false;};
    }
    setDialog(open){this.dialog=open;$('okusan-dialog').classList.toggle('hidden',!open);for(const child of $('courtyard-screen').children)if(child.id!=='okusan-dialog')child.inert=open;document.querySelector('.topbar').inert=open;}
    open(){this.x=240;this.target=null;this.autoTalk=false;this.keys.clear();this.setDialog(false);this.paid=false;$('courtyard-talk').disabled=false;$('okusan-person').disabled=false;this.draw();}
    leave(){this.keys.clear();this.target=null;this.setDialog(false);this.onMenu();}
    approach(){if(this.dialog)return;if(Math.abs(this.x-880)<105)this.talk();else{this.target=805;this.autoTalk=true;}}
    talk(){
      this.setDialog(true);this.paid=false;this.keys.clear();this.target=null;
      $('okusan-response').textContent=this.campaign.balance>0?'Окусан молча ждёт у крыльца. Ты можешь отдать одну чашу тяирэ и попросить прощения.':'Окусан ждёт у крыльца. У тебя пока нет тяирэ для подношения. Возвращайся, когда будешь готов.';
      $('okusan-offer').textContent='Попросить прощения (1 тяирэ)';$('okusan-offer').disabled=this.campaign.balance<1;$('courtyard-talk').disabled=true;$('okusan-person').disabled=true;
      (this.campaign.balance>0?$('okusan-offer'):$('okusan-leave')).focus({preventScroll:true});
    }
    update(dt){
      this.time+=dt;
      if(!this.dialog){let axis=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);
        if(this.target!==null){const distance=this.target-this.x;axis=Math.sign(distance);if(Math.abs(distance)<5){this.x=this.target;this.target=null;axis=0;if(this.autoTalk)this.talk();}}
        if(axis)this.face=axis;this.x=Math.max(60,Math.min(1180,this.x+axis*230*dt));this.walking=!!axis;
      }
      $('courtyard-talk').textContent=Math.abs(this.x-880)<105?'Поговорить · E':'Подойти к Окусан';this.draw();
    }
    draw(){
      const c=this.c,canvas=this.canvas,w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(!w||!h)return;
      if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
      this.scale=h/720;const width=w/this.scale;this.camera=width>=1280?(1280-width)/2:Math.max(0,Math.min(1280-width,this.x-width*.38));
      c.setTransform(dpr*this.scale,0,0,dpr*this.scale,0,0);c.imageSmoothingEnabled=false;
      const rect=(x,y,ww,hh,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),ww,hh);};
      const poly=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
      const sky=c.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#313f48');sky.addColorStop(1,'#ad9680');c.fillStyle=sky;c.fillRect(0,0,width,720);
      c.save();c.translate(-this.camera,0);
      for(let i=-4;i<24;i++){const x=i*96;poly([[x-90,410],[x+80,180+(i%3)*35],[x+240,410]],'#3c5554');}
      rect(this.camera-50,430,width+100,290,'#4c6652');rect(this.camera-50,520,width+100,200,'#66775a');
      // Low garden wall and roofed home with warm paper doors.
      rect(10,380,600,125,'#697469');for(let x=10;x<610;x+=52){rect(x,383,48,35,'#8b8d77');rect(x+20,424,48,35,'#7d8370');}rect(0,371,620,13,'#313e3e');
      rect(650,257,490,274,'#453f36');rect(670,275,450,242,'#6f5d46');
      for(let x=695;x<1115;x+=98){rect(x,292,80,190,'#b29666');rect(x+5,298,70,178,'#dec38a');for(let row=0;row<6;row++)rect(x+5,300+row*30,70,3,'#89734d');rect(x+38,298,4,178,'#89734d');}
      for(let x=651;x<=1131;x+=120)rect(x,258,14,275,'#403c34');
      poly([[603,269],[660,228],[876,152],[1149,228],[1201,269]],'#34464a');rect(601,266,600,13,'#67716b');rect(625,283,550,8,'#2a3737');
      for(let i=0;i<18;i++)rect(650+i*28,249,18,5,'#889083');
      rect(632,518,530,18,'#9e8765');rect(650,536,490,19,'#655a46');rect(760,555,220,17,'#a3967d');rect(738,572,265,15,'#8a8872');
      // Stone path, pond, stepping stones and flowers.
      for(let i=0;i<16;i++)rect(40+i*78,575+(i%2)*8,65,22,'#a5a58b');
      poly([[70,633],[116,606],[355,608],[424,649],[370,693],[119,694]],'#728774');poly([[90,637],[130,620],[348,622],[400,651],[355,679],[135,680]],'#3c6467');
      for(let i=0;i<9;i++)rect(135+i*26,643+Math.sin(this.time+i)*8,18,2,'#96b3a378');
      const tree=(x,y,small=false)=>{rect(x,y-170,20,170,'#3a4436');poly([[x+9,y-98],[x-60,y-179],[x+15,y-120],[x+75,y-192]],'#3a4436');for(let i=0;i<16;i++){const xx=x-112+(i*53)%220,yy=y-235+(i*23)%80;rect(xx,yy,65,25,small?'#80966a':i%3?'#9b7a72':'#bd9990');}};
      tree(220,500);tree(1210,540,true);
      for(let i=0;i<22;i++){const x=460+(i*43)%180,y=600+(i*27)%70;rect(x,y,3,17,'#496447');rect(x-3,y-4,9,7,i%2?'#d2bba0':'#c68d87');}
      for(const x of [638,1148]){rect(x,318,2,43,'#3c4038');const glow=c.createRadialGradient(x,384,4,x,384,85);glow.addColorStop(0,'#e7bb6a55');glow.addColorStop(1,'#e7bb6a00');c.fillStyle=glow;c.fillRect(x-85,299,170,170);rect(x-14,361,30,44,'#b5794c');rect(x-10,365,22,34,'#f1cd87');rect(x-16,357,34,5,'#343d36');rect(x-16,405,34,5,'#343d36');}
      // Okusan: long dark hair, a black dress and red sleeves and sash.
      const ox=880,oy=474;rect(ox-16,oy+105,48,6,'#33473477');rect(ox-15,oy-11,37,70,'#20262a');rect(ox-8,oy-2,22,28,'#d7b398');rect(ox-14,oy-10,37,10,'#172327');rect(ox-14,oy,9,58,'#172327');rect(ox+15,oy,9,67,'#172327');rect(ox-9,oy+26,27,31,'#652f3a');poly([[ox-8,oy+40],[ox+18,oy+40],[ox+34,oy+103],[ox-24,oy+103]],'#22272b');poly([[ox+5,oy+44],[ox+14,oy+44],[ox+25,oy+99],[ox+9,oy+99]],'#9f4047');rect(ox-13,oy+48,34,9,'#bd5351');rect(ox-23,oy+30,13,39,'#923d46');rect(ox+22,oy+30,12,39,'#923d46');rect(ox-21,oy+68,9,9,'#d7b398');rect(ox+24,oy+68,8,9,'#d7b398');rect(ox-9,oy+104,13,6,'#292d2b');rect(ox+12,oy+104,13,6,'#292d2b');rect(ox-6,oy+11,4,2,'#393533');rect(ox+7,oy+11,4,2,'#393533');
      c.font='16px sans-serif';c.textAlign='center';c.fillStyle='#e6dac0';c.fillText('ОКУСАН',ox+5,oy-32);c.textAlign='left';
      // The ninja is unarmed here, with the same dark clothes and red scarf.
      c.save();c.translate(this.x,507);c.scale(this.face,1);const step=this.walking&&!this.dialog?Math.sin(this.time*12)*6:0;
      rect(-13,31,12,34+step,'#28393d');rect(4,31,12,34-step,'#35464a');rect(-16,64+step,19,8,'#1d3036');rect(3,64-step,19,8,'#1d3036');rect(-16,16,34,30,'#30454a');rect(-15,39,34,7,'#ad454b');rect(-12,-9,28,27,'#25383e');rect(-13,-2,30,6,'#b74b51');rect(0,5,17,6,'#ded2b6');rect(4,6,4,3,'#203139');rect(-25,18,10,27,'#34474a');rect(17,18,10,27,'#34474a');rect(-32,12,23,6,'#ae454e');c.restore();
      c.restore();
      const person=$('okusan-person');person.style.left=((ox-this.camera-31)*this.scale)+'px';person.style.top=((oy-17)*this.scale)+'px';person.style.width=(78*this.scale)+'px';person.style.height=(132*this.scale)+'px';
    }
  }
  root.OkusanVisit=OkusanVisit;
})(window);
