const {randomUUID}=require('node:crypto');
const R=require('./registry.cjs'),B=require('./battle.cjs');
const TTL=1800000;
const dialogues=[
  'So, you’ve decided to challenge me?',
  'You have my attention. Let’s see what you’ve got.',
  'Another challenger? How interesting.',
  'You should know what you’re getting yourself into.',
  'Heh. I was beginning to get bored.',
  'You want to test your strength against mine?',
  'Very well. Let the battle begin!',
  'I won’t make this easy for you.',
  'You’ve made your choice. Now prove yourself.',
  'Let’s see if you’re worthy of this encounter.'
];
const LEVEL_BANDS=[
  {min:1,max:5,weight:60},
  {min:6,max:10,weight:25},
  {min:11,max:20,weight:10},
  {min:21,max:30,weight:4},
  {min:31,max:40,weight:0.9},
  {min:41,max:50,weight:0.1},
];
function chooseWeighted(random,bands=LEVEL_BANDS){
  const total=bands.reduce((sum,b)=>sum+b.weight,0);
  let roll=random()*total;
  for(const band of bands){
    roll-=band.weight;
    if(roll<0) return band;
  }
  return bands[bands.length-1];
}
function rollWildLevel(random){
  const band=chooseWeighted(random);
  return band.min+Math.floor(random()*(band.max-band.min+1));
}
const RARITY_BANDS=Object.entries({Common:45,Uncommon:30,Rare:15,'Super Rare':7,'SS Rare':2.5,'Ultra Rare':0.5}).map(([rarity,weight])=>({rarity,weight}));
function randomCharacterId(random,roster,previous){
  const pool=roster.filter(c=>c.id!==previous);
  const eligible=pool.length?pool:roster;
  const bands=RARITY_BANDS.filter(b=>eligible.some(c=>c.rarity===b.rarity));
  const band=chooseWeighted(random,bands);
  const candidates=eligible.filter(c=>c.rarity===band.rarity);
  return candidates[Math.floor(random()*candidates.length)].id;
}
class WildEncounters {
 constructor({state={},random=Math.random,now=Date.now,credits=level=>50+level*5,canBattle=()=>true}={}){this.state=state;this.state.groups??={};this.state.outbox??={};this.state.previous??={};this.random=random;this.now=now;this.credits=credits;this.canBattle=canBattle;}
 get(group){return Object.hasOwn(this.state.groups,group)?this.state.groups[group]:null;}
 spawn(group,{id,level}={}){this.sweep();if(this.get(group))throw Error('Wild Card already active');const roster=R.list();id??=randomCharacterId(this.random,roster,this.state.previous[group]);level??=rollWildLevel(this.random);const c=R.getCard(id);R.statsAt(id,level);const e={id:randomUUID(),card:{id,level},expires:this.now()+TTL,failed:[],battle:null};Object.defineProperty(this.state.groups,group,{value:e,writable:true,enumerable:true,configurable:true});return {heading:'WILD CARD SPOTTED',encounter:e.id,name:c.name,level,type:c.type,rarity:c.rarity,command:'.claim'};}
 replaceIdle(group){
  this.sweep();
  const current=this.get(group);
  if(current?.battle)throw Error('Wild Card already challenged');
  if(current){this.state.previous[group]=current.card.id;delete this.state.groups[group];}
  return this.spawn(group);
 }
 claim(group,player,cards){this.sweep();const e=this.get(group);if(!e||this.now()>=e.expires)throw Error('No Wild Card available');if(e.failed.includes(player))throw Error('You already lost to this Wild Card. Another player must challenge it.');if(e.battle)throw Error('Wild Card already challenged');if(!this.canBattle(player)||Object.values(this.state.groups).some(x=>x.battle?.sides[0].id===player))throw Error('Already in battle');const enemy='wild:'+e.id;const b=B.createBattle([{id:player,cards},{id:enemy,ai:true,cards:[{...e.card,uid:enemy}]}],{mode:'wild',now:this.now()});e.battle=b;this.advance(e);return {dialogue:dialogues[Math.floor(this.random()*dialogues.length)],enemyName:R.getCard(e.card.id).name,battle:structuredClone(e.battle),encounter:e.id,outcome:this.finish(group,e)};}
 advance(e){let n=0;while(e.battle.phase!=='ended'&&e.battle.phase!=='cancelled'&&e.battle.sides[e.battle.turn].ai){if(++n>12)throw Error('AI loop limit');e.battle=B.action(e.battle,e.battle.sides[e.battle.turn].id,B.aiAction(e.battle),{random:this.random,now:this.now()});}}
 act(group,player,cmd){this.sweep();const e=this.get(group);if(!e?.battle||e.battle.sides[0].id!==player)throw Error('No active challenge');e.battle=B.action(e.battle,player,cmd,{random:this.random,now:this.now()});const events=[...e.battle.events];this.advance(e);const battle=structuredClone(e.battle);const outcome=this.finish(group,e);return {battle,playerEvents:events,outcome};}
 finish(group,e){const b=e.battle;if(!b||!['ended','cancelled'].includes(b.phase))return null;const player=b.sides[0].id;const win=b.phase==='ended'&&b.winner===player;const replace=win||this.now()>=e.expires;const result={replace, id:e.id+':'+player+':'+b.lastActivity,player,group,won:win,cancelled:b.phase==='cancelled',cards:b.sides[0].cards.map(c=>({uid:c.uid,hp:c.hp})),xp:b.phase==='ended'?B.rewards(b)[0].xp:[],credits:win?this.credits(e.card.level):0,captured:win?{...e.card,uid:randomUUID(),xp:0}:null};if(!Number.isSafeInteger(result.credits)||result.credits<0)throw Error('Invalid reward');this.state.outbox[result.id]=result;if(replace){this.state.previous[group]=e.card.id;delete this.state.groups[group];}else{if(!result.cancelled&&!e.failed.includes(player))e.failed.push(player);e.battle=null;}return structuredClone(result);}
 sweep(){const results=[];for(const [group,e] of Object.entries(this.state.groups)){if(e.battle&&this.now()-e.battle.lastActivity>=120000){e.battle.phase='cancelled';e.battle.events=[{type:'timeout'}];results.push(this.finish(group,e));}else if(!e.battle&&this.now()>=e.expires){this.state.previous[group]=e.card.id;delete this.state.groups[group];}}return results;}
 pending(){return structuredClone(Object.values(this.state.outbox));}
 acknowledge(id){delete this.state.outbox[id];}
 snapshot(){return structuredClone(this.state);}
}
module.exports={WildEncounters,TTL,dialogues,LEVEL_BANDS,rollWildLevel,RARITY_BANDS,randomCharacterId};
