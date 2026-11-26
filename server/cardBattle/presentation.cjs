const R=require('./registry.cjs'),M=require('./moves.cjs'),B=require('./battle.cjs');
const title=s=>`*${s}*`;
const bar=(hp,max)=>{const n=Math.max(0,Math.min(10,Math.ceil(10*hp/max)));return '█'.repeat(n)+'░'.repeat(10-n)};
const category=m=>({attack:'',healing:' [Heal]',ultimate:' [Ultimate]'}[m.category]||'');
const collectible=c=>c.id.startsWith('catalog:')?R.getCollectible(c.id):null;
const name=c=>collectible(c)?.name||R.getCard(c.id).name;

function cardInfo(c,pre,index,sourceCmd='card'){
  const cmdPrefix=pre.replace(/cb\s*$/,'');
  const collectibleCard=collectible(c);
  if(!R.isBattleReady(c.id)){
    const m=collectibleCard;
    return [
      title(m.name.toUpperCase()),
      m.series,
      `${m.rarity} · Lv. ${c.level}`,
      '',
      '*Collectible card*',
      'Battle support is coming later. Add battle data and a sprite to make this card battle-ready.',
      '',
      `Catalog ID: ${m.catalogId}`
    ].join('\n');
  }
  const id=R.resolveBattleId(c.id),m=R.getCard(id),s=R.statsAt(id,c.level),hp=c.hp??s.HP;
  const equipped=M.validateLoadout(id,c.level,c.loadout||M.initial(id,c.level));
  const lockedUlt=c.level<20?M.all(id).find(x=>x.category==='ultimate'&&x.level>c.level):null;
  const displayRarity=collectibleCard?.rarity||m.rarity;
  return [
    title((collectibleCard?.name||m.name).toUpperCase()),
    collectibleCard?.series||m.series,
    `${displayRarity} · ${m.type} · Lv. ${c.level}`,
    '',
    `${bar(hp,s.HP)} ${hp}/${s.HP} HP`,
    '',
    '*Stats*',
    `ATK: ${s.ATK} | DEF: ${s.DEF}`,
    `SPD: ${s.SPD} | ARC: ${s.ARC}`,
    `CRT: ${s.CRT}%`,
    '',
    '*Equipped moves*',
    ...equipped.map((x,i)=>`${i+1}. ${x.name}${category(x)}`),
    ...(lockedUlt?[`🔒 ${lockedUlt.name}${category(lockedUlt)} · Locked (Unlocks at Lv. 20)`]:[]),
    '',
    `${cmdPrefix}${sourceCmd} ${index} moves — All moves`
  ].join('\n');
}

