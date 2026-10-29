'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Kitchen,INGREDIENTS}=require('../kitchen-core.js'),{Campaign,JOBS}=require('../campaign.js');
function solve(g){
  g.start();
  for(let i=0;i<10000&&g.status!=='done';i++){
    if(g.job==='fish'){
      const [x,y]=g.path[g.index],next=g.path[g.index+1];
      if(next)g.turn(next[0]>x?'right':next[0]<x?'left':next[1]>y?'down':'up');
    }else if(g.job==='rice'){g.setHeat(g.temperature<66?75:40);if(g.stirAge>3)g.stir();}
    else if(g.job==='slice'){if(Math.abs(g.beatClock-g.cutTarget)<.035)g.slice();}
    else if(g.job==='roll')g.setRolling(g.pressure<g.target);
    else if(g.job==='order'&&g.orderPhase==='recall')g.chooseIngredient(g.sequence[g.cursor]);
    g.update(1/60);
  }
  return g;
}
test('all five minigames and hard variants can be completed with good quality across different seeds',()=>{
  for(const job of Object.keys(JOBS))for(const rare of [false,true])for(const seed of [0,1,47,500,123456]){
    const g=solve(new Kitchen({day:1,seed,job,rare}));assert.equal(g.status,'done',job+' '+seed);assert.equal(g.progress,1);assert.ok(g.quality>=80,job+' quality '+g.quality);
  }
});
test('leaving any game unattended never unlocks a raid',()=>{
  for(const job of Object.keys(JOBS)){
    const c=new Campaign(null,()=>.3);c.work.job=job;const g=new Kitchen(c.work);g.start();
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

test('rhythm rejects early cuts and spam; accurate cuts finish the entire required batch',()=>{
  const g=new Kitchen({day:1,seed:12,job:'slice',rare:true});g.start();assert.equal(g.slice(),false);
  const quality=g.quality;for(let i=0;i<20;i++)g.slice();assert.equal(g.quality,quality);assert.equal(g.cuts,0);
  solve(g);assert.equal(g.cuts,16);assert.equal(g.status,'done');assert.ok(g.quality<100&&g.quality>=80);
});
test('holding the mat constantly overpresses the roll and cannot complete it',()=>{
  const g=new Kitchen({day:1,seed:4,job:'roll',rare:false});g.start();g.setRolling(true);
  for(let i=0;i<3600;i++)g.update(1/60);
  assert.equal(g.pressure,100);assert.ok(g.quality<40);assert.ok(g.progress<1);
  solve(g);assert.equal(g.status,'done');assert.equal(g.rolling,false);
});
test('memory order cannot be assembled during preview; mistakes and replay cost quality',()=>{
  const g=new Kitchen({day:1,seed:20,job:'order',rare:true});g.start();
  assert.equal(g.chooseIngredient(g.sequence[0]),false);assert.equal(g.cursor,0);
  while(g.orderPhase==='watch')g.update(.05);
  const wrong=INGREDIENTS.find(i=>i.id!==g.sequence[0]).id;
  assert.equal(g.chooseIngredient(wrong),false);assert.equal(g.quality,94);assert.equal(g.orderPhase,'watch');assert.equal(g.progress,0);
  while(g.orderPhase==='watch')g.update(.05);
  assert.equal(g.replayOrder(),true);assert.equal(g.quality,86);solve(g);
  assert.equal(g.order,5);assert.equal(g.status,'done');assert.equal(g.quality,86);
});
test('all jobs have seed-stable content and cannot act before starting or after finishing',()=>{
  for(const job of ['slice','roll','order']){
    const a=new Kitchen({day:1,seed:19,job,rare:true}),b=new Kitchen({day:1,seed:19,job,rare:true});
    assert.deepEqual(a.sequence,b.sequence);assert.equal(a.period,b.period);
    assert.equal(a.slice(),false);assert.equal(a.chooseIngredient('rice'),false);a.setRolling(true);assert.ok(!a.rolling);
    solve(a);const score=a.quality,progress=a.progress;a.slice();a.chooseIngredient('salmon');a.replayOrder();a.setRolling(true);a.update(.05);
    assert.equal(a.quality,score);assert.equal(a.progress,progress);assert.ok(!a.rolling);
  }
});
