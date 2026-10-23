'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Campaign:ActualCampaign,RAIDS,JOBS,STORAGE_KEY}=require('../campaign.js');
// These existing economy scenarios run on workdays; day-off behavior is tested below with the real class.
class Campaign extends ActualCampaign{newDay(){super.newDay();this.work.dayOff=false;this.work.phase='work';}}
const {World,BUFFS,WEAPONS}=require('../engine.js');
function memory(initial=null){let value=initial;return{getItem:()=>value,setItem:(key,next)=>{assert.equal(key,STORAGE_KEY);value=next;}};}
function complete(c,quality=79){const w=c.work;assert.equal(c.completeWork({day:w.day,seed:w.seed,job:w.job,status:'done',progress:1,quality}),true);}
function run(c,index=0){const entry=c.beginRaid(index);assert.ok(entry);return new World(index,entry);}
function win(c,index=0){complete(c);const w=run(c,index);w.status='cleared';return c.claimRaid(w);}
test('raid entry requires a completed matching shift and can only be spent once',()=>{
  const c=new Campaign(memory(),()=>0);assert.equal(c.beginRaid(0),null);
  assert.equal(c.completeWork({status:'done',progress:1,quality:100}),false);
  complete(c);assert.equal(c.work.buff,null);const w=run(c);assert.equal(c.beginRaid(0),null);assert.equal(w.player.hp,2);
});
test('successful repeat raids pay once each and require a new working day',()=>{
  const c=new Campaign(memory(),()=>0);complete(c);const w=run(c);w.status='cleared';
  assert.equal(c.claimRaid(w),1);assert.equal(c.claimRaid(w),0);assert.equal(c.work.phase,'work');assert.equal(c.work.day,2);
  assert.equal(win(c),1);assert.equal(c.balance,2);assert.deepEqual(c.clears,[2,0,0]);
});
test('failure and abort spend the buff, pay nothing, and change the next job',()=>{
  const c=new Campaign(memory(),()=>0);complete(c,100);const previous=c.work.job,w=run(c);w.status='dead';
  assert.equal(c.claimRaid(w),0);assert.equal(c.abandonRaid(),true);assert.equal(c.abandonRaid(),false);
  assert.equal(c.balance,0);assert.equal(c.work.buff,null);assert.equal(c.work.phase,'work');assert.notEqual(c.work.job,previous);
});
test('quality 79 gives no buff; 80 and 100 each give exactly one valid buff',()=>{
  for(const quality of [79,80,100]){const c=new Campaign(memory(),()=>0);complete(c,quality);assert.equal(!!BUFFS[c.work.buff],quality>=80);}
});
test('all six buffs can be assigned and assignment stays saved',()=>{
  const seen=new Set();
  for(let seed=0;seed<150;seed++){const storage=memory(),c=new Campaign(storage,()=>0);c.work.seed=seed;complete(c,80);seen.add(c.work.buff);assert.equal(new Campaign(storage).work.buff,c.work.buff);}
  assert.deepEqual([...seen].sort(),Object.keys(BUFFS).sort());
});
test('double trophy doubles a found trophy only for its single successful raid',()=>{
  const c=new Campaign(memory(),()=>0);complete(c,100);c.work.buff='bounty';const w=run(c);w.status='cleared';
  assert.equal(c.claimRaid(w),2);assert.equal(c.claimRaid(w),0);assert.equal(win(c),1);assert.equal(c.balance,3);
});
test('reload keeps unfinished task and ready buff, while active raid reload consumes the day',()=>{
  const storage=memory(),c=new Campaign(storage,()=>0);const first={...c.work},a=new Campaign(storage);
  assert.equal(a.work.seed,first.seed);assert.equal(a.work.job,first.job);complete(a,100);const b=new Campaign(storage);
  assert.equal(b.work.phase,'ready');assert.equal(b.work.buff,a.work.buff);run(b);
  const reload=new Campaign(storage);assert.equal(reload.work.day,2);assert.equal(reload.work.phase,'work');assert.equal(reload.work.buff,null);assert.notEqual(reload.work.job,first.job);
});
test('shop purchase still costs four, auto-equips and survives reloading',()=>{
  const storage=memory(),c=new Campaign(storage,()=>0);for(let i=0;i<3;i++)win(c,0);
  assert.deepEqual(c.buyAkatsuki(),{ok:false,reason:'funds'});assert.equal(c.balance,3);win(c);
  assert.deepEqual(c.buyAkatsuki(),{ok:true});assert.equal(c.balance,0);assert.equal(c.equipped,'akatsuki');
  assert.deepEqual(c.buyAkatsuki(),{ok:false,reason:'owned'});assert.equal(new Campaign(storage).equipped,'akatsuki');
  c.equip('katana');assert.equal(new Campaign(storage).equipped,'katana');
});
test('old saves migrate without losing money or equipment',()=>{
  const c=new Campaign(memory(JSON.stringify({version:1,balance:3,clears:[1,2,3],ownsAkatsuki:true,equipped:'akatsuki'})));
  assert.equal(c.balance,3);assert.equal(c.equipped,'akatsuki');assert.deepEqual(c.clears,[1,2,3]);assert.equal(c.work.phase,'work');
});
test('damaged or unavailable storage stays playable',()=>{
  const c=new Campaign(memory('{broken'));assert.equal(c.balance,0);assert.equal(c.equipped,'katana');
  const unavailable=new Campaign({getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}},()=>0);
  assert.equal(win(unavailable),1);assert.equal(unavailable.persisted,false);
});
test('unknown and unowned weapons cannot be equipped',()=>{
  const c=new Campaign(memory(),()=>0);assert.equal(c.equip('akatsuki'),false);assert.equal(c.equip('unknown'),false);
});
test('base health is two, vitality is three, and revival saves only the lethal hit',()=>{
  const normal=new World(),healthy=new World(0,{buff:'vitality'}),revive=new World(0,{buff:'revive'});
  assert.equal(normal.player.hp,2);normal.hurtPlayer(1);assert.equal(normal.player.hp,1);assert.equal(normal.status,'playing');normal.player.invincible=0;normal.hurtPlayer(1);assert.equal(normal.status,'dead');
  assert.equal(healthy.player.hp,3);assert.equal(healthy.player.maxHp,3);healthy.hurtPlayer(1);assert.equal(healthy.player.hp,2);assert.equal(healthy.status,'playing');
  revive.hurtPlayer(1);assert.equal(revive.player.revives,1);assert.equal(revive.player.hp,1);revive.player.invincible=0;revive.hurtPlayer(1);assert.equal(revive.status,'playing');assert.equal(revive.player.revives,0);assert.equal(revive.player.hp,1);
  assert.ok(revive.player.invincible>1);revive.player.invincible=0;revive.hurtPlayer(1);assert.equal(revive.status,'dead');
});
test('revival also rescues a fall once without resetting killed enemies',()=>{
  const w=new World(0,{buff:'revive'});w.hurtEnemy(w.enemies[0],99,1);w.hitstop=0;Object.assign(w.player,{x:955,y:800,vy:1000,hp:1});
  w.update(1/120);assert.equal(w.player.hp,1);assert.equal(w.player.revives,0);assert.ok(w.player.y<582);assert.equal(w.kills,1);
});
test('haste increases actual run and dash velocity by ten percent',()=>{
  for(const [buff,target,dash] of [[null,300,940],['haste',330,1034]]){
    const w=new World(0,{buff});w.enemies=[];for(let i=0;i<50;i++)w.update(1/120,{right:true});
    assert.ok(Math.abs(w.player.vx-target)<.001);w.dash();w.update(1/120);assert.ok(Math.abs(w.player.vx-dash)<.001);
  }
});
test('fire and ice apply an exact 3% damage bonus without integer rounding',()=>{
  for(const weapon of Object.keys(WEAPONS))for(const buff of ['fire','ice']){
    const w=new World(0,{weapon,buff}),e=w.enemies[0];w.enemies=[e];
    Object.assign(w.player,{x:110,y:530,grounded:true});Object.assign(e,{x:160,y:532,hp:10,maxHp:10,state:'recover',timer:20});
    w.attack();w.update(1/120);assert.ok(Math.abs(e.hp-(10-WEAPONS[weapon].damage*1.03))<.0001);
    assert.equal(w.player.element,buff);assert.equal(new World(0,{weapon}).damageMultiplier,1);
  }
});
test('map shows the actual counts for its increasingly dangerous squads',()=>{
  const worlds=RAIDS.map((_,i)=>new World(i));assert.deepEqual(worlds.map(w=>w.enemies.length),[8,10,12]);assert.deepEqual(worlds.map(w=>w.enemies.filter(e=>e.type==='brute').length),[1,3,5]);
});

