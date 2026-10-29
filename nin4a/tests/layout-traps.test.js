'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World,LEVELS,overlap}=require('../engine.js'),Traps=require('../traps.js');
const step=1/120;
function run(w,seconds){for(let t=0;t<seconds;t+=step)w.update(step);}
function trapScene(type,buff=null){
  const w=new World(0,{random:()=>.5,buff});w.enemies=[];w.platforms=[{x:0,y:582,w:1500,h:180,kind:'ground'}];
  w.traps=Traps.create({traps:[{id:0,type,x:500,y:582,w:type==='mine'?28:100,warning:.9}]});
  Object.assign(w.player,{x:520,y:530,grounded:true});return w;
}

test('every route is longer, evenly populated, and has a safe opening and increasing tiers',()=>{
  for(let i=0;i<LEVELS.length;i++){
    const l=LEVELS[i];if(l.boss)continue;assert.ok(l.width>=5600);assert.ok(l.enemies[0][0]>=780);assert.equal(l.enemies[0][2],'guard');assert.equal(l.enemies[1][2],'guard');
    for(let j=1;j<l.enemies.length;j++){const gap=l.enemies[j][0]-l.enemies[j-1][0];assert.ok(gap>=210&&gap<=560,l.name+': spacing '+gap);}
    assert.ok(l.width-l.enemies.at(-1)[0]<=550);assert.ok(l.enemies.length>=12);
    const w=new World(i);run(w,10);assert.equal(w.player.hp,2,l.name+' safe entry');assert.ok(w.enemies.every(e=>!e.dead&&e.alert===0));
    if(i%3>0){assert.ok(l.width>LEVELS[i-1].width);assert.ok(l.enemies.length>LEVELS[i-1].enemies.length);assert.ok(l.traps.length>LEVELS[i-1].traps.length);}
  }
});

test('structures, enemy bodies, scenery and trap footprints have full support and no invalid intersections',()=>{
  for(const l of LEVELS){
    const ground=l.platforms.filter(p=>p.kind==='ground'),roofs=l.platforms.filter(p=>p.kind!=='ground');
    for(let i=0;i<l.platforms.length;i++)for(let j=i+1;j<l.platforms.length;j++)assert.ok(!overlap(l.platforms[i],l.platforms[j]),l.name+' overlapping platforms');
    for(const roof of roofs)assert.ok(ground.some(s=>roof.x>=s.x&&roof.x+roof.w<=s.x+s.w),l.name+' unsupported roof');
    for(const [x,y,type]of l.enemies)assert.ok(l.platforms.some(s=>s.y===y&&x>=s.x+20&&x+(type==='brute'?32:25)<=s.x+s.w-20),l.name+' unsupported enemy');
    const reserved=roofs.flatMap(s=>[s,{x:s.x+14,y:s.y+24,w:12,h:558-s.y},{x:s.x+s.w-25,y:s.y+24,w:12,h:558-s.y}]);
    const exit={x:l.exit-165,y:282,w:330,h:300};assert.ok(ground.some(s=>exit.x>=s.x&&exit.x+exit.w<=s.x+s.w));
    assert.ok(roofs.every(s=>!overlap(exit,s)),l.name+' exit overlaps roof');
    for(const p of l.props){
      assert.ok(ground.some(s=>p.y+p.h===s.y&&p.x>=s.x&&p.x+p.w<=s.x+s.w),l.name+' floating prop');
      assert.ok(reserved.every(s=>!overlap(s,p)),l.name+' prop clips structure');assert.ok(!overlap(exit,p));
      assert.ok(l.props.every(other=>other===p||!overlap(p,other)),l.name+' overlapping scenery');
    }
    assert.deepEqual([...new Set(l.traps.map(t=>t.type))].sort(),l.boss?[]:['beam','mine','spikes']);
    for(const t of l.traps){
      assert.ok(t.x>1100);const support=l.platforms.find(s=>s.y===t.y&&t.x>=s.x+40&&t.x+t.w<=s.x+s.w-40);assert.ok(support,l.name+' unsupported trap');
      const h=t.type==='beam'?246:t.type==='spikes'?38:18,b={x:t.x,y:t.y-h,w:t.w,h};
      assert.ok(l.platforms.every(s=>s===support||!overlap(b,s)),l.name+' trap clips platform');
      assert.ok(reserved.every(s=>s===support||!overlap(b,s)),l.name+' trap clips a support post');
      if(t.type==='beam'&&support.kind==='ground')assert.ok(roofs.every(r=>t.x>=r.x+r.w||t.x+t.w<=r.x),l.name+' beam trapped under roof');
      assert.ok(l.props.every(p=>!overlap(b,p)));assert.ok(!overlap(b,exit));
    }
  }
});

test('only the nearby patrol shares alarm, distant patrols stay in place',()=>{
  const w=new World(),[a,b,c]=w.enemies;w.enemies=[a,b,c];w.traps=[];
  Object.assign(w.player,{x:100,y:530});Object.assign(a,{x:430,y:532,patrol:1});Object.assign(b,{x:650,y:532,patrol:1});Object.assign(c,{x:680,y:532,patrol:2});
  w.update(step);assert.ok(b.alert>0);assert.equal(c.alert,0);
});

test('all hazards telegraph before dealing one health point',()=>{
  for(const type of ['beam','spikes','mine']){
    const w=trapScene(type);run(w,.65);assert.equal(w.traps[0].state,'warning');assert.equal(w.player.hp,2,type);
    run(w,1);assert.equal(w.player.hp,1,type);assert.equal(w.status,'playing');
  }
});

test('a player can escape each warning at ordinary walking speed',()=>{
  for(const type of ['beam','spikes','mine']){
    const w=trapScene(type);w.update(step);for(let i=0;i<200;i++)w.update(step,{right:true});assert.equal(w.player.hp,2,type);
  }
});

test('mines can be disarmed before detonation, explode once, and honor dash and revival',()=>{
  const w=trapScene('mine');w.player.x=440;w.attack();run(w,.05);assert.equal(w.traps[0].state,'spent');run(w,2);assert.equal(w.player.hp,2);
  const dodged=trapScene('mine');dodged.amulets.dash=true;run(dodged,.82);dodged.dash();run(dodged,.3);assert.equal(dodged.player.hp,2);
  const revived=trapScene('mine','revive');revived.player.hp=1;run(revived,1.5);assert.equal(revived.player.hp,1);assert.equal(revived.player.revives,0);assert.equal(revived.status,'playing');assert.equal(revived.traps[0].state,'spent');
  run(revived,5);assert.equal(revived.player.hp,1);
});

test('spikes retract and rearm, a falling beam is consumed, and loading resets traps',()=>{
  const spikes=trapScene('spikes');spikes.player.invincible=100;run(spikes,2.3);assert.equal(spikes.traps[0].state,'cooldown');run(spikes,2.6);assert.equal(spikes.traps[0].state,'warning');
  const beam=trapScene('beam');beam.player.invincible=100;run(beam,2);assert.equal(beam.traps[0].state,'spent');run(beam,4);assert.equal(beam.traps[0].state,'spent');beam.load(0);assert.ok(beam.traps.every(t=>t.state==='idle'));
});

test('traps can hurt enemies and the last environmental kill still clears the level once',()=>{
  const w=trapScene('mine');const e=new World().enemies[0];Object.assign(e,{x:510,y:532,state:'recover',timer:20,hp:3});w.enemies=[e];w.player.invincible=100;
  run(w,2.5);assert.equal(e.dead,true);assert.equal(w.kills,1);assert.equal(w.status,'cleared');assert.equal(w.events.filter(e=>e.type==='clear').length,1);
});
