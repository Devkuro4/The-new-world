const A=require('node:assert/strict'),B=require('./battle.cjs'),M=require('./moves.cjs'),UI=require('./presentation.cjs');
const c=(id,uid,level=20)=>({id,uid,level});
const teams=[{id:'a',cards:[c('son-goku-base','a1'),c('satoru-gojo-base','a2')]},{id:'b',ai:true,cards:[c('monkey-d-luffy-base','b1'),c('choso-base','b2')]}];
let b=B.createBattle(teams,{now:0});
A.throws(()=>B.action(b,b.sides[1-b.turn].id,{type:'move',index:1},{now:1}));
let prev=JSON.stringify(b);
let next=B.action(b,b.sides[b.turn].id,{type:'move',index:1},{now:1,random:()=>.99});
A.equal(JSON.stringify(b),prev);
A.notEqual(next.turn,b.turn);
// Damage dialogue must appear immediately before the target's updated HP
const txt=UI.battleText(next,{prefix:'.',label:x=>x});
const atkEvent=next.events.find(e=>e.type==='attack');
const dmgIdx=txt.indexOf(`took ${atkEvent.amount} damage!`);
const hpIdx=txt.indexOf(`${atkEvent.hp}/${atkEvent.maxHp} HP`,dmgIdx);
A.ok(dmgIdx>0&&hpIdx>dmgIdx);
A.ok(!txt.includes('A wild '));
// Lv. 10 card should visibly show locked Lv. 20 Ultimate move
const lowBattle=B.createBattle([{id:'a',cards:[c('satoru-gojo-base','g1',10)]},{id:'b',ai:true,cards:[c('panda-base','p1',10)]}],{now:0});
const lowTxt=UI.battleText(lowBattle,{prefix:'.',label:x=>x});
A.match(lowTxt,/🔒 Unlimited Void \[Ultimate\] · Locked \(Unlocks at Lv\. 20\)/);
// Silence must always succeed (even with random=0.99) and block attacks for 2 turns
A.equal(M.statuses.regeneration,undefined);
let silBattle=B.createBattle([{id:'toge',cards:[c('toge-inumaki-base','t1',10)]},{id:'foe',cards:[c('panda-base','f1',10)]}],{now:0});
if(silBattle.sides[silBattle.turn].id!=='toge')silBattle=B.action(silBattle,'foe',{type:'move',index:1},{now:1,random:()=>.99});
silBattle=B.action(silBattle,'toge',{type:'move',index:3},{now:2,random:()=>.99});
A.equal(silBattle.sides[1].cards[0].status.silence,2);
A.throws(()=>B.action(silBattle,'foe',{type:'move',index:1},{now:3}),/Silenced/);
silBattle=B.action(silBattle,'foe',{type:'move',index:4},{now:3});
A.equal(silBattle.sides[1].cards[0].status.silence,1);
silBattle=B.action(silBattle,'toge',{type:'move',index:1},{now:4,random:()=>.99});
A.throws(()=>B.action(silBattle,'foe',{type:'move',index:1},{now:5}),/Silenced/);
silBattle=B.action(silBattle,'foe',{type:'pass'},{now:5});
A.equal(silBattle.sides[1].cards[0].status.silence,undefined);
silBattle=B.action(silBattle,'toge',{type:'move',index:1},{now:6,random:()=>.99});
silBattle=B.action(silBattle,'foe',{type:'move',index:1},{now:7,random:()=>.99});
A.equal(B.action(b,b.sides[b.turn].id,{type:'move',index:1},{now:120000}).phase,'cancelled');
for(let i=1;i<200&&b.phase!=='ended';i++){b.sides[b.turn].ai=true;const a=B.aiAction(b);b=B.action(b,b.sides[b.turn].id,a,{now:i,random:()=>.99});}
A.equal(b.phase,'ended');
A.equal(B.rewards(b).length,2);
console.log('Battle smoke tests passed');
