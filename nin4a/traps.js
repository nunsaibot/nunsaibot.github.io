/* Telegraphs, collision and drawing share the same trap dimensions. */
(function(root){
  'use strict';
  const names={beam:'БАЛКА',spikes:'ШИПЫ',mine:'МИНА'};
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function create(level){return level.traps.map(t=>({...t,state:'idle',timer:0,vy:0,beamY:t.y-230,hit:new Set()}));}
  function damage(world,t,box,amount){
    const p=world.player;
    if(!t.hit.has('player')&&overlap(box,p)&&world.hurtPlayer(p.x+p.w/2<t.x+t.w/2?-1:1))t.hit.add('player');
    for(const e of world.enemies)if(!e.dead&&!t.hit.has(e.id)&&overlap(box,e)){t.hit.add(e.id);world.hurtEnemy(e,amount,e.x<t.x?-1:1,true,'trap');}
  }
  function burst(world,t){
    world.emit('trapImpact',{kind:t.type});world.shake=Math.max(world.shake,t.type==='mine'?8:5);
    for(let i=0;i<22;i++)world.particles.push({x:t.x+t.w/2,y:t.y-10,vx:world.rand(-190,190),vy:world.rand(-250,-50),life:world.rand(.3,.7),size:world.rand(2,6),color:t.type==='mine'?'#ffc176':'#bba582',blood:false});
  }
  function update(world,dt){
    if(world.status!=='playing'||world.endDelay>=0)return;
    const p=world.player;
    for(const t of world.traps){
      if(t.state==='spent')continue;
      const dx=Math.abs(p.x+p.w/2-t.x-t.w/2),feet=p.y+p.h;
      if(t.state==='idle'){
        const near=t.type==='mine'?dx<48&&Math.abs(feet-t.y)<24:dx<165&&Math.abs(feet-t.y)<95;
        if(near){t.state='warning';t.timer=t.warning;t.hit.clear();world.emit('trapWarning',{kind:t.type});}
      }else if(t.state==='warning'){
        t.timer-=dt;
        if(t.timer<=0){
          t.state='active';t.timer=t.type==='spikes'?1.15:t.type==='mine'?.28:0;
          if(t.type==='mine'){damage(world,t,{x:t.x-82,y:t.y-86,w:t.w+164,h:86},3);burst(world,t);}
          else if(t.type==='spikes')world.emit('trapImpact',{kind:t.type});
        }
      }else if(t.state==='active'){
        if(t.type==='beam'){
          t.vy=Math.min(950,t.vy+2000*dt);const previous=t.beamY;t.beamY=Math.min(t.y-22,t.beamY+t.vy*dt);
          damage(world,t,{x:t.x,y:previous,w:t.w,h:t.beamY-previous+22},4);
          if(t.beamY>=t.y-22){t.state='spent';burst(world,t);}
        }else if(t.type==='spikes'){
          const height=Math.min(34,(1.15-t.timer)*230);damage(world,t,{x:t.x,y:t.y-height,w:t.w,h:height},2);
          t.timer-=dt;if(t.timer<=0){t.state='cooldown';t.timer=2.4;}
        }else{t.timer-=dt;if(t.timer<=0)t.state='spent';}
      }else if(t.state==='cooldown'){t.timer-=dt;if(t.timer<=0)t.state='idle';}
    }
  }
  function disarm(world,attackBox){
    for(const t of world.traps)if(t.type==='mine'&&['idle','warning'].includes(t.state)&&overlap(attackBox,{x:t.x,y:t.y-14,w:t.w,h:14})){
      t.state='spent';world.sparks(t.x+t.w/2,t.y-10,world.player.facing);world.emit('trapDisarmed');
    }
  }
  function draw(c,world,{cam,width,time}){
    const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
    const poly=(pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
    for(const t of world.traps){
      const x=t.x-cam,y=t.y;if(x+t.w<-130||x>width+130)continue;
      const warning=t.state==='warning',active=t.state==='active',blink=Math.sin(time*24)>0,col=warning?(blink?'#ff8063':'#d8bc72'):'#bba073';
      if(t.type==='beam'){
        rect(x-12,y-246,5,246,'#4c4943');rect(x+t.w+7,y-246,5,246,'#4c4943');
        rect(x-7,y-246,t.w+14,10,'#685544');
        for(const xx of [x+12,x+t.w-15]){rect(xx,y-238,2,Math.max(0,t.beamY-y+238),'#a49a81');}
        if(t.state!=='spent'){
          const bx=x+(warning?Math.sin(time*45)*2:0);rect(bx,t.beamY,t.w,22,'#7f6047');rect(bx,t.beamY,t.w,5,'#b9a27a');
          for(const xx of [bx+14,bx+t.w-22]){rect(xx,t.beamY,8,22,'#333d43');rect(xx+2,t.beamY+3,4,4,'#bdc0ac');}
          rect(x,y-3,t.w,3,warning?'#ff9c6d':'#bda46c66');
          if(warning){rect(x,y-226,t.w,226,'#eb8f6020');for(let xx=x;xx<x+t.w;xx+=22)poly([[xx,y-12],[xx+10,y-12],[xx+5,y-5]],col);}
        }else{rect(x+8,y-6,t.w*.4,6,'#675445');rect(x+t.w*.58,y-8,t.w*.3,8,'#8c7050');}
      }else if(t.type==='spikes'){
        rect(x-3,y-6,t.w+6,6,'#59656c');rect(x,y-4,t.w,4,'#222d36');
        const height=active?Math.min(34,(1.15-t.timer)*230):t.state==='cooldown'?Math.max(0,34-(2.4-t.timer)*220):0;
        for(let xx=x+3;xx<x+t.w-6;xx+=14){rect(xx,y-5,9,3,col);if(height>0){poly([[xx,y-4],[xx+4,y-4-height],[xx+9,y-4]],'#d4ded1');poly([[xx+4,y-4-height],[xx+9,y-4],[xx+5,y-4]],'#8b9da5');}}
        if(warning)rect(x,y-42,t.w,36,'#ff996627');
      }else{
        if(t.state==='spent'){rect(x+4,y-4,t.w-8,4,'#4b4a44');continue;}
        rect(x,y-9,t.w,9,'#59634a');rect(x+4,y-14,t.w-8,5,'#8b9970');rect(x+t.w/2-3,y-15,6,4,warning?col:'#e0ae60');
        if(warning||active){c.strokeStyle=active?'#ffc577':col;c.lineWidth=2;c.setLineDash(warning?[6,6]:[]);c.beginPath();c.ellipse(x+t.w/2,y-3,82+t.w/2,22,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
        if(active){rect(x-70,y-75,t.w+140,75,'#f5b46750');for(let i=0;i<12;i++){const a=i*Math.PI/6;rect(x+t.w/2+Math.cos(a)*70,y-35+Math.sin(a)*34,10,9,'#ffce89');}}
      }
      if(warning){
        const cy=t.type==='beam'?y-86:y-60;c.font='bold 10px sans-serif';c.textAlign='center';
        rect(x+t.w/2-40,cy-12,80,20,'#17212ce8');c.fillStyle=col;c.fillText('! '+names[t.type],x+t.w/2,cy+2);
        rect(x,cy+12,t.w*(1-t.timer/t.warning),3,col);c.textAlign='left';
      }
    }
  }
  const api={create,update,disarm,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BushidoTraps=api;
})(typeof window!=='undefined'?window:globalThis);
