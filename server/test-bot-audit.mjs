import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountIds, identityJids, selectTarget } from './whatsappIdentity.ts';

const require = createRequire(import.meta.url);
const { run, services } = require('./cardBattle/adapter.cjs');
const { getCard } = require('./cardBattle/registry.cjs');
const meta = [{ id: '900@lid', phoneNumber: '123@s.whatsapp.net' }];
assert.deepEqual(identityJids('900:2@lid', undefined, meta), ['900@lid', '123@s.whatsapp.net']);
assert.deepEqual(accountIds(identityJids('123@lid'), '123'), ['wa-lid-123']);
assert.deepEqual(identityJids('123@lid', undefined, meta), ['123@lid']);
assert.deepEqual(identityJids('900@lid', '456@s.whatsapp.net', meta), ['900@lid']);
assert.equal(selectTarget(['900@lid'], true, '777@lid'), '900@lid');
assert.equal(selectTarget([], true, '777:5@lid'), '777@lid');
assert.equal(selectTarget([], false), undefined);
assert.equal(selectTarget([], true, '123@g.us'), null);
assert.equal(selectTarget(['900@lid','777@lid'], false), null);

const state = {};
const a = { player: 'a', group: '120@g.us', prefix: '.', label: x => x };
const b = { ...a, player: 'b' };
const call = (who, command, ...args) => run(state, who, command, args);
assert.throws(() => call(a, 'claim'), /Claim your starter cards first/);
call(a, 'start');
call(a, 'start');
const starter = services(state).economy.info('a');
assert.equal(starter.cards.length, 4);
assert.equal(starter.credits, 500);
assert.equal(new Set(starter.cards.map(card => card.id)).size, 3);
assert.ok(starter.cards.every(card => card.level === 5 && ['Common','Uncommon'].includes(getCard(card.id).rarity)));
assert.throws(() => call({ ...a, target:'b' }, 'pvp', '@b'), /needs to claim starter/);
call(b, 'start');
call(a, 'deck', '2', '1');
const saved = [...state.decks.a];
const restored = JSON.parse(JSON.stringify(state));
assert.deepEqual(services(restored).deck('a').map(card => card.uid), saved);
call({ ...a, target:'b' }, 'pvp', '@b');
assert.throws(() => call({ ...b, group:'121@g.us' }, 'pvp', 'accept'), /No pending challenge/);
assert.equal(call(b,'pvp','accept').battle.mode, 'pvp');
call(b,'forfeit');
assert.equal(services(state).economy.info('a').credits,600);
assert.equal(services(state).economy.info('b').credits,525);
const first = call(a,'wild');
const firstCard = services(state).wild.get(a.group).card.id;
assert.match(first.text,/WILD CARD SPOTTED/);
call(a,'wild');
assert.notEqual(services(state).wild.get(a.group).card.id, firstCard);
call(a,'claim');
const battleEncounter = services(state).wild.get(a.group).id;
assert.match(call(b,'wild').text,/IN PROGRESS/);
assert.equal(services(state).wild.get(a.group).id,battleEncounter);
assert.throws(() => call(a,'shop','99'),/Unknown shop/);
assert.equal(state.shop.a,undefined);

