'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World,LEVELS,REGIONS,ENEMY_TYPES}=require('../engine.js');
const {Campaign,RAIDS}=require('../campaign.js');
const quotes=require('../okusan-quotes.js');
function memory(raw={}){let value=JSON.stringify(raw);return{getItem:()=>value,setItem:(_,next)=>{value=next;}};}
function ready(balance=5){return{version:4,balance,dryStreak:2,clears:[1,2,3],ownsAkatsuki:true,equipped:'akatsuki',work:{day:8,job:'rice',seed:3,phase:'ready',rare:false,quality:100,buff:'vitality',dayOff:false,raidChances:[17,38,67]}};}
function battle(type){const w=new World(3,{random:()=>.5}),e=w.enemies[0];w.platforms=[{x:0,y:582,w:1500,h:180}];w.enemies=[e];Object.assign(w.player,{x:500,y:530,grounded:true});Object.assign(e,{type,x:180,y:532,h:50,w:25,hp:ENEMY_TYPES[type].hp,state:'patrol',cooldown:0,grounded:true,alert:4});return{w,e};}
function advance(w,seconds){for(let t=0;t<seconds;t+=1/120)w.update(1/120);}

test('24 distinct locations form eight regions, each with increasing enemy counts and three loot tiers',()=>{
  assert.equal(LEVELS.filter(l=>!l.boss).length,24);assert.equal(RAIDS.filter(r=>!r.boss).length,24);assert.equal(REGIONS.length,8);assert.equal(new Set(LEVELS.map(l=>l.name)).size,32);
  const seen=new Set();
  for(let region=0;region<8;region++){
    const levels=LEVELS.filter(l=>l.region===region&&!l.boss);assert.equal(levels.length,3);
    assert.ok(levels[0].enemies.length<levels[1].enemies.length&&levels[1].enemies.length<levels[2].enemies.length);
    levels.forEach((level,tier)=>{assert.equal(level.theme,REGIONS[region].id);assert.deepEqual(RAIDS[region*3+tier].drops,RAIDS[tier].drops);assert.deepEqual(RAIDS[region*3+tier].chance,RAIDS[tier].chance);level.enemies.forEach(([x,y,type])=>{seen.add(type);assert.ok(ENEMY_TYPES[type]);assert.ok(level.platforms.some(p=>x>=p.x&&x<=p.x+p.w&&y===p.y));});});
  }
  assert.deepEqual([...seen].sort(),Object.keys(ENEMY_TYPES).sort());
});

test('v4 migration expands progress without changing the existing shift, chances, equipment or money',()=>{
  const storage=memory(ready()),c=new Campaign(storage,()=>.5);
  assert.equal(c.balance,5);assert.equal(c.equipped,'akatsuki');assert.equal(c.dryStreak,2);
  assert.deepEqual(c.clears.slice(0,3),[1,2,3]);assert.equal(c.clears.length,32);assert.ok(c.clears.slice(3).every(n=>n===0));
  assert.deepEqual(c.work.raidChances.slice(0,3),[17,38,67]);assert.equal(c.work.raidChances.length,32);assert.equal(c.work.buff,'vitality');assert.equal(c.work.day,8);
  const reload=new Campaign(storage,()=>{throw Error('A saved day must not reroll');});assert.deepEqual(reload.work,c.work);assert.deepEqual(reload.clears,c.clears);
});

test('the last location uses normal single-attempt completion and hard-tier loot',()=>{
  const c=new Campaign(memory(ready()),()=>0),w=new World(23,c.beginRaid(23));assert.equal(w.player.hp,3);w.status='cleared';
  assert.equal(c.claimRaid(w),1);assert.equal(c.claimRaid(w),0);assert.equal(c.clears[23],1);assert.equal(c.work.day,9);assert.equal(c.work.buff,null);
});

test('Okusan offers cost one, keep the day and buff, save, and do not repeat in a 100-quote cycle',()=>{
  assert.equal(quotes.length,100);assert.equal(new Set(quotes).size,100);
  const storage=memory(ready(101)),c=new Campaign(storage,()=>.41),work=JSON.stringify(c.work),seen=new Set();
  for(let i=0;i<100;i++){
    const result=c.offerOkusan();assert.equal(result.ok,true);assert.equal(result.quote,quotes[result.index]);assert.ok(!seen.has(result.index));seen.add(result.index);
    assert.equal(c.balance,100-i);assert.equal(JSON.stringify(c.work),work);assert.equal(c.dryStreak,2);
    if(i===38){const restored=new Campaign(storage,()=>{throw Error('Restoring must not shuffle');});assert.deepEqual(restored.okusan,c.okusan);assert.equal(restored.balance,c.balance);}
  }
  const previous=c.okusan.last,next=c.offerOkusan();assert.notEqual(next.index,previous);assert.equal(c.balance,0);assert.equal(c.okusan.gifts,101);
  const snapshot=JSON.stringify(c.okusan);assert.deepEqual(c.offerOkusan(),{ok:false,reason:'funds'});assert.equal(JSON.stringify(c.okusan),snapshot);assert.equal(c.balance,0);
});

test('leaving/reloading the visit does not consume quotes and an active raid rejects offerings',()=>{
  const storage=memory(ready()),c=new Campaign(storage,()=>.5);c.offerOkusan();const snapshot=JSON.stringify(c.okusan);
  const reload=new Campaign(storage,()=>.5);assert.equal(JSON.stringify(reload.okusan),snapshot);reload.beginRaid(3);
  assert.deepEqual(reload.offerOkusan(),{ok:false,reason:'raid'});assert.equal(reload.balance,4);assert.equal(JSON.stringify(reload.okusan),snapshot);
});

test('archer visibly aims before firing a travelling, damaging arrow',()=>{
  const {w,e}=battle('archer');advance(w,.1);assert.equal(e.state,'aim');assert.equal(w.projectiles.length,0);assert.equal(w.player.hp,2);
  advance(w,.68);assert.equal(w.projectiles.length,0);advance(w,.15);assert.equal(w.projectiles.length,1);assert.equal(w.player.hp,2);
  advance(w,.8);assert.equal(w.player.hp,1);
});

test('solid platforms block line of sight and arrows; dash evades arrows',()=>{
  const {w,e}=battle('archer');w.platforms.push({x:330,y:450,w:18,h:132});assert.equal(w.clearShot(e,w.player),false);
  w.projectiles=[{x:250,y:550,vx:430,vy:0,life:2}];w.updateProjectiles(1);assert.equal(w.player.hp,2);assert.equal(w.projectiles.length,0);
  w.platforms.pop();assert.equal(w.clearShot(e,w.player),true);w.amulets.dash=true;w.dash();w.projectiles=[{x:480,y:550,vx:430,vy:0,life:2}];w.updateProjectiles(.1);assert.equal(w.player.hp,2);assert.equal(w.projectiles.length,0);
});

test('spearmen threaten outside a guards reach and assassins close in faster',()=>{
  for(const [type,expected]of [['spearman',1],['guard',2]]){const {w,e}=battle(type);e.x=350;e.state='strike';e.timer=.15;e.facing=1;e.vx=0;w.update(1/120);assert.equal(w.player.hp,expected);}
  const speeds={};for(const type of ['guard','assassin']){const {w,e}=battle(type);w.update(1/120);speeds[type]=e.vx;}
  assert.ok(speeds.assassin>speeds.guard);assert.ok(ENEMY_TYPES.assassin.hp<ENEMY_TYPES.guard.hp);
});
