'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World,LEVELS,REGIONS}=require('../engine.js'),{Campaign,RAIDS}=require('../campaign.js'),Bosses=require('../bosses.js');
const dt=1/120;
function run(w,seconds,input={}){for(let t=0;t<seconds;t+=dt)w.update(dt,input);}
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function memory(raw){let data=JSON.stringify(raw);return{getItem:()=>data,setItem:(_,v)=>data=v};}
function saved(buff=null,clears=Array(24).fill(1)){return{version:5,balance:7,dryStreak:3,clears,ownsAkatsuki:true,equipped:'akatsuki',work:{day:9,seed:777,job:'fish',phase:'ready',quality:100,buff,raidChances:RAIDS.slice(0,24).map(r=>r.chance[0])}};}
function cast(region,move,phase=1){const w=new World(24+region,{random:()=>.5,blood:0}),b=w.boss;Object.assign(w.player,{x:700,y:530,grounded:true});Object.assign(b,{x:900,state:'windup',timer:0,move,phase,facing:-1,target:{x:712,y:556}});Bosses.update(w,b,dt);return w;}

test('32 maps preserve the first 24 mission IDs and add one distinct boss per district',()=>{
  assert.equal(LEVELS.length,32);assert.equal(RAIDS.length,32);assert.equal(new Set(Bosses.DEFS.map(d=>d.id)).size,8);
  for(let r=0;r<8;r++){
    assert.equal(LEVELS.filter(l=>l.region===r).length,4);
    for(let t=0;t<3;t++){assert.equal(LEVELS[r*3+t].region,r);assert.equal(LEVELS[r*3+t].boss,undefined);}
    const w=new World(24+r);assert.equal(w.level.name,'Босс — '+Bosses.DEFS[r].name);assert.equal(w.level.theme,REGIONS[r].id);
    assert.equal(w.enemies.length,1);assert.equal(w.enemies[0],w.boss);assert.ok(w.boss.hp>=28);
    assert.ok(w.platforms.some(s=>s.kind==='ground'&&s.x<=0&&s.x+s.w>=w.level.width));
    run(w,15);assert.equal(w.player.hp,2);assert.equal(w.boss.state,'sleep');assert.equal(w.bossHazards.length,0);
  }
  assert.equal(new Set(Bosses.DEFS.map(d=>d.moves.join(','))).size,8);
});

test('three distinct successful missions unlock only their district; rejection spends nothing',()=>{
  const c=new Campaign(memory(saved(null,Array(24).fill(0))),()=>.99),before=JSON.stringify(c.work);
  c.clears[0]=30;assert.equal(c.beginRaid(24),null);assert.equal(JSON.stringify(c.work),before);
  c.clears[1]=1;assert.equal(c.bossUnlocked(0),false);c.clears[2]=1;
  assert.equal(c.bossUnlocked(0),true);assert.equal(c.canEnter(25),false);assert.equal(c.regionProgress(0),3);
  assert.ok(c.beginRaid(24));assert.equal(c.beginRaid(24),null);
});

test('v5 saves preserve money, all old clear counts, today and chances without rerolling',()=>{
  const raw=saved('bounty',Array.from({length:24},(_,i)=>i+1)),storage=memory(raw);
  const c=new Campaign(storage,()=>{throw Error('Migration must not reroll');});
  assert.equal(c.balance,7);assert.deepEqual(c.clears.slice(0,24),raw.clears);assert.deepEqual(c.clears.slice(24),Array(8).fill(0));
  assert.deepEqual(c.work.raidChances.slice(0,24),raw.work.raidChances);assert.deepEqual(c.work.raidChances.slice(24),Array(8).fill(100));
  assert.equal(c.work.buff,'bounty');assert.equal(c.work.day,9);assert.equal(c.equipped,'akatsuki');
  const again=new Campaign(storage,()=>{throw Error('Reload must not reroll');});assert.deepEqual(again.work,c.work);assert.ok(again.bossUnlocked(7));
});