function battleText(b,ctx,extra=''){
  const closed=['ended','cancelled'].includes(b.phase);
  const s=b.sides[b.turn];
  const cardByUid=new Map(b.sides.flatMap(side=>side.cards.map(c=>[c.uid,c])));
  const names=new Map(b.sides.flatMap(side=>side.cards.map(c=>[c.uid,name(c)])));
  const label=id=>ctx.label(id);
  const who=id=>names.get(id)||'Card';
  const pre=ctx.prefix+'cb ';
  const out=[title(b.mode==='pvp'?'PVP BATTLE':b.mode==='tower'?'CARD TOWER':'CARD BATTLE')];
  if(extra)out.push(extra);

  const hpShownUids=new Set();
  const formatHpBlock=(uid,hpVal,maxHpVal)=>{
    const card=cardByUid.get(uid);
    const hp=hpVal??card?.hp??0;
    const max=maxHpVal??card?.stats?.HP??1;
    hpShownUids.add(uid);
    const lines=[who(uid),`${bar(hp,max)} ${hp}/${max} HP`];
    if(card&&Object.keys(card.status||{}).length){
      lines.push(Object.entries(card.status).map(([k,v])=>`${k} (${v}t)`).join(' · '));
    }
    return lines;
  };

  const events=[];
  for(const e of b.events||[]){
    const n=who(e.card);
    switch(e.type){
      case 'attack':{
        const t=who(e.target);
        events.push(
          `${n} used ${e.move}!${e.critical?' (Critical!)':''}`,
          `${t} took ${e.amount} damage!`,
          '',
          ...formatHpBlock(e.target,e.hp,e.maxHp),
          ''
        );
        break;
      }
      case 'heal':
        events.push(
          `${n} used ${e.move}!`,
          `${n} recovered ${e.amount} HP!`,
          '',
          ...formatHpBlock(e.card,e.hp,e.maxHp),
          ''
        );
        break;
      case 'status':
        events.push(`${n} was afflicted with ${e.status}!`);
        break;
      case 'statusDamage':
        events.push(
          `${n} took ${e.amount} ${e.status} damage!`,
          '',
          ...formatHpBlock(e.card,e.hp,e.maxHp),
          ''
        );
        break;
      case 'switch':
        events.push(
          `${n} entered the battle!`,
          '',
          ...formatHpBlock(e.card,e.hp,e.maxHp),
          ''
        );
        break;
      case 'stun':
        events.push(`${n} is stunned and cannot act!`);
        break;
      case 'silence':
        events.push(`${n} is silenced and cannot attack!`);
        break;
      case 'desperate':{
        const t=who(e.target);
        events.push(
          `${n} used Desperate Strike!`,
          `${t?`${t} took ${e.damage} damage!`:`Dealt ${e.damage} damage!`} (${n} took ${e.recoil} recoil)`,
          ...(e.target?['',...formatHpBlock(e.target,e.targetHp,e.targetMaxHp),'']:[''])
        );
        break;
      }
      case 'item':
        events.push(`${n} used ${e.key}!`);
        break;
    }
  }
  while(events.length&&events.at(-1)==='')events.pop();

  if(events.length){
    out.push('',...events);
    for(const side of b.sides){
      const c=side.cards[side.active];
      if(!hpShownUids.has(c.uid)){
        out.push('',`${name(c)} · Lv. ${c.level} (${label(side.id)})`,`${bar(c.hp,c.stats.HP)} ${c.hp}/${c.stats.HP} HP`);
        if(Object.keys(c.status||{}).length)out.push(Object.entries(c.status).map(([k,v])=>`${k} (${v}t)`).join(' · '));
      }
    }
  }else{
    for(const side of b.sides){
      const c=side.cards[side.active];
      out.push('',`${name(c)} · Lv. ${c.level} (${label(side.id)})`,`${bar(c.hp,c.stats.HP)} ${c.hp}/${c.stats.HP} HP`);
      if(Object.keys(c.status||{}).length)out.push(Object.entries(c.status).map(([k,v])=>`${k} (${v}t)`).join(' · '));
    }
  }

  out.push('');
  if(closed){
    out.push(title(b.phase==='cancelled'?'BATTLE CANCELLED':b.winner?`${label(b.winner)} WINS`:'DRAW'));
    return out.join('\n');
  }
  out.push(title(`${label(s.id)}’S TURN`));
  const o=B.options(b),c=s.cards[s.active];
  if(b.phase==='replacement'){
    out.push('Choose your next card.',...o.switches.map(x=>`${x.index}. ${R.getCard(x.id).name} · HP ${x.hp}`),`${ctx.prefix}switch <number>`);
  }else{
    const lockedUlt=c.level<20?M.all(c.id).find(x=>x.category==='ultimate'&&x.level>c.level):null;
    out.push(...o.moves.map(m=>`${m.index}. ${m.name}${category(m)}${m.remaining?` · ⏳ ${m.remaining}t`:c.status.silence&&m.category!=='healing'?' · Silenced':''}`));
    if(lockedUlt)out.push(`🔒 ${lockedUlt.name}${category(lockedUlt)} · Locked (Unlocks at Lv. 20)`);
    out.push('',`${ctx.prefix}move <number>`);
    if(o.moves.every(m=>m.remaining))out.push(`${pre}desperate — Desperate Strike`);
    if(c.status.silence)out.push(`${pre}pass — if no usable action`);
  }
  out.push(`${ctx.prefix}switch · ${ctx.prefix}forfeit`);
  return out.join('\n');
}

function moveList(c,pre,index){
  const id=R.resolveBattleId(c.id),pool=M.available(id,c.level),all=M.all(id),equipped=c.loadout||M.initial(id,c.level);
  return [
    title('MOVE LIBRARY'),
    `*${name(c)}* · Lv.${c.level}`,
    '',
    '*AVAILABLE MOVES*',
    ...pool.map((m,i)=>`${i+1}. ${m.name}${category(m)} · ${m.cooldown}t cooldown${equipped.includes(m.id)?' · Equipped':''}`),
    '',
    '*LOCKED MOVES*',
    ...(all.filter(m=>m.level>c.level).map(m=>`🔒 Lv. ${m.level} · ${m.name}${category(m)} (Locked)`)||['None']),
    '',
    `${pre}learn ${index} <move index> <equipped available index or 0>`
  ].join('\n');
}

module.exports={title,cardInfo,battleText,moveList,bar};
