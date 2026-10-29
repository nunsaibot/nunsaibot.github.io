(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  class Hub{
    constructor({campaign,levels,weapons,onRaid,onMenu,onChange=()=>{}}){
      this.campaign=campaign;this.levels=levels;this.weapons=weapons;this.onRaid=onRaid;this.selected=0;this.tab='map';this.region=0;
      $('region-select').innerHTML=root.KageCore.REGIONS.map((r,i)=>'<option value="'+i+'">'+r.name+'</option>').join('');
      $('region-select').onchange=()=>{this.region=Number($('region-select').value);this.selected=this.region*3;this.refresh();};
      $('raid-nodes').innerHTML=root.KageCampaign.RAIDS.map((raid,index)=>'<button class="raid-node'+(raid.boss?' boss-node':'')+'" data-raid="'+index+'" style="left:'+raid.x+'%;top:'+raid.y+'%" aria-label="'+levels[index].name+'"><span class="node-marker">'+(raid.boss?'鬼':String(levels[index].tier+1).padStart(2,'0'))+'</span><span class="node-label">'+levels[index].name+'</span><span class="node-loot"></span></button>').join('');
      for(const button of document.querySelectorAll('[data-raid]'))button.onclick=()=>{this.selected=Number(button.dataset.raid);this.refresh();};
      $('map-tab').onclick=()=>this.show('map');$('shop-tab').onclick=()=>this.show('shop');
      $('shop-map-button').onclick=()=>this.show('map');$('hub-menu-button').onclick=onMenu;
      $('raid-start-button').onclick=()=>this.onRaid(this.selected);
      const items=root.KageCampaign.SHOP_ITEMS;
      $('shop-catalog').innerHTML=[['weapon','Клинки','Оба меча остаются навсегда.'],['amulet','Амулеты','Одна покупка навсегда. Все купленные амулеты действуют одновременно.'],['supply','Припасы','Неиспользованные предметы сохраняются после набега.']].map(([kind,title,note])=>'<section class="shop-group"><div class="shop-group-heading"><h3>'+title+'</h3><p>'+note+'</p></div><div class="shop-grid">'+Object.entries(items).filter(([,item])=>item.kind===kind).map(([id,item])=>'<article class="shop-card '+kind+'" data-item-card="'+id+'"><div class="item-heading"><span class="item-seal" aria-hidden="true">'+item.icon+'</span><div><span class="item-kind">'+(kind==='supply'?'РАСХОДНИК':'НАВСЕГДА')+'</span><h4>'+item.name+'</h4></div><strong class="item-price">'+item.price+'<small>тяирэ</small></strong></div><p>'+item.description+'</p><span class="item-stock"></span><button class="primary-button" '+(id==='akatsuki'?'id="buy-weapon-button" ':id==='katana'?'id="buy-katana-button" ':'')+'data-shop-item="'+id+'"></button></article>').join('')+'</div></section>').join('');
      for(const button of document.querySelectorAll('[data-shop-item]'))button.onclick=()=>{
        const id=button.dataset.shopItem,item=items[id],equipping=item.kind==='weapon'&&campaign.owns(id);
        const success=equipping?campaign.equip(id):campaign.buy(id).ok;
        if(success)$('shop-feedback').textContent=item.name+(equipping?' экипирована.':item.kind==='amulet'?' куплен и действует постоянно.':item.kind==='weapon'?' куплена и экипирована.':' добавлен в запас.');
        this.refresh();onChange();
      };
      $('equip-default-button').onclick=()=>{campaign.equip('fists');$('shop-feedback').textContent='Кулаки готовы. Купленные мечи остаются в снаряжении.';this.refresh();onChange();};
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
        const index=Number(button.dataset.raid),nodeLevel=this.levels[index],locked=!c.canEnter(index);button.classList.toggle('hidden',nodeLevel.region!==this.region);button.classList.toggle('selected',index===this.selected);button.classList.toggle('cleared',c.clears[index]>0);button.classList.toggle('locked',locked);button.setAttribute('aria-pressed',String(index===this.selected));
        const offer=c.raidOffer(index);button.querySelector('.node-loot').textContent=nodeLevel.boss?(locked?'ЗАКРЫТО · '+c.regionProgress(nodeLevel.region)+'/3':'НАГРАДА · '+offer.drops[0].amount+' ТЯИРЭ'):'ДОБЫЧА · '+offer.chance+'%';
        button.setAttribute('aria-label',nodeLevel.name+'. '+(locked?'Откроется после трёх разных миссий района.':nodeLevel.boss?'Гарантировано '+offer.drops[0].amount+' тяирэ.':'Шанс добычи: '+offer.chance+'%.'));
      }
      const region=root.KageCore.REGIONS[this.region],bossIndex=this.levels.findIndex(l=>l.region===this.region&&l.boss);$('region-progress').textContent=c.regionProgress(this.region)+' / 3 · '+(c.clears[bossIndex]?'БОСС ПОБЕЖДЁН':c.bossUnlocked(this.region)?'БОСС ДОСТУПЕН':'БОСС ЗАКРЫТ');document.querySelector('.city-map').style.background=region.sky[1];document.querySelector('.city-drawing').style.filter='hue-rotate('+(this.region*29)+'deg)';
      $('raid-code').textContent=level.boss?'ЧЕТВЁРТАЯ ЦЕЛЬ · БОСС':'ЦЕЛЬ '+String(level.tier+1).padStart(2,'0');
      $('raid-threat').innerHTML=[1,2,3,4].map(i=>'<i class="'+(i<=raid.threat?'lit':'')+'"></i>').join('');
      $('raid-faction').textContent=raid.faction;$('raid-name').textContent=level.name;$('raid-description').textContent=raid.description;
      $('raid-difficulty').textContent=raid.difficulty;$('raid-enemy-count').textContent=String(level.boss?1:level.enemies.length);
      $('raid-traps').closest('details').classList.toggle('hidden',!!level.boss);
      $('raid-traps').textContent='ЛОВУШКИ · '+level.traps.length+' — балки, шипы, мины';
      $('raid-enemy-types').innerHTML=Object.entries(root.KageCore.ENEMY_TYPES).map(([id,type])=>{const count=level.enemies.filter(e=>e[2]===id).length;return count?'<span><i class="guard-swatch" style="background:'+type.color+'"></i>'+type.name+' <b>'+count+'</b></span>':'';}).join('');
      if(level.boss)$('raid-enemy-types').textContent='При 50% здоровья босс усиливает свои атаки.';
      $('raid-cleared').textContent=c.clears[this.selected]?'ЗАЧИЩЕНО: '+c.clears[this.selected]+' · МОЖНО ПОВТОРИТЬ':'РАЙОН ЕЩЁ НЕ ЗАЧИЩЕН';
      $('map-equipped').textContent=this.weapons[c.equipped].name;
      const w=c.work,buff=root.KageCore.BUFFS[w.buff];
      $('map-day').textContent='ДЕНЬ '+String(w.day).padStart(2,'0');
      $('map-shift-status').textContent=w.skipped?'Смена пропущена по грамоте · Без бафа':w.dayOff?'Сегодня выходной · Набег открыт без бафа':w.phase==='ready'?'Смена завершена · Качество '+w.quality+'%':'Сначала закончи смену: '+root.KageCampaign.JOBS[w.job].name;
      $('shop-day-status').textContent=w.skipped?'Грамота использована. Можно выбрать набег, без бафа.':w.dayOff?'Сегодня выходной. Можно сразу выбрать набег, без бафа.':w.phase==='ready'?'Смена завершена. Снарядись и выбери цель набега.':'Сегодня: '+root.KageCampaign.JOBS[w.job].name+'. После покупки можно вернуться к работе.';
      $('shop-continue-button').textContent=w.phase==='ready'?'ВЫБРАТЬ НАБЕГ →':'К РАБОТЕ →';
      $('map-buff').textContent=buff?buff.name+' · '+buff.description:'Без бафа';
      $('raid-start-button').innerHTML=(w.phase==='ready'?'НАЧАТЬ НАБЕГ':'СНАЧАЛА НА РАБОТУ')+' <span>↗</span>';
      $('raid-start-button').disabled=!c.canEnter(this.selected);
      if(!c.canEnter(this.selected)){$('raid-start-button').textContent='ЗАЧИСТИ 3 МИССИИ РАЙОНА · '+c.regionProgress(level.region)+'/3';$('raid-cleared').textContent='Нужны победы в каждой из трёх локаций этого района.';}
      const offer=c.raidOffer(this.selected),amounts=offer.drops.map(drop=>drop.amount);
      $('raid-reward-value').textContent=amounts.length===1?String(amounts[0]):amounts[0]+'–'+amounts[amounts.length-1];
      $('raid-loot-chance').textContent=offer.chance+'%';$('loot-chance-fill').style.width=offer.chance+'%';
      $('raid-loot-bonus').textContent=offer.bonus?offer.baseChance+'% база + '+offer.bonus+' п.п. за пустые зачистки':'После пустой зачистки: +'+root.KageCampaign.PITY_STEP+' п.п. к следующему шансу.';
      $('raid-loot-distribution').textContent='Если добыча найдена: '+offer.drops.map(drop=>drop.amount+' тяирэ — '+drop.weight+'%').join('; ')+'.';
      $('raid-loot-buff').classList.toggle('hidden',offer.multiplier===1);
      $('raid-loot-rules').textContent='После победы без добычи шанс всех баз увеличивается на '+root.KageCampaign.PITY_STEP+' процентных пунктов, до 100%. Выпадение сбрасывает прибавку. Поражение и выход её не меняют. Шансы обновляются в новый день.';
      $('raid-reward-label').textContent=level.boss?'НАГРАДА ЗА ПОБЕДУ':'ДОБЫЧА ПРИ УДАЧЕ';
      if(level.boss){$('raid-loot-bonus').textContent='Гарантированная награда за каждую победу.';$('raid-loot-distribution').textContent=offer.multiplier===2?'3 тяирэ ×2 = 6 тяирэ с «Двойным трофеем».':'Всегда 3 тяирэ. С бафом «Двойной трофей» — 6.';$('raid-loot-rules').textContent='Победа над боссом сбрасывает прибавку за пустые зачистки. Повторный бой доступен в следующий день после работы или в выходной.';}
      $('shop-equipped').textContent=this.weapons[c.equipped].name;$('equip-default-button').disabled=c.equipped==='fists';
      for(const [id,item]of Object.entries(root.KageCampaign.SHOP_ITEMS)){
        const card=document.querySelector('[data-item-card="'+id+'"]'),button=card.querySelector('button'),owned=c.owns(id),equipped=c.equipped===id,reason=c.purchaseReason(id);
        card.classList.toggle('owned',owned);card.querySelector('.item-stock').textContent=item.kind==='supply'?'В ЗАПАСЕ: '+c.inventory[id]+' / '+item.limit:equipped?'В РУКАХ':owned?'КУПЛЕНО НАВСЕГДА':'ЕЩЁ НЕ КУПЛЕНО';
        button.disabled=equipped||!!reason&&!(reason==='owned'&&item.kind==='weapon');
        button.textContent=equipped?'ЭКИПИРОВАНО ✓':owned?item.kind==='weapon'?'ЭКИПИРОВАТЬ →':'ДЕЙСТВУЕТ ✓':reason==='full'?id==='workPass'?'ЕСТЬ НЕИСПОЛЬЗОВАННЫЕ ПРОПУСКИ':'ЗАПАС ПОЛОН':reason==='funds'?'НЕ ХВАТАЕТ '+(item.price-c.balance)+' ТЯИРЭ':'КУПИТЬ ЗА '+item.price+' ТЯИРЭ →';
      }
      $('save-note').textContent=c.persisted?'Покупки, амулеты и остатки припасов сохраняются в этом браузере.':'Сохранение недоступно: прогресс останется только до закрытия страницы.';
    }
  }
  root.KageHub=Hub;
})(window);
