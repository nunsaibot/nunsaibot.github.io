'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
async function prepare(page,unlocked=false){
  await page.addInitScript(unlocked=>{
    for(const [name,key,output]of [['KageCore','World','__world'],['KageCampaign','Campaign','__campaign']]){
      let captured;Object.defineProperty(window,name,{configurable:true,get:()=>captured,set:value=>{captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){if(name==='KageCampaign')args[1]=()=>.5;super(...args);window[output]=this;}};}});
    }
    if(!localStorage.getItem('kage-campaign-v1'))localStorage.setItem('kage-campaign-v1',JSON.stringify({version:5,balance:7,clears:Array.from({length:24},(_,i)=>unlocked||i<2?1:0),work:{day:9,job:'fish',seed:3,phase:'ready',quality:100,buff:null,raidChances:Array.from({length:24},(_,i)=>[20,40,60][i%3])}}));
  },unlocked);
}
async function ready(page,buff=null){await page.evaluate(buff=>{const c=__campaign;if(c.work.phase==='work')c.completeWork({...c.work,status:'done',progress:1,quality:100});c.work.buff=buff;c.work.dayOff=false;c.save();},buff);}
async function checkWithinMap(page){const map=await page.locator('.city-map').boundingBox();for(const node of await page.locator('.raid-node:visible').all()){const b=await node.boundingBox();assert.ok(b.x>=map.x-1&&b.x+b.width<=map.x+map.width+1&&b.y>=map.y&&b.y+b.height<=map.y+map.height,'node fits map '+JSON.stringify(b));}}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));await prepare(page);await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    await page.locator('#start-button').click();assert.equal(await page.locator('.raid-node:visible').count(),4);
    await page.locator('[data-raid="24"]').click();assert.equal(await page.locator('#raid-start-button').isDisabled(),true);assert.match(await page.locator('#region-progress').textContent(),/2 \/ 3/);
    await checkWithinMap(page);await page.screenshot({path:path.join(out,'boss-map-locked.png')});
    await page.locator('[data-raid="2"]').click();await page.locator('#raid-start-button').click();
    await page.evaluate(()=>{__world.player.invincible=100;for(const e of __world.enemies)__world.hurtEnemy(e,99,1);});await page.locator('#result-screen').waitFor({state:'visible'});
    assert.match(await page.locator('#result-description').textContent(),/Открыта новая карта.*Акаони/);await ready(page);
    // Other districts are seeded as cleared to exercise all eight separate encounters without replaying 21 missions.
    await page.evaluate(()=>{for(let i=0;i<24;i++)__campaign.clears[i]=1;__campaign.save();});
    await page.locator('#result-menu-button').click();await page.reload({waitUntil:'networkidle'});await page.locator('#start-button').click();
    for(let r=0;r<8;r++){
      await ready(page,r===1?'bounty':null);await page.locator('#region-select').selectOption(String(r));await page.locator('[data-raid="'+(24+r)+'"]').click();
      assert.equal(await page.locator('#raid-start-button').isDisabled(),false);assert.equal(await page.locator('#raid-reward-value').textContent(),r===1?'6':'3');
      await checkWithinMap(page);if(r===0)await page.screenshot({path:path.join(out,'boss-map-open.png')});
      const before=await page.evaluate(()=>__campaign.balance);await page.locator('#raid-start-button').click();assert.equal(await page.evaluate(()=>__world.levelIndex),24+r);assert.equal(await page.locator('#boss-hud').isVisible(),true);
      assert.match(await page.locator('#boss-name').textContent(),new RegExp(await page.evaluate(()=>__world.boss.name)));
      assert.equal(await page.locator('#boss-hint').count(),0,'no live attack names or dodge instructions');
      await page.evaluate(()=>{__world.player.x=750;__world.player.invincible=100;});
      await page.waitForFunction(()=>__world.boss.state==='windup');await page.screenshot({path:path.join(out,'boss-'+r+'-tell.png')});
      await page.evaluate(()=>{const b=__world.boss;__world.hurtEnemy(b,b.maxHp*.51,1);});await page.waitForFunction(()=>__world.boss.phase===2);assert.match(await page.locator('#boss-phase').textContent(),/2 \/ 2/);
      await page.waitForFunction(()=>__world.bossHazards.length>0||__world.boss.state==='rush');await page.screenshot({path:path.join(out,'boss-'+r+'-phase2.png')});
      for(let move=0;move<3;move++){
        await page.evaluate(move=>{const w=__world,b=w.boss;w.bossHazards=[];w.hitstop=0;Object.assign(b,{x:1000,y:504,state:'windup',timer:0,move:b.def.moves[move],target:{x:750,y:556},facing:-1,sequence:null,vx:0,vy:0});w.update(1/120);for(const h of w.bossHazards){h.delay=0;h.life=2;}},move);
        await page.waitForTimeout(50);await page.screenshot({path:path.join(out,'boss-'+r+'-move-'+move+'.png')});
      }
      await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>JSON.stringify([__world.elapsed,__world.boss.timer,__world.bossHazards.map(h=>[h.x,h.delay,h.life])]));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>JSON.stringify([__world.elapsed,__world.boss.timer,__world.bossHazards.map(h=>[h.x,h.delay,h.life])])),frozen);await page.locator('#resume-button').click();
      await page.evaluate(()=>__world.hurtEnemy(__world.boss,999,1));await page.locator('#result-screen').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>__campaign.balance),before+(r===1?6:3));assert.equal(await page.evaluate(()=>__world.bossHazards.length),0);assert.match(await page.locator('#result-loot-note').textContent(),/Гарантированная награда/);
      await ready(page);await page.locator('#result-menu-button').click();await page.locator('#start-button').click();console.log('Boss passed: '+r);
    }
    await page.close();
    for(const [name,width,height]of [['portrait',390,844],['landscape',844,390]]){
      const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await prepare(p,true);await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await p.locator('#start-button').click();
      for(let r=0;r<8;r++){await p.locator('#region-select').selectOption(String(r));await checkWithinMap(p);}
      await p.locator('[data-raid="31"]').click();await p.screenshot({path:path.join(out,'boss-map-'+name+'.png')});await p.locator('#raid-start-button').click();
      await p.evaluate(()=>{__world.player.x=750;__world.player.invincible=100;});await p.waitForFunction(()=>__world.boss.state==='windup');
      const hud=await p.locator('#boss-hud').boundingBox();assert.ok(hud.x>=0&&hud.y>=0&&hud.x+hud.width<=width&&hud.y+hud.height<=height,'HUD fits');assert.equal(await p.locator('#touch-controls').isVisible(),true);await p.screenshot({path:path.join(out,'boss-fight-'+name+'.png')});
      const feet=height*582/720,head=height*530/720;assert.ok(hud.y+hud.height<head||hud.y>feet,'HUD does not obscure the hero on the floor');assert.equal(await p.locator('#chapter-toast').isVisible(),false);
      await p.evaluate(()=>{__world.player.hp=1;__world.player.invincible=0;__world.hurtPlayer(1);});await p.locator('#result-screen').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>__campaign.balance),7);assert.ok(await p.evaluate(()=>__campaign.bossUnlocked(7)));await p.close();
    }
    const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await prepare(offline,true);await offline.route('https://**/*',route=>route.abort());await offline.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await offline.locator('#start-button').click();await offline.locator('[data-raid="24"]').click();await offline.locator('#raid-start-button').click();assert.equal(await offline.evaluate(()=>__world.boss.bossId),'akaoni');await offline.close();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({bosses:8,rewards:[3,6],mobileLayouts:2,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
