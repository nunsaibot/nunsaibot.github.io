/* Optional Playwright checks: NODE_PATH and CHROME_PATH may select bundled runtimes. */
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function instrument(page,fixture=true){
  await page.addInitScript(({fixture})=>{
    for(const [name,key,output] of [['KageCore','World','__world'],['KageKitchen','Kitchen','__kitchen'],['KageCampaign','Campaign','__campaign']]){
      let captured;Object.defineProperty(window,name,{configurable:true,get:()=>captured,set:value=>{
        captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){if(name==='KageCampaign'&&fixture)args[1]=()=>.5;super(...args);window[output]=this;}};
      }});
    }
    if(fixture&&!localStorage.getItem('kage-campaign-v1'))localStorage.setItem('kage-campaign-v1',JSON.stringify({version:2,balance:0,work:{day:1,job:'fish',seed:7,rare:false,phase:'work',quality:null,buff:null}}));
  },{fixture});
}
async function solve(page){
  const result=await page.evaluate(()=>{
    const g=window.__kitchen;
    for(let i=0;i<12000&&g.status!=='done';i++){
      if(g.job==='fish'){
        const [x,y]=g.path[g.index],next=g.path[g.index+1];
        if(next)g.turn(next[0]>x?'right':next[0]<x?'left':next[1]>y?'down':'up');
      }else{g.setHeat(g.temperature<66?75:40);if(g.stirAge>3)g.stir();}
      g.update(1/60);
    }
    return{status:g.status,quality:g.quality,job:g.job};
  });
  assert.equal(result.status,'done');assert.ok(result.quality>=80);
  await page.locator('#work-completion').waitFor({state:'visible'});
  return result;
}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await instrument(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
    const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
    await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    await page.locator('#start-button').click();assert.equal(await page.locator('#work-screen').isVisible(),true);assert.equal(await page.locator('#hub-screen').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.__campaign.beginRaid(0)),null);
    await shot('fish-intro');await page.locator('#work-start-button').click();await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>window.__kitchen.direction),'down');await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');const elapsed=await page.evaluate(()=>window.__kitchen.elapsed);await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.__kitchen.elapsed),elapsed);await page.locator('#work-start-button').click();await shot('fish-playing');
    let total=0,previousJob=null;const buffs=[];
    for(let day=0;day<4;day++){
      if(day>0){
        await page.locator('#next-button').click();const job=await page.evaluate(()=>window.__kitchen.job);assert.notEqual(job,previousJob);
        await page.locator('#work-start-button').click();
        if(job==='rice'){
          await page.locator('#heat-control').focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>window.__kitchen.heat),100);
          await page.locator('#stir-button').click();assert.ok(await page.evaluate(()=>window.__kitchen.stirs)>0);
          await shot('rice-playing');
        }
      }
      const result=await solve(page);previousJob=result.job;
      const buff=await page.evaluate(()=>window.__campaign.work.buff);buffs.push(buff);await shot('shift-result-'+(day+1));
      if(day===2){await page.evaluate(()=>{window.__campaign.work.buff='bounty';window.__campaign.save();});}
      if(day===0){
        const snapshot=await page.evaluate(()=>({...window.__campaign.work}));await page.reload({waitUntil:'networkidle'});
        assert.equal(await page.evaluate(()=>window.__campaign.work.buff),snapshot.buff);assert.equal(await page.evaluate(()=>window.__campaign.work.phase),'ready');assert.deepEqual(await page.evaluate(()=>window.__campaign.work.raidChances),snapshot.raidChances);
        await page.locator('#start-button').click();
      }else await page.locator('#work-map-button').click();
      await page.locator('[data-raid="'+(day%3)+'"]').click();
      const offer=await page.evaluate(index=>window.__campaign.raidOffer(index),day%3);
      assert.equal(await page.locator('#raid-loot-chance').textContent(),offer.chance+'%');
      assert.equal(await page.locator('[data-raid="'+(day%3)+'"] .node-loot').textContent(),'ДОБЫЧА · '+offer.chance+'%');
      assert.equal(await page.locator('#raid-reward-value').textContent(),offer.drops.length===1?String(offer.drops[0].amount):offer.drops[0].amount+'–'+offer.drops.at(-1).amount);
      await page.locator('.loot-details summary').click();assert.equal(await page.locator('#raid-loot-distribution').isVisible(),true);
      if(day===2){assert.equal(await page.locator('#raid-loot-buff').isVisible(),true);assert.equal(offer.chance,80);assert.equal(offer.multiplier,2);}
      await shot('loot-map-day-'+(day+1));await page.locator('.loot-details summary').click();
      await page.locator('#raid-start-button').click();
      const health=await page.evaluate(()=>({hp:window.__world.player.hp,max:window.__world.player.maxHp}));
      assert.equal(health.max,buff==='vitality'?2:1);assert.equal(health.hp,health.max);
      await page.evaluate(()=>{window.__world.player.invincible=60;});
      if(day===0){
        await page.keyboard.press('Escape');await page.locator('#resume-button').click();await page.keyboard.press('KeyJ');await shot('buff-hud');
      }
      await page.evaluate(day=>{
        const c=window.__campaign,random=c.random,draws=day<2?[.999999]:[0,day===2?.8:0];
        c.random=()=>draws.length?draws.shift():random();
        for(const e of window.__world.enemies)window.__world.hurtEnemy(e,99,1);
      },day);
      await page.locator('#result-screen').waitFor({state:'visible'});
      const reward=day<2?0:day===2?6:offer.multiplier;total+=reward;
      assert.equal(await page.locator('#wallet [data-balance]').textContent(),String(total));
      assert.equal(await page.locator('#reward-amount').textContent(),reward?'+'+reward+' тяирэ':'Без добычи');
      assert.equal(await page.locator('#result-reward').isVisible(),true);
      assert.equal(await page.evaluate(()=>window.__campaign.pityBonus),day<2?(day+1)*10:0);
      assert.ok((await page.locator('#result-loot-note').textContent()).includes('Шанс добычи был '+offer.chance+'%'));
      if(day===2)assert.ok((await page.locator('#result-loot-note').textContent()).includes('3 ×2 = 6'));
      if(!reward)assert.ok(!(await page.locator('#result-description').textContent()).includes('кошельке'));
      await shot('loot-result-day-'+(day+1));
      assert.equal(await page.evaluate(()=>window.__campaign.work.phase),'work');
    }
    // Shop remains functional after a new mandatory shift.
    await page.locator('#next-button').click();await page.locator('#work-start-button').click();await solve(page);await page.locator('#work-map-button').click();
    await page.locator('#shop-tab').click();await page.locator('#buy-weapon-button').click();
    assert.equal(await page.locator('#wallet [data-balance]').textContent(),String(total-4));
    await page.locator('#shop-map-button').click();await page.locator('#raid-start-button').click();
    assert.equal(await page.evaluate(()=>window.__world.weapon.id),'akatsuki');
    await page.evaluate(()=>{const p=window.__world.player;p.revives=0;p.invincible=0;p.hp=1;window.__world.hurtPlayer(1);});
    await page.locator('#result-screen').waitFor({state:'visible'});assert.equal(await page.locator('#result-reward').isVisible(),false);
    assert.equal(await page.evaluate(()=>window.__campaign.work.buff),null);
    await page.locator('#next-button').click();await page.locator('#work-start-button').click();await solve(page);await page.locator('#work-map-button').click();await page.locator('#raid-start-button').click();
    await page.keyboard.press('Escape');await page.locator('#restart-button').click();assert.equal(await page.locator('#work-screen').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.__campaign.work.phase),'work');
    await page.locator('#work-start-button').click();await solve(page);await page.locator('#work-map-button').click();await page.locator('#raid-start-button').click();
    const activeDay=await page.evaluate(()=>window.__campaign.work.day);
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>window.__campaign.work.day),activeDay+1);
    assert.equal(await page.evaluate(()=>window.__campaign.work.buff),null);
    for(const [name,width,height]of [['portrait',390,844],['landscape',844,390]]){
      const mobile=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});await instrument(mobile);mobile.on('pageerror',e=>errors.push(e.message));
      await mobile.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await mobile.locator('#start-button').tap();await mobile.locator('#work-start-button').tap();
      await mobile.locator('[data-work-dir="down"]').tap();assert.equal(await mobile.evaluate(()=>window.__kitchen.direction),'down');
      await mobile.locator('[data-work-dir="right"]').tap();await mobile.screenshot({path:path.join(out,'kitchen-'+name+'.png')});
      await solve(mobile);await mobile.locator('#work-map-button').tap();
      await mobile.locator('[data-raid="2"]').tap();await mobile.locator('.loot-details summary').tap();
      await mobile.locator('#raid-loot-chance').scrollIntoViewIfNeeded();await mobile.screenshot({path:path.join(out,'loot-map-'+name+'.png')});
      assert.equal(await mobile.evaluate(()=>document.getElementById('hub-screen').scrollWidth<=innerWidth),true);
      await mobile.locator('#raid-start-button').tap();assert.equal(await mobile.locator('#touch-controls').isVisible(),true);
      await mobile.evaluate(()=>{window.__campaign.random=()=>.999999;for(const e of window.__world.enemies)window.__world.hurtEnemy(e,99,1);});
      await mobile.locator('#result-screen').waitFor({state:'visible'});assert.equal(await mobile.locator('#reward-amount').textContent(),'Без добычи');
      await mobile.locator('#next-button').scrollIntoViewIfNeeded();await mobile.screenshot({path:path.join(out,'loot-result-'+name+'.png')});
      await mobile.locator('#next-button').tap();assert.equal(await mobile.locator('#work-screen').isVisible(),true);await mobile.close();
    }
    const offline=await browser.newPage();await instrument(offline,false);offline.on('pageerror',e=>errors.push(e.message));await offline.route('https://**/*',route=>route.abort());
    await offline.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);await offline.locator('#start-button').click();await offline.locator('#work-start-button').click();await solve(offline);await offline.locator('#work-map-button').click();
    await offline.locator('#raid-start-button').click();assert.equal(await offline.locator('#hud').isVisible(),true);
    console.log(JSON.stringify({dailyLoot:true,emptyClears:true,pityPersists:true,bountyMultipliesQuantity:true,mandatoryKitchen:true,bothJobs:true,nonrepeatingDays:true,buffs,earnedTrophies:total,shop:true,deathConsumesBuff:true,restartCannotBypassShift:true,reloadCannotReuseBuff:true,mobileLayouts:2,offlineFile:true,errors},null,2));
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
