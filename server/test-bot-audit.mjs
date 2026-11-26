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
    if (specifier === 'node:child_process' && context.parentURL?.includes('/botEngine.ts')) {
      return { url: 'data:text/javascript,export const execFile = (...args) => globalThis.auditExecFile(...args)', shortCircuit: true };
    }
    if (Object.hasOwn(mocks,specifier)) return { url: 'data:text/javascript,'+encodeURIComponent(mocks[specifier]), shortCircuit: true };
    return next(specifier,context);
  },
});
const scratch = mkdtempSync(join(tmpdir(),'pieck-audit-'));
process.env.DATA_DIR = scratch;
delete process.env.SUPABASE_URL;
try {
  const { botState, findCommand, handleIncomingMessage, takeAfkReturn } = await import('./botEngine.ts');
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

  const profile = () => botState.players[playerA];
  const previousAge = profile().age;
  assert.equal((await command('.setage 22abc')).status,'error');
  assert.equal(profile().age,previousAge);
  await command('.setage 24');
  assert.equal(profile().age,24);
  assert.match((await command('.afk lunch')).text,/now AFK.*Reason: lunch/);
  assert.ok(profile().afkSince <= Date.now());
  assert.equal(takeAfkReturn(playerB, 'Someone else sent a message'),undefined);
  assert.equal(takeAfkReturn(playerA, '.afk another reason'),undefined);
  profile().afkSince = Date.now() - 125000;
  assert.match(takeAfkReturn(playerA, 'I am back'),/Welcome back.*2m .*Reason: lunch/);
  assert.equal(takeAfkReturn(playerA, 'Second message'),undefined);
  assert.equal(profile().afkReason,undefined);
  assert.equal(profile().afkSince,undefined);
  assert.equal(JSON.parse(readFileSync(join(scratch,'pieck-state.json'),'utf8')).players[playerA].afkReason,undefined);
  await command('.afk reading');
  const comeback = await command('.balance',{source:'simulator'});
  assert.match(comeback.text,/Welcome back.*reading/);
  assert.match(comeback.text,/Wallet/i);
  await command('.afk');
  assert.match((await command('.afk clear')).text,/Welcome back.*No reason given/);
  profile().afkReason = 'Legacy away status';
  assert.match(takeAfkReturn(playerA,'Hi'),/You were AFK\. Reason: Legacy away status/);
  const xp = profile().xp;
  assert.match((await command('.support a problem')).text,/Support Desk/);
  assert.match((await command('.otp',{senderRole:'owner'})).text,/Deploy/);
  assert.match((await command('.test')).text,/Online/i);
  assert.equal(profile().xp,xp);
  const priorWallet = profile().wallet;
  profile().inventory['Audit Test Item'] = 2;
  assert.equal((await command('.buy ticket 0')).status,'error');
  assert.equal((await command('.sell Audit Test Item 3')).status,'error');
  assert.equal((await command('.lottery two')).status,'error');
  assert.equal((await command('.use')).status,'error');
  assert.equal(profile().wallet,priorWallet);
  assert.equal(profile().inventory['Audit Test Item'],2);

  await command('.memories add Likes offline tests');
  assert.match((await command('.mem')).text,/Likes offline tests/);
  await command('.mem del 1wrong');
  assert.equal(botState.aiMemories[playerA].length,1);
  await command('.memories del 1');
  assert.equal(botState.aiMemories[playerA].length,0);

  const moderator = { senderRole:'admin' };
  const previousAntilink = botState.groupSettings.antilink;
  assert.equal((await command('.antilink maybe',moderator)).status,'error');
  assert.equal(botState.groupSettings.antilink,previousAntilink);
  assert.equal((await command('.kick @900',{senderRole:'admin',source:'simulator'})).status,'blocked');

  const qa = await command('.aquiz');
  assert.equal(qa.buttons.length,4);
  const qb = await command('.aquiz',{groupId:'124@g.us'});
  assert.notEqual(qa.buttons[0].command,qb.buttons[0].command);
  assert.deepEqual((await command('.aquiz')).buttons,qa.buttons);
  assert.equal((await command(qa.buttons[0].command,{groupId:'124@g.us'})).status,'error');
  const correct = botState.activeQuizzes['group:123@g.us'].answerIndex;
  assert.match((await command(qa.buttons[correct].command)).text,/Correct/);
  assert.equal((await command(qa.buttons[correct].command)).status,'error');
  assert.ok(botState.activeQuizzes['group:124@g.us']);

  await command('.c4');
  const board = botState.activeConnect4[playerA].board;
  board[5].splice(0,3,1,1,1);
  for (const row of board) row[6] = 2;
  assert.equal((await command('.c4 7')).status,'error');
  assert.equal((await command('.c4 3abc')).status,'error');
  await command('.c4');
  assert.deepEqual(board[5].slice(0,3),[1,1,1]);
  assert.match((await command('.c4 4')).text,/You win/);
  assert.equal(botState.activeConnect4[playerA],undefined);
  await command('.wcg');
  await command('.wcg elric');
  assert.equal((await command('.wcg elric')).status,'error');
  assert.equal((await command('.wcg two words')).status,'error');
  assert.match((await command('.wcg')).text,/Streak: 1/);
  const beforeLoan = profile().loan;
  await command('.loan 999999');
  assert.equal(profile().loan,beforeLoan);
  await command('.loan all');
  assert.ok(profile().loan > beforeLoan && profile().loan <= 10000);
  await command('.repay all');
  assert.equal(profile().loan,0);
  assert.equal((await command('.guilds join missing')).status,'error');
  await command('.guilds join jujutsu high');
  assert.equal(profile().guild,'Jujutsu High');
  const chessXp = profile().xp;
  assert.equal((await command('.chess nonsense')).status,'error');
  assert.equal(profile().xp,chessXp);

  const playSource = 'https://soundcloud.com/test-artist/audit-song';
  const youtubeSource = 'https://www.youtube.com/watch?v=audit123';
  const ytFixture = {
    contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: {
      contents: [{ itemSectionRenderer: { contents: [{ videoRenderer: {
        videoId: 'audit123', title: { runs: [{ text: 'Audit Song' }] }, lengthText: { simpleText: '2:30' },
      } }] } }],
    } } } },
  };
  const soundCloudEntry = { title: 'Audit Song', uploader: 'Beyoncé', webpage_url: playSource, duration: 180 };
  const originalFetch = globalThis.fetch;
  let youtubeRequests = 0;
  let soundCloudResponse = JSON.stringify({ entries:[{ ...soundCloudEntry, title:'Unrelated upload' }, soundCloudEntry] });
  let soundCloudAudio = true;
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith('https://www.youtube.com/youtubei/')) throw Error('Unexpected playback fixture request');
    youtubeRequests++;
    return new Response(JSON.stringify(ytFixture));
  };
  globalThis.auditExecFile = (_bin, args, _options, callback) => {
    if (args.includes('--version')) return callback(null,'fixture','');
    if (args.at(-1).startsWith('scsearch5:')) return callback(null,soundCloudResponse,'');
    if (args.at(-1) === playSource && soundCloudAudio) {
      assert.ok(!args.includes('--cookies'));
      const output = args[args.indexOf('-o')+1].replace('%(ext)s','mp3');
      writeFileSync(output,'fixture audio');
    }
    callback(null,'','');
  };
  try {
    const match = await command('.play audit song Beyonce');
    assert.equal(match.handler,'SoundCloud Search');
    assert.equal(match.cardLink,playSource);
    assert.equal(youtubeRequests,0);
    const audio = await match.pendingMedia;
    assert.ok(audio.path);
    rmSync(audio.path);
    soundCloudAudio = false;
    const unavailable = await command('.play audit song Beyonce');
    assert.equal(unavailable.cardLink,youtubeSource);
    await unavailable.pendingMedia;
    assert.equal(youtubeRequests,1);
    soundCloudResponse = JSON.stringify({ entries:[{ ...soundCloudEntry, title:'Different recording' }] });
    assert.equal((await command('.play audit song',{source:'simulator'})).handler,'YouTube Search');
    soundCloudResponse = 'temporary provider error';
    assert.equal((await command('.play audit song',{source:'simulator'})).cardLink,youtubeSource);
    assert.equal(youtubeRequests,3);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.auditExecFile;
  }

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
console.log('WhatsApp identity, general commands, playback fallback, Gold, saved data and Card Battle regressions passed.');
