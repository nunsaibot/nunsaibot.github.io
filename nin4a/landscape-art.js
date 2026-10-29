/* World-aligned parallax scenery. Cached tiles are bounded and never affect level geometry. */
(function(root){
  'use strict';
  const TILE=1024,HEIGHT=720,cache=new Map();let activeKey='';
  const hash=n=>{const v=Math.sin(n*127.1+39.7)*43758.54;return v-Math.floor(v);};
  const palettes=[
    {sky:['#080f1e','#303646','#59616a'],fog:'#647c88',far:'#414859',mid:'#303e50',near:'#1c2e3c',edge:'#5e7280',wood:'#35404b',roof:'#21303f',leaf:['#344553','#455765','#586571'],light:'#efb77c',moon:'#dc9f9c'},
    {sky:['#0b2329','#314d4a','#7a8f70'],fog:'#8fa79b',far:'#4d716a',mid:'#31564e',near:'#193e37',edge:'#72947a',wood:'#354b3d',roof:'#243d39',leaf:['#2c5143','#466b4c','#668158'],light:'#d9d59a',moon:'#dce5bf'},
    {sky:['#0c2134','#3a596c','#96a29f'],fog:'#a3bbba',far:'#5e7a87',mid:'#3c5e6d',near:'#233f4b',edge:'#789294',wood:'#465252',roof:'#2d454e',leaf:['#304e53','#45646b','#557e7b'],light:'#f0bd7c',moon:'#ece3bd'},
    {sky:['#182943','#657e97','#c7d3d2'],fog:'#bfced4',far:'#8198af',mid:'#536f89',near:'#2e4c62',edge:'#9eb5c1',wood:'#4d6573',roof:'#354c60',leaf:['#365765','#4e6b75','#76919a'],light:'#f6c58e',moon:'#f0f0dc'},
    {sky:['#181b31','#51546e','#ad9995'],fog:'#b4a8b5',far:'#76788e',mid:'#4f566d',near:'#303d53',edge:'#808393',wood:'#655458',roof:'#303f50',leaf:['#35434c','#4a5a60','#6c7372'],light:'#efb878',moon:'#eddbbf'},
    {sky:['#0b171f','#26323c','#49483e'],fog:'#69716c',far:'#3e535b',mid:'#2b3c45',near:'#192b34',edge:'#637876',wood:'#625440',roof:'#293b40',leaf:['#303f42','#435456','#6f8077'],light:'#f4b569',moon:'#bfb690'},
    {sky:['#342d3f','#917379','#dfb28b'],fog:'#d6b7a2',far:'#ab8d8d',mid:'#7b6b70',near:'#4d484e',edge:'#a98b79',wood:'#716054',roof:'#484652',leaf:['#794941','#a45f45','#c5804e'],light:'#f5c38c',moon:'#fae5bd'},
    {sky:['#1c1d2c','#645059','#bd836c'],fog:'#c49b86',far:'#8b7076',mid:'#5f535e',near:'#393e4b',edge:'#8d7b79',wood:'#574649',roof:'#333947',leaf:['#3d3d47','#51434b','#735350'],light:'#f6a66c',moon:'#e2a189'}
  ];
  function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
  function poly(c,pts,col){c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();}
  function line(c,pts,col,width=1){c.strokeStyle=col;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function glow(c,x,y,r,color,alpha=.2){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function mist(c,width,y,height,color,alpha){c.save();c.globalAlpha=alpha;const g=c.createLinearGradient(0,y,0,y+height);g.addColorStop(0,color+'00');g.addColorStop(.6,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,y,width,height);c.restore();}
  function slab(c,x,y,w,h,front,side,top,depth=7){rect(c,x,y,w,h,front);poly(c,[[x+w,y],[x+w+depth,y-depth],[x+w+depth,y+h-depth],[x+w,y+h]],side);poly(c,[[x,y],[x+depth,y-depth],[x+w+depth,y-depth],[x+w,y]],top);}
  function roof(c,x,y,w,h,p,snow=false){
    poly(c,[[x-w*.09,y+h*.75],[x+w*.15,y+h*.54],[x+w*.43,y],[x+w*.71,y],[x+w*.9,y+h*.5],[x+w*1.07,y+h*.7],[x+w,y+h],[x,y+h]],p.roof);
    poly(c,[[x+w*.43,y],[x+w*.71,y],[x+w*1.07,y+h*.7],[x+w*.6,y+h*.84]],p.near);
    line(c,[[x-w*.07,y+h*.75],[x+w*.12,y+h*.8],[x+w*.59,y+h*.88],[x+w*1.06,y+h*.7]],snow?'#d7e1dc':p.edge,3);
    line(c,[[x+w*.44,y],[x+w*.72,y],[x+w*.76,y-4]],snow?'#ecede1':p.edge,3);
    for(let i=0;i<Math.floor(w/13);i++){const t=i/Math.floor(w/13);line(c,[[x+w*(.44+t*.27),y+3],[x+w*(-.04+t*1.08),y+h*.77]],p.edge+'45');}
    rect(c,x,y+h,w,5,p.near);rect(c,x+12,y+h+5,w-24,3,p.wood);
  }
  function lantern(c,x,y,s,p){
    glow(c,x,y,45*s,p.light,.17);rect(c,x-1,y-22*s,2,14*s,p.near);slab(c,x-6*s,y-8*s,12*s,18*s,p.light,p.wood,'#f1d5a4',2*s);
    rect(c,x-7*s,y-9*s,14*s,3*s,p.near);rect(c,x-7*s,y+8*s,14*s,3*s,p.near);for(let j=0;j<3;j++)rect(c,x-6*s,y+(-4+j*5)*s,12*s,s,p.wood+'80');rect(c,x-1,y+12*s,2,7*s,p.light);
  }
  function house(c,x,base,w,h,p,seed,snow=false){
    const top=base-h,side=Math.min(28,w*.16);slab(c,x,top,w,h,p.wood,p.near,p.edge,side);rect(c,x+8,top+10,w-16,h-15,p.mid);
    for(let xx=12;xx<w-8;xx+=w/5){rect(c,x+xx,top+10,3,h-14,p.near);if(hash(seed+xx)>.25){const ww=w/5-9,wy=top+Math.min(25,h*.25),wh=Math.min(25,h-18);rect(c,x+xx+4,wy,ww,wh,p.light+'65');rect(c,x+xx+4,wy+wh*.5,ww,2,p.near);rect(c,x+xx+ww*.5+3,wy,2,wh,p.near);}}
    rect(c,x+4,base-12,w-8,5,p.near);roof(c,x-10,top-35,w+20,37,p,snow);if(hash(seed+8)>.3)lantern(c,x+w-16,top+27,.65,p);
    if(hash(seed+21)>.55){rect(c,x+w*.25,top+56,w*.45,19,p.near);for(let i=0;i<4;i++)rect(c,x+w*.25+i*w*.113,top+56,w*.1,17,p.mid);}
  }
  function pagoda(c,x,base,s,p,seed,floors=4){
    c.save();c.translate(x,base);c.scale(s,s);slab(c,-67,-18,138,22,p.mid,p.near,p.edge,10);
    for(let j=0;j<floors;j++){const w=156-j*22,y=-30-j*62;slab(c,-w*.36,y-42,w*.72,44,p.wood,p.near,p.edge,10);for(let k=-1;k<=1;k++){rect(c,k*w*.2-6,y-32,12,21,hash(seed+j*3+k)>.25?p.light+'80':p.near);rect(c,k*w*.2-1,y-32,2,21,p.near);}roof(c,-w/2,y-69,w,30,p);rect(c,-w*.4,y-4,w*.8,4,p.edge);}
    const top=-floors*62-35;rect(c,-2,top-39,4,51,p.edge);for(let i=0;i<5;i++)rect(c,-10+i,top-32+i*7,20-i*2,2,p.edge);c.restore();
  }
  function torii(c,x,base,s,p){
    c.save();c.translate(x,base);c.scale(s,s);const red=p===palettes[7]?'#785348':'#815757';
    slab(c,-69,-163,12,163,red,p.near,p.edge,5);slab(c,58,-163,12,163,red,p.near,p.edge,5);slab(c,-82,-139,164,10,red,p.near,p.edge,4);slab(c,-96,-165,192,13,red,p.near,p.edge,5);
    poly(c,[[-107,-177],[-88,-169],[91,-169],[108,-177],[101,-160],[-101,-160]],p.roof);rect(c,-9,-155,18,34,p.wood);rect(c,-4,-150,8,21,p.light+'80');line(c,[[-59,-126],[-25,-119],[18,-118],[63,-126]],p.edge,2);
    for(let j=-2;j<=2;j++){const xx=j*19;poly(c,[[xx,-120],[xx+5,-117],[xx+1,-111],[xx+6,-107],[xx,-100],[xx-3,-105]],'#d4d3bd90');}c.restore();
  }
  function pine(c,x,base,s,p,seed,snow=false,bare=false){
    c.save();c.translate(x,base);c.scale(s,s);const lean=(hash(seed)-.5)*36;poly(c,[[-8,0],[-4,-90],[lean,-204],[lean+8,-210],[5,-85],[12,0]],p.near);
    for(let j=0;j<5;j++){const y=-67-j*28,dir=j%2?1:-1,reach=43+hash(seed+j+2)*39-j*5,bx=lean*j/6;line(c,[[bx,y+18],[bx+dir*reach*.55,y-8],[bx+dir*reach,y-12]],p.near,4);if(!bare){const xx=bx+dir*reach*.57;poly(c,[[xx-reach*.65,y-9],[xx-reach*.45,y-23],[xx-9,y-29],[xx+reach*.58,y-19],[xx+reach*.76,y-8],[xx+14,y-2]],p.leaf[j%3]);if(snow)line(c,[[xx-reach*.5,y-21],[xx-9,y-26],[xx+reach*.5,y-18]],'#d4e0da',5);}}
    c.restore();
  }
  function maple(c,x,base,s,p,seed){
    c.save();c.translate(x,base);c.scale(s,s);poly(c,[[-11,0],[-7,-70],[10,-144],[2,-200],[13,-204],[22,-135],[8,-67],[15,0]],p.near);
    for(let branch=0;branch<5;branch++){const dir=branch%2?1:-1,y=-97-branch*20,reach=50+hash(seed+branch)*48;line(c,[[9,y+30],[dir*reach*.55,y],[dir*reach,y-19]],p.near,6-branch*.6);for(let j=0;j<6;j++){const xx=dir*reach+(hash(seed+branch*9+j)-.5)*74,yy=y-32+hash(seed+branch*7+j+71)*37,r=17+hash(seed+j*4+branch)*17;poly(c,[[xx-r,yy],[xx-r*.8,yy-r*.6],[xx-r*.2,yy-r],[xx+r*.7,yy-r*.7],[xx+r,yy],[xx+r*.5,yy+r*.4],[xx-r*.4,yy+r*.5]],p.leaf[(j+branch)%3]);if(j%2===0)rect(c,xx-r*.5,yy-r*.5,r,3,p.edge+'70');}}
    c.restore();
  }
  function bamboo(c,x,base,s,p,seed){
    const count=3+Math.floor(hash(seed)*4);
    for(let j=0;j<count;j++){const bx=x+(j-count/2)*20*s,top=base-(230+hash(seed+j+2)*100)*s,bend=(hash(seed+j+12)-.5)*48*s,thick=(4+hash(seed+j+3)*4)*s;poly(c,[[bx,base],[bx+bend,top],[bx+bend+thick,top],[bx+thick,base]],p.mid);line(c,[[bx+thick,base],[bx+bend+thick,top]],p.edge+'90',1.5);
      for(let y=base-33*s;y>top+18;y-=39*s){const xx=bx+bend*(base-y)/(base-top);rect(c,xx-1,y,thick+2,2*s,p.edge);if(hash(seed+j+y)>.45){const dir=hash(j+y+seed)>.5?1:-1;line(c,[[xx,y],[xx+dir*38*s,y-14*s]],p.near);for(let k=0;k<4;k++){const lx=xx+dir*(10+k*8)*s;poly(c,[[lx,y-k*3*s],[lx+dir*22*s,y-25*s-k*2],[lx+dir*9*s,y-3*s-k*3]],p.leaf[k%3]);}}}}
  }
  function bridge(c,x,y,w,p){
    const arch=[];for(let i=0;i<=16;i++){const t=i/16;arch.push([x+t*w,y-Math.sin(t*Math.PI)*31]);}line(c,arch,p.near,13);line(c,arch.map(([a,b])=>[a,b-3]),p.edge,3);line(c,arch.map(([a,b])=>[a,b-21]),p.wood,4);for(let i=0;i<=10;i++){const xx=x+i*w/10,yy=y-Math.sin(i*Math.PI/10)*31;rect(c,xx,yy-23,3,25,p.wood);}
  }
  function boat(c,x,y,s,p,seed){
    c.save();c.translate(x,y);c.scale(s,s);const length=140+hash(seed)*90;poly(c,[[-length/2,-12],[-length*.35,15],[length*.34,15],[length/2,-19],[length*.3,-10]],p.near);line(c,[[-length/2,-13],[length*.3,-10],[length/2,-20]],p.edge,3);rect(c,-4,-155,5,151,p.wood);
    if(hash(seed+2)>.25){poly(c,[[3,-147],[69,-135],[84,-40],[5,-32]],'#a8aea080');for(let j=0;j<5;j++)line(c,[[5,-135+j*21],[70+j*2,-125+j*20]],p.mid,2);line(c,[[-2,-153],[-51,-12],[82,-12]],p.edge+'70');}else{house(c,-35,-10,58,29,p,seed);lantern(c,43,-30,.6,p);}c.restore();
  }
  function ridge(c,origin,base,amplitude,seed,color,step){
    // Include peaks outside both edges: their rock faces can extend into this tile.
    const pts=[];for(let n=Math.floor(origin/step)-2;n<=Math.ceil((origin+TILE)/step)+2;n++){const broad=Math.sin(n*.43+seed)*.3+Math.sin(n*.91+seed*.3)*.16;pts.push([n*step-origin,base-amplitude*(.25+hash(n+seed)*.4+broad)]);}poly(c,[[pts[0][0],HEIGHT],...pts,[pts.at(-1)[0],HEIGHT]],color);return pts;
  }
  function mountains(c,origin,seed,p,region){
    const height=[135,205,115,290,225,0,155,270][region];
    ridge(c,origin,region===2?405:377,height,seed+900,p.far+'70',150);
    const points=ridge(c,origin,438,height,seed,p.far,132);
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],d=points[i+1];if(b[1]>=a[1]||b[1]>=d[1])continue;
      const foot=470,shoulder=[b[0]+(d[0]-b[0])*.6,b[1]+(d[1]-b[1])*.6];
      poly(c,[b,shoulder,[d[0]+80,foot],[b[0]+48,foot],[b[0]+21,b[1]+80]],p.mid+'65');
      poly(c,[b,[b[0]-18,b[1]+71],[b[0]-94,foot],[a[0]-75,foot],a],p.edge+'30');
      line(c,[[b[0]+9,b[1]+41],[b[0]+28,b[1]+79],[b[0]+14,b[1]+123],[b[0]+49,foot]],p.mid+'50',2);
      for(let j=0;j<4;j++){const yy=b[1]+88+j*35;line(c,[[b[0]-j*17-15,yy],[b[0]-j*23-48,yy+14],[a[0]-j*14-23,yy+27]],p.edge+'25',3);}
      if(region===3)poly(c,[b,shoulder,[b[0]+26,b[1]+42],[b[0]+7,b[1]+28],[b[0]-11,b[1]+56],[b[0]-31,b[1]+41],[b[0]-65,b[1]+72]],'#c9d8dd');
      if(region===7)line(c,[[b[0],b[1]+7],[b[0]+18,b[1]+32],[b[0]+8,b[1]+50],[b[0]+45,430]],'#b9806b70',3);
    }
    // Broken woodland on the lower foothills creates scale without a solid row of trees.
    const hills=ridge(c,origin,475,90,seed+431,p.mid+'65',91);
    for(const [x,y]of hills){const k=x+origin+seed;if(hash(k)>.68)continue;for(let j=0;j<3;j++){const h=16+hash(k+j)*27,xx=x+j*12;poly(c,[[xx-9,y+7],[xx-5,y-h*.25],[xx-8,y-h*.25],[xx,y-h],[xx+8,y-h*.25],[xx+5,y-h*.25],[xx+10,y+7]],p.mid+'85');}}
    for(let n=Math.floor((origin-460)/520);n<=Math.ceil((origin+TILE)/520);n++){
      const k=seed+n*43,x=n*520-origin,y=387+hash(k)*63;
      poly(c,[[x,y+9],[x+85,y],[x+269,y+3],[x+420,y+11],[x+303,y+18],[x+126,y+15]],p.fog+'13');
      if(region===0){c.save();c.globalAlpha=.48;for(let j=0;j<3;j++)house(c,x+j*66,470,65,31+hash(k+j)*30,p,k+j);if(hash(k+5)>.6)pagoda(c,x+245,470,.28,p,k,4);c.restore();}
    }
  }
  function bank(c,x,base,p,layer,region,seed){
    const ground=layer===1?p.mid:p.near,left=x-125,right=x+470;
    if(region===6&&layer===2&&hash(seed+8)>.42){
      poly(c,[[left-85,base+86],[left,base+12],[left+35,base-1],[x+180,base-1],[x+239,base+9],[x+271,base+55],[x+271,HEIGHT],[left-85,HEIGHT]],ground);
      poly(c,[[x+424,HEIGHT],[x+424,base+55],[x+449,base+9],[x+496,base+4],[right+90,base+35],[right+90,HEIGHT]],ground);
    }else{
      poly(c,[[left-85,base+86],[left,base+21],[left+15,base-1],[x+120,base-1],[x+225,base-3],[right-40,base-1],[right,base+47],[right+67,base+110],[right+67,HEIGHT],[left-85,HEIGHT]],ground);
      poly(c,[[left+15,base+1],[x+120,base+1],[x+225,base-1],[right-40,base+1],[right-10,base+30],[x+205,base+34],[x+63,base+19],[left+18,base+30]],p.edge+'24');
    }
    if(region===0||region===2||region===4){
      // Low stone embankments support the settlement and taper into the hillside.
      line(c,[[x-85,base+3],[x+145,base+3],[x+221,base+15],[x+343,base+15]],p.edge+'65',3);
      for(let j=0;j<16;j++){const xx=x-79+j*27,yy=base+12+hash(seed+j)*19;line(c,[[xx,yy],[xx+18,yy-2],[xx+23,yy+5]],p.edge+'38',2);}
    }else if(region!==5)for(let j=0;j<12;j++){const xx=x-80+hash(seed+j*3)*460,yy=base+17+hash(seed+j*7)*35;line(c,[[xx-7,yy],[xx-4,yy-5],[xx,yy],[xx+4,yy-9],[xx+5,yy]],p.edge+'38');}
  }
  function terrain(c,origin,seed,p,region,layer){
    if(region===5){
      if(layer===0){ridge(c,origin,460,170,seed,p.far,150);for(let n=Math.floor(origin/440)-1;n<Math.ceil((origin+TILE)/440)+1;n++){const x=n*440-origin+60,y=250+hash(n+seed)*80;poly(c,[[x-100,550],[x-85,y+65],[x-45,y],[x+29,y-20],[x+98,y+47],[x+125,550]],p.near);poly(c,[[x-73,550],[x-61,y+75],[x-24,y+27],[x+37,y+24],[x+72,y+80],[x+88,550]],'#172b35');}}
      else{const pts=[];for(let n=Math.floor(origin/95)-1;n<=Math.ceil((origin+TILE)/95)+1;n++)pts.push([n*95-origin,50+hash(n+seed+layer*51)*(layer===1?110:66)]);poly(c,[[pts[0][0],0],...pts,[pts.at(-1)[0],0]],layer===1?p.mid:p.near);for(let i=0;i<pts.length-1;i++)poly(c,[[pts[i][0],pts[i][1]],[pts[i][0]+27,pts[i][1]+65*hash(pts[i][0]+origin+seed)],[pts[i+1][0],pts[i+1][1]]],p.edge+'30');}return;
    }
    if(layer===0){mountains(c,origin,seed,p,region);return;}
    if(layer===2&&(region===2||region===6))return;
    ridge(c,origin,layer===1?478:565,layer===1?65:20,seed+layer*119,layer===1?p.mid:p.near,115);
  }
  function compose(c,origin,region,layer,seed){
    const p=palettes[region];terrain(c,origin,seed,p,region,layer);if(layer===0)return;const step=layer===1?750:560;
    // Iterate neighboring world cells too: objects spanning tile boundaries remain continuous.
    const cells=[];
    for(let n=Math.floor((origin-650)/step);n<=Math.ceil((origin+TILE+650)/step);n++){
      const k=seed+n*37+layer*271,x=n*step+hash(k)*180-origin,base=(layer===1?442:535)+hash(k+7)*26,s=(layer===1?.44:.7)+hash(k+3)*.28;
      cells.push({k,x,base,s});
      if(!(region===2&&layer===2))bank(c,x,base,p,layer,region,k);
    }
    for(const {k,x,base,s}of cells){
      if(region===0){
        if(layer===1){if(hash(k+4)>.5)pagoda(c,x,base,s,p,k,3+Math.floor(hash(k)*3));else{house(c,x-90,base,150,100,p,k);house(c,x+90,base+12,90,65,p,k+2);}}
        else{house(c,x,base,120+hash(k+5)*90,70+hash(k+6)*30,p,k);if(hash(k+8)>.35)house(c,x+215,base+7,105,63,p,k+9);else pine(c,x+330,base,.6,p,k);if(hash(k+12)>.55)torii(c,x-92,base,.55,p);}
      }else if(region===1){
        if(layer===1){pine(c,x+180,base,s*1.4,p,k);if(hash(k+10)>.5)house(c,x-85,base,135,60,p,k);}for(let j=0;j<(layer===1?2:3);j++)bamboo(c,x+j*90,base,s*(.8+hash(k+j+20)*.5),p,k+j*13);if(layer===2&&hash(k+8)>.6)torii(c,x+355,base,.62,p);
      }else if(region===2){
        if(layer===1){house(c,x,base,140,67,p,k);if(hash(k+10)>.4)pagoda(c,x+240,base+9,.45,p,k,3);}else{boat(c,x,base+5,s,p,k);if(hash(k+4)>.4)boat(c,x+255,base+15,s*.55,p,k+30);rect(c,x-90,base+24,230,5,p.mid);for(let j=0;j<5;j++)rect(c,x-85+j*48,base+27,4,35,p.near);lantern(c,x+124,base+2,.6,p);}
      }else if(region===3){
        for(let j=0;j<3;j++)pine(c,x+j*84,base+j%2*14,s*(.65+hash(k+j+4)*.5),p,k+j*17,true);if(hash(k+9)>.4)house(c,x+315,base,104,55,p,k,true);else if(layer===2)torii(c,x+350,base,.55,p);
      }else if(region===4){
        if(layer===1){pagoda(c,x,base,s,p,k,3+Math.floor(hash(k+10)*3));pine(c,x+170,base+12,s,p,k);}else{house(c,x,base,165+hash(k)*55,72,p,k);torii(c,x+315,base,.64,p);pine(c,x-70,base,.75,p,k);for(let j=0;j<4;j++)slab(c,x+j*48,base+9,44,25,p.mid,p.near,p.edge,4);}
      }else if(region===5){
        const top=190+hash(k+8)*45,w=180+hash(k+10)*70;slab(c,x,top,12,base-top,p.wood,p.near,p.edge,5);slab(c,x+w,top,12,base-top,p.wood,p.near,p.edge,5);slab(c,x-14,top-10,w+38,14,p.wood,p.near,p.edge,4);line(c,[[x+10,top+54],[x+58,top+6]],p.edge,7);line(c,[[x+w,top+54],[x+w-48,top+6]],p.edge,7);lantern(c,x+w*.68,top+40,.8,p);
        for(let j=0;j<12;j++){const xx=x-95+hash(k+j*11)*100,yy=175+hash(k+j*5)*290;poly(c,[[xx,yy],[xx+9,yy-5],[xx+13,yy+4],[xx+3,yy+9]],j%3?'#b1866255':'#86a59a66');}if(layer===2){line(c,[[x-110,base+27],[x+w+140,base+27]],p.edge,2);for(let j=0;j<11;j++)rect(c,x-100+j*40,base+21,17,10,p.wood);slab(c,x+45,base-20,62,32,p.mid,p.near,p.edge,7);rect(c,x+50,base+12,9,10,p.near);rect(c,x+94,base+12,9,10,p.near);}
      }else if(region===6){
        if(layer===1){maple(c,x,base,s,p,k);if(hash(k+5)>.45)house(c,x+190,base,155,65,p,k);else pagoda(c,x+270,base,.44,p,k,3);}else{maple(c,x,base,s,p,k);maple(c,x+148,base+15,s*.65,p,k+13);if(hash(k+8)>.42)bridge(c,x+255,base+8,195,p);else torii(c,x+340,base,.65,p);}
      }else{
        if(layer===1){if(hash(k+2)>.45)pagoda(c,x,base,.6,p,k,3);else house(c,x,base,140,70,p,k);}else{pine(c,x,base,s*1.1,p,k,false,true);pine(c,x+95,base,s*.65,p,k+2,false,true);if(hash(k+7)>.5)torii(c,x+300,base,.75,p);else house(c,x+280,base,115,62,p,k);}for(let j=0;j<3;j++){const xx=x+j*38,y=base-15+hash(k+j)*22;line(c,[[xx,y],[xx+9,y+6],[xx+6,y+16],[xx+23,y+20]],'#c68a663c',2);}
      }
    }
  }
  function tile(region,layer,index,seed){
    const key=layer+':'+index;if(cache.has(key)){const old=cache.get(key);cache.delete(key);cache.set(key,old);return old;}
    const canvas=document.createElement('canvas');canvas.width=TILE;canvas.height=HEIGHT;compose(canvas.getContext('2d'),index*TILE,region,layer,seed);cache.set(key,canvas);while(cache.size>24)cache.delete(cache.keys().next().value);return canvas;
  }
  function paint(c,view){
    const {cam,width,time,level}=view,region=level.region,p=palettes[region],seed=region*197+level.tier*61+(level.boss?719:0),key=region+':'+seed;
    if(key!==activeKey){cache.clear();activeKey=key;}c.save();
    const sky=c.createLinearGradient(0,0,0,HEIGHT);sky.addColorStop(0,p.sky[0]);sky.addColorStop(.62,p.sky[1]);sky.addColorStop(1,p.sky[2]);c.fillStyle=sky;c.fillRect(0,0,width,HEIGHT);
    if(region!==5){
      const mx=width*(.62+hash(seed)*.14)-cam*.012,my=125+hash(seed+2)*45,r=35+hash(seed+7)*23;glow(c,mx,my,r*3.2,p.moon,.16);
      for(let y=-r;y<r;y+=4){const half=Math.floor(Math.sqrt(Math.max(0,r*r-y*y))/3)*3;rect(c,mx-half,my+y,half*2,4,p.moon);}
      for(let i=0;i<5;i++){const xx=mx-r*.65+hash(seed+i*7)*r*1.3,yy=my-r*.65+hash(seed+i*17)*r*1.3;rect(c,xx,yy,6+hash(i+seed)*14,4,p.sky[1]+'20');}
      for(let n=Math.floor((cam*.035-400)/650);n<Math.ceil((cam*.035+width+400)/650);n++){const x=n*650-cam*.035+(view.reducedMotion?0:Math.sin(time*.025+n)*18),y=92+hash(seed+n*8)*110;poly(c,[[x,y+12],[x+40,y+5],[x+150,y],[x+226,y+8],[x+310,y+10],[x+357,y+20],[x+200,y+17],[x+83,y+22]],p.fog+'19');rect(c,x+90,y+28,190,3,p.fog+'0c');}
    }else glow(c,width*.7-cam*.025,270,260,'#85afad',.07);
    const factors=[.075,.21,.43];
    for(let layer=0;layer<3;layer++){
      const offset=cam*factors[layer],first=Math.floor(offset/TILE),last=Math.floor((offset+width)/TILE);for(let i=first;i<=last;i++)c.drawImage(tile(region,layer,i,seed),Math.round(i*TILE-offset),0);
      mist(c,width,layer===0?260:layer===1?365:455,layer===0?245:170,p.fog,layer===0?.22:layer===1?.14:.075);
      if(layer===1&&(region===2||region===6)){
        const water=c.createLinearGradient(0,477,0,630);water.addColorStop(0,region===2?'#527b8540':'#866d7040');water.addColorStop(1,p.near);c.fillStyle=water;c.fillRect(0,477,width,HEIGHT-477);
        for(let i=0;i<28;i++){const x=((hash(seed+i)*2300-cam*.29+(view.reducedMotion?0:time*4))%(width+140)+width+140)%(width+140)-70,y=495+hash(seed+i*7)*75;rect(c,x,y,12+hash(seed+i*3)*57,1,p.edge+'50');}
      }
    }
    const offset=cam*.68;
    for(let n=Math.floor((offset-350)/1100);n<Math.ceil((offset+width+350)/1100);n++){const x=n*1100+hash(seed+n*7)*150-offset;if(region===5)poly(c,[[x,0],[x+120,0],[x+98,37],[x+64,84],[x+42,38]],'#11232b');else if(region===1||region===6){line(c,[[x-60,0],[x+16,65],[x+130,92]],p.near,8);for(let j=0;j<8;j++){const xx=x+j*19,yy=35+j*7;poly(c,[[xx,yy],[xx+27,yy-12],[xx+18,yy+10],[xx-5,yy+7]],p.near+'b0');}}}
    c.restore();
  }
  function scenery(c,view){
    const {cam,width,level}=view,p=palettes[level.region],id=level.theme;
    for(const prop of level.props){const x=prop.x-cam,y=prop.y,w=prop.w,h=prop.h,base=y+h;if(x+w<-20||x>width+20)continue;
      // Foreground decoration stays inside the footprint reserved by level generation.
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      if(prop.type==='building')house(c,x+w*.09,base-2,w*.74,h-45,p,prop.seed,id==='snow');
      else if(prop.type==='tree'){if(id==='autumn'||id==='city')maple(c,x+w*.5,base,Math.min(h/240,w/200),p,prop.seed);else pine(c,x+w*.5,base,Math.min(h/215,w/145),p,prop.seed,id==='snow');}
      else if(prop.type==='lantern'){slab(c,x+w*.42,y+h*.48,w*.17,h*.52,p.mid,p.near,p.edge,4);slab(c,x+w*.24,y+h*.21,w*.5,h*.32,p.mid,p.near,p.edge,4);roof(c,x+w*.12,y+h*.06,w*.72,h*.15,p,id==='snow');glow(c,x+w*.5,y+h*.36,25,p.light,.22);rect(c,x+w*.39,y+h*.28,w*.22,h*.18,p.light);}
      else if(prop.type==='crates'){slab(c,x,base-50,Math.min(w*.52,53),50,p.wood,p.near,p.edge,5);line(c,[[x+5,base-44],[x+w*.42,base-8]],p.edge,3);slab(c,x+w*.6,base-34,w*.33,34,p.mid,p.near,p.edge,4);}
      else{poly(c,[[x,base],[x+5,base-h*.5],[x+w*.3,base-h],[x+w*.78,base-h*.8],[x+w,base-h*.3],[x+w,base]],p.mid);poly(c,[[x+w*.3,base-h],[x+w*.78,base-h*.8],[x+w,base-h*.3],[x+w*.47,base-h*.4]],id==='snow'?'#d1dfd9':p.edge);}
      c.restore();
    }
    if(level.region!==0)torii(c,level.exit-cam,582,.9,p);
  }
  root.BushidoLandscape={paint,scenery};
})(window);
