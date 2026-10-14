'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{World}=require('../engine.js');
function scene(){const w=new World(),e=w.enemies[0];w.enemies=[e];w.player.invincible=100;return[w,e];}
function advance(w,n){for(let i=0;i<n*120;i++)w.update(1/120);}
test('enemy pursues a player on a higher roof and jumps onto it',()=>{
  const [w,e]=scene();Object.assign(e,{x:220,y:532,grounded:true});Object.assign(w.player,{x:420,y:422,grounded:true});
  let landed=false;for(let i=0;i<600;i++){w.update(1/120);if(e.grounded&&e.y+e.h===474)landed=true;}
  assert.equal(landed,true);assert.ok(e.alert>0);
});
test('enemy drops from a roof to pursue a player below',()=>{
  const [w,e]=scene();Object.assign(e,{x:400,y:424,grounded:true});Object.assign(w.player,{x:200,y:530,grounded:true});
  advance(w,3);assert.equal(e.y+e.h,582);assert.ok(Math.abs(e.x-w.player.x)<170);
});
test('enemy jumps a gap rather than waiting forever at its edge',()=>{
  const [w,e]=scene();Object.assign(e,{x:885,y:532,grounded:true});Object.assign(w.player,{x:1120,y:530,grounded:true});
  advance(w,3);assert.ok(e.x>1030);assert.equal(e.dead,false);
});
test('alerted enemies call nearby allies',()=>{
  const w=new World();const [e,a]=w.enemies;w.enemies=[e,a];Object.assign(w.player,{x:100,y:530});Object.assign(e,{x:430,y:532});Object.assign(a,{x:600,y:532});
  w.update(1/120);assert.ok(a.alert>0);
});
test('a brute resists a light hit during windup but a finisher interrupts it',()=>{
  const w=new World(),e=w.enemies.find(e=>e.type==='brute');e.state='windup';e.timer=.3;
  w.hurtEnemy(e,1,1,false);assert.equal(e.state,'windup');assert.equal(e.hp,4);
  w.hurtEnemy(e,2,1,true);assert.equal(e.state,'stunned');assert.equal(e.hp,2);
});
test('guards evade a telegraphed out-of-range player swing',()=>{
  const [w,e]=scene();Object.assign(w.player,{x:100,y:530,attackTime:.2,attackCooldown:.23});Object.assign(e,{x:230,y:532,grounded:true});
  w.update(1/120);assert.equal(e.state,'evade');assert.ok(e.vx>0);assert.ok(e.defenseCooldown>0);
});
test('an enemy lunge damages during its active movement and a stationary hero dies',()=>{
  const w=new World(),e=w.enemies[0];w.enemies=[e];Object.assign(w.player,{x:235,y:530});Object.assign(e,{x:100,y:532,grounded:true,facing:1,state:'strike',timer:.17,vx:345,strikeHit:false});
  advance(w,.17);assert.equal(w.status,'dead');
});

test('a stationary default hero is threatened from the opening position',()=>{
  const w=new World();advance(w,6);assert.equal(w.status,'dead');assert.equal(w.kills,0);
});
test('enemy descends across a roof gap without falling into the street gap or sticking to a ledge',()=>{
  const [w,e]=scene();Object.assign(e,{x:790,y:326,grounded:true});Object.assign(w.player,{x:1170,y:530,grounded:true});
  advance(w,7);assert.equal(e.dead,false);assert.equal(e.y+e.h,582);assert.ok(Math.abs(e.x-w.player.x)<180);
});
