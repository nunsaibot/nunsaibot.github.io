'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
async function instrument(page,job,options={}){
  await page.addInitScript(({job,options})=>{
    for(const [name,key,output] of [['KageCore','World','__world'],['KageKitchen','Kitchen','__kitchen'],['KageCampaign','Campaign','__campaign']]){
      let captured;Object.defineProperty(window,name,{configurable:true,get:()=>captured,set:value=>{
        captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){if(name==='KageCampaign')args[1]=()=>options.naturalHoliday?.1:.5;super(...args);window[output]=this;}};
      }});
    }
    if(job&&!localStorage.getItem('kage-campaign-v1'))localStorage.setItem('kage-campaign-v1',JSON.stringify({version:4,balance:options.balance||0,work:{day:1,job,seed:3,rare:false,phase:'work',quality:null,buff:null,dayOff:false,raidChances:[20,40,60]}}));
  },{job,options});
}
async function solve(page){
  const result=await page.evaluate(()=>{
    const g=window.__kitchen;
    for(let i=0;i<12000&&g.status!=='done';i++){
      if(g.job==='fish'){
        const [x,y]=g.path[g.index],next=g.path[g.index+1];
        if(next)g.turn(next[0]>x?'right':next[0]<x?'left':next[1]>y?'down':'up');
      }else if(g.job==='rice'){g.setHeat(g.temperature<66?75:40);if(g.stirAge>3)g.stir();}
      else if(g.job==='slice'){if(Math.abs(g.beatClock-g.cutTarget)<.035)g.slice();}
      else if(g.job==='roll')g.setRolling(g.pressure<g.target);
      else if(g.job==='order'&&g.orderPhase==='recall')g.chooseIngredient(g.sequence[g.cursor]);
      g.update(1/60);
    }
    return{status:g.status,quality:g.quality,job:g.job};
  });
  assert.equal(result.status,'done');assert.ok(result.quality>=80);
  await page.locator('#work-completion').waitFor({state:'visible'});
  return result;
}

