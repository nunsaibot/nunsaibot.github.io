'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {World,WEAPONS}=require('../engine.js'),{Campaign,SHOP_ITEMS}=require('../campaign.js');
const dt=1/120,advance=(w,t)=>{for(let i=0;i<t;i+=dt)w.update(dt);};
function memory(raw={}){let value=JSON.stringify(raw);return{getItem:()=>value,setItem:(_,next)=>value=next};}
function setup(){const storage=memory(),c=new Campaign(storage,()=>.5);c.balance=100;return{c,storage};}
function ready(c){c.completeWork({...c.work,status:'done',progress:1,quality:79});}
function scene(options={}){const w=new World(0,{random:()=>.5,blood:0,...options});w.traps=[];for(const e of w.enemies){e.x=5000;e.state='recover';e.timer=100;}advance(w,.2);return w;}

test('fresh hero has fists, one jump, two lives and no dash or supplies',()=>{
  const {c}=setup(),w=scene();assert.equal(c.equipped,'fists');assert.equal(w.weapon.id,'fists');assert.equal(w.player.hp,2);assert.equal(w.dash(),false);
  w.jump();advance(w,.18);assert.equal(w.player.jumps,1);const vy=w.player.vy;w.jump();advance(w,.03);assert.equal(w.player.jumps,1);assert.ok(w.player.vy>vy);
  assert.equal(w.throwShuriken(),false);w.player.hp=1;assert.equal(w.heal(),false);assert.equal(w.execute(),false);
});
test('walking off a ledge cannot grant a free midair jump without Omamori',()=>{
  const w=scene();Object.assign(w.player,{x:955,y:590,grounded:false,coyote:0,jumps:0,vy:150});w.jump();w.update(dt);assert.ok(w.player.vy>150);assert.equal(w.player.jumps,1);
});
test('fist combo uses hands then foot, kills guard in three hits and spearman in four',()=>{
  for(const [type,hp,hits]of [['guard',3,3],['spearman',4,4]]){
    const w=scene(),e=w.enemies[0];w.enemies=[e];Object.assign(e,{type,hp,maxHp:hp});
    for(let i=0;i<hits;i++){Object.assign(e,{x:w.player.x+38,y:530,state:'recover',timer:10});w.hitstop=0;w.player.attackCooldown=0;assert.equal(w.attack(),true);w.update(dt);assert.equal(w.slashes.at(-1).weapon,'fists');assert.equal(w.player.comboStep,i%3);assert.equal(e.dead,i===hits-1);}
  }
  assert.ok(WEAPONS.fists.reach<91);assert.ok(WEAPONS.fists.damage<WEAPONS.katana.damage);
});
test('both swords have independent prices, ownership and equipment',()=>{
  const {c,storage}=setup();c.balance=4;assert.equal(c.buy('katana').ok,false);c.balance=5;assert.equal(c.buy('katana').ok,true);assert.equal(c.balance,0);assert.equal(c.equipped,'katana');
  c.balance=9;assert.equal(c.buy('akatsuki').ok,false);c.balance=10;assert.equal(c.buy('akatsuki').ok,true);assert.equal(c.balance,0);
  assert.equal(c.buy('katana').reason,'owned');const restored=new Campaign(storage,()=>.5);assert.equal(restored.equipped,'akatsuki');assert.equal(restored.equip('katana'),true);assert.equal(restored.equip('fists'),true);
});
test('all four permanent amulets charge once, persist and activate together',()=>{
  const {c,storage}=setup();for(const id of ['omamori','dash','fury','ronin']){const old=c.balance;assert.equal(c.buy(id).ok,true);assert.equal(c.balance,old-SHOP_ITEMS[id].price);assert.equal(c.buy(id).reason,'owned');assert.equal(c.balance,old-SHOP_ITEMS[id].price);}
  const saved=new Campaign(storage,()=>.5);ready(saved);const w=scene(saved.beginRaid(0));assert.ok(Object.values(w.amulets).every(Boolean));
  w.jump();advance(w,.15);w.jump();advance(w,.02);assert.equal(w.player.jumps,2);assert.equal(w.dash(),true);assert.equal(w.damageMultiplier,1.08);
  saved.abandonRaid();assert.deepEqual(new Campaign(storage,()=>.5).amulets,c.amulets);
});
test('fury stacks with elemental cooking buff using fractional damage',()=>{
  for(const weapon of Object.keys(WEAPONS)){
    const w=scene({weapon,buff:'fire',amulets:{fury:true}}),e=w.enemies[0];Object.assign(e,{x:w.player.x+38,y:530,hp:20,maxHp:20});w.attack();w.update(dt);
    const expected=Math.round((20-WEAPONS[weapon].damage*1.08*1.03)*10000)/10000;assert.equal(e.hp,expected);
  }
});
test('supplies enforce capacities and failed purchases never take money',()=>{
  const {c}=setup();for(const [id,count]of [['shuriken',1],['potion',2],['workPass',1]]){for(let i=0;i<count;i++)assert.equal(c.buy(id).ok,true);const old=c.balance;assert.equal(c.buy(id).reason,'full');assert.equal(c.balance,old);}
  assert.deepEqual(c.inventory,{shuriken:1,potion:2,workPass:4});assert.equal(c.buy('unknown').ok,false);
});
test('a potion heals one segment, respects maximum and is saved immediately',()=>{
  const {c,storage}=setup();c.buy('potion');c.buy('potion');ready(c);c.work.buff='vitality';const w=scene(c.beginRaid(0));
  assert.equal(w.heal(),false);assert.equal(c.inventory.potion,2);w.player.hp=1;assert.equal(w.heal(),true);assert.equal(w.player.hp,2);assert.equal(c.inventory.potion,1);
  assert.equal(JSON.parse(storage.getItem()).inventory.potion,1);assert.equal(w.heal(),true);assert.equal(w.player.hp,3);assert.equal(w.heal(),false);assert.equal(c.inventory.potion,0);
  w.player.hp=1;w.status='dead';assert.equal(w.heal(),false);
});
test('spent items stay spent after raid reload, unused items survive death and next day',()=>{
  const {c,storage}=setup();c.buy('shuriken');c.buy('potion');c.buy('potion');ready(c);const w=scene(c.beginRaid(0));
  assert.equal(w.throwShuriken(),true);assert.equal(w.throwShuriken(),false);w.player.hp=1;w.heal();const restored=new Campaign(storage,()=>.5);
  assert.deepEqual(restored.inventory,{shuriken:0,potion:1,workPass:0});assert.equal(restored.work.day,2);assert.equal(restored.buy('shuriken').ok,true);
  ready(restored);const next=scene(restored.beginRaid(0));next.status='dead';restored.abandonRaid();assert.equal(restored.inventory.potion,1);assert.equal(restored.inventory.shuriken,1);
});
test('stale raid instances cannot spend items after the campaign moved to a new day',()=>{
  const {c}=setup();c.buy('shuriken');c.buy('potion');ready(c);const w=scene(c.beginRaid(0));c.abandonRaid();w.player.hp=1;
  assert.equal(w.throwShuriken(),false);assert.equal(w.heal(),false);assert.equal(c.inventory.potion,1);assert.equal(c.inventory.shuriken,1);
});
test('wind shuriken pierces surfaces and every enemy along the entire map once',()=>{
  const w=scene({inventory:{shuriken:1}}),template=w.enemies[0];w.enemies=[220,300,4800].map((x,id)=>({...template,id,x,y:530,hp:8,maxHp:8,dead:false}));
  w.enemies.push({...template,id:9,x:500,y:300,hp:8,maxHp:8});w.platforms.push({x:250,y:0,w:25,h:720});assert.equal(w.throwShuriken(),true);
  while(w.windProjectiles.length)w.updateWind(.2);assert.deepEqual(w.enemies.map(e=>e.hp),[6,6,6,8]);assert.equal(w.inventory.shuriken,0);
});
test('wind shuriken follows facing and receives the same damage modifiers as Akatsuki',()=>{
  const w=scene({inventory:{shuriken:1},amulets:{fury:true},buff:'ice'}),e=w.enemies[0];Object.assign(w.player,{x:500,facing:-1});Object.assign(e,{x:300,y:530,hp:10});w.throwShuriken();w.updateWind(.3);
  assert.equal(e.hp,Math.round((10-2*1.08*1.03)*10000)/10000);
});
test('ronin requires amulet and ten active hits, executes exactly one near ordinary enemy',()=>{
  const w=scene({amulets:{ronin:true}}),e=w.enemies[0],other=w.enemies[1];Object.assign(e,{x:170,y:530,hp:50});Object.assign(other,{x:210,y:530,hp:50});
  assert.equal(w.execute(),false);for(let i=0;i<10;i++)w.hurtEnemy(e,.1,1);assert.equal(w.combo,10);
  assert.equal(w.execute(),true);assert.equal(e.dead,true);assert.equal(other.dead,false);assert.equal(w.combo,0);assert.equal(w.execute(),false);
});
test('ronin cannot hit bosses, distant or rear targets, or use an expired series',()=>{
  const boss=new World(24,{amulets:{ronin:true}});boss.combo=10;boss.comboTimer=2;boss.player.x=boss.boss.x-40;const hp=boss.boss.hp;
  assert.equal(boss.execute(),false);assert.equal(boss.boss.hp,hp);assert.equal(boss.combo,10);
  const w=scene({amulets:{ronin:true}});w.combo=10;w.comboTimer=2;assert.equal(w.execute(),false);const e=w.enemies[0];Object.assign(e,{x:w.player.x-80,y:530});assert.equal(w.execute(),false);
  e.x=w.player.x+40;w.comboTimer=0;assert.equal(w.execute(),false);w.comboTimer=2;w.amulets.ronin=false;assert.equal(w.execute(),false);
});
test('environmental damage does not charge the ronin combo',()=>{
  const w=scene({amulets:{ronin:true}});w.hurtEnemy(w.enemies[0],1,1,true,'trap');assert.equal(w.combo,0);
});
test('certificate skips exactly four separate workdays, with no buff or chance reroll',()=>{
  const {c,storage}=setup();c.buy('workPass');
  for(let i=0;i<4;i++){
    const before={...c.work},offers=[...c.work.raidChances];assert.equal(c.skipWork(),true);assert.equal(c.skipWork(),false);assert.equal(c.work.buff,null);assert.equal(c.work.quality,null);assert.equal(c.work.day,before.day);assert.deepEqual(c.work.raidChances,offers);assert.equal(c.inventory.workPass,3-i);
    assert.equal(c.completeWork({...before,status:'done',progress:1,quality:100}),false);const saved=new Campaign(storage,()=>.5);assert.equal(saved.work.phase,'ready');assert.equal(saved.work.skipped,true);assert.equal(saved.inventory.workPass,3-i);
    assert.ok(c.beginRaid(0));c.abandonRaid();
  }
  assert.equal(c.skipWork(),false);assert.equal(c.buy('workPass').ok,true);assert.equal(c.inventory.workPass,4);
});
test('certificate cannot be used on a holiday or completed shift; shopping is closed during raids',()=>{
  const c=new Campaign(memory(),()=>.1);c.balance=100;c.buy('workPass');assert.equal(c.skipWork(),false);assert.equal(c.inventory.workPass,4);c.beginRaid(0);
  assert.equal(c.buy('katana').reason,'raid');assert.equal(c.equip('fists'),false);assert.equal(c.skipWork(),false);
});
test('migration keeps purchased Akatsuki, progress and money without granting formerly free abilities',()=>{
  for(const purchased of [false,true]){
    const storage=memory({version:6,balance:17,clears:[4,2,1],ownsAkatsuki:purchased,equipped:purchased?'akatsuki':'katana'}),c=new Campaign(storage,()=>.5);
    assert.equal(c.balance,17);assert.deepEqual(c.clears.slice(0,3),[4,2,1]);assert.equal(c.equipped,purchased?'akatsuki':'fists');assert.equal(c.ownsKatana,false);assert.ok(Object.values(c.amulets).every(x=>x===false));
    assert.equal(JSON.parse(storage.getItem()).version,7);
  }
});
test('invalid saved quantities and unowned equipment are repaired safely',()=>{
  const c=new Campaign(memory({version:7,equipped:'katana',inventory:{shuriken:99,potion:-4,workPass:5},amulets:{dash:'true',fury:true}}),()=>.5);
  assert.equal(c.equipped,'fists');assert.deepEqual(c.inventory,{shuriken:1,potion:0,workPass:4});assert.equal(c.amulets.dash,false);assert.equal(c.amulets.fury,true);
});