// The command engine runs with text-only test doubles for optional I/O dependencies.
const mocks = {
  'dotenv/config': '',
  'yt-search': 'export default function(){ throw Error("No media access in regression tests"); }',
  '@napi-rs/canvas': 'export function createCanvas(){ throw Error("Text-only regression test"); } export function loadImage(){ throw Error("Text-only regression test"); }',
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(mocks,specifier)) return { url: 'data:text/javascript,'+encodeURIComponent(mocks[specifier]), shortCircuit: true };
    return next(specifier,context);
  },
});
const scratch = mkdtempSync(join(tmpdir(),'pieck-audit-'));
process.env.DATA_DIR = scratch;
delete process.env.SUPABASE_URL;
try {
  const { botState, findCommand, handleIncomingMessage } = await import('./botEngine.ts');
  botState.groupSettings.isOpen = true;
  const playerA = 'wa-700';
  const playerB = 'wa-lid-900';
  const command = (text, params = {}) => handleIncomingMessage({
    senderId: playerA, senderName:'Audit Alice', senderRole:'everyone', chatMode:'group', source:'baileys',
    groupId:'123@g.us', text, ...params,
  });
  await command('.p', { senderId:playerB, senderName:'Audit Bob' });
  const bob = structuredClone(botState.players[playerB]);
  const target = ['wa-123',playerB];
  assert.match((await command('.p @900', { targetAccountIds:target, hasTargetMention:true })).text,/Audit Bob/);
  assert.match((await command('.profile', { targetAccountIds:target })).text,/Audit Bob/);
  assert.match((await command('.p')).text,/Audit Alice/);
  assert.equal((await command('.p @900',{ targetAccountIds:[] })).status,'error');
  assert.equal((await command('.p @900')).status,'error');
  assert.deepEqual(botState.players[playerB],bob);
  assert.equal(botState.players['wa-123'],undefined);
  await command('.rename Alice New',{ targetAccountIds:target });
  assert.equal(botState.players[playerA].name,'Alice New');
  assert.equal(botState.players[playerB].name,'Audit Bob');
  assert.equal((await command('.wild',{chatMode:'dm'})).status,'blocked');
  assert.equal((await command('.kick @900')).status,'blocked');
  assert.equal(findCommand('auction'),undefined);
  assert.equal(findCommand('cardshop').name,'cb');
  assert.equal(findCommand('use').name,'use');
  await command('.starter',{senderId:playerB,senderName:'Audit Bob'});
  await command('.starter');
  assert.match((await command('.pvp @900',{targetAccountIds:target})).text,/challenged Audit Bob/);
  const before = botState.players[playerB].wallet;
  await command('.pay @900 5',{targetAccountIds:target,hasTargetMention:true});
  assert.equal(botState.players[playerB].wallet,before+5);
  await command('.pay @900 5',{targetAccountIds:[]});
  assert.equal(botState.players[playerB].wallet,before+5);
  await command('.pay @900 5 extra',{targetAccountIds:target,hasTargetMention:true});
  assert.equal(botState.players[playerB].wallet,before+5);
  await command('.daily');
  const wallet = botState.players[playerA].wallet;
  await command('.daily');
  assert.equal(botState.players[playerA].wallet,wallet);
  assert.match((await command('.balance')).text,/Wallet/i);
  assert.ok((await command('.inventory')).text.length);
  assert.ok((await command('.transactions')).text.length);

  const save = join(scratch, 'pieck-state.json');
  const persisted = JSON.parse(readFileSync(save,'utf8'));
  const legacyCard = 'audit-card';
  persisted.auctions = [
    { id:'audit-auction', sellerId:playerA, highestBidderId:playerB, highestBid:10, cardId:legacyCard },
    { id:'unresolved', sellerId:playerA, highestBidderId:'wa-absent', highestBid:15, cardId:'unresolved-card' },
  ];
  writeFileSync(save, JSON.stringify(persisted));
  const migrated = await import('./botEngine.ts?audit-migration');
  assert.deepEqual(migrated.botState.auctions.map(auction => auction.id), ['unresolved']);
  assert.equal(migrated.botState.archivedAuctions[0].id,'audit-auction');
  assert.ok(migrated.botState.players[playerA].cards.includes(legacyCard));
  assert.equal(migrated.botState.players[playerB].wallet,persisted.players[playerB].wallet+10);
  migrated.persistState();
  const reloaded = await import('./botEngine.ts?audit-reload');
  assert.equal(reloaded.botState.players[playerB].wallet,migrated.botState.players[playerB].wallet);
  assert.deepEqual(reloaded.botState.cardBattle,migrated.botState.cardBattle);
} finally {
  hooks.deregister();
  rmSync(scratch,{recursive:true,force:true});
}
console.log('WhatsApp identity, command routing, Gold and Card Battle regressions passed.');