async function completeRaid(page,dead=false){
  await page.evaluate(dead=>{const w=window.__world;if(dead){w.player.hp=1;w.player.revives=0;w.player.invincible=0;w.hurtPlayer(1);}else{w.player.invincible=60;for(const e of w.enemies)w.hurtEnemy(e,99,1);}},dead);
  await page.locator('#result-screen').waitFor({state:'visible'});
}
async function prepareRecall(page){await page.evaluate(()=>{const g=window.__kitchen;while(g.orderPhase==='watch')g.update(.05);});}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const errors=[];
  try{
    for(const job of ['fish','rice','slice','roll','order']){
      const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
      await instrument(page,job,{balance:job==='fish'?10:0});await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
      assert.ok((await page.title()).includes('Бусидо'));assert.ok((await page.locator('#game-title').textContent()).includes('БУСИДО'));
      if(job==='fish')await page.screenshot({path:path.join(out,'bushido-menu.png')});
      const day=await page.evaluate(()=>JSON.stringify(window.__campaign.work));await page.locator('#menu-shop-button').click();
      assert.equal(await page.locator('#shop-pane').isVisible(),true);assert.equal(await page.evaluate(()=>window.__campaign.beginRaid(0)),null);
      if(job==='fish'){await page.locator('#buy-weapon-button').click();assert.equal(await page.evaluate(()=>window.__campaign.equipped),'akatsuki');await page.screenshot({path:path.join(out,'bushido-shop-before-work.png')});}
      assert.equal(await page.evaluate(()=>JSON.stringify(window.__campaign.work)),day);
      await page.locator('#shop-continue-button').click();assert.equal(await page.locator('#work-screen').isVisible(),true);
      await page.locator('#work-start-button').click();
      if(job==='slice'){
        await page.evaluate(()=>{const g=window.__kitchen;g.beatClock=g.cutTarget;});await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.__kitchen.cuts),1);
      }else if(job==='roll'){
        await page.keyboard.down('Space');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__kitchen.rolling),true);assert.ok(await page.evaluate(()=>window.__kitchen.pressure)>0);await page.keyboard.up('Space');
        const box=await page.locator('#roll-button').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();assert.equal(await page.evaluate(()=>window.__kitchen.rolling),true);await page.mouse.up();assert.equal(await page.evaluate(()=>window.__kitchen.rolling),false);
      }else if(job==='order'){
        await page.screenshot({path:path.join(out,'bushido-memory-watch.png')});await prepareRecall(page);
        const index=await page.evaluate(()=>window.KageKitchen.INGREDIENTS.findIndex(i=>i.id===window.__kitchen.sequence[0]));await page.keyboard.press('Digit'+(index+1));assert.equal(await page.evaluate(()=>window.__kitchen.cursor),1);
        await page.locator('#replay-order-button').click();assert.equal(await page.evaluate(()=>window.__kitchen.quality),92);await prepareRecall(page);
      }
      await page.screenshot({path:path.join(out,'bushido-'+job+'.png')});
      await page.locator('#work-shop-button').click();const paused=await page.evaluate(()=>({elapsed:window.__kitchen.elapsed,quality:window.__kitchen.quality,progress:window.__kitchen.progress}));
      await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>({elapsed:window.__kitchen.elapsed,quality:window.__kitchen.quality,progress:window.__kitchen.progress})),paused);assert.ok(!(await page.evaluate(()=>window.__kitchen.rolling)));
      await page.locator('#shop-continue-button').click();assert.equal(await page.locator('#work-start-overlay').isVisible(),true);await page.locator('#work-start-button').click();
      await solve(page);assert.equal(await page.evaluate(()=>window.__campaign.work.buff),'vitality');
      await page.locator('#work-shop-button').click();assert.equal(await page.evaluate(()=>window.__campaign.work.buff),'vitality');await page.locator('#shop-continue-button').click();
      await page.locator('#raid-start-button').click();assert.equal(await page.locator('#health-label').textContent(),'3 / 3');assert.equal(await page.locator('#health .health-segment').count(),3);
      if(job==='fish')await page.screenshot({path:path.join(out,'bushido-three-lives.png')});
      await completeRaid(page,job==='order');await page.locator('#result-shop-button').click();assert.equal(await page.locator('#shop-pane').isVisible(),true);assert.equal(await page.evaluate(()=>window.__campaign.work.day),2);
      await page.locator('#shop-continue-button').click();assert.equal(await page.locator('#work-screen').isVisible(),true);await page.close();console.log('Passed kitchen and shop flow: '+job);
    }
    const holiday=await browser.newPage({viewport:{width:1440,height:900}});holiday.on('pageerror',e=>errors.push(e.message));await instrument(holiday,null,{naturalHoliday:true});await holiday.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    assert.equal(await holiday.evaluate(()=>window.__campaign.work.dayOff),true);assert.ok((await holiday.locator('#menu-day-status').textContent()).includes('закрыт'));
    await holiday.screenshot({path:path.join(out,'bushido-day-off.png')});const saved=await holiday.evaluate(()=>JSON.stringify(window.__campaign.work));await holiday.reload({waitUntil:'networkidle'});assert.equal(await holiday.evaluate(()=>JSON.stringify(window.__campaign.work)),saved);
    await holiday.locator('#menu-shop-button').click();await holiday.locator('#shop-continue-button').click();assert.equal(await holiday.locator('#map-pane').isVisible(),true);assert.ok((await holiday.locator('#map-shift-status').textContent()).includes('выходной'));
    await holiday.locator('#raid-start-button').click();assert.equal(await holiday.locator('#health-label').textContent(),'2 / 2');assert.equal(await holiday.locator('#health .health-segment').count(),2);assert.equal(await holiday.evaluate(()=>window.__world.buff),null);
    await holiday.evaluate(()=>{window.__campaign.random=()=>.5;window.__world.hurtPlayer(1);});assert.equal(await holiday.evaluate(()=>window.__world.status),'playing');assert.equal(await holiday.evaluate(()=>window.__world.player.hp),1);
    await completeRaid(holiday,true);await holiday.locator('#next-button').click();assert.equal(await holiday.locator('#work-screen').isVisible(),true);assert.equal(await holiday.evaluate(()=>window.__campaign.work.dayOff),false);await holiday.close();
    for(const [orientation,width,height]of [['portrait',390,844],['landscape',844,390]])for(const job of ['slice','roll','order']){
      const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));await instrument(page,job);await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
      if(job==='slice')await page.screenshot({path:path.join(out,'bushido-menu-'+orientation+'.png')});
      await page.locator('#start-button').tap();await page.locator('#work-start-button').tap();
      if(job==='roll'){
        const button=await page.locator('#roll-button').boundingBox(),session=await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2}]});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__kitchen.rolling),true);
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__kitchen.rolling),false);await session.detach();
      }else if(job==='order'){
        await prepareRecall(page);const id=await page.evaluate(()=>window.__kitchen.sequence[0]);await page.locator('[data-ingredient="'+id+'"]').tap();assert.equal(await page.evaluate(()=>window.__kitchen.cursor),1);
      }else{
        await page.evaluate(()=>{const g=window.__kitchen;g.beatClock=g.cutTarget;});await page.locator('#slice-button').tap();assert.equal(await page.evaluate(()=>window.__kitchen.cuts),1);
      }
      assert.equal(await page.evaluate(()=>document.getElementById('work-screen').scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(out,'bushido-'+job+'-'+orientation+'.png')});await solve(page);await page.locator('#work-map-button').tap();assert.equal(await page.locator('#map-pane').isVisible(),true);await page.close();
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({jobs:5,shopBeforeDuringAfterWork:true,shopAfterWinAndDeath:true,dayOffPersists:true,health:[2,3],touchLayouts:6,errors},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
