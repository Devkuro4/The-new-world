const R=require('./registry.cjs'),path=require('node:path'),fs=require('node:fs');
const W=1080,H=607;
const rarity={Common:'#e1e5ed',Uncommon:'#71dc8a',Rare:'#56a8ff','Super Rare':'#b28aff','SS Rare':'#ffd35b','Ultra Rare':'#ff6b6b'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const img=p=>`data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
function towerArena(floor){const n=Math.max(1,Math.min(10,Number(floor)||1));return path.join(__dirname,'arenas','tower',`floor-${n}.jpg`);}
function scene(b,{dialogue,arena=b?.mode==='tower'?towerArena(b.towerFloor):path.join(__dirname,'arenas/ruins.png'),effectsEnabled=false}={}){
  if(!b||b.sides?.length!==2)throw Error('Invalid battle state');
  const cards=b.sides.map(s=>s.cards[s.active]);
  const meta=cards.map(c=>R.getCard(R.resolveBattleId(c.id)));
  const text=(x,y,s,size=24,anchor='start',fill='#fff')=>`<text x="${x}" y="${y}" font-family="sans-serif" font-weight="600" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
  let out=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><image width="1080" height="607" preserveAspectRatio="none" xlink:href="${img(arena)}"/>`;
  for(let i=0;i<2;i++){
    const c=cards[i],m=meta[i],x=i?730:18,col=rarity[m.rarity]||'#e1e5ed',ratio=Math.max(0,Math.min(1,c.hp/c.stats.HP));
    out+=`<path d="M${x+12} 18 H${x+308} L${x+330} 46 L${x+308} 99 H${x+12} L${x} 81 V35Z" fill="#121a2b" stroke="#bcc9dc" stroke-width="3"/><rect x="${x+17}" y="78" width="296" height="12" rx="5" fill="#303746"/><rect x="${x+17}" y="78" width="${296*ratio}" height="12" rx="5" fill="${ratio>.5?'#9cfb4d':ratio>.2?'#ffc24d':'#f65c63'}"/>`+text(x+22,43,m.name,22)+text(x+22,66,`Lv. ${c.level} · ${m.type}`,17)+text(x+310,66,m.rarity,15,'end',col)+text(x+165,118,`${c.hp} / ${c.stats.HP} HP`,19,'middle');
    const sx=i?640:85;
    out+=`<ellipse cx="${sx+175}" cy="424" rx="112" ry="13" fill="#10151e" opacity=".35"/><g ${i?'transform="translate(1630 0) scale(-1 1)"':''} opacity="${c.hp===0?.45:1}"><image x="${sx}" y="132" width="350" height="300" xlink:href="${img(R.spritePath(c.id))}"/></g>`;
    out+=text(x+18,144,Object.keys(c.status||{}).join(' · '),15,'start','#fff0b0');
    for(let j=0;j<b.sides[i].cards.length;j++)out+=`<circle cx="${x+24+j*23}" cy="160" r="7" fill="${b.sides[i].cards[j].hp>0?col:'#343844'}" stroke="#152030"/>`;
  }
  if(effectsEnabled) out+=require('./effects.cjs').effect(b);
  const names=new Map(b.sides.flatMap(s=>s.cards.map(c=>[c.uid,R.getCard(R.resolveBattleId(c.id)).name])));
  const lines=(b.events||[]).map(e=>{
    switch(e.type){
      case'attack':return `${names.get(e.card)} used ${e.move}! ${e.amount} damage${e.critical?' — critical!':''}.`;
      case'heal':return `${names.get(e.card)} recovered ${e.amount} HP!`;
      case'switch':return `${names.get(e.card)} entered the battle!`;
      case'status':return `${names.get(e.card)} is affected by ${e.status}!`;
      case'statusDamage':return `${names.get(e.card)} took ${e.amount} ${e.status} damage.`;
      case'desperate':return `Desperate Strike! ${e.damage} damage, ${e.recoil} recoil.`;
      case'result':return e.winner?`${e.winner} wins!`:'Draw!';
      case'timeout':return 'Battle cancelled due to inactivity.';
      case'stun':case'silence':return `${names.get(e.card)} cannot act!`;
      default:return '';
    }
  }).filter(Boolean);
  const heading=b.phase==='ended'?'BATTLE COMPLETE':b.phase==='cancelled'?'BATTLE CANCELLED':b.phase==='replacement'?`${b.sides[b.turn].id} — CHOOSE A CARD`:`${b.sides[b.turn].id} — YOUR TURN`;
  let message=dialogue??(lines.join(' ')||`${meta[0].name} faced ${meta[1].name}!`);
  const words=String(message).split(/\s+/),wrapped=[''];
  for(const word of words){if((wrapped.at(-1)+' '+word).length>76&&wrapped.at(-1))wrapped.push(word);else wrapped[wrapped.length-1]+=(wrapped.at(-1)?' ':'')+word;}
  if(wrapped.length>2){wrapped.length=2;wrapped[1]=wrapped[1].slice(0,73)+'…';}
  out+=`<path d="M25 465 H1055 L1065 475 V582 L1055 592 H25 L15 582 V475Z" fill="#101522" stroke="#d0d7e2" stroke-width="3"/>`+text(40,492,heading,18,'start','#e0bd77')+wrapped.map((s,i)=>text(40,527+i*32,s,23)).join('')+'</svg>';
  return out;
}
async function renderBattle(b,opts={}){const svg=Buffer.from(scene(b,opts));let canvas;try{canvas=require('@napi-rs/canvas')}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}if(canvas){const c=canvas.createCanvas(W,H),ctx=c.getContext('2d');ctx.drawImage(await canvas.loadImage(svg),0,0);return c.toBuffer('image/png');}return require('sharp')(svg).png().toBuffer();}
module.exports={scene,renderBattle,towerArena,W,H};