test('every boss guarantees 3, or 6 with bounty; a result can be claimed once and starts a new day',()=>{
  for(let r=0;r<8;r++)for(const buff of [null,'bounty']){
    const c=new Campaign(memory(saved(buff)),()=>.999999),entry=c.beginRaid(24+r),w=new World(24+r,{...entry,random:()=>.5,blood:0});
    assert.deepEqual(c.raidOffer(24+r),{baseChance:100,bonus:0,chance:100,multiplier:buff?2:1,drops:[{amount:buff?6:3,weight:100}]});
    w.hurtEnemy(w.boss,99,1);run(w,1.2);assert.equal(w.status,'cleared');
    const amount=buff?6:3;assert.equal(c.claimRaid(w),amount);assert.equal(c.balance,7+amount);assert.equal(c.dryStreak,0);assert.equal(c.clears[24+r],1);
    assert.equal(c.work.day,10);assert.equal(c.work.buff,null);assert.equal(c.claimRaid(w),0);assert.equal(c.beginRaid(24+r),null);
    c.completeWork({...c.work,status:'done',progress:1,quality:0});assert.ok(c.beginRaid(24+r),'boss can be replayed after another shift');
  }
});

test('death, leaving and reloading an active boss fight pay nothing and consume the attempt',()=>{
  const storage=memory(saved()),c=new Campaign(storage,()=>.99),w=new World(24,c.beginRaid(24));
  w.player.hp=1;w.hurtPlayer(1);assert.equal(c.claimRaid(w),0);assert.equal(c.balance,7);
  const restored=new Campaign(storage,()=>.99);assert.equal(restored.work.day,10);assert.equal(restored.balance,7);assert.equal(restored.clears[24],0);assert.equal(restored.dryStreak,3);assert.ok(restored.bossUnlocked(0));
  assert.equal(c.abandonRaid(),true);assert.equal(c.abandonRaid(),false);assert.equal(c.work.day,10);
});

test('all eight bosses use their own move pool and strengthen at half health without stun-lock',()=>{
  for(let r=0;r<8;r++){
    const w=new World(24+r,{random:rng(41+r),blood:0}),b=w.boss,seen=new Set();w.player.x=750;w.player.invincible=1000;
    for(let i=0;i<120*45;i++){w.update(dt);if(b.move)seen.add(b.move);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}
    assert.deepEqual([...seen].sort(),[...b.def.moves].sort(),b.name);assert.ok(w.bossHazards.length<35);
    b.state='windup';b.timer=.8;w.hurtEnemy(b,1,1,true);assert.equal(b.state,'windup');assert.equal(b.timer,.8);
    w.hurtEnemy(b,b.maxHp*.5,1);w.hitstop=0;w.update(dt);assert.equal(b.phase,2);assert.equal(b.state,'recover');assert.equal(w.bossHazards.length,0);
  }
});

test('falling objects must reach the player, and area attacks still allow an escape without markers',()=>{
  for(const [r,move]of [[2,'anchor'],[3,'icicles'],[4,'verdict'],[5,'beams'],[7,'eruption']]){
    const w=cast(r,move);run(w,.18);assert.equal(w.player.hp,2,move+' not active yet');
    run(w,.85);assert.equal(w.player.hp,1,move+' impact');
    const escape=cast(r,move);for(let i=0;i<144;i++)escape.update(dt,{left:escape.player.x>620});assert.equal(escape.player.hp,2,move+' avoidable by moving into the gap');
  }
});

test('waves can be jumped; dash and revival apply to boss attacks',()=>{
  const w=cast(0,'waves');w.player.x=880;w.jump();run(w,.5);assert.equal(w.player.hp,2);
  const dodge=cast(7,'breath');dodge.amulets.dash=true;dodge.dash();Bosses.updateHazards(dodge,.02);assert.equal(dodge.player.hp,2);
  const revived=cast(7,'breath');revived.player.hp=1;revived.player.revives=1;Bosses.updateHazards(revived,.02);assert.equal(revived.player.hp,1);assert.equal(revived.player.revives,0);assert.equal(revived.status,'playing');
});

