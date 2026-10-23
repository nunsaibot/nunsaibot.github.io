'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {World,LEVELS}=require('../engine.js');
const dt=1/120;
function advance(world,seconds,input={}){for(let t=0;t<seconds;t+=dt)world.update(dt,input);}
function sandbox(level=0){const world=new World(level,{random:()=>.5});for(const e of world.enemies)e.x=world.level.width-80;return world;}

test('player lands on the floor and cannot walk outside the level',()=>{
  const w=sandbox();advance(w,.4);assert.equal(w.player.y+w.player.h,582);assert.equal(w.player.grounded,true);
  advance(w,2,{left:true});assert.equal(w.player.x,0);
});
test('double jump works, a third jump is rejected, landing restores jumps',()=>{
  const w=sandbox();advance(w,.3);w.jump();advance(w,.18);assert.equal(w.player.jumps,1);
  w.jump();advance(w,.03);assert.equal(w.player.jumps,2);assert.ok(w.player.vy<0);
  advance(w,.2);const velocity=w.player.vy;w.jump();advance(w,.03);assert.equal(w.player.jumps,2);assert.ok(w.player.vy>velocity);
  advance(w,1);assert.equal(w.player.grounded,true);advance(w,dt);assert.equal(w.player.jumps,0);
});
test('one-way roofs can be jumped through and landed on',()=>{
  const w=sandbox();w.player.x=330;w.player.y=530;advance(w,.03);w.jump();advance(w,.8);
  assert.equal(w.player.y+w.player.h,474);assert.equal(w.player.grounded,true);
});
test('one swing hits once; three-hit combo kills and produces limbs and blood',()=>{
  const w=sandbox();advance(w,.3);const e=w.enemies[0];Object.assign(e,{x:170,y:532,hp:3,state:'recover',timer:20});
  w.attack();advance(w,dt);assert.equal(e.hp,2);const p=w.particles.length;
  advance(w,.1);assert.equal(e.hp,2);assert.ok(p>50);
  for(let i=0;i<2;i++){advance(w,.3);e.x=w.player.x+50;e.y=w.player.y;e.state='recover';e.timer=20;w.attack();advance(w,.02);}
  assert.equal(e.dead,true);assert.equal(w.kills,1);assert.ok(w.chunks.some(c=>c.part==='arm'));assert.ok(w.chunks.some(c=>c.part==='leg'));
});
test('katana does not hit enemies behind the player',()=>{
  const w=sandbox();w.player.x=300;w.player.facing=1;const e=w.enemies[0];e.x=230;e.y=530;e.state='recover';e.timer=5;
  w.attack();advance(w,.1);assert.equal(e.hp,3);
});
test('dash gives invulnerability and obeys its cooldown',()=>{
  const w=sandbox();advance(w,.2);const x=w.player.x;assert.equal(w.dash(),true);assert.equal(w.dash(),false);
  assert.equal(w.hurtPlayer(1),false);advance(w,.13);assert.ok(w.player.x-x>100);assert.equal(w.player.hp,2);
  advance(w,.8);assert.equal(w.dash(),true);
});
test('enemy telegraphs before it damages the player',()=>{
  const w=sandbox();advance(w,.2);const e=w.enemies[0];Object.assign(e,{x:160,y:532,state:'patrol',cooldown:0});
  advance(w,.1);assert.equal(e.state,'windup');assert.equal(w.player.hp,2);
  advance(w,.5);assert.equal(w.player.hp,1);
});
test('fall costs one health and respawns on a safe platform',()=>{
  const w=sandbox();Object.assign(w.player,{x:955,y:800,vy:1000,hp:2,maxHp:2});advance(w,dt);
  assert.equal(w.player.hp,1);assert.ok(w.player.y<582);assert.ok(w.player.x+w.player.w<=920);
  advance(w,.2);assert.equal(w.player.hp,1);
});
test('zero health emits death once and ends gameplay',()=>{
  const w=sandbox();w.player.hp=1;w.hurtPlayer(1);assert.equal(w.status,'dead');const elapsed=w.elapsed;
  advance(w,1);assert.equal(w.elapsed,elapsed);assert.equal(w.events.filter(e=>e.type==='dead').length,1);
});
test('each level clears after its last enemy; loading next level resets state',()=>{
  const w=new World();
  for(let i=0;i<LEVELS.length;i++){
    w.load(i);for(const e of w.enemies)w.hurtEnemy(e,99,1);
    assert.equal(w.kills,w.enemies.length);advance(w,1.2);assert.equal(w.status,'cleared');assert.ok(w.events.some(e=>e.type==='clear'));
  }
  w.load(0);assert.equal(w.player.hp,2);assert.equal(w.kills,0);assert.equal(w.status,'playing');assert.equal(w.stains.length,0);
});
test('blood lands on surfaces and effects have finite lifetimes and bounded counts',()=>{
  const w=sandbox();w.spray(200,520,1,1);for(let i=0;i<200;i++)w.updateEffects(dt);
  assert.ok(w.stains.length>0);assert.equal(w.particles.length,0);
  for(let i=0;i<80;i++)w.spray(200,510,1,1);assert.ok(w.particles.length<=1350);
});
test('all enemy platforms are reachable from spawn using real jump physics',()=>{
  for(let level=0;level<LEVELS.length;level++){
    const w=new World(level),platforms=w.platforms;
    const spawn=platforms.findIndex(s=>w.player.x>=s.x&&w.player.x<s.x+s.w&&s.y===582);
    const reachable=new Set([spawn]),queue=[spawn];
    while(queue.length){
      const from=platforms[queue.shift()];
      for(let j=0;j<platforms.length;j++){
        if(reachable.has(j))continue;
        const to=platforms[j];
        if(from.y-to.y>235)continue;
        let landed=false;
        const centers=[from.x+20,from.x+from.w/2,from.x+from.w-45].map(x=>Math.max(0,Math.min(w.level.width-25,x)));
        for(const start of centers){
          if(landed)break;
          for(const aim of [Math.max(to.x+16,Math.min(to.x+to.w-16,start)),to.x+to.w/2,to.x+20,to.x+to.w-35]){
          if(landed)break;
          for(const secondAt of [.23,.33,.42]){
            const sim=new World(level);sim.enemies=[];
            Object.assign(sim.player,{x:start,y:from.y-52,grounded:true});sim.jump();let jumped=false;
            for(let t=0;t<1.7;t+=dt){
              if(!jumped&&t>secondAt){sim.jump();jumped=true;}
              const center=sim.player.x+12.5,target=aim;
              sim.update(dt,{left:center>target+3,right:center<target-3});
              if(sim.player.grounded&&t>.12&&Math.abs(sim.player.y+52-to.y)<.1&&sim.player.x+25>to.x&&sim.player.x<to.x+to.w){landed=true;break;}
              if(sim.player.y>740)break;
            }
            if(landed)break;
          }
          }
        }
        if(landed){reachable.add(j);queue.push(j);}
      }
    }
    for(const [x,floor] of w.level.enemies){
      const index=platforms.findIndex(s=>x>=s.x&&x<s.x+s.w&&s.y===floor);
      assert.ok(index>=0,`enemy has a platform in level ${level+1}`);
      assert.ok(reachable.has(index),`level ${level+1}: enemy platform ${index} at (${x}, ${floor}) is reachable`);
    }
  }
});
