const {randomUUID}=require('node:crypto');
const R=require('./registry.cjs');
const DIFFICULTIES=Object.freeze(['Easy','Normal','Hard','Extreme','Nightmare'].map((name,i)=>Object.freeze({id:i+1,name,minLevel:[1,15,30,50,75][i],hours:[1,3,6,12,24][i]})));
function difficulty(id){const d=DIFFICULTIES.find(d=>d.id===id);if(!d)throw Error('Unknown expedition difficulty');return d;}
function defaultReward(d,random){return {credits:[30,80,170,350,700][d.id-1],trainingMaterials:[1,2,4,7,12][d.id-1],ascensionCores:Math.floor(random()*(d.id+1))};}
class Expeditions{
 constructor({state={},now=Date.now,random=Math.random,getCollection,canAssign=()=>true,reward=defaultReward}={}){this.state=state;for(const k of ['drafts','runs','outbox'])this.state[k]??={};Object.assign(this,{now,random,getCollection,canAssign,reward});}
 draft(p){return Object.hasOwn(this.state.drafts,p)?this.state.drafts[p]:null;}
 active(p){return Object.values(this.state.runs).find(r=>r.player===p);}
 locked(p,uid){return !!this.active(p)?.cards.some(c=>c.uid===uid);}
 info(p){this.sweep();const r=this.active(p);return r?{active:true,difficulty:r.difficulty,cards:structuredClone(r.cards),endsAt:r.endsAt,remainingMs:Math.max(0,r.endsAt-this.now())}:{active:false,difficulties:DIFFICULTIES,draft:structuredClone(this.draft(p))};}
 choose(p,id){this.sweep();if(this.active(p))throw Error('Expedition already active');const d=difficulty(id);Object.defineProperty(this.state.drafts,p,{value:{difficulty:id,indices:null,uids:null},enumerable:true,writable:true,configurable:true});return d;}
 validate(p,d,indices){if(!this.getCollection)throw Error('Collection provider required');if(!Array.isArray(indices)||indices.length!==3||new Set(indices).size!==3||indices.some(i=>!Number.isSafeInteger(i)||i<1))throw Error('Select exactly three distinct card indices');const collection=this.getCollection(p);const invalid=[],cards=[];for(const i of indices){const c=collection[i-1];if(!c||typeof c.uid!=='string'||!c.uid||!R.isBattleReady(c.id)||!Number.isInteger(c.level)||c.level<d.minLevel||c.level>100||this.locked(p,c.uid)||!this.canAssign(p,c.uid)){invalid.push(i);continue;}cards.push({uid:c.uid,id:c.id,level:c.level,index:i});}if(invalid.length)throw Error(`Ineligible cards: ${invalid.join(', ')}`);if(new Set(cards.map(c=>c.uid)).size!==3)throw Error('Duplicate card instances');return cards;}
 select(p,indices){this.sweep();if(this.active(p))throw Error('Expedition already active');const draft=this.draft(p);if(!draft)throw Error('Choose an expedition first');const d=difficulty(draft.difficulty),cards=this.validate(p,d,indices);draft.indices=[...indices];draft.uids=cards.map(c=>c.uid);return {difficulty:d,cards};}
 confirm(group,p){this.sweep();if(this.active(p))throw Error('Expedition already active');const draft=this.draft(p);if(!draft?.indices)throw Error('Select cards first');const d=difficulty(draft.difficulty),cards=this.validate(p,d,draft.indices);if(cards.some((c,i)=>c.uid!==draft.uids[i]))throw Error('Collection changed; select cards again');const now=this.now();const r={id:randomUUID(),player:p,group,difficulty:d,cards,startedAt:now,endsAt:now+d.hours*3600000};this.state.runs[r.id]=r;delete this.state.drafts[p];return structuredClone(r);}
 sweep(){const completed=[];for(const r of Object.values(this.state.runs)){if(this.now()<r.endsAt)continue;const rewards=this.reward(difficulty(r.difficulty.id),this.random,r);if(!rewards||Object.values(rewards).some(v=>!Number.isSafeInteger(v)||v<0)||Object.keys(rewards).some(k=>!['credits','trainingMaterials','ascensionCores'].includes(k)))throw Error('Invalid expedition rewards');const result={id:r.id,kind:'expeditionCompleted',player:r.player,group:r.group,difficulty:r.difficulty,cards:r.cards,rewards};this.state.outbox[r.id]=result;delete this.state.runs[r.id];completed.push(structuredClone(result));}return completed;}
 pending(){return structuredClone(Object.values(this.state.outbox));}
 acknowledge(id){delete this.state.outbox[id];}
 snapshot(){return structuredClone(this.state);}
}
module.exports={Expeditions,DIFFICULTIES,defaultReward};
