'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
async function prepare(page,gear=false,ready=false){await page.addInitScript(({gear,ready})=>{
  for(const [name,key,output]of [['KageCore','World','__world'],['KageCampaign','Campaign','__campaign']]){let captured;Object.defineProperty(window,name,{get:()=>captured,set:value=>{captured=value;const Original=value[key];value[key]=class extends Original{constructor(...args){if(name==='KageCampaign')args[1]=()=>.5;super(...args);window[output]=this;}};}});}
  if(!localStorage.getItem('kage-campaign-v1'))localStorage.setItem('kage-campaign-v1',JSON.stringify({version:7,balance:100,clears:Array(24).fill(1),amulets:gear?{omamori:true,dash:true,fury:true,ronin:true}:{},inventory:gear?{shuriken:1,potion:2,workPass:4}:{},work:{day:5,job:'rice',seed:3,phase:ready?'ready':'work',quality:ready?100:null,buff:gear&&ready?'vitality':null,dayOff:false,raidChances:[20,40,60]}}));
},{gear,ready});}
async function calm(page){await page.evaluate(()=>{__world.player.invincible=100;__world.traps=[];for(const e of __world.enemies){e.x=4500;e.state='recover';e.timer=100;}});}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),errors=[];
  try{
    const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));await prepare(p);await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    assert.equal(await p.evaluate(()=>__campaign.equipped),'fists');await p.locator('#menu-shop-button').click();assert.equal(await p.locator('[data-item-card]').count(),9);
    await p.screenshot({path:path.join(out,'equipment-shop-weapons.png')});
    for(const id of ['katana','akatsuki','omamori','dash','fury','ronin','shuriken','potion','potion','workPass'])await p.locator('[data-shop-item="'+id+'"]').click();
    assert.equal(await p.evaluate(()=>__campaign.balance),38);assert.equal(await p.locator('[data-shop-item="potion"]').isDisabled(),true);assert.equal(await p.locator('[data-shop-item="shuriken"]').isDisabled(),true);
    await p.locator('[data-item-card="fury"]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'equipment-shop-amulets.png')});
    await p.locator('[data-item-card="workPass"]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'equipment-shop-supplies.png')});
    await p.locator('#equip-default-button').click();await p.locator('#shop-continue-button').click();assert.equal(await p.locator('#work-screen').isVisible(),true);
    await p.locator('#work-screen [data-skip-work]').click();assert.equal(await p.evaluate(()=>__campaign.inventory.workPass),3);assert.equal(await p.evaluate(()=>__campaign.work.buff),null);
    await p.locator('#raid-start-button').click();await calm(p);assert.equal(await p.evaluate(()=>__world.weapon.id),'fists');
    assert.equal(await p.locator('#jump-control').textContent(),'ДВОЙНОЙ ПРЫЖОК');
    await p.keyboard.press('KeyR');assert.equal(await p.evaluate(()=>__campaign.inventory.potion),2);
    await p.evaluate(()=>__world.player.hp=1);await p.keyboard.press('KeyR');assert.equal(await p.evaluate(()=>__world.player.hp),2);assert.equal(await p.evaluate(()=>__campaign.inventory.potion),1);
    await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>__world.windProjectiles.length),1);assert.equal(await p.evaluate(()=>__campaign.inventory.shuriken),0);
    await p.screenshot({path:path.join(out,'equipment-wind.png')});
    await p.evaluate(()=>{__world.player.hp=1;});await p.keyboard.press('Escape');await p.keyboard.press('KeyR');assert.equal(await p.evaluate(()=>__campaign.inventory.potion),1);await p.locator('#resume-button').click();
    await p.keyboard.press('KeyR');assert.equal(await p.evaluate(()=>__campaign.inventory.potion),0);
    await p.evaluate(()=>{const w=__world;w.combo=10;w.comboTimer=5;Object.assign(w.player,{facing:1,vx:0});Object.assign(w.enemies[0],{x:w.player.x+65,y:w.player.y,hp:30});});await p.keyboard.press('KeyQ');assert.equal(await p.evaluate(()=>__world.enemies[0].dead),true);assert.equal(await p.evaluate(()=>__world.combo),0);
    await p.waitForTimeout(1700);await p.evaluate(()=>{__world.hitstop=30;__world.player.x=450;__world.player.y=530;__world.player.grounded=true;});await p.waitForTimeout(600);
    for(let step=0;step<3;step++){await p.evaluate(step=>Object.assign(__world.player,{attackTime:.13,comboStep:step,attackDuration:.24}),step);await p.screenshot({path:path.join(out,'equipment-fist-'+step+'.png')});}
    await p.reload({waitUntil:'networkidle'});assert.equal(await p.evaluate(()=>__campaign.work.day),6);assert.deepEqual(await p.evaluate(()=>__campaign.inventory),{shuriken:0,potion:0,workPass:3});assert.equal(await p.evaluate(()=>__campaign.amulets.ronin),true);
    await p.locator('#menu-shop-button').click();await p.locator('[data-shop-item="shuriken"]').click();assert.equal(await p.evaluate(()=>__campaign.inventory.shuriken),1);await p.locator('[data-shop-item="katana"]').click();assert.equal(await p.evaluate(()=>__campaign.equipped),'katana');await p.close();
    const fresh=await browser.newPage();fresh.on('pageerror',e=>errors.push(e.message));await prepare(fresh,false,true);await fresh.goto('http://127.0.0.1:5173');await fresh.locator('#start-button').click();await fresh.locator('#raid-start-button').click();await calm(fresh);await fresh.waitForTimeout(300);
    await fresh.keyboard.press('ShiftLeft');assert.equal(await fresh.evaluate(()=>__world.player.dashTime),0);await fresh.keyboard.press('Space');await fresh.waitForTimeout(100);await fresh.keyboard.press('Space');assert.equal(await fresh.evaluate(()=>__world.player.jumps),1);assert.equal(await fresh.locator('#jump-control').textContent(),'ПРЫЖОК');await fresh.close();
    for(const [label,width,height]of [['portrait',390,844],['landscape',844,390]]){
      const mobile=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await prepare(mobile,true,true);await mobile.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await mobile.locator('#menu-shop-button').tap();
      for(const card of await mobile.locator('[data-item-card]').all()){const b=await card.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1,'shop card fits '+label);}
      await mobile.screenshot({path:path.join(out,'equipment-shop-'+label+'.png')});await mobile.locator('#shop-map-button').tap();await mobile.locator('#raid-start-button').tap();await calm(mobile);await mobile.waitForTimeout(2000);
      await mobile.evaluate(()=>__world.player.hp=1);await mobile.locator('[data-control="heal"]').tap();assert.equal(await mobile.evaluate(()=>__world.player.hp),2);await mobile.locator('[data-control="shuriken"]').tap();assert.equal(await mobile.evaluate(()=>__campaign.inventory.shuriken),0);
      for(const button of await mobile.locator('#touch-controls button:visible').all()){const b=await button.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,'touch action fits '+label);}
      await mobile.screenshot({path:path.join(out,'equipment-play-'+label+'.png')});
      await mobile.locator('#pause-button').tap();await mobile.locator('#menu-button').tap();await mobile.evaluate(()=>{const c=__campaign;c.completeWork({...c.work,status:'done',progress:1,quality:100});c.work.buff='vitality';c.save();});
      await mobile.locator('[data-raid="24"]').tap();await mobile.locator('#raid-start-button').tap();await mobile.evaluate(()=>{__world.player.invincible=100;__world.combo=10;__world.comboTimer=30;});await mobile.waitForTimeout(150);
      const hp=await mobile.evaluate(()=>__world.boss.hp);await mobile.keyboard.press('KeyQ');assert.equal(await mobile.evaluate(()=>__world.boss.hp),hp);assert.equal(await mobile.locator('[data-control="execute"]').isDisabled(),true);
      const playerHud=await mobile.locator('.player-info').boundingBox(),bossHud=await mobile.locator('#boss-hud').boundingBox();
      await mobile.screenshot({path:path.join(out,'equipment-boss-'+label+'.png')});
      assert.ok(playerHud.y+playerHud.height<=bossHud.y||bossHud.y+bossHud.height<=playerHud.y||playerHud.x+playerHud.width<=bossHud.x,'equipment and boss HUD do not overlap '+label);await mobile.close();
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({items:9,purchases:true,savedConsumables:true,certificate:true,keyboard:['E','R','Q'],unarmedPoses:3,mobileLayouts:2,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
