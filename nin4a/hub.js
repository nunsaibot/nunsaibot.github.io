(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  class Hub{
    constructor({campaign,levels,weapons,onRaid,onMenu}){
      this.campaign=campaign;this.levels=levels;this.weapons=weapons;this.onRaid=onRaid;this.selected=0;this.tab='map';
      $('raid-nodes').innerHTML=root.KageCampaign.RAIDS.map((raid,index)=>'<button class="raid-node" data-raid="'+index+'" style="left:'+raid.x+'%;top:'+raid.y+'%" aria-label="'+levels[index].name+'"><span class="node-marker">'+String(index+1).padStart(2,'0')+'</span><span class="node-label">'+levels[index].name+'</span><span class="node-loot"></span></button>').join('');
      for(const button of document.querySelectorAll('[data-raid]'))button.onclick=()=>{this.selected=Number(button.dataset.raid);this.refresh();};
      $('map-tab').onclick=()=>this.show('map');$('shop-tab').onclick=()=>this.show('shop');
      $('shop-map-button').onclick=()=>this.show('map');$('hub-menu-button').onclick=onMenu;
      $('raid-start-button').onclick=()=>this.onRaid(this.selected);
      $('buy-weapon-button').onclick=()=>{
        if(campaign.ownsAkatsuki)campaign.equip('akatsuki');else campaign.buyAkatsuki();
        this.refresh();
      };
      $('equip-default-button').onclick=()=>{campaign.equip('katana');this.refresh();};
      this.refresh();
    }
    show(tab='map'){
      this.tab=tab;
      $('map-pane').classList.toggle('hidden',tab!=='map');$('shop-pane').classList.toggle('hidden',tab!=='shop');
      for(const name of ['map','shop']){
        $(name+'-tab').classList.toggle('active',name===tab);
        if(name===tab)$(name+'-tab').setAttribute('aria-current','page');else $(name+'-tab').removeAttribute('aria-current');
      }
      this.refresh();$('hub-screen').scrollTop=0;
    }
    refresh(){
      const c=this.campaign,raid=root.KageCampaign.RAIDS[this.selected],level=this.levels[this.selected];
      for(const el of document.querySelectorAll('[data-balance]'))el.textContent=String(c.balance);
      $('wallet').setAttribute('aria-label','Баланс: '+c.balance+' тяирэ');
      for(const button of document.querySelectorAll('[data-raid]')){
        const index=Number(button.dataset.raid);button.classList.toggle('selected',index===this.selected);button.classList.toggle('cleared',c.clears[index]>0);button.setAttribute('aria-pressed',String(index===this.selected));
        const chance=c.raidOffer(index).chance;button.querySelector('.node-loot').textContent='ДОБЫЧА · '+chance+'%';
        button.setAttribute('aria-label',this.levels[index].name+'. Шанс добычи: '+chance+'%.');
      }
      $('raid-code').textContent='ЦЕЛЬ '+String(this.selected+1).padStart(2,'0');
      $('raid-threat').innerHTML=[1,2,3].map(i=>'<i class="'+(i<=raid.threat?'lit':'')+'"></i>').join('');
      $('raid-faction').textContent=raid.faction;$('raid-name').textContent=level.name;$('raid-description').textContent=raid.description;
      $('raid-difficulty').textContent=raid.difficulty;$('raid-enemy-count').textContent=String(level.enemies.length);
      const guards=level.enemies.filter(e=>e[2]==='guard').length,brutes=level.enemies.filter(e=>e[2]==='brute').length;
      $('raid-enemy-types').innerHTML='<span><i class="guard-swatch"></i>Бойцы <b>'+guards+'</b></span><span><i class="brute-swatch"></i>Громилы <b>'+brutes+'</b></span>';
      $('raid-cleared').textContent=c.clears[this.selected]?'ЗАЧИЩЕНО: '+c.clears[this.selected]+' · МОЖНО ПОВТОРИТЬ':'РАЙОН ЕЩЁ НЕ ЗАЧИЩЕН';
      $('map-equipped').textContent=this.weapons[c.equipped].name;
      const w=c.work,buff=root.KageCore.BUFFS[w.buff];
      $('map-day').textContent='ДЕНЬ '+String(w.day).padStart(2,'0');
      $('map-shift-status').textContent=w.dayOff?'Сегодня выходной · Набег открыт без бафа':w.phase==='ready'?'Смена завершена · Качество '+w.quality+'%':'Сначала закончи смену: '+root.KageCampaign.JOBS[w.job].name;
      $('shop-day-status').textContent=w.dayOff?'Сегодня выходной. Можно сразу выбрать набег, без бафа.':w.phase==='ready'?'Смена завершена. Снарядись и выбери цель набега.':'Сегодня: '+root.KageCampaign.JOBS[w.job].name+'. После покупки можно вернуться к работе.';
      $('shop-continue-button').textContent=w.phase==='ready'?'ВЫБРАТЬ НАБЕГ →':'К РАБОТЕ →';
      $('map-buff').textContent=buff?buff.name+' · '+buff.description:'Без бафа';
      $('raid-start-button').innerHTML=(w.phase==='ready'?'НАЧАТЬ НАБЕГ':'СНАЧАЛА НА РАБОТУ')+' <span>↗</span>';
      const offer=c.raidOffer(this.selected),amounts=offer.drops.map(drop=>drop.amount);
      $('raid-reward-value').textContent=amounts.length===1?String(amounts[0]):amounts[0]+'–'+amounts[amounts.length-1];
      $('raid-loot-chance').textContent=offer.chance+'%';$('loot-chance-fill').style.width=offer.chance+'%';
      $('raid-loot-bonus').textContent=offer.bonus?offer.baseChance+'% база + '+offer.bonus+' п.п. за пустые зачистки':'После пустой зачистки: +'+root.KageCampaign.PITY_STEP+' п.п. к следующему шансу.';
      $('raid-loot-distribution').textContent='Если добыча найдена: '+offer.drops.map(drop=>drop.amount+' тяирэ — '+drop.weight+'%').join('; ')+'.';
      $('raid-loot-buff').classList.toggle('hidden',offer.multiplier===1);
      $('raid-loot-rules').textContent='После победы без добычи шанс всех баз увеличивается на '+root.KageCampaign.PITY_STEP+' процентных пунктов, до 100%. Выпадение сбрасывает прибавку. Поражение и выход её не меняют. Шансы обновляются в новый день.';
      const equipped=c.equipped==='akatsuki',owned=c.ownsAkatsuki,shortage=Math.max(0,4-c.balance),buy=$('buy-weapon-button');
      $('weapon-ownership').textContent=owned?'ТВОЙ КЛИНОК':'В ПРОДАЖЕ';
      buy.disabled=equipped||(!owned&&shortage>0);
      buy.innerHTML=equipped?'ЭКИПИРОВАНО <span>✓</span>':owned?'ЭКИПИРОВАТЬ <span>→</span>':shortage?'НУЖНО ЕЩЁ '+shortage+' ТЯИРЭ':'КУПИТЬ ЗА 4 ТЯИРЭ <span>→</span>';
      $('shop-feedback').textContent=equipped?'Акацуки готов к следующему набегу.':owned?'Клинок куплен. Можно экипировать в любой момент.':shortage?'Тяирэ могут выпасть за зачистку. Смотри шанс добычи на карте.':'После покупки клинок будет экипирован автоматически.';
      $('equip-default-button').classList.toggle('hidden',!equipped);
      $('save-note').textContent=c.persisted?'Баланс и оружие сохраняются в этом браузере.':'Сохранение недоступно: прогресс останется только до закрытия страницы.';
    }
  }
  root.KageHub=Hub;
})(window);
