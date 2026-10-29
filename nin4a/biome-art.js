/* Scenery entry point and sparse foreground weather; landscape geometry lives in landscape-art.js. */
(function(root){
  function paint(c,view,part){
    if(part==='background'){root.BushidoLandscape.paint(c,view);return;}
    if(part==='scenery'){root.BushidoLandscape.scenery(c,view);return;}
    if(part!=='weather'||view.reducedMotion)return;
    const {cam,width,time,level}=view,id=level.theme;
    const h=n=>{const v=Math.sin(n*127.1+39)*43758.54;return v-Math.floor(v);};
    c.save();
    if(['snow','autumn','volcano','bamboo','mine','temple'].includes(id))for(let i=0;i<(id==='snow'?45:id==='bamboo'?18:24);i++){
      const x=((h(i)*2200+time*(id==='snow'?18:10)-cam*.2)%(width+30)+width+30)%(width+30),y=(h(i+70)*740+time*(id==='snow'?35:id==='bamboo'?2:19))%740;
      c.fillStyle=id==='snow'?'#e5eee1aa':id==='bamboo'?'#b4d58b88':id==='volcano'?'#e59d6b88':id==='autumn'?'#dcac6b99':'#d0b18e25';c.fillRect(Math.round(x),Math.round(y),id==='snow'?3:4,id==='snow'?3:2);
    }
    if(id==='port'){
      c.strokeStyle='#bdd0ce18';c.lineWidth=1;c.beginPath();for(let i=0;i<55;i++){const x=((h(i+57)*2200-time*45-cam*.25)%(width+40)+width+40)%(width+40),y=(h(i+29)*740+time*290)%740;c.moveTo(x,y);c.lineTo(x-3,y+9);}c.stroke();
    }
    c.restore();
  }
  root.BushidoBiomeArt={paint};
})(window);
