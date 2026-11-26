const A=require('node:assert/strict'),adapter=require('./adapter.cjs');
const group='test@g.us',state={},ctx={player:'p',group,prefix:'.',label:x=>x},ctx2={player:'q',group,prefix:'.',label:x=>x};
adapter.run(state,ctx,'start',[]);adapter.run(state,ctx2,'start',[]);adapter.run(state,ctx,'wild',[]);
let v=adapter.services(state),e=v.wild.get(group),id=e.card.id;
v.wild.claim(group,'p',v.deck('p'));e=v.wild.get(group);e.battle.phase='ended';e.battle.winner=e.battle.sides[1].id;e.battle.events=[];v.wild.finish(group,e);adapter.settle(v);A.ok(v.wild.get(group));A.throws(()=>v.wild.claim(group,'p',v.deck('p')),/already lost/);
const qClaim=v.wild.claim(group,'q',v.deck('q'));A.equal(qClaim.battle.sides[1].cards[0].hp,qClaim.battle.sides[1].cards[0].stats.HP);
e=v.wild.get(group);e.battle.phase='ended';e.battle.winner='q';e.battle.events=[];v.wild.finish(group,e);adapter.settle(v);A.equal(state.nextSpawn[group],0);A.equal(v.wild.get(group),null);
let notices=adapter.tick(state);A.equal(notices.filter(n=>n.group===group).length,0);A.ok(state.nextSpawn[group]>Date.now());state.nextSpawn[group]=Date.now()-1;state.settings.spawnChance=1;notices=adapter.tick(state);A.equal(notices.filter(n=>n.group===group).length,1);v=adapter.services(state);A.notEqual(v.wild.get(group).card.id,id);A.equal(adapter.tick(state).length,0);console.log('Defeat retention, win cooldown, and scheduled notice passed');