function lootWin(c,index,chanceRoll,amountRoll=0,buff=null){
  complete(c);c.work.buff=buff;const w=run(c,index);w.status='cleared';
  const random=c.random,draws=chanceRoll*100<c.raidOffer(index).chance?[chanceRoll,amountRoll]:[chanceRoll];
  c.random=()=>draws.length?draws.shift():random();const reward=c.claimRaid(w);c.random=random;
  return{reward,world:w};
}
test('daily offers cover both endpoints and retain the same chances through menus and reloads',()=>{
  for(const [random,expected]of [[0,[10,30,40]],[.999999,[30,50,80]]]){
    const storage=memory(),c=new Campaign(storage,()=>random);
    assert.deepEqual(c.work.raidChances,expected);complete(c);
    const restored=new Campaign(storage,()=>{throw Error('Ready day must not reroll');});
    assert.deepEqual(restored.work.raidChances,expected);
    for(let repeat=0;repeat<3;repeat++)assert.deepEqual(RAIDS.map((_,i)=>restored.raidOffer(i).chance),expected);
    run(restored,2);assert.deepEqual(restored.work.raidChances,expected);
  }
});
test('successful and empty clears use the exact displayed probability boundary for each base',()=>{
  for(const [index,chance]of [[0,30],[1,50],[2,80]])for(const succeeds of [true,false]){
    const c=new Campaign(memory(),()=>0);c.work.raidChances[index]=chance;
    assert.equal(c.raidOffer(index).chance,chance);
    const {reward,world}=lootWin(c,index,chance/100-(succeeds?.000001:0));
    assert.equal(reward,succeeds?1:0);assert.equal(c.balance,reward);assert.equal(c.clears[index],1);assert.equal(c.work.day,2);
    assert.equal(c.claimRaid(world),0);assert.equal(c.dryStreak,succeeds?0:1);assert.equal(c.clears[index],1);
  }
});
test('conditional loot quantities follow 100, 70/30 and 40/30/20/10 weights',()=>{
  for(const [index,expected]of [[0,[100]],[1,[70,30]],[2,[40,30,20,10]]]){
    const counts=Array(expected.length).fill(0);
    for(let value=0;value<100;value++){
      const c=new Campaign(memory(),()=>0),{reward}=lootWin(c,index,0,(value+.5)/100);
      assert.ok(reward>=1&&reward<=expected.length);counts[reward-1]++;
    }
    assert.deepEqual(counts,expected);
  }
});
test('empty clears build a saved bonus for every base; death and abort do not farm or reset it',()=>{
  const storage=memory(),c=new Campaign(storage,()=>0);
  lootWin(c,0,.99);lootWin(c,1,.99);assert.equal(c.dryStreak,2);
  assert.deepEqual(RAIDS.map((_,i)=>c.raidOffer(i).chance),[30,50,60]);
  const restored=new Campaign(storage,()=>0);assert.equal(restored.pityBonus,20);complete(restored);const w=run(restored,2);w.status='dead';
  assert.equal(restored.claimRaid(w),0);assert.equal(restored.pityBonus,20);restored.abandonRaid();assert.equal(restored.pityBonus,20);
  complete(restored);run(restored);const reloaded=new Campaign(storage,()=>0);assert.equal(reloaded.pityBonus,20);
  assert.equal(lootWin(reloaded,2,0,.95).reward,4);assert.equal(reloaded.pityBonus,0);
  assert.equal(new Campaign(storage).dryStreak,0);
});
test('a long empty streak reaches 100 percent, pays even on the highest roll and resets the bonus',()=>{
  const c=new Campaign(memory(),()=>0);
  for(let i=0;i<9;i++)assert.equal(lootWin(c,0,.999999).reward,0);
  assert.deepEqual(RAIDS.map((_,i)=>c.raidOffer(i).chance),[100,100,100]);
  assert.equal(c.raidOffer(2).bonus,60);assert.equal(lootWin(c,0,.999999).reward,1);assert.equal(c.dryStreak,0);
});
test('double trophy can pay six or eight, preserves zero, and never changes the chance',()=>{
  for(const [index,roll,expected]of [[0,0,2],[1,.8,4],[2,.8,6],[2,.95,8]]){
    const c=new Campaign(memory(),()=>0),before=c.raidOffer(index).chance;
    complete(c);c.work.buff='bounty';assert.equal(c.raidOffer(index).chance,before);
    assert.deepEqual(c.raidOffer(index).drops.map(d=>d.amount),RAIDS[index].drops.map(d=>d.amount*2));
    const w=run(c,index);w.status='cleared';let draws=[0,roll];c.random=()=>draws.length?draws.shift():0;
    assert.equal(c.claimRaid(w),expected);assert.equal(c.balance,expected);assert.equal(c.work.buff,null);
  }
  const c=new Campaign(memory(),()=>0);assert.equal(lootWin(c,2,.99,.95,'bounty').reward,0);assert.equal(c.pityBonus,10);assert.equal(c.work.buff,null);
});
test('version two saves receive daily chances without losing a completed shift or a buff',()=>{
  const saved={version:2,balance:3,clears:[1,2,3],ownsAkatsuki:true,equipped:'akatsuki',work:{day:5,job:'rice',seed:7,rare:false,phase:'ready',quality:99,buff:'bounty'}};
  const storage=memory(JSON.stringify(saved)),c=new Campaign(storage,()=>.5);
  assert.equal(c.balance,3);assert.equal(c.equipped,'akatsuki');assert.equal(c.work.phase,'ready');assert.equal(c.work.buff,'bounty');assert.equal(c.work.day,5);
  assert.deepEqual(c.work.raidChances,[20,40,60]);assert.equal(c.pityBonus,0);assert.deepEqual(new Campaign(storage).work.raidChances,[20,40,60]);
});
test('invalid or missing saved chances and streaks are repaired',()=>{
  const saved={dryStreak:-7,work:{day:3,job:'fish',seed:8,phase:'work',raidChances:[0,55,101]}};
  const c=new Campaign(memory(JSON.stringify(saved)),()=>0);
  assert.deepEqual(c.work.raidChances,[10,30,40]);assert.equal(c.dryStreak,0);assert.equal(c.work.day,3);
});

