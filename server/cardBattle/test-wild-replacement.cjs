const A=require('node:assert/strict'),adapter=require('./adapter.cjs');
const group='test@g.us',state={},ctx={player:'p',group,prefix:'.',label:x=>x};
adapter.run(state,ctx,'start',[]);adapter.run(state,ctx,'wild',[]);
let v=adapter.services(state),e=v.wild.get(group),id=e.card.id;
v.wild.claim(group,'p',v.deck('p'));e=v.wild.get(group);e.battle.phase='ended';e.battle.winner=e.battle.sides[1].id;e.battle.events=[];v.wild.finish(group,e);adapter.settle(v);A.equal(state.nextSpawn[group],0);A.equal(v.wild.get(group),null);
const notices=adapter.tick(state);A.equal(notices.filter(n=>n.group===group).length,1);v=adapter.services(state);A.notEqual(v.wild.get(group).card.id,id);A.equal(adapter.tick(state).length,0);console.log('Defeat replacement and scheduled notice passed');
