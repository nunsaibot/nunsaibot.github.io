'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Kitchen}=require('../kitchen-core.js'),{Campaign}=require('../campaign.js');
function solve(g){
  g.start();
  for(let i=0;i<10000&&g.status!=='done';i++){
    if(g.job==='fish'){
      const [x,y]=g.path[g.index],next=g.path[g.index+1];
      if(next)g.turn(next[0]>x?'right':next[0]<x?'left':next[1]>y?'down':'up');
    }else{g.setHeat(g.temperature<66?75:40);if(g.stirAge>3)g.stir();}
    g.update(1/60);
  }
  return g;
}
test('both minigames and hard variants can be completed with good quality across different seeds',()=>{
  for(const job of ['fish','rice'])for(const rare of [false,true])for(const seed of [0,1,47,500,123456]){
    const g=solve(new Kitchen({day:1,seed,job,rare}));assert.equal(g.status,'done',job+' '+seed);assert.equal(g.progress,1);assert.ok(g.quality>=80,job+' quality '+g.quality);
  }
});
test('leaving either game unattended never unlocks a raid',()=>{
  for(const job of ['fish','rice']){
    const c=new Campaign(null,()=>0);c.work.job=job;const g=new Kitchen(c.work);g.start();
    for(let i=0;i<8000;i++)g.update(1/60);
    assert.notEqual(g.status,'done');assert.equal(c.completeWork(g),false);assert.equal(c.beginRaid(0),null);
  }
});
test('knife collisions lower quality but correction can still finish the entire order',()=>{
  const g=new Kitchen({day:1,seed:11,job:'fish',rare:false});g.start();g.turn('up');
  for(let i=0;i<160;i++)g.update(1/60);
  assert.ok(g.mistakes>=3);solve(g);assert.equal(g.status,'done');assert.ok(g.quality<80);assert.equal(g.portion,3);
});
test('rice progress stops when forgotten and overheating costs quality',()=>{
  const g=new Kitchen({day:1,seed:3,job:'rice',rare:false});g.start();g.setHeat(100);
  for(let i=0;i<900;i++)g.update(1/60);
  const progress=g.progress;for(let i=0;i<180;i++)g.update(1/60);
  assert.equal(g.progress,progress);assert.ok(g.quality<80);assert.ok(g.temperature>94);
});
test('a genuinely completed shift grants access and cannot be submitted twice',()=>{
  const c=new Campaign(null,()=>.3),g=solve(new Kitchen(c.work));
  assert.equal(c.completeWork(g),true);assert.equal(c.completeWork(g),false);assert.ok(c.beginRaid(0));
});
