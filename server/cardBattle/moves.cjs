const catalog=require('./moves.json');
const registry=require('./registry.cjs');
function available(id,level){registry.statsAt(id,level);return structuredClone(catalog[id].filter(m=>m.level<=level));}
function initial(id,level=1){return available(id,level).filter(m=>m.level===1).map(m=>m.id);}
function validateLoadout(id,level,ids){const pool=available(id,level);if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length>5||ids.some(x=>!pool.some(m=>m.id===x)))throw Error('Invalid loadout');const moves=ids.map(x=>pool.find(m=>m.id===x));if(moves.filter(m=>m.category==='attack').length!==3||moves.filter(m=>m.category==='healing').length!==1||moves.filter(m=>m.category==='ultimate').length>1)throw Error('Invalid slot categories');return moves;}
function equip(id,level,ids,learn,forget){const next=[...ids];if(forget==null){next.push(learn);}else{const i=next.indexOf(forget);if(i<0)throw Error('Move not equipped');next[i]=learn;}validateLoadout(id,level,next);return next;}
const statuses={burn:{duration:4,hpFraction:.05},badlyBurned:{duration:4,hpFraction:.075},poison:{duration:4,hpFraction:.075},badlyPoisoned:{duration:4,hpFraction:.10},chilled:{duration:4,speedMultiplier:.75},stun:{duration:4,skipChance:.6},silence:{duration:2,blocksAttack:true}};
function applyStatus(current,key){if(!statuses[key])throw Error('Unknown status');const next={...current};const family=['burn','badlyBurned'].includes(key)?['burn','badlyBurned']:['poison','badlyPoisoned'].includes(key)?['poison','badlyPoisoned']:null;if(family){if(next[family[1]]||next[family[0]])key=family[1];for(const k of family)delete next[k];}next[key]=(next[key]||0)+statuses[key].duration;return next;}
function tickCooldowns(cooldowns){return Object.fromEntries(Object.entries(cooldowns).map(([k,v])=>[k,Math.max(0,v-1)]));}
module.exports={available,initial,validateLoadout,equip,statuses,applyStatus,tickCooldowns};