test('mines can be disarmed, hooks pull toward the pirate, and blades return',()=>{
  const mine=cast(5,'mines');mine.player.x=650;mine.player.facing=1;mine.attack();run(mine,.05);assert.equal(mine.bossHazards.filter(h=>h.type==='mine').length,2);
  const hook=cast(2,'hook');run(hook,.6);assert.equal(hook.player.hp,1);assert.ok(hook.player.x>700,'hook pulls right toward the pirate');
  const blades=cast(6,'blades'),first=blades.bossHazards[0],vx=first.vx;blades.player.invincible=100;run(blades,1);assert.equal(first.returning,true);assert.equal(Math.sign(first.vx),-Math.sign(vx));
});

test('boss hazards threaten elevated camping and never remain after boss death or a new map',()=>{
  const w=cast(4,'lightning');Object.assign(w.player,{x:480,y:404,grounded:true});run(w,1.1);assert.equal(w.player.hp,1);
  const danger=cast(7,'breath');danger.hurtEnemy(danger.boss,99,1);assert.equal(danger.bossHazards.length,0);run(danger,1.2);assert.equal(danger.status,'cleared');assert.equal(danger.player.hp,2);assert.equal(danger.events.filter(e=>e.type==='clear').length,1);
  danger.load(0);assert.equal(danger.boss,null);assert.equal(danger.bossHazards.length,0);
});

test('normal sword combos actually damage a boss during recovery and can end the fight',()=>{
  const w=new World(24,{random:()=>.5,blood:0}),b=w.boss;Object.assign(b,{x:200,y:504,state:'recover',timer:100});w.player.x=150;w.player.facing=1;
  for(let i=0;i<40&&!b.dead;i++){b.state='recover';b.timer=100;b.x=w.player.x+50;b.y=504;w.player.invincible=100;w.attack();run(w,.4);}
  assert.equal(b.dead,true);run(w,1.2);assert.equal(w.status,'cleared');assert.ok(w.chunks.length>0);
});

test('attack choice reacts to distance and height instead of repeating a fixed order',()=>{
  const sample=(x,y)=>{const w=new World(24,{random:rng(945)});w.player.x=x;w.player.y=y;w.boss.x=900;const counts={cut:0,charge:0,waves:0};for(let i=0;i<1000;i++)counts[Bosses.chooseMove(w,w.boss)]++;return counts;};
  const near=sample(820,530),far=sample(390,530),roof=sample(820,404);
  assert.ok(near.cut>far.cut*5);assert.ok(far.charge>near.charge);assert.ok(roof.cut<near.cut/3);
  const sequences=[];
  for(const seed of [11,42,97]){
    const w=new World(30,{random:rng(seed),blood:0});w.player.x=850;w.player.invincible=100;let previous=0;const moves=[];
    for(let i=0;i<120*30;i++){w.update(dt);if(w.boss.attackIndex!==previous){previous=w.boss.attackIndex;moves.push(w.boss.move);}}
    sequences.push(moves.join(','));assert.ok(moves.length>=10);assert.ok(moves.some((m,i)=>i>=3&&m!==moves[i-3]),'not the old three-move loop');
  }
  assert.equal(new Set(sequences).size,3);
});

test('bosses move faster and mobile fighters make vulnerable backsteps with a cooldown',()=>{
  const oldSpeeds=[180,260,155,215,170,150,245,190];
  for(let r=0;r<8;r++){
    const w=new World(24+r),b=w.boss;w.player.x=600;Object.assign(b,{x:1000,state:'approach',timer:2,decisionTime:2,grounded:true});
    run(w,.2);assert.ok(1000-b.x>oldSpeeds[r]*.2*1.15,b.name+' closes faster');
  }
  for(const r of [1,3,6]){
    const w=new World(24+r,{random:()=>0,blood:0}),b=w.boss;w.player.x=900;Object.assign(b,{x:950,state:'approach',timer:1,grounded:true});
    w.update(dt);assert.equal(b.state,'evade');assert.ok(b.vx>0);assert.ok(b.maneuverCooldown>=2);
    const hp=b.hp;w.hurtEnemy(b,1,-1);assert.equal(b.hp,hp-1);assert.equal(b.state,'evade');run(w,.4);assert.equal(b.state,'windup');
  }
});

