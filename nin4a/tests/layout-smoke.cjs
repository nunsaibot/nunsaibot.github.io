'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
async function instrument(page){await page.addInitScript(()=>{
  for(const [name,key,output]of [['KageCore','World','__world'],['KageCampaign','Campaign','__campaign']]){
    let captured;Object.defineProperty(window,name,{get:()=>captured,set:value=>{captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){super(...args);window[output]=this;}};}});
  }
  localStorage.setItem('kage-campaign-v1',JSON.stringify({version:5,work:{day:3,job:'fish',seed:3,phase:'ready',quality:79,buff:null,raidChances:[20,40,60]}}));
});}
async function cameraAt(page,x){await page.evaluate(x=>{const w=__world;const floor=w.platforms.find(s=>s.kind==='ground'&&x>=s.x+30&&x<s.x+s.w-40)||w.platforms.filter(s=>s.kind==='ground').find(s=>s.x>x);Object.assign(w.player,{x:floor?Math.max(floor.x+35,Math.min(x,floor.x+floor.w-45)):110,y:530,vx:0,vy:0,invincible:100});for(const e of w.enemies){e.state='recover';e.timer=100;e.vx=0;}},x);await page.waitForTimeout(650);}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),errors=[];
  try{
    const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));await instrument(p);await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    for(let region=0;region<(process.argv.includes('--traps-only')?0:8);region++){
      await p.locator('#start-button').click();await p.locator('#region-select').selectOption(String(region));await p.locator('[data-raid="'+(region*3+2)+'"]').click();assert.ok((await p.locator('#raid-traps').textContent()).includes('8'));
      if(region===0){await p.locator('#raid-traps').click();await p.screenshot({path:path.join(out,'layout-map-traps.png')});}
      await p.locator('#raid-start-button').click();await p.waitForTimeout(1900);assert.equal(await p.evaluate(()=>__world.player.hp),2);
      const width=await p.evaluate(()=>__world.level.width);
      for(const [label,x]of [['entry',110],['middle',width*.45],['end',width-450]]){await cameraAt(p,x);await p.screenshot({path:path.join(out,'layout-'+region+'-'+label+'.png')});}
      await p.evaluate(()=>{for(const e of __world.enemies)__world.hurtEnemy(e,99,1);});await p.locator('#result-screen').waitFor({state:'visible'});await p.locator('#result-menu-button').click();await p.evaluate(()=>{const c=__campaign;if(c.work.phase==='work')c.completeWork({...c.work,status:'done',progress:1,quality:79});});console.log('Rendered extended region '+region);
    }
    await p.close();
    for(const type of ['beam','spikes','mine']){
      const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.locator('#start-button').click();await page.locator('#raid-start-button').click();
      await page.evaluate(type=>{const w=__world,t=w.traps.find(t=>t.type===type);window.__trap=t;for(const e of w.enemies){e.state='recover';e.timer=100;}Object.assign(w.player,{x:t.x-210,y:t.y-52,invincible:100});},type);await page.waitForTimeout(600);
      await page.evaluate(type=>{const t=__trap;Object.assign(__world.player,{x:type==='mine'?t.x:t.x-70,y:t.y-52,vy:0,vx:0});},type);
      await page.waitForFunction(()=>__trap.state==='warning');await page.screenshot({path:path.join(out,'trap-'+type+'-warning.png')});
      await page.keyboard.press('Escape');const timer=await page.evaluate(()=>__trap.timer);await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>__trap.timer),timer);await page.keyboard.press('Escape');
      if(type==='mine'){await page.keyboard.press('KeyJ');await page.waitForFunction(()=>__trap.state==='spent');}
      else{await page.waitForFunction(()=>__trap.state==='active');await page.screenshot({path:path.join(out,'trap-'+type+'-active.png')});await page.waitForFunction(()=>['spent','cooldown'].includes(__trap.state));}
      await page.close();console.log('Trap interaction passed: '+type);
    }
    const mobile=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await instrument(mobile);await mobile.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await mobile.locator('#start-button').tap();await mobile.locator('#raid-start-button').tap();await cameraAt(mobile,1500);await mobile.screenshot({path:path.join(out,'layout-mobile.png')});await mobile.close();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({regionsRendered:process.argv.includes('--traps-only')?'previously checked':8,trapTypes:3,mobile:true,errors},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
