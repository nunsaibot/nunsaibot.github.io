'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../.qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
    const result=await page.evaluate(()=>{
      const levels=KageCore.LEVELS,before=JSON.stringify(levels),canvas=document.createElement('canvas');canvas.width=1152;canvas.height=720;
      const c=canvas.getContext('2d',{willReadFrequently:true}),hashes=[],shots=[];
      const draw=(level,cam=0,time=0,reducedMotion=true)=>{BushidoBiomeArt.paint(c,{cam,width:1152,time,level,reducedMotion},'background');return c;};
      const hash=()=>{const pixels=c.getImageData(0,0,1152,720).data;let value=2166136261;for(let i=0;i<pixels.length;i+=13)value=Math.imul(value^pixels[i],16777619);return value>>>0;};
      // Warm up Canvas readback before comparisons (Chrome can switch raster backends on first read).
      draw(levels[0]);hash();
      for(const level of levels){
        for(const cam of [0,level.width*.48,level.width-1152]){draw(level,cam);if(cam===0)hashes.push(hash());BushidoBiomeArt.paint(c,{cam,width:1152,time:0,level,reducedMotion:true},'scenery');}
        if(!level.boss&&level.tier===2){draw(level,level.width*.48);shots.push(canvas.toDataURL());}
      }
      // Returning after other districts evicted the tiles must reproduce the same scenery.
      draw(levels[0]);const revisit=hash();draw(levels[0],0,90);const reducedMotionStable=hash()===revisit;
      const durations=[];draw(levels[2],1000);
      for(let frame=0;frame<120;frame++){const start=performance.now();draw(levels[2],1000+frame*2,frame/60,false);durations.push(performance.now()-start);}
      durations.sort((a,b)=>a-b);
      return {count:levels.length,hashes,revisit,reducedMotionStable,geometryUnchanged:before===JSON.stringify(levels),shots,renderMs:{mean:durations.reduce((a,b)=>a+b,0)/durations.length,p95:durations[Math.floor(durations.length*.95)]}};
    });
    assert.equal(result.count,32);assert.equal(new Set(result.hashes).size,32,'all mission and arena compositions are distinct');
    assert.equal(result.revisit,result.hashes[0],'deterministic scenery after switching districts');assert.equal(result.reducedMotionStable,true);assert.equal(result.geometryUnchanged,true);
    for(let r=0;r<result.shots.length;r++)fs.writeFileSync(path.join(out,'scenery-'+r+'.png'),Buffer.from(result.shots[r].split(',')[1],'base64'));
    const sheet=await page.evaluate(async shots=>{
      const canvas=document.createElement('canvas');canvas.width=1152;canvas.height=1280;const c=canvas.getContext('2d');c.fillStyle='#10151d';c.fillRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<shots.length;i++){const img=new Image();img.src=shots[i];await img.decode();const x=i%2*576,y=Math.floor(i/2)*320;c.drawImage(img,0,0,1152,600,x,y+20,576,300);c.fillStyle='#fff';c.font='12px sans-serif';c.fillText(KageCore.REGIONS[i].name,x+10,y+14);}
      return canvas.toDataURL();
    },result.shots);fs.writeFileSync(path.join(out,'scenery-contact.png'),Buffer.from(sheet.split(',')[1],'base64'));
    const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.route('https://**/*',route=>route.abort());
    await offline.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    assert.equal(await offline.evaluate(()=>{const c=document.createElement('canvas').getContext('2d');BushidoBiomeArt.paint(c,{cam:1024,width:1152,time:0,level:KageCore.LEVELS[6],reducedMotion:true},'background');return typeof BushidoLandscape.scenery;}),'function');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({levels:result.count,compositions:new Set(result.hashes).size,cameraPositions:96,reducedMotion:result.reducedMotionStable,geometryUnchanged:result.geometryUnchanged,offline:true,renderMs:result.renderMs,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
