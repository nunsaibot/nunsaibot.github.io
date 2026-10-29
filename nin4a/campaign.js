/* Persistent day cycle: finish a shift, spend one raid entry, then a new day. */
(function(root){
  'use strict';
  const {BUFFS,LEVELS}=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.KageCore;
  const STORAGE_KEY='kage-campaign-v1',WEAPON_PRICE=10,PITY_STEP=10,DAY_OFF_CHANCE=.17;
  const SHOP_ITEMS={
    katana:{name:'Катана',price:5,kind:'weapon',icon:'刀',description:'Первый клинок. Урон 1 / 1 / 2, дальность больше, чем у кулаков.'},
    akatsuki:{name:'Акацуки',price:10,kind:'weapon',icon:'暁',description:'Клинок рассвета. Урон 2 / 2 / 3, красная рукоять и золотая гарда.'},
    omamori:{name:'Омамори',price:3,kind:'amulet',icon:'守',description:'Открывает второй прыжок в воздухе. SPACE — повторное нажатие.'},
    dash:{name:'Амулет рывка',price:8,kind:'amulet',icon:'疾',description:'SHIFT — быстрый рывок с короткой неуязвимостью.'},
    fury:{name:'Амулет ярости',price:10,kind:'amulet',icon:'怒',description:'+8% к урону кулаков, обоих мечей и сюрикена ветра.'},
    ronin:{name:'Амулет ронина',price:13,kind:'amulet',icon:'浪',description:'При серии ×10 нажми Q: мгновенно убей одного обычного врага перед собой. Серия расходуется. На боссов не действует.'},
    shuriken:{name:'Сюрикен ветра',price:2,kind:'supply',icon:'風',limit:1,amount:1,description:'E — один бросок через всю карту в сторону взгляда. Пробивает врагов на пути; урон 2, как обычный удар Акацуки. После броска можно купить новый.'},
    potion:{name:'Зелье здоровья',price:3,kind:'supply',icon:'薬',limit:2,amount:1,description:'R (русская К) — восстановить одну полоску жизни. Запас: максимум 2 зелья.'},
    workPass:{name:'Грамота лучшего работника',price:5,kind:'supply',icon:'功',limit:4,amount:4,description:'Четыре пропуска смены по твоему выбору, без бафа. Новую грамоту можно купить после использования всех четырёх пропусков.'}
  };
  const JOBS={fish:{name:'Разделка рыбы',label:'РЫБА'},rice:{name:'Идеальный рис',label:'РИС'},slice:{name:'Нарезка в ритм',label:'НАРЕЗКА'},roll:{name:'Сворачивание ролла',label:'РОЛЛ'},order:{name:'Заказ по памяти',label:'ЗАКАЗ'}};
  const RAIDS=[
    {faction:'Красные карпы',difficulty:'Опасная',threat:1,chance:[10,30],drops:[{amount:1,weight:100}],x:25,y:68,description:'На входе — одиночный дозор. Дальше смешанные патрули, крыши и ловушки. Не спеши собирать на себя весь отряд.'},
    {faction:'Пепельные лисы',difficulty:'Тяжёлая',threat:2,chance:[30,50],drops:[{amount:1,weight:70},{amount:2,weight:30}],x:53,y:38,description:'Банда контролирует крыши. Бойцы зовут соседей, обходят с двух сторон и прыгают за тобой.'},
    {faction:'Железный круг',difficulty:'Смертельная',threat:3,chance:[40,80],drops:[{amount:1,weight:40},{amount:2,weight:30},{amount:3,weight:20},{amount:4,weight:10}],x:79,y:62,description:'Длинный укреплённый рубеж. Громил прикрывают лучники, копейщики и убийцы. Ловушки срабатывают быстрее: береги обе жизни.'}
  ];
  const bosses=typeof module!=='undefined'&&module.exports?require('./bosses.js'):root.BushidoBosses;
  for(let i=3;i<LEVELS.length;i++){
    const level=LEVELS[i];
    if(level.boss){const boss=bosses.DEFS.find(b=>b.id===level.boss);RAIDS.push({region:level.region,boss:level.boss,faction:boss.title,difficulty:'Босс · две фазы',threat:4,chance:[100,100],drops:[{amount:3,weight:100}],x:50,y:77,description:boss.description+' '+boss.tip});}
    else{const base=RAIDS[level.tier];RAIDS.push({...base,region:level.region,faction:['Тихие стрелы','Стражи тумана','Клан затмения'][level.tier],difficulty:['Умеренная','Тяжёлая','Смертельная'][level.tier],description:level.subtitle+' Лучники держат дистанцию, копейщики контролируют подходы, убийцы сокращают расстояние.'});}
  }
  RAIDS.forEach((raid,i)=>{if(!raid.boss){raid.x=[20,50,80][LEVELS[i].tier];raid.y=[48,25,48][LEVELS[i].tier];}});
  const QUOTES=typeof module!=='undefined'&&module.exports?require('./okusan-quotes.js'):root.OkusanQuotes;
  const safeCount=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,1000000):0;
  class Campaign{
    constructor(storage=null,random=Math.random){
      this.storage=storage;this.random=random;this.claimed=new WeakSet();this.persisted=!!storage;
      let raw={};try{raw=JSON.parse(storage?.getItem(STORAGE_KEY)||'{}')||{};}catch{this.persisted=false;}
      this.dryStreak=safeCount(raw.dryStreak);
      const bag=raw.okusan?.bag;this.okusan={gifts:safeCount(raw.okusan?.gifts),last:Number.isInteger(raw.okusan?.last)?raw.okusan.last:-1,bag:Array.isArray(bag)&&bag.every(i=>Number.isInteger(i)&&i>=0&&i<QUOTES.length)&&new Set(bag).size===bag.length?[...bag]:[]};
      this.balance=safeCount(raw.balance);this.clears=RAIDS.map((_,i)=>safeCount(raw.clears?.[i]));
      this.ownsAkatsuki=raw.ownsAkatsuki===true;this.ownsKatana=raw.version>=7&&raw.ownsKatana===true;
      this.amulets=Object.fromEntries(Object.entries(SHOP_ITEMS).filter(([,item])=>item.kind==='amulet').map(([id])=>[id,raw.amulets?.[id]===true]));
      this.inventory=Object.fromEntries(Object.entries(SHOP_ITEMS).filter(([,item])=>item.kind==='supply').map(([id,item])=>[id,Math.min(item.limit,safeCount(raw.inventory?.[id]))]));
      this.equipped=raw.equipped==='akatsuki'&&this.ownsAkatsuki?'akatsuki':raw.equipped==='katana'&&this.ownsKatana?'katana':'fists';
      const saved=raw.work;
      if(saved&&JOBS[saved.job]&&safeCount(saved.day)>0&&Number.isInteger(saved.seed)&&['work','ready','raid'].includes(saved.phase)){
        const quality=Number.isFinite(saved.quality)?Math.max(0,Math.min(100,Math.floor(saved.quality))):null;
        this.work={day:saved.day,job:saved.job,seed:saved.seed>>>0,rare:!!saved.rare,phase:saved.phase,quality,buff:quality>=80&&BUFFS[saved.buff]?saved.buff:null,runId:typeof saved.runId==='string'?saved.runId:null,levelIndex:saved.levelIndex};
        this.work.raidChances=this.restoreChances(saved.raidChances);
        this.work.dayOff=saved.dayOff===true;this.work.skipped=saved.skipped===true;
        if(this.work.skipped){this.work.quality=null;this.work.buff=null;if(this.work.phase==='work')this.work.phase='ready';}
        if(this.work.dayOff){this.work.quality=null;this.work.buff=null;if(this.work.phase==='work')this.work.phase='ready';}
        if(this.work.phase==='raid')this.newDay(); // Reloading an active raid spends that attempt.
      }else this.newDay();
      this.save();
    }
    createChances(){return RAIDS.map(raid=>raid.boss?100:raid.chance[0]+Math.floor(this.random()*(raid.chance[1]-raid.chance[0]+1)));}
    restoreChances(saved){
      return RAIDS.map((raid,i)=>raid.boss?100:Number.isInteger(saved?.[i])&&saved[i]>=raid.chance[0]&&saved[i]<=raid.chance[1]?saved[i]:raid.chance[0]+Math.floor(this.random()*(raid.chance[1]-raid.chance[0]+1)));
    }
    regionProgress(region){return this.clears.slice(region*3,region*3+3).filter(n=>n>0).length;}
    bossUnlocked(region){return Number.isInteger(region)&&region>=0&&region<bosses.DEFS.length&&this.regionProgress(region)===3;}
    canEnter(index){return Number.isInteger(index)&&!!RAIDS[index]&&(!RAIDS[index].boss||this.bossUnlocked(LEVELS[index].region));}
    get pityBonus(){return Math.min(100,this.dryStreak*PITY_STEP);}
    raidOffer(index){
      const raid=RAIDS[index];if(!raid)return null;
      const baseChance=this.work.raidChances[index],bonus=Math.min(100-baseChance,this.pityBonus),multiplier=this.work.buff==='bounty'?2:1;
      return{baseChance,bonus,chance:baseChance+bonus,multiplier,drops:raid.drops.map(drop=>({amount:drop.amount*multiplier,weight:drop.weight}))};
    }
    newDay(){
      const previous=this.work,choices=Object.keys(JOBS).filter(id=>id!==previous?.job);
      this.work={day:(previous?.day||0)+1,job:choices[Math.floor(this.random()*choices.length)%choices.length],seed:Math.floor(this.random()*4294967296)>>>0,rare:this.random()<.2,phase:'work',quality:null,buff:null,runId:null,levelIndex:null,raidChances:this.createChances()};
      this.work.dayOff=this.random()<DAY_OFF_CHANCE;this.work.skipped=false;
      if(this.work.dayOff)this.work.phase='ready';
    }
    save(){
      try{if(!this.storage)throw Error('No storage');this.storage.setItem(STORAGE_KEY,JSON.stringify({version:7,okusan:this.okusan,dryStreak:this.dryStreak,balance:this.balance,clears:this.clears,ownsKatana:this.ownsKatana,ownsAkatsuki:this.ownsAkatsuki,equipped:this.equipped,amulets:this.amulets,inventory:this.inventory,work:this.work}));this.persisted=true;}catch{this.persisted=false;}return this.persisted;
    }
    completeWork(game){
      const w=this.work;
      if(w.dayOff||w.skipped||w.phase!=='work'||!game||game.status!=='done'||game.progress!==1||game.day!==w.day||game.job!==w.job||game.seed!==w.seed||!Number.isFinite(game.quality))return false;
      w.quality=Math.max(0,Math.min(100,Math.floor(game.quality)));w.phase='ready';
      const ids=Object.keys(BUFFS),pick=((Math.imul(w.seed^0x45d9f3b,2654435761)>>>0)%ids.length);
      w.buff=w.quality>=80?ids[pick]:null;this.save();return true;
    }
    beginRaid(index){
      if(this.work.phase!=='ready'||!this.canEnter(index))return null;
      const w=this.work;w.phase='raid';w.runId=w.day+':'+w.seed+':'+index;w.levelIndex=index;this.save();
      const runId=w.runId;
      return{runId,buff:w.buff,weapon:this.equipped,amulets:{...this.amulets},inventory:{...this.inventory},consumeItem:id=>this.consumeItem(id,runId)};
    }
    claimRaid(world){
      const w=this.work;
      if(!world||world.status!=='cleared'||this.claimed.has(world)||w.phase!=='raid'||world.runId!==w.runId||world.levelIndex!==w.levelIndex)return 0;
      this.claimed.add(world);
      const offer=this.raidOffer(world.levelIndex);let reward=0;
      if(RAIDS[world.levelIndex].boss)reward=3*offer.multiplier;
      else if(this.random()*100<offer.chance){
        const roll=this.random()*100;let cumulative=0;
        for(const drop of offer.drops){cumulative+=drop.weight;if(roll<cumulative){reward=drop.amount;break;}}
      }
      this.dryStreak=reward?0:Math.min(1000000,this.dryStreak+1);
      this.balance+=reward;this.clears[world.levelIndex]++;
      this.newDay();this.save();return reward;
    }
    abandonRaid(){
      if(this.work.phase!=='raid')return false;this.newDay();this.save();return true;
    }
    offerOkusan(){
      if(this.work.phase==='raid')return{ok:false,reason:'raid'};
      if(this.balance<1)return{ok:false,reason:'funds'};
      if(!this.okusan.bag.length){
        this.okusan.bag=QUOTES.map((_,i)=>i);
        for(let i=this.okusan.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.okusan.bag[i],this.okusan.bag[j]]=[this.okusan.bag[j],this.okusan.bag[i]];}
        const last=this.okusan.bag.length-1;if(this.okusan.bag[last]===this.okusan.last)[this.okusan.bag[0],this.okusan.bag[last]]=[this.okusan.bag[last],this.okusan.bag[0]];
      }
      const index=this.okusan.bag.pop();this.okusan.last=index;this.okusan.gifts++;this.balance--;this.save();return{ok:true,quote:QUOTES[index],index};
    }
    owns(id){return id==='fists'||id==='katana'&&this.ownsKatana||id==='akatsuki'&&this.ownsAkatsuki||this.amulets[id]===true;}
    purchaseReason(id){
      if(!Object.hasOwn(SHOP_ITEMS,id))return 'unknown';const item=SHOP_ITEMS[id];if(this.work.phase==='raid')return 'raid';
      if(item.kind!=='supply'&&this.owns(id))return 'owned';
      if(item.kind==='supply'&&this.inventory[id]+item.amount>item.limit)return 'full';
      return this.balance<item.price?'funds':null;
    }
    buy(id){
      const reason=this.purchaseReason(id);if(reason)return{ok:false,reason};const item=SHOP_ITEMS[id];this.balance-=item.price;
      if(item.kind==='weapon'){if(id==='katana')this.ownsKatana=true;else this.ownsAkatsuki=true;this.equipped=id;}
      else if(item.kind==='amulet')this.amulets[id]=true;else this.inventory[id]+=item.amount;
      this.save();return{ok:true};
    }
    buyAkatsuki(){return this.buy('akatsuki');}
    equip(id){if(this.work.phase==='raid'||!['fists','katana','akatsuki'].includes(id)||!this.owns(id))return false;this.equipped=id;this.save();return true;}
    consumeItem(id,runId){
      if(!['shuriken','potion'].includes(id)||this.work.phase!=='raid'||this.work.runId!==runId||this.inventory[id]<1)return false;
      this.inventory[id]--;this.save();return true;
    }
    skipWork(){
      if(this.work.phase!=='work'||this.work.dayOff||this.inventory.workPass<1)return false;
      this.inventory.workPass--;Object.assign(this.work,{phase:'ready',skipped:true,quality:null,buff:null});this.save();return true;
    }
  }
  const api={Campaign,RAIDS,JOBS,SHOP_ITEMS,WEAPON_PRICE,PITY_STEP,DAY_OFF_CHANCE,STORAGE_KEY};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KageCampaign=api;
})(typeof window!=='undefined'?window:globalThis);
