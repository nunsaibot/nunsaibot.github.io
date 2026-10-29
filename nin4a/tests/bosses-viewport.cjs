'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try{
    const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('kage-campaign-v1',JSON.stringify({clears:Array(24).fill(1),work:{day:1,job:'fish',seed:1,phase:'ready',dayOff:true}})));
    await page.goto('http://127.0.0.1:5173');await page.locator('#start-button').click();await page.locator('[data-raid="24"]').click();await page.locator('#raid-start-button').click();
    for(const [width,height]of [[1366,768],[1280,720],[1024,600],[1440,900]]){
      await page.setViewportSize({width,height});const hud=await page.locator('#boss-hud').boundingBox();assert.ok(hud.y>height*582/720,'boss HUD below the floor at '+width+'x'+height);assert.ok(hud.x>=0&&hud.x+hud.width<=width);await page.screenshot({path:path.resolve(__dirname,'../.qa/boss-viewport-'+width+'.png')});
    }
    console.log('Boss HUD clear of the floor at all four desktop sizes');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