test('aim tracks early movement but commits before impact, with both fast and delayed windups',()=>{
  const durations=[];
  for(let seed=1;seed<=16;seed++){
    const w=new World(24,{random:rng(seed*991)}),b=w.boss;w.player.x=760;Object.assign(b,{x:900,state:'approach',timer:0,pendingMove:'cut'});Bosses.update(w,b,dt);assert.equal(b.state,'windup');durations.push(b.windupDuration);
    b.timer=.35;w.player.x=810;Bosses.update(w,b,dt);assert.ok(b.target.x>810);
    b.timer=.18;const locked={...b.target},facing=b.facing;w.player.x=1100;Bosses.update(w,b,dt);assert.deepEqual(b.target,locked);assert.equal(b.facing,facing);
  }
  assert.ok(Math.max(...durations)-Math.min(...durations)>.2);assert.ok(Math.min(...durations)>=.4);
});

test('branches increase second-phase pressure but every chain has a finite punish window',()=>{
  for(let r=0;r<8;r++){
    const w=new World(24+r,{random:rng(784+r),blood:0}),b=w.boss;w.player.x=850;w.player.invincible=1000;b.phase=2;
    let maxChain=0,openings=0,previous='sleep';
    for(let i=0;i<120*50;i++){
      w.update(dt);maxChain=Math.max(maxChain,b.chain);assert.ok(b.chain<=2,b.name+' bounded chain');
      if(b.state==='recover'&&previous!=='recover'&&!b.followup){assert.ok(b.timer>=.55,b.name+' real recovery');openings++;}
      previous=b.state;
    }
    assert.ok(maxChain>0,b.name+' branches');assert.ok(openings>=5,b.name+' offers windows');assert.ok(b.attackIndex>=18,b.name+' applies pressure');assert.ok(w.bossHazards.length<35);
  }
});

test('duelist turns between cuts but cannot rotate a live slash onto a dodging player',()=>{
  const w=cast(0,'cut'),b=w.boss;assert.equal(b.state,'cutRecover');const slash=w.bossHazards[0],x=slash.x;w.player.x=1000;
  Bosses.update(w,b,.1);assert.equal(slash.x,x);assert.equal(b.facing,-1);
  b.timer=0;Bosses.update(w,b,dt);assert.equal(b.state,'cutTell');assert.equal(b.facing,1);
  b.timer=.1;w.player.x=700;Bosses.update(w,b,dt);assert.equal(b.facing,1);
});

test('boss rendering draws no target outlines, warning glyphs or hitbox overlays',()=>{
  const forbidden=[],calls=[];
  const context=new Proxy({},{get:(_,key)=>typeof key==='string'?((...args)=>{if(['strokeRect','setLineDash','fillText'].includes(key))forbidden.push(key);if(key==='fillRect')calls.push(args);}):undefined,set:()=>true});
  for(let r=0;r<8;r++)for(const move of Bosses.DEFS[r].moves){
    const w=cast(r,move);w.boss.state='windup';w.boss.timer=.4;Bosses.drawHazards(context,w,0);
    for(const h of w.bossHazards)h.delay=0;
    Bosses.drawHazards(context,w,0);
  }
  assert.deepEqual(forbidden,[]);assert.ok(calls.length>0,'actual attacks remain visible');
});

test('mashing katana and chasing without dodging is no longer a reliable boss strategy',()=>{
  for(let r=0;r<8;r++){
    let deaths=0;
    for(let seed=1;seed<=4;seed++){
      const w=new World(24+r,{random:rng(seed),blood:0});w.player.x=1000;
      for(let i=0;i<120*30&&w.status==='playing';i++){const dx=w.boss.x-w.player.x;w.player.facing=Math.sign(dx)||1;w.attack();w.update(dt,{left:dx< -45,right:dx>45});}
      if(w.status==='dead')deaths++;
    }
    assert.ok(deaths>=3,Bosses.DEFS[r].name+' punishes uninterrupted attacks');
  }
});