test('new days have exactly a seventeen percent day-off interval and access without buffs',()=>{
  let holidays=0;
  for(let i=0;i<100;i++){
    const c=new ActualCampaign(memory(),()=>(i+.5)/100);
    if(c.work.dayOff){holidays++;assert.equal(c.work.phase,'ready');assert.equal(c.work.quality,null);assert.equal(c.work.buff,null);assert.ok(c.beginRaid(0));assert.equal(c.beginRaid(0),null);}
    else{assert.equal(c.work.phase,'work');assert.equal(c.beginRaid(0),null);}
  }
  assert.equal(holidays,17);
  assert.equal(new ActualCampaign(memory(),()=>.17).work.dayOff,false);
});
test('day off remains saved, cannot grant a cooking buff, and allows shopping before the raid',()=>{
  const storage=memory(),c=new ActualCampaign(storage,()=>.1),first={...c.work};c.balance=4;c.save();
  const reload=new ActualCampaign(storage,()=>{throw Error('Saved holiday must not reroll');});
  assert.deepEqual(reload.work,first);assert.equal(reload.completeWork({...first,status:'done',progress:1,quality:100}),false);
  assert.equal(reload.buyAkatsuki().ok,true);assert.equal(reload.work.day,1);assert.equal(reload.work.dayOff,true);
  const entry=reload.beginRaid(2);assert.equal(entry.buff,null);assert.equal(entry.weapon,'akatsuki');
  reload.random=()=>.5;reload.abandonRaid();assert.equal(reload.work.day,2);assert.equal(reload.work.dayOff,false);assert.equal(reload.work.phase,'work');
});
test('reloading an active holiday raid consumes that attempt and generates the next day',()=>{
  const storage=memory(),c=new ActualCampaign(storage,()=>.1);c.beginRaid(0);
  const next=new ActualCampaign(storage,()=>.5);assert.equal(next.work.day,2);assert.equal(next.work.phase,'work');assert.equal(next.work.buff,null);
});
test('all five jobs are available and adjacent daily assignments never repeat',()=>{
  const seen=new Set();for(let i=0;i<100;i++)seen.add(new ActualCampaign(null,()=>(i+.5)/100).work.job);
  assert.deepEqual([...seen].sort(),Object.keys(JOBS).sort());
  let seed=41;const c=new ActualCampaign(null,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
  for(let i=0;i<100;i++){const previous=c.work.job;c.newDay();assert.notEqual(c.work.job,previous);}
});
test('legacy workday saves do not gain a holiday or lose their earned buff on migration',()=>{
  const saved={version:3,balance:7,ownsAkatsuki:true,equipped:'akatsuki',work:{day:8,job:'rice',seed:4,phase:'ready',quality:100,buff:'bounty',raidChances:[20,40,60]}};
  const c=new ActualCampaign(memory(JSON.stringify(saved)),()=>{throw Error('Do not reroll existing workday');});
  assert.equal(c.work.dayOff,false);assert.equal(c.work.buff,'bounty');assert.equal(c.work.quality,100);assert.equal(c.balance,7);assert.equal(c.equipped,'akatsuki');
});
