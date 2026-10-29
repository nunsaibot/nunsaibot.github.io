/* Fixed campaign locations. Generation is deterministic: every route is the same on repeat visits. */
(function(root){
  'use strict';
  const REGIONS=[
    {id:'city',name:'Ночной город',color:'#d8697b',sky:['#0b1120','#202332'],ground:'#63737a'},
    {id:'bamboo',name:'Бамбуковая чаща',color:'#89b98a',sky:['#112b29','#3c6051'],ground:'#7b9870',names:['Тропа светлячков','Зелёный лабиринт','Усадьба в чаще']},
    {id:'port',name:'Туманный порт',color:'#7cbac9',sky:['#122936','#4f6975'],ground:'#907e62',names:['Рыбацкая пристань','Склады контрабандистов','Чёрный причал']},
    {id:'snow',name:'Снежный перевал',color:'#bad9e5',sky:['#22314b','#8ba4b5'],ground:'#e0e9e5',names:['Белая тропа','Ледяные террасы','Крепость метели']},
    {id:'temple',name:'Забытые храмы',color:'#bca0dc',sky:['#201c38','#695574'],ground:'#a19aa8',names:['Ворота паломников','Колокольный двор','Храм безмолвия']},
    {id:'mine',name:'Медные шахты',color:'#d0a276',sky:['#151719','#413a32'],ground:'#8c7460',names:['Заброшенный забой','Шахта фонарей','Подземный арсенал']},
    {id:'autumn',name:'Кленовые сады',color:'#e5a574',sky:['#3d3034','#ad8068'],ground:'#ad8b67',names:['Аллея красных листьев','Сад камней','Павильон заката']},
    {id:'volcano',name:'Пепельный рубеж',color:'#ef956a',sky:['#241c24','#79433b'],ground:'#a37566',names:['Остывший тракт','Мосты над пеплом','Цитадель углей']}
  ];
  const ENEMY_TYPES={
    guard:{name:'Бойцы',color:'#6b354b',hp:3,speed:190,reach:71,range:112,windup:.28,lunge:345,recover:.25},
    brute:{name:'Громилы',color:'#713f4f',hp:5,speed:145,reach:91,range:125,windup:.45,lunge:365,recover:.46},
    archer:{name:'Лучники',color:'#486b69',hp:2,speed:165,reach:55,range:85,windup:.38,lunge:230,recover:.45},
    spearman:{name:'Копейщики',color:'#8b7450',hp:4,speed:160,reach:145,range:172,windup:.55,lunge:170,recover:.55},
    assassin:{name:'Убийцы',color:'#605580',hp:2,speed:245,reach:62,range:106,windup:.24,lunge:445,recover:.24}
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const intersects=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
  function buildLayout(level,region,tier,platform){
    const width=[5600,7000,8400][tier]+region*90,ground=[],roofs=[];
    // Every elevated structure stands entirely on one ground island. No posts end over a pit.
    ground.push(platform(-100,582,1020,180,'ground'));
    let x=1030,section=0;
    while(x<width){
      let length=980+((region+section*2+tier)%4)*80;
      if(width-x-length<500)length=width-x+100;
      ground.push(platform(x,582,length,180,'ground'));x+=length+100+((section+region+tier)%3)*20;section++;
    }
    roofs.push(platform(300,474,240),platform(630,376,270));
    ground.slice(1).forEach((floor,i)=>{
      if(floor.w<600)return;
      const offset=(region+i+tier)%3*25;
      roofs.push(platform(floor.x+115+offset,474,220+((region+i)%2)*20));
      const upper=(i+region)%3!==1;
      if(floor.w>850&&upper)roofs.push(platform(floor.x+445+offset,376+(i%2)*30,240));
      if(tier>0&&i%2===1&&floor.w>1130&&upper)roofs.push(platform(floor.x+775,290,230));
    });
    for(let i=roofs.length-1;i>=0;i--)if(roofs[i].x+roofs[i].w>width-345)roofs.splice(i,1);
    const platforms=[...ground,...roofs],count=[12,18,24][tier]+region%3,enemies=[];
    const roster=tier===0?['guard','spearman','archer','guard','assassin','brute']:tier===1?['spearman','archer','assassin','brute','guard','brute']:['brute','spearman','assassin','archer','brute','assassin'];
    for(let i=0;i<count;i++){
      const desired=800+i*(width-1200)/(count-1),type=i<2?'guard':roster[(i-2+region)%roster.length];
      const prefersRoof=i>0&&(type==='archer'||i%3===1);
      const candidates=platforms.filter(s=>s.x+s.w-80>=Math.max(s.x+45,(enemies.at(-1)?.[0]??0)+210)).map(s=>{
        const px=clamp(desired,Math.max(s.x+45,(enemies.at(-1)?.[0]??0)+210),s.x+s.w-80);
        return{s,x:px,score:Math.abs(px-desired)+(prefersRoof===(s.kind!=='ground')?0:100)};
      }).filter(c=>Math.abs(c.x-desired)<260);
      candidates.sort((a,b)=>a.score-b.score);const spot=candidates[0];
      if(!spot)throw Error('No safe patrol position: '+level.name+' #'+i);
      enemies.push([spot.x,spot.s.y,type,i===0?0:1+Math.floor((i-1)/2)]);
    }
    Object.assign(level,{width,spawn:[110,520],exit:width-170,region,theme:REGIONS[region].id,tier,platforms,enemies,traps:[],props:[]});
    const enemyBounds=enemies.map(([x,y])=>({x:x-48,y:y-80,w:128,h:80}));
    // Traps have clear approach/escape space and never occupy the first encounter or the exit.
    const trapCount=[4,6,8][tier];
    for(let i=0;i<trapCount;i++){
      const type=['beam','spikes','mine'][(i+region+tier)%3],w=type==='beam'?112:type==='spikes'?88:28,h=type==='beam'?250:type==='spikes'?36:18;
      const desired=1450+i*(width-2050)/(trapCount-1),candidates=[];
      for(const s of platforms)for(let px=s.x+(s.kind==='ground'?100:48);px+w<=s.x+s.w-(s.kind==='ground'?100:48);px+=24){
        const box={x:px,y:s.y-h,w,h};
        if(px<1150||px+w>width-410)continue;
        if(type==='beam'&&s.kind==='ground'&&roofs.some(r=>px-16<r.x+r.w&&px+w+16>r.x))continue;
        if(roofs.some(r=>[{x:r.x+12,y:r.y+24,w:15,h:558-r.y},{x:r.x+r.w-26,y:r.y+24,w:15,h:558-r.y}].some(post=>intersects(box,post,16))))continue;
        if(platforms.some(p=>p!==s&&intersects(box,p,16))||enemyBounds.some(b=>intersects(box,b,10))||level.traps.some(t=>Math.abs(t.x-px)<420))continue;
        candidates.push({x:px,y:s.y,w,h,type,score:Math.abs(px-desired),surface:s});
      }
      candidates.sort((a,b)=>a.score-b.score);const spot=candidates[0];
      if(!spot)throw Error('No safe trap position: '+level.name+' #'+i);
      level.traps.push({id:i,type,x:spot.x,y:spot.y,w,warning:(type==='mine'?.72:type==='beam'?1.15:1.0)-tier*.10});
    }
    // Scenery reserves its entire silhouette, including roofs, foliage and platform supports.
    const occupied=[...roofs.flatMap(s=>[{x:s.x-10,y:s.y-12,w:s.w+20,h:44},{x:s.x+12,y:s.y+24,w:15,h:558-s.y},{x:s.x+s.w-26,y:s.y+24,w:15,h:558-s.y}]),...enemies.map(([x,y])=>({x:x-8,y:y-80,w:48,h:80})),
      ...level.traps.map(t=>({x:t.x-100,y:t.y-250,w:t.w+200,h:250})),{x:0,y:0,w:450,h:582},{x:level.exit-165,y:282,w:330,h:300}];
    const theme=REGIONS[region].id;
    ground.forEach((floor,i)=>{
      const type=theme==='city'?(i%2?'building':'tree'):['port','mine'].includes(theme)?'crates':theme==='temple'?'lantern':theme==='bamboo'||theme==='autumn'?'tree':'rock';
      const sizes={building:[190,210],tree:[170,215],crates:[104,54],lantern:[62,100],rock:[56,32]};
      let placed=0;
      for(const kind of [...new Set([type,'rock'])]){
        for(let px=Math.max(470,floor.x+45);px<floor.x+floor.w-80&&px<width-380&&placed<3;px+=40){
          const [w,h]=sizes[kind],b={x:px,y:floor.y-h,w,h};
          if(px+w>floor.x+floor.w-30||occupied.some(o=>intersects(b,o,22)))continue;
          level.props.push({...b,type:kind,seed:px+i});occupied.push(b);placed++;
        }
      }
    });
    if(theme==='city')level.props.push({type:'building',x:25,y:372,w:190,h:210,seed:region+tier});
  }
  function extend(levels,platform){
    for(let region=1;region<REGIONS.length;region++)for(let tier=0;tier<3;tier++){
      const r=REGIONS[region];levels.push({name:r.names[tier],subtitle:['Шаг за шагом. Клинок наготове.','Патрули держат каждый переход.','Длинный путь. Пощады не будет.'][tier],color:r.color});
    }
    levels.forEach((level,i)=>buildLayout(level,Math.floor(i/3),i%3,platform));
  }
  const api={REGIONS,ENEMY_TYPES,extend};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BushidoContent=api;
})(typeof window!=='undefined'?window:globalThis);
