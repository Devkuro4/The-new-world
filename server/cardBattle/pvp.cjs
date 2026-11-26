const {randomUUID}=require('node:crypto');
const B=require('./battle.cjs');
const CHALLENGE_TTL=60000, COOLDOWN=1800000, TIMEOUT=120000;
class PvP {
 constructor({state={},now=Date.now,random=Math.random,canBattle=()=>true,getDeck,reward=({won,draw})=>draw?40:won?100:25}={}){this.state=state;for(const k of ['challenges','battles','cooldowns','outbox'])this.state[k]??={};Object.assign(this,{now,random,canBattle,getDeck,reward});}
 active(player){return Object.values(this.state.battles).find(x=>x.battle.sides.some(s=>s.id===player));}
 cooldown(player){return Math.max(0,(Object.hasOwn(this.state.cooldowns,player)?this.state.cooldowns[player]:0)-this.now());}
 check(player){if(typeof player!=='string'||!player)throw Error('Invalid player');if(this.active(player)||!this.canBattle(player))throw Error('Already in battle');if(this.cooldown(player))throw Error('PvP cooldown');}
 deck(player){if(!this.getDeck)throw Error('Deck provider required');return this.getDeck(player);}
 challenge(group,from,to){this.sweep();if(from===to)throw Error('Cannot challenge yourself');this.check(from);this.check(to);if(Object.values(this.state.challenges).some(c=>[from,to].some(p=>p===c.from||p===c.to)))throw Error('Pending challenge');B.createBattle([{id:from,cards:this.deck(from)},{id:to,cards:this.deck(to)}]);const c={id:randomUUID(),group,from,to,expires:this.now()+CHALLENGE_TTL};this.state.challenges[c.id]=c;return structuredClone(c);}
 incoming(group,player){this.sweep();const c=Object.values(this.state.challenges).find(c=>c.group===group&&c.to===player);if(!c)throw Error('No pending challenge');return c;}
 accept(group,player){const c=this.incoming(group,player);this.check(c.from);this.check(c.to);const battle=B.createBattle([{id:c.from,cards:this.deck(c.from)},{id:c.to,cards:this.deck(c.to)}],{mode:'pvp',now:this.now()});const match={id:c.id,group,battle};this.state.battles[c.id]=match;delete this.state.challenges[c.id];return structuredClone(match);}
 decline(group,player){const c=this.incoming(group,player);delete this.state.challenges[c.id];return structuredClone(c);}
 act(group,player,cmd){this.sweep();const m=this.active(player);if(!m||m.group!==group)throw Error('No active PvP battle here');if(!['move','switch','desperate','pass'].includes(cmd.type))throw Error('Consumables disabled in PvP');m.battle=B.action(m.battle,player,cmd,{now:this.now(),random:this.random});return {battle:structuredClone(m.battle),outcome:this.finish(m)};}
 finish(m){const b=m.battle;if(!['ended','cancelled'].includes(b.phase))return null;const cancelled=b.phase==='cancelled',draw=!cancelled&&b.winner===null;const xp=cancelled?[]:B.rewards(b);const result={id:m.id,group:m.group,cancelled,draw,winner:b.winner,players:b.sides.map(s=>{const won=!cancelled&&b.winner===s.id;const credits=cancelled?0:this.reward({won,draw,player:s.id});if(!Number.isSafeInteger(credits)||credits<0)throw Error('Invalid reward');return {player:s.id,won,credits,xp:xp.find(x=>x.player===s.id)?.xp??[],cards:s.cards.map(c=>({uid:c.uid,hp:c.hp}))};})};for(const s of b.sides)Object.defineProperty(this.state.cooldowns,s.id,{value:this.now()+COOLDOWN,enumerable:true,writable:true,configurable:true});this.state.outbox[m.id]=result;delete this.state.battles[m.id];return structuredClone(result);}
 sweep(){const expired=[],outcomes=[];for(const c of Object.values(this.state.challenges))if(this.now()>=c.expires){expired.push(structuredClone(c));delete this.state.challenges[c.id];}for(const m of Object.values(this.state.battles))if(this.now()-m.battle.lastActivity>=TIMEOUT){m.battle.phase='cancelled';m.battle.events=[{type:'timeout'}];outcomes.push(this.finish(m));}return {expired,outcomes};}
 pending(){return structuredClone(Object.values(this.state.outbox));}
 acknowledge(id){delete this.state.outbox[id];}
 snapshot(){return structuredClone(this.state);}
}
module.exports={PvP,CHALLENGE_TTL,COOLDOWN,TIMEOUT};
