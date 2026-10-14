/* Deterministic, input-driven kitchen minigames; renderer-independent. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const DIRS={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
  function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  class Kitchen{
    constructor(day){
      this.day=day.day;this.seed=day.seed;this.job=day.job;this.rare=day.rare;this.status='ready';this.elapsed=0;this.quality=100;this.progress=0;this.mistakes=0;
      this.random=random(this.seed);
      if(this.job==='fish'){this.portion=0;this.portions=3;this.tick=0;this.flash=0;this.makeFish();}
      else{this.heat=45;this.temperature=24;this.cooked=0;this.duration=this.rare?32:28;this.badCook=0;this.penalty=0;this.stirAge=0;this.stirCooldown=0;this.stirs=0;}
    }
    start(){if(this.status==='ready')this.status='playing';}
    makeFish(){
      const flip=this.random()>.5,offset=this.random()>.5?1:0;
      const waypoints=[[2,6],[5+offset,6],[5+offset,3],[10,3],[10,8],[15+offset,8],[15+offset,4],[19,4],[19,6]];
      this.path=[];for(let i=0;i<waypoints.length-1;i++){
        let [x,y]=waypoints[i];const [tx,ty]=waypoints[i+1];
        while(x!==tx||y!==ty){this.path.push([x,flip?11-y:y]);x+=Math.sign(tx-x);y+=Math.sign(ty-y);}
      }
      const [x,y]=waypoints.at(-1);this.path.push([x,flip?11-y:y]);this.index=0;this.direction='right';this.wait=0;
    }
    turn(direction){if(DIRS[direction]&&this.job==='fish')this.direction=direction;}
    setHeat(value){if(this.job==='rice')this.heat=clamp(Number(value)||0,0,100);}
    stir(){
      if(this.job!=='rice'||this.status!=='playing'||this.stirCooldown>0)return false;
      this.stirAge=0;this.stirCooldown=1.2;this.stirs++;this.temperature=Math.max(20,this.temperature-1.1);return true;
    }
    update(dt,input={}){
      if(this.status!=='playing')return;
      dt=clamp(dt,0,.05);this.elapsed+=dt;
      if(this.job==='fish'){
        this.flash=Math.max(0,this.flash-dt);
        if(this.wait>0){this.wait-=dt;return;}
        this.tick+=dt;if(this.tick<(this.rare?.24:.31))return;this.tick=0;
        const [x,y]=this.path[this.index],[dx,dy]=DIRS[this.direction],next=this.path[this.index+1];
        if(next&&x+dx===next[0]&&y+dy===next[1]){
          this.index++;this.progress=(this.portion+this.index/(this.path.length-1))/this.portions;
          if(this.index===this.path.length-1){
            this.portion++;if(this.portion===this.portions){this.finish();return;}
            this.makeFish();this.wait=1.1;
          }
        }else{
          this.mistakes++;this.quality=Math.max(0,100-this.mistakes*7);this.flash=.5;this.wait=.55;
        }
      }else{
        this.setHeat(this.heat+((input.right?1:0)-(input.left?1:0))*38*dt);
        this.stirAge+=dt;this.stirCooldown=Math.max(0,this.stirCooldown-dt);
        const drift=Math.sin(this.elapsed*(this.rare?.8:.4)+this.seed%10)*(this.rare?8:2);
        const target=20+this.heat*1.4+drift;
        this.temperature+=(target-this.temperature)*Math.min(1,dt*.38);
        const needsStir=this.stirAge>(this.rare?5:6);
        const cooking=this.temperature>=55&&this.temperature<=94&&!needsStir;
        if(cooking){
          const step=Math.min(dt,this.duration-this.cooked);this.cooked+=step;
          if(this.temperature<65||this.temperature>82)this.badCook+=step;
        }
        if(this.cooked>0){
          if(this.temperature>94)this.penalty+=dt*1.4;
          if(needsStir)this.penalty+=dt*.6;
        }
        this.progress=this.cooked/this.duration;
        this.quality=Math.round(clamp(100-this.badCook/this.duration*70-this.penalty,0,100));
        if(this.cooked>=this.duration)this.finish();
      }
    }
    finish(){this.status='done';this.progress=1;this.quality=Math.round(clamp(this.quality,0,100));}
  }
  const api={Kitchen,DIRS,random};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KageKitchen=api;
})(typeof window!=='undefined'?window:globalThis);
