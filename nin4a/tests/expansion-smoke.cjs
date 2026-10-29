'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
async function instrument(page,balance=3){
  await page.addInitScript(balance=>{
    for(const [name,key,output]of [['KageCore','World','__world'],['KageCampaign','Campaign','__campaign']]){
      let captured;Object.defineProperty(window,name,{configurable:true,get:()=>captured,set:value=>{captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){if(name==='KageCampaign')args[1]=()=>.5;super(...args);window[output]=this;}};}});
    }
    let Visit;Object.defineProperty(window,'OkusanVisit',{configurable:true,get:()=>Visit,set:value=>{Visit=class extends value{constructor(...args){super(...args);window.__visit=this;}};}});
    if(!localStorage.getItem('kage-campaign-v1'))localStorage.setItem('kage-campaign-v1',JSON.stringify({version:4,balance,clears:[1,0,0],work:{day:4,job:'fish',seed:3,phase:'ready',rare:false,quality:100,buff:'vitality',dayOff:false,raidChances:[20,40,60]}}));
  },balance);
}
async function visibleInside(page,id){const box=await page.locator(id).boundingBox(),size=page.viewportSize();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,id+' must fit the viewport: '+JSON.stringify(box));}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),errors=[];
  try{
    if(!process.argv.includes('--visits-only')){
    const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    await visibleInside(page,'#okusan-button');await page.screenshot({path:path.join(out,'expansion-menu.png')});
    await page.locator('#start-button').click();
    for(let region=0;region<8;region++){
      await page.locator('#region-select').selectOption(String(region));assert.equal(await page.locator('.raid-node:visible').count(),4);
      for(let tier=0;tier<3;tier++){
        const index=region*3+tier;await page.locator('[data-raid="'+index+'"]').click();
        assert.equal(await page.locator('#raid-name').textContent(),await page.evaluate(i=>KageCore.LEVELS[i].name,index));
        assert.equal(Number(await page.locator('#raid-enemy-count').textContent()),await page.evaluate(i=>KageCore.LEVELS[i].enemies.length,index));
        if(tier===2)await page.screenshot({path:path.join(out,'expansion-map-'+region+'.png')});
        await page.locator('#raid-start-button').click();assert.equal(await page.evaluate(()=>__world.levelIndex),index);
        await page.evaluate(()=>{__world.player.invincible=100;});
        if(tier===2){await page.waitForTimeout(900);await page.screenshot({path:path.join(out,'expansion-region-'+region+'.png')});}
        await page.evaluate(()=>{for(const enemy of __world.enemies)__world.hurtEnemy(enemy,99,1);});await page.locator('#result-screen').waitFor({state:'visible'});
        assert.ok(await page.evaluate(i=>__campaign.clears[i]>0,index));
        await page.evaluate(()=>{const c=__campaign;if(c.work.phase==='work')c.completeWork({...c.work,status:'done',progress:1,quality:100});});
        await page.locator('#result-menu-button').click();await page.locator('#start-button').click();
      }
      console.log('Region passed: '+region);
    }
    await page.locator('#hub-menu-button').click();await page.close();
    }
    for(const [name,width,height]of [['desktop',1440,900],['portrait',390,844],['landscape',844,390]]){
      const p=await browser.newPage({viewport:{width,height},isMobile:name!=='desktop',hasTouch:name!=='desktop'});p.on('pageerror',e=>errors.push(e.message));await instrument(p,2);await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
      await visibleInside(p,'#okusan-button');await visibleInside(p,'#menu-shop-button');await p.screenshot({path:path.join(out,'expansion-menu-'+name+'.png')});
      const day=await p.evaluate(()=>JSON.stringify(__campaign.work));await p.locator('#okusan-button').click();await p.locator('#courtyard-screen').waitFor({state:'visible'});await p.screenshot({path:path.join(out,'expansion-garden-'+name+'.png')});
      if(name==='desktop'){
        const before=await p.evaluate(()=>__visit.x);await p.keyboard.down('KeyD');await p.waitForTimeout(180);await p.keyboard.up('KeyD');assert.ok(await p.evaluate(()=>__visit.x)>before);await p.locator('#okusan-person').click();
      }else await p.locator('#courtyard-talk').tap();
      await p.locator('#okusan-dialog').waitFor({state:'visible'});assert.equal(await p.locator('#okusan-dialog button').count(),2);assert.equal(await p.locator('#okusan-leave').textContent(),'Уйти');
      await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'okusan-leave');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'okusan-offer');
      await p.screenshot({path:path.join(out,'expansion-courtyard-'+name+'.png')});await p.locator('#okusan-offer').click();
      const quote=await p.locator('#okusan-response').textContent();assert.ok(await p.evaluate(q=>OkusanQuotes.includes(q.slice(1,-1)),quote));assert.equal(await p.evaluate(()=>__campaign.balance),1);assert.equal(await p.locator('#okusan-offer').isDisabled(),true);
      await p.evaluate(()=>document.getElementById('okusan-offer').click());assert.equal(await p.evaluate(()=>__campaign.balance),1);
      await p.screenshot({path:path.join(out,'expansion-quote-'+name+'.png')});await p.locator('#okusan-leave').click();assert.equal(await p.locator('#menu-screen').isVisible(),true);assert.equal(await p.evaluate(()=>JSON.stringify(__campaign.work)),day);
      await p.reload({waitUntil:'networkidle'});assert.equal(await p.evaluate(()=>__campaign.balance),1);assert.equal(await p.evaluate(()=>__campaign.okusan.gifts),1);
      await p.locator('#okusan-button').click();await p.locator('#courtyard-talk').click();await p.locator('#okusan-dialog').waitFor({state:'visible'});await p.locator('#okusan-leave').click();assert.equal(await p.evaluate(()=>__campaign.balance),1);
      await p.locator('#okusan-button').click();await p.locator('#courtyard-talk').click();await p.locator('#okusan-dialog').waitFor({state:'visible'});await p.locator('#okusan-offer').click();assert.notEqual(await p.locator('#okusan-response').textContent(),quote);await p.locator('#okusan-leave').click();
      await p.locator('#okusan-button').click();await p.locator('#courtyard-talk').click();await p.locator('#okusan-dialog').waitFor({state:'visible'});assert.equal(await p.locator('#okusan-offer').isDisabled(),true);await p.locator('#okusan-leave').click();assert.equal(await p.evaluate(()=>__campaign.balance),0);
      await p.locator('#start-button').click();await p.locator('#region-select').selectOption('7');await p.locator('[data-raid="23"]').click();await p.screenshot({path:path.join(out,'expansion-map-'+name+'.png')});await p.locator('#hub-menu-button').click();
      await p.close();console.log('Okusan passed: '+name);
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({locations:process.argv.includes('--visits-only')?'previously checked':24,regions:8,okusanLayouts:3,errors},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
