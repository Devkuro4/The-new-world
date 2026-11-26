const {Economy}=require('./economy.cjs'),{WildEncounters,randomCharacterId}=require('./wild.cjs'),{PvP}=require('./pvp.cjs'),{CardTower}=require('./tower.cjs'),{Expeditions,DIFFICULTIES}=require('./expeditions.cjs'),B=require('./battle.cjs'),R=require('./registry.cjs'),M=require('./moves.cjs');
const {randomUUID}=require('node:crypto');
const meta=c=>c.id.startsWith('catalog:')?R.getCollectible(c.id):R.getCard(c.id);
const itemKeys=['healthPotion','purificationVial','xpBooster','energyElixir','antidote'];
const cardLine=(c,i)=>{const m=meta(c);return `${String(i+1).padStart(2,'0')}. ${m.name} · ${m.rarity} · Lv. ${c.level}`;};
function displayCard(text,id){
  return {text, artwork:R.cardArtwork(id)};
}
const num=s=>/^\d+$/.test(s||'')?Number(s):NaN;
const tierAliases={
  c:'C',common:'C',basic:'C',
  uc:'UC',uncommon:'UC',
  r:'R',rare:'R',
  sr:'SR','super rare':'SR',superrare:'SR',
  ssr:'SSR','ss rare':'SSR',ssrare:'SSR',
  ur:'UR','ultra rare':'UR',ultrarare:'UR',
};
const catalogRow=(c,index)=>`${String(index).padStart(3,'0')}. ${c.name} · ${c.series} · ${c.rarity}`;
const searchWords=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
const matchesWords=(value,query)=>{const haystack=searchWords(value);return searchWords(query).every(word=>haystack.some(token=>token===word||token.startsWith(word)));};
function services(s){for(const k of ['economy','wild','pvp','tower','exped','decks','shop','heals','nextSpawn','notices'])s[k]??={};s.settings??={};if(typeof s.settings.effectsEnabled!=='boolean')s.settings.effectsEnabled=false;if(!Number.isFinite(s.settings.spawnCooldownMs))s.settings.spawnCooldownMs=1800000;if(!Number.isFinite(s.settings.spawnChance))s.settings.spawnChance=.35;const economy=new Economy({state:s.economy});let wild,pvp,tower,exped;const busy=p=>!!(pvp.active(p)||tower.active(p)||Object.values(wild.state.groups).some(e=>e.battle?.sides[0].id===p));const selected=p=>{
  const all=economy.collection(p);
  const byId=new Map(all.map(card=>[card.uid,card]));
  const saved=[...new Set(s.decks[p]??[])].map(id=>byId.get(id)).filter(c=>c&&R.isBattleReady(c.id));
  return saved.length?saved.slice(0,6):all.filter(c=>R.isBattleReady(c.id)).slice(0,6);
};const deck=p=>selected(p).filter(c=>!exped.locked(p,c.uid));wild=new WildEncounters({state:s.wild,canBattle:p=>!busy(p)});pvp=new PvP({state:s.pvp,canBattle:p=>!busy(p),getDeck:deck});tower=new CardTower({state:s.tower,canBattle:p=>!busy(p),getDeck:deck});exped=new Expeditions({state:s.exped,getCollection:p=>economy.collection(p),canAssign:p=>!busy(p)});return {economy,wild,pvp,tower,exped,busy,deck,selected,state:s};}
const ownerCount=(economy,id)=>Object.values(economy.state.players).filter(player=>player.cards?.some(card=>card.id===id)).length;
const spawnable=(economy,wild)=>R.list().filter(card=>ownerCount(economy,card.id)+Object.values(wild.state.groups).filter(encounter=>encounter.card?.id===card.id).length<3);
const spawnAvailable=(economy,wild,group)=>{const roster=spawnable(economy,wild);if(!roster.length)throw Error('Every Card Battle variant already has three owners');return wild.spawn(group,{id:randomCharacterId(Math.random,roster,wild.state.previous[group])});};
function settle(v){
  const {economy:e,wild,pvp,tower,exped}=v;
  for(const service of [wild,pvp,tower,exped]){
    service.sweep();
    for(const r of service.pending()){
      const grant=(p,credits,items={},cards=[],xp=[],hp=[])=>{
        const result=e.grant(p,r.id,{credits,items,cards,xp:xp.map(x=>({...x,xp:x.xp*e.xpMultiplier(p)}))});
        if(!result.duplicate&&hp.length)e.transaction(p,pl=>{for(const x of hp){const c=pl.cards.find(c=>c.uid===x.uid);if(c)c.hp=Math.min(x.hp,R.statsAt(c.id,c.level).HP);}});
      };
      if(service===wild){
        const captured=r.captured&&!e.collection(r.player).some(card=>card.id===r.captured.id)&&ownerCount(e,r.captured.id)<3?[r.captured]:[];
        grant(r.player,r.credits,{},captured,r.xp,r.cards);
        if(r.replace&&!wild.get(r.group))v.state.nextSpawn[r.group]=0;
      }else if(service===pvp){for(const p of r.players)grant(p.player,p.credits,{},[],p.xp,[]);}
      else if(r.kind==='floorXP')grant(r.player,0,{},[],r.xp);
      else if(r.kind==='towerResult')grant(r.player,r.rewards.credits,{super:r.rewards.superPacks,ascensionCores:r.rewards.ascensionCores},[],[],r.cards);
      else if(r.kind==='expeditionCompleted')grant(r.player,r.rewards.credits,{trainingMaterials:r.rewards.trainingMaterials,ascensionCores:r.rewards.ascensionCores});
      service.acknowledge(r.id);
    }
  }
}
const UI=require('./presentation.cjs');
function battleReply(b,ctx,extra=''){return {text:UI.battleText(b,ctx,extra),battle:b};}
function outcomeText(outcome){
  if(!outcome)return '';
  const reward=outcome.rewards||outcome,lines=[];
  if(Number.isFinite(reward.credits)&&reward.credits>0)lines.push(`Credits earned: +${reward.credits}`);
  if(Number.isFinite(reward.superPacks)&&reward.superPacks>0)lines.push(`Super Packs: +${reward.superPacks}`);
  if(Number.isFinite(reward.ascensionCores)&&reward.ascensionCores>0)lines.push(`Ascension Cores: +${reward.ascensionCores}`);
  if(outcome.captured){const card=meta(outcome.captured);lines.push(`Card claimed: ${card.name} · ${card.rarity}`);}
  return lines.length?`*BATTLE REWARDS*\n${lines.join('\n')}`:'';
}
function run(state,ctx,command,args){
  const v=services(state),{economy:e,wild,pvp,tower,exped,busy,deck,selected}=v;
  settle(v);
  const p=ctx.player,g=ctx.group,pre=ctx.prefix+'cb ',a=args[0],n=num(a),info=()=>e.info(p),list=()=>e.collection(p),reply=text=>({text});
  const requireIdle=()=>{if(busy(p))throw Error('Finish your battle first');};
  const owned=i=>{const c=list()[i-1];if(!c)throw Error('Invalid collection index');return c;};
  const current=()=>{const m=pvp.active(p);if(m?.group===g)return {kind:'pvp',battle:m.battle};const w=wild.get(g);if(w?.battle?.sides[0].id===p)return {kind:'wild',battle:w.battle};const t=tower.active(p);if(t?.group===g)return {kind:'tower',battle:t.battle};throw Error('No active battle in this group');};
  let result;
  const requireDeck=(id)=>{
    if(!e.collection(id).length)throw Error(id===p?`Claim your starter cards first with ${ctx.prefix}starter.`:`${ctx.label(id)} needs to claim starter cards with ${ctx.prefix}starter.`);
    const available=deck(id);
    if(!available.some(c=>(c.hp??1)>0))throw Error(`${ctx.label(id)} needs an available card. Check ${ctx.prefix}deck, choose cards outside expeditions, or use ${ctx.prefix}heal.`);
    return available;
  };
  switch(command){
  case 'help':return reply([
    '*CARD BATTLE*',`${list().length} cards · ${info().credits} Credits`,'',
    '*Collection*',`${ctx.prefix}starter — Starter cards`,`${ctx.prefix}cards [page|search] · ${ctx.prefix}catalog [page|search]`,`${ctx.prefix}ss <series> · ${ctx.prefix}ci <name> [tier]`,`${ctx.prefix}deck [number] · ${ctx.prefix}card <number>`,`${ctx.prefix}swap <a> <b> · ${ctx.prefix}t2col <deck> <col>`,'',
    '*Battle*',`${ctx.prefix}wild — Spawn a Wild Card`,`${ctx.prefix}claim · ${ctx.prefix}pvp @user · ${ctx.prefix}tower start`,'',
    '*Resources*',`${ctx.prefix}cardshop · ${ctx.prefix}bag · ${ctx.prefix}exped`,`${pre}more — Controls and settings`
  ].join('\n'));
  case 'more':return reply([
    '*CARD BATTLE CONTROLS*',`${ctx.prefix}move <n> · ${ctx.prefix}switch · ${ctx.prefix}forfeit · ${ctx.prefix}heal`,
    `${pre}buy <n> · ${ctx.prefix}openpack · ${ctx.prefix}openspack · ${pre}use <item>`,
    `${ctx.prefix}learn · ${ctx.prefix}cmi · ${ctx.prefix}merge <a> <b> <c>`,`${ctx.prefix}effects on|off`
  ].join('\n'));
  case 'start':{
    const prior=info();
    if(prior.receipts['starter-v1']||prior.receipts['starter-v2'])return reply(`Your account is ready. Use ${ctx.prefix}cards`);
    const eligible=R.list().filter(c=>['Common','Uncommon'].includes(c.rarity)&&ownerCount(e,c.id)<3);
    const picks=[];
    while(picks.length<4&&eligible.length){
      picks.push(eligible.splice(e.roll(eligible.length),1)[0]);
    }
    if(picks.length!==4)throw Error('Starter roster is incomplete');
    const cards=picks.map(c=>({id:c.id,level:5}));
    e.grant(p,'starter-v2',{credits:250,cards});
    return reply('Starter cards · 250 Credits\n'+cards.map(cardLine).join('\n'));
  }
  case 'collection':{
    const pageToken=args.at(-1),page=/^\d+$/.test(pageToken||'')?Number(pageToken):1;
    const query=(/^\d+$/.test(pageToken||'')?args.slice(0,-1):args).join(' ').toLowerCase();
    const matches=list().map((card,index)=>({card,index})).filter(({card})=>{const m=meta(card);return !query||matchesWords(`${m.name} ${m.series} ${m.rarity}`,query);});
    const pages=Math.max(1,Math.ceil(matches.length/20));if(page<1||page>pages)throw Error(`Choose a page from 1 to ${pages}`);
    const rows=matches.slice((page-1)*20,page*20).map(({card,index})=>cardLine(card,index));
    const countLabel=`${matches.length} ${matches.length===1?'Card':'Cards'}`;
    return reply(UI.title('YOUR COLLECTION')+`\n${countLabel} · Page ${page}/${pages}\n\n`+(rows.join('\n')||'No matching cards.')+`\n\n${ctx.prefix}card <number> — View card\n${ctx.prefix}cards <search> [page] — Filter collection`);
  }
  case 'catalog':{
    const pageToken=args.at(-1),page=/^\d+$/.test(pageToken||'')?Number(pageToken):1;
    const query=(/^\d+$/.test(pageToken||'')?args.slice(0,-1):args).join(' ').toLowerCase();
    const all=R.collectibleList().filter(c=>!query||matchesWords(`${c.name} ${c.series} ${c.rarity} ${c.catalogRarity}`,query));
    const pages=Math.max(1,Math.ceil(all.length/20));if(page<1||page>pages)throw Error(`Choose a page from 1 to ${pages}`);
    const rows=all.slice((page-1)*20,page*20).map((c,i)=>catalogRow(c,(page-1)*20+i+1));
    return reply(UI.title('CARD CATALOG')+`\n${all.length}/491 cards · Page ${page}/${pages}\n\n${rows.join('\n')}\n\n${ctx.prefix}catalog <search> [page]`);
  }
  case 'ss':{
    const pageToken=args.at(-1),page=/^\d+$/.test(pageToken||'')?Number(pageToken):1;
    const query=(/^\d+$/.test(pageToken||'')?args.slice(0,-1):args).join(' ').trim().toLowerCase();
    const catalog=R.collectibleList();
    if(!query){
      const series=[...new Set(catalog.map(c=>c.series))].sort((a,b)=>a.localeCompare(b));
      return reply(UI.title('CARD SERIES')+'\n\n'+series.map(name=>`${name} · ${catalog.filter(c=>c.series===name).length} cards`).join('\n')+`\n\nUse ${ctx.prefix}ss <series>`);
    }
    const matches=catalog.filter(c=>matchesWords(c.series,query));
    const pages=Math.max(1,Math.ceil(matches.length/20));if(page<1||page>pages)throw Error(`Choose a page from 1 to ${pages}`);
    const rows=matches.slice((page-1)*20,page*20).map((c,i)=>catalogRow(c,(page-1)*20+i+1));
    return reply(UI.title('SERIES SEARCH')+`\n${matches.length} cards · Page ${page}/${pages}\n\n${rows.join('\n')||'No cards matched that series.'}\n\n${ctx.prefix}ss <series> [page]`);
  }
  case 'ci':{
    const tokens=[...args];
    const page=/^\d+$/.test(tokens.at(-1)||'')?Number(tokens.pop()):1;
    const tier=tierAliases[(tokens.at(-1)||'').toLowerCase()];if(tier)tokens.pop();
    const query=tokens.join(' ').trim().toLowerCase();
    if(!query&&!tier)throw Error(`Use ${ctx.prefix}ci <name> [C|UC|R|SR|SSR|UR]`);
    const matches=R.collectibleList().filter(c=>(!query||matchesWords(c.name,query))&&(!tier||c.catalogRarity===tier));
    const pages=Math.max(1,Math.ceil(matches.length/20));if(page<1||page>pages)throw Error(`Choose a page from 1 to ${pages}`);
    const mentionedOwners=new Set(),ownership=c=>{
      const variantIds=new Set([c.id,c.battleId].filter(Boolean));
      const ownerIds=Object.entries(e.state.players).filter(([,player])=>player.cards?.some(card=>variantIds.has(card.id))).map(([id])=>id);
      const ownerLines=ownerIds.map(id=>{const jid=ctx.mention?.(id);if(jid)mentionedOwners.add(jid);return `   ${jid?`@${jid.split('@')[0]}`:`@${ctx.label(id)}`}`;});
      return [`   Owners (${ownerIds.length}/3)`,...(ownerLines.length?ownerLines:['   None yet'])];
    };
    const rows=matches.slice((page-1)*20,page*20).flatMap((c,i)=>[catalogRow(c,(page-1)*20+i+1),...ownership(c)]);
    const text=UI.title('CARD NAME SEARCH')+`\n${matches.length} cards${tier?` · Tier ${tier}`:''} · Page ${page}/${pages}\n\n${rows.join('\n')||'No cards matched that name and tier.'}\n\n${ctx.prefix}ci <name> [tier] [page]`;
    return matches.length?{...displayCard(text,matches[(page-1)*20].id),mentions:[...mentionedOwners]}:reply(text);
  }
  case 'deck':{
    const currentDeck=selected(p);
    if(!args.length){
      return reply(UI.title('BATTLE DECK')+'\n\n'+(currentDeck.map((c,i)=>cardLine(c,i)+(exped.locked(p,c.uid)?' · On expedition':'')).join('\n')||`No battle-ready cards. Use ${ctx.prefix}starter`)+`\n\n${ctx.prefix}deck <number> — View deck card\n${ctx.prefix}swap <a> <b> — Swap deck slots\n${ctx.prefix}t2col <deck> <col> — Swap with collection`);
    }
    if(args.length===1||(args.length===2&&args[1]==='moves')){
      if(!Number.isInteger(n)||n<1||n>currentDeck.length)throw Error('Invalid deck index');
      const c=currentDeck[n-1];
      if(args[1]==='moves')return reply(UI.moveList(c,pre,n));
      return displayCard(UI.cardInfo(c,pre,n,'deck'),c.id);
    }
    requireIdle();
    if(args.length>6||new Set(args.map(num)).size!==args.length)throw Error('Select 1–6 distinct indices');
    const cards=args.map(x=>owned(num(x)));
    if(cards.some(c=>!R.isBattleReady(c.id)))throw Error('Decks can only use battle-ready cards');
    if(cards.some(c=>exped.locked(p,c.uid)))throw Error('Card is on expedition');
    state.decks[p]=cards.map(c=>c.uid);
    return reply('Deck updated.');
  }
  case 'swap':{
    requireIdle();
    const currentDeck=selected(p);
    if(!currentDeck.length)throw Error(`No battle-ready cards. Use ${ctx.prefix}starter`);
    const i=num(args[0]),j=num(args[1]);
    if(!Number.isInteger(i)||!Number.isInteger(j)||i<1||j<1||i>currentDeck.length||j>currentDeck.length||i===j){
      throw Error(`Use ${ctx.prefix}swap <deck slot 1> <deck slot 2> (1–${currentDeck.length})`);
    }
    const next=currentDeck.map(c=>c.uid);
    [next[i-1],next[j-1]]=[next[j-1],next[i-1]];
    state.decks[p]=next;
    return reply(`Swapped Deck slot ${i} (${meta(currentDeck[i-1]).name}) with Deck slot ${j} (${meta(currentDeck[j-1]).name}).`);
  }
  case 't2col':{
    requireIdle();
    const currentDeck=selected(p);
    if(!currentDeck.length)throw Error(`No battle-ready cards. Use ${ctx.prefix}starter`);
    const deckIdx=num(args[0]),colIdx=num(args[1]);
    if(!Number.isInteger(deckIdx)||deckIdx<1||deckIdx>currentDeck.length){
      throw Error(`Invalid deck index. Use ${ctx.prefix}t2col <deck slot> <collection index>`);
    }
    const deckCard=currentDeck[deckIdx-1];
    const colCard=owned(colIdx);
    if(!R.isBattleReady(colCard.id))throw Error('Decks can only use battle-ready cards');
    if(exped.locked(p,deckCard.uid)||exped.locked(p,colCard.uid))throw Error('Card is on expedition');
    if(deckCard.uid===colCard.uid)throw Error('That card is already in that Deck slot');
    const next=currentDeck.map(c=>c.uid);
    const existingSlot=next.indexOf(colCard.uid);
    if(existingSlot>=0){
      [next[deckIdx-1],next[existingSlot]]=[next[existingSlot],next[deckIdx-1]];
    }else{
      next[deckIdx-1]=colCard.uid;
    }
    state.decks[p]=next;
    return reply(`Swapped Deck slot ${deckIdx} (${meta(deckCard).name}) with Collection #${colIdx} (${meta(colCard).name}).`);
  }
  case 'card':{
    const c=owned(n);
    if(args[1]==='moves'){
      if(!R.isBattleReady(c.id))throw Error('Moves will be available after this card receives battle data and a sprite');
      return reply(UI.moveList(c,pre,n));
    }
    return displayCard(UI.cardInfo(c,pre,n,'card'),c.id);
  }
  case 'effects':{if(!a)return reply(`Battle effects are currently ${state.settings.effectsEnabled?'ON':'OFF'}. Use ${pre}effects on or ${pre}effects off.`);if(!['on','off'].includes(a))throw Error(`Use ${pre}effects on or ${pre}effects off.`);state.settings.effectsEnabled=a==='on';return reply(`Battle effects ${state.settings.effectsEnabled?'enabled':'disabled'}.`);}
  case 'cmi':{const c=owned(n),id=R.resolveBattleId(c.id),m=M.available(id,c.level)[num(args[1])-1];if(!m)throw Error('Use cmi <card index> <move index>');return reply(`${m.name} [${m.category}]\nUnlock Lv.${m.level} · Cooldown ${m.cooldown} turns\n${m.category==='healing'?`Healing: ${Math.round(m.heal*100)}% max HP`:`Power: ${m.power}× · ${m.kind}`}`);}
  case 'learn':{requireIdle();const c=owned(n),id=R.resolveBattleId(c.id);if(exped.locked(p,c.uid))throw Error('Card on expedition');const pool=M.available(id,c.level),learn=pool[num(args[1])-1],forget=num(args[2]);if(!learn||!Number.isInteger(forget)||forget<0||(forget>0&&!pool[forget-1]))throw Error('Invalid move indices');const loadout=M.equip(id,c.level,c.loadout||M.initial(id,c.level),learn.id,forget===0?null:pool[forget-1].id);e.transaction(p,pl=>{pl.cards.find(x=>x.uid===c.uid).loadout=loadout;});return reply('Move equipped.');}
  case 'wild':{
    const previous=wild.get(g);
    const active=Boolean(previous?.battle);
    if(!active){
      if(previous){wild.state.previous[g]=previous.card.id;delete wild.state.groups[g];}
      spawnAvailable(e,wild,g);state.nextSpawn[g]=Date.now()+state.settings.spawnCooldownMs;
    }
    const w=wild.get(g),c=R.getCard(w.card.id);
    const heading=active?'*WILD CARD BATTLE IN PROGRESS*':'*WILD CARD SPOTTED*';
    return displayCard(`${heading}\n\n${c.name}\nLv. ${w.card.level} · ${c.rarity} · ${c.type}\n\n${ctx.prefix}claim — Challenge`,c.id);
  }
  case 'claim':{
    result=wild.claim(g,p,requireDeck(p));
    settle(v);
    const intro=[
      '*CARD BATTLE*',
      '',
      `${ctx.label(p)} has challenged ${result.enemyName}!`,
      '',
      `${result.enemyName}:`,
      `"${result.dialogue}"`,
      '',
      '*BATTLE STARTING...*'
    ].join('\n');
    const outcomeLine=outcomeText(result.outcome);
    return {
      text: intro,
      followUp: battleReply(result.battle,ctx,outcomeLine),
    };
  }
  case 'pvp':
    if(a?.toLowerCase()==='accept'){result=pvp.accept(g,p);break;}
    if(a?.toLowerCase()==='decline'){pvp.decline(g,p);return reply('PvP challenge declined.');}
    if(!a&&!ctx.target)return reply(`${ctx.prefix}pvp @user · accept · decline`);
    if(!ctx.target)throw Error('Mention one player or reply to their message');
    if(ctx.target===p)throw Error('Cannot challenge yourself');
    requireDeck(p);
    requireDeck(ctx.target);
    pvp.challenge(g,p,ctx.target);
    return reply(`${ctx.label(p)} challenged ${ctx.label(ctx.target)}!\n${ctx.prefix}pvp accept / decline · expires in 60s`);
  case 'tower':if(a==='start'){requireDeck(p);result=tower.start(g,p);break;}return reply(UI.title('CARD TOWER')+'\n\n'+tower.info(p).floors.map(f=>`Floor ${f.floor}: ${f.count} enemies · ${f.difficulty}`).join('\n')+`\n${ctx.prefix}tower start`);
  case 'move':case 'switch':case 'desperate':case 'pass':{const cur=current();if(command==='switch'&&!a){if(cur.battle.sides[cur.battle.turn].id!==p)throw Error('Not your turn');return reply(B.options(cur.battle).switches.map(x=>`${x.index}. ${R.getCard(x.id).name} · HP ${x.hp}`).join('\n')||'No available switches');}const cmd={type:command,index:n};result=cur.kind==='pvp'?pvp.act(g,p,cmd):cur.kind==='wild'?wild.act(g,p,cmd):tower.act(g,p,cmd);break;}
  case 'forfeit':{const cur=current();const match=cur.kind==='pvp'?pvp.active(p):cur.kind==='wild'?wild.get(g):tower.active(p);const b=match.battle;b.phase='ended';b.winner=b.sides.find(side=>side.id!==p).id;b.lastActivity=Date.now();b.events=[{type:'forfeit',player:p}];if(cur.kind==='pvp')pvp.finish(match);else if(cur.kind==='wild')wild.finish(g,match);else tower.finish(match,false);settle(v);return battleReply(b,ctx,`${ctx.label(p)} forfeited the battle!`);}
  case 'heal':requireIdle();if(Date.now()<(state.heals[p]||0))throw Error('Healing is on cooldown');e.transaction(p,pl=>{for(const c of pl.cards)if(R.isBattleReady(c.id)&&!exped.locked(p,c.uid))c.hp=R.statsAt(c.id,c.level).HP;});state.heals[p]=Date.now()+1800000;return reply('Battle-ready cards healed.');
  case 'exped':if(!a){const i=exped.info(p);return reply(i.active?`${i.difficulty.name} Expedition · ${Math.ceil(i.remainingMs/60000)} minutes remaining`:DIFFICULTIES.map(x=>`${x.id}. ${x.name} · Lv.${x.minLevel}+ · ${x.hours}h`).join('\n')+`\n${ctx.prefix}exped <number>`);}if(a==='select'){const r=exped.select(p,args.slice(1).map(num));return reply(r.cards.map(cardLine).join('\n')+`\n${ctx.prefix}exped confirm`);}if(a==='confirm'){const r=exped.confirm(g,p);return reply(`Expedition started: ${r.difficulty.name}.`);}return reply(`Selected ${exped.choose(p,n).name}. ${ctx.prefix}exped select <a> <b> <c>`);
  case 'shop':{
    const header=`*CARD SHOP*\nCredits: ${info().credits}`;
    if(!a)return reply(`${header}\n\n${ctx.prefix}cardshop 1 — Packs\n${ctx.prefix}cardshop 2 — Consumables`);
    const items=e.shop(n);
    state.shop[p]=n;
    const rates=n===1?'\n\n*Universal Pack*\n3 cards · 5% chance of a fourth\nC 65% · UC 25% · R 8%\nSR 1.7% · SSR 0.25% · UR 0.05%':'';
    return reply(`${header}\n\n`+items.map(x=>`${x.index}. ${x.name} — ${x.price} Credits`).join('\n')+rates+`\n\n${pre}buy <number>`);
  }
  case 'buy':{const r=e.buy(p,state.shop[p]||1,n);return reply(`Purchased ${r.name}. Balance: ${r.balance} Credits.`);}
  case 'openpack':case 'openspack':{const r=e.open(p,command==='openpack'?'universal':'super');return displayCard(UI.title('PACK OPENED')+'\n\n'+r.cards.map(cardLine).join('\n')+`\n\nUse ${ctx.prefix}cards to view your collection.`,r.cards[0].id);}
  case 'bag':return reply(`Credits: ${info().credits}\n`+itemKeys.map((k,i)=>`${i+1}. ${k}: ${info().items[k]||0}`).join('\n')+`\n${pre}use <number> [move index]`);
  case 'use':{const key=itemKeys[n-1]||a;if(key==='xpBooster'){requireIdle();e.activateBooster(p);return reply('XP Booster active for 10 minutes.');}if(!itemKeys.includes(key))throw Error('Unknown item');const cur=current();if(cur.kind==='pvp')throw Error('Consumables disabled in PvP');if(!(info().items[key]>0))throw Error('Insufficient inventory');const cmd={type:'item',key,index:num(args[1])};result=cur.kind==='wild'?wild.act(g,p,cmd):tower.act(g,p,cmd);if(result.battle.phase!=='cancelled')e.transaction(p,pl=>e.spend(pl,key));break;}
  case 'merge':{requireIdle();if(args.length!==3||new Set(args.map(num)).size!==3)throw Error('Select three distinct card indices');const cards=args.map(x=>owned(num(x)));if(cards.some(c=>!R.isBattleReady(c.id)))throw Error('Merging requires battle-ready cards');if(cards.some(c=>c.id!==cards[0].id||exped.locked(p,c.uid)))throw Error('Cards must be identical and available');const target=R.getCard(R.resolveBattleId(cards[0].id)).mergeTarget;if(!target)throw Error('No higher-rarity version available');const selectedIds=new Set(cards.map(c=>c.uid));const uid=randomUUID();const best=cards.sort((a,b)=>b.level-a.level||b.xp-a.xp)[0];e.transaction(p,pl=>{pl.cards=pl.cards.filter(c=>!cards.some(x=>x.uid===c.uid));pl.cards.push({id:target,uid,level:best.level,xp:best.xp});});if(state.decks[p]?.some(id=>selectedIds.has(id))){
    state.decks[p]=[...new Set(state.decks[p].map(id=>selectedIds.has(id)?uid:id))];
  }return reply('Merged into '+R.getCard(target).name);}
  default:throw Error('Unknown Card Battle command. '+pre+'help');}
  settle(v);
  if(result.playerEvents)result.battle.events=[...result.playerEvents,...result.battle.events.filter(x=>!result.playerEvents.some(y=>JSON.stringify(x)===JSON.stringify(y)))];
  if(result.events)result.battle.events=result.events;
  const outcome=result.outcome;
  return battleReply(result.battle,ctx,[result.dialogue,result.floor?`Floor ${result.floor}`:'',outcomeText(outcome)].filter(Boolean).join('\n'));
}
function tick(state){const v=services(state),notices=[];for(const r of v.exped.sweep())notices.push({group:r.group,text:`🏕️ Expedition completed for ${r.player}. Rewards: ${r.rewards.credits} Credits, ${r.rewards.trainingMaterials} training materials.`});settle(v);for(const [group,due] of Object.entries(state.nextSpawn)){if(!group.endsWith('@g.us')||Date.now()<due||v.wild.get(group))continue;if(due===0){state.nextSpawn[group]=Date.now()+state.settings.spawnCooldownMs;continue;}state.nextSpawn[group]=Date.now()+state.settings.spawnCooldownMs;if(Math.random()>state.settings.spawnChance)continue;const r=spawnAvailable(v.economy,v.wild,group);const c=v.wild.get(group).card;notices.push({group,...displayCard(`*WILD CARD SPOTTED*\n\n${r.name}\nLv. ${r.level} · ${r.rarity} · ${r.type}\n\n.claim — Challenge`,c.id)});}return notices;}
module.exports={run,services,settle,tick};
