/* Persistent day cycle: finish a shift, spend one raid entry, then a new day. */
(function(root){
  'use strict';
  const {BUFFS}=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.KageCore;
  const STORAGE_KEY='kage-campaign-v1',WEAPON_PRICE=4,PITY_STEP=10;
  const JOBS={fish:{name:'Разделка рыбы',label:'РЫБА'},rice:{name:'Идеальный рис',label:'РИС'}};
  const RAIDS=[
    {faction:'Красные карпы',difficulty:'Опасная',threat:1,chance:[10,30],drops:[{amount:1,weight:100}],x:25,y:68,description:'Бойцы преследуют по крышам и атакуют с разбега. Один громила держит удар во время замаха.'},
    {faction:'Пепельные лисы',difficulty:'Тяжёлая',threat:2,chance:[30,50],drops:[{amount:1,weight:70},{amount:2,weight:30}],x:53,y:38,description:'Банда контролирует крыши. Бойцы зовут соседей, обходят с двух сторон и прыгают за тобой.'},
    {faction:'Железный круг',difficulty:'Смертельная',threat:3,chance:[40,80],drops:[{amount:1,weight:40},{amount:2,weight:30},{amount:3,weight:20},{amount:4,weight:10}],x:79,y:62,description:'Двенадцать противников, пять громил. Один пропущенный удар может закончить этот день.'}
  ];
  const safeCount=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,1000000):0;
  class Campaign{
    constructor(storage=null,random=Math.random){
      this.storage=storage;this.random=random;this.claimed=new WeakSet();this.persisted=!!storage;
      let raw={};try{raw=JSON.parse(storage?.getItem(STORAGE_KEY)||'{}')||{};}catch{this.persisted=false;}
      this.dryStreak=safeCount(raw.dryStreak);
      this.balance=safeCount(raw.balance);this.clears=RAIDS.map((_,i)=>safeCount(raw.clears?.[i]));
      this.ownsAkatsuki=raw.ownsAkatsuki===true;this.equipped=this.ownsAkatsuki&&raw.equipped==='akatsuki'?'akatsuki':'katana';
      const saved=raw.work;
      if(saved&&JOBS[saved.job]&&safeCount(saved.day)>0&&Number.isInteger(saved.seed)&&['work','ready','raid'].includes(saved.phase)){
        const quality=Number.isFinite(saved.quality)?Math.max(0,Math.min(100,Math.floor(saved.quality))):null;
        this.work={day:saved.day,job:saved.job,seed:saved.seed>>>0,rare:!!saved.rare,phase:saved.phase,quality,buff:quality>=80&&BUFFS[saved.buff]?saved.buff:null,runId:typeof saved.runId==='string'?saved.runId:null,levelIndex:saved.levelIndex};
        this.work.raidChances=this.restoreChances(saved.raidChances);
        if(this.work.phase==='raid')this.newDay(); // Reloading an active raid spends that attempt.
      }else this.newDay();
      this.save();
    }
    createChances(){return RAIDS.map(raid=>raid.chance[0]+Math.floor(this.random()*(raid.chance[1]-raid.chance[0]+1)));}
    restoreChances(saved){
      return Array.isArray(saved)&&saved.length===RAIDS.length&&saved.every((chance,i)=>Number.isInteger(chance)&&chance>=RAIDS[i].chance[0]&&chance<=RAIDS[i].chance[1])?[...saved]:this.createChances();
    }
    get pityBonus(){return Math.min(100,this.dryStreak*PITY_STEP);}
    raidOffer(index){
      const raid=RAIDS[index];if(!raid)return null;
      const baseChance=this.work.raidChances[index],bonus=Math.min(100-baseChance,this.pityBonus),multiplier=this.work.buff==='bounty'?2:1;
      return{baseChance,bonus,chance:baseChance+bonus,multiplier,drops:raid.drops.map(drop=>({amount:drop.amount*multiplier,weight:drop.weight}))};
    }
    newDay(){
      const previous=this.work,choices=Object.keys(JOBS).filter(id=>id!==previous?.job);
      this.work={day:(previous?.day||0)+1,job:choices[Math.floor(this.random()*choices.length)%choices.length],seed:Math.floor(this.random()*4294967296)>>>0,rare:this.random()<.2,phase:'work',quality:null,buff:null,runId:null,levelIndex:null,raidChances:this.createChances()};
    }
    save(){
      try{if(!this.storage)throw Error('No storage');this.storage.setItem(STORAGE_KEY,JSON.stringify({version:3,dryStreak:this.dryStreak,balance:this.balance,clears:this.clears,ownsAkatsuki:this.ownsAkatsuki,equipped:this.equipped,work:this.work}));this.persisted=true;}catch{this.persisted=false;}return this.persisted;
    }
    completeWork(game){
      const w=this.work;
      if(w.phase!=='work'||!game||game.status!=='done'||game.progress!==1||game.day!==w.day||game.job!==w.job||game.seed!==w.seed||!Number.isFinite(game.quality))return false;
      w.quality=Math.max(0,Math.min(100,Math.floor(game.quality)));w.phase='ready';
      const ids=Object.keys(BUFFS),pick=((Math.imul(w.seed^0x45d9f3b,2654435761)>>>0)%ids.length);
      w.buff=w.quality>=80?ids[pick]:null;this.save();return true;
    }
    beginRaid(index){
      if(this.work.phase!=='ready'||!Number.isInteger(index)||!RAIDS[index])return null;
      const w=this.work;w.phase='raid';w.runId=w.day+':'+w.seed+':'+index;w.levelIndex=index;this.save();
      return{runId:w.runId,buff:w.buff,weapon:this.equipped};
    }
    claimRaid(world){
      const w=this.work;
      if(!world||world.status!=='cleared'||this.claimed.has(world)||w.phase!=='raid'||world.runId!==w.runId||world.levelIndex!==w.levelIndex)return 0;
      this.claimed.add(world);
      const offer=this.raidOffer(world.levelIndex);let reward=0;
      if(this.random()*100<offer.chance){
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
    buyAkatsuki(){
      if(this.ownsAkatsuki)return{ok:false,reason:'owned'};
      if(this.balance<WEAPON_PRICE)return{ok:false,reason:'funds'};
      this.balance-=WEAPON_PRICE;this.ownsAkatsuki=true;this.equipped='akatsuki';this.save();return{ok:true};
    }
    equip(id){if(id!=='katana'&&(id!=='akatsuki'||!this.ownsAkatsuki))return false;this.equipped=id;this.save();return true;}
  }
  const api={Campaign,RAIDS,JOBS,WEAPON_PRICE,PITY_STEP,STORAGE_KEY};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KageCampaign=api;
})(typeof window!=='undefined'?window:globalThis);
