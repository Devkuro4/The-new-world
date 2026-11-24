import fs from 'node:fs';
import path from 'node:path';
import {
  COMMAND_CATEGORIES,
  DEFAULT_BOT_CONFIG,
  DEFAULT_CARDS,
  DEFAULT_COMMANDS,
  DEFAULT_GROUP_SETTINGS,
  type ActivityLogEntry,
  type AnimeCard,
  type AuctionItem,
  type BotCommandDef,
  type BotConfig,
  type BotReplyPayload,
  type CommandCategory,
  type CommandRole,
  type GroupSettings,
  type PlayerProfile,
} from '../src/shared/botSchema.ts';
import { askGroqText, hasGroqKey, GROQ_MODEL } from './groqClient.ts';

export interface ActiveDrop {
  card: AnimeCard;
  claimCode: string;
  claimedBy?: string;
}

export interface ActiveQuiz {
  question: string;
  options: string[];
  answerIndex: number;
  anime: string;
  reward: number;
}

export interface BlackjackSession {
  playerCards: number[];
  dealerCards: number[];
  bet: number;
}

export interface BotState {
  config: BotConfig;
  groupSettings: GroupSettings;
  commands: BotCommandDef[];
  cards: AnimeCard[];
  auctions: AuctionItem[];
  players: Record<string, PlayerProfile>;
  activeDrop: ActiveDrop | null;
  activeQuiz: ActiveQuiz | null;
  activeBlackjack: Record<string, BlackjackSession>;
  activeConnect4: Record<string, { board: number[][]; turn: number }>;
  activeWordChain: Record<string, { lastWord: string; used: string[]; score: number }>;
  lotteryPool: { jackpot: number; tickets: Array<{ playerId: string; playerName: string }> };
  eventScores: Record<string, number>;
  logs: ActivityLogEntry[];
  stats: {
    totalCommands: number;
    totalAiCalls: number;
    totalCardDrops: number;
    startedAt: string;
  };
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'pieck-state.json');

const SEED_PLAYERS: Record<string, PlayerProfile> = {
  'owner-kuro': {
    id: 'owner-kuro',
    name: 'kuro',
    role: 'owner',
    wallet: 24500,
    bank: 82000,
    orbs: 48,
    stardust: 3200,
    xp: 4850,
    level: 19,
    age: 22,
    bio: 'Creator of Pieck & The new world WhatsApp Community.',
    guild: 'Tempest Federation',
    cards: ['C-100', 'C-101', 'C-103', 'C-104'],
    deck: ['C-101', 'C-102', 'C-103', 'C-104'],
    inventory: { 'Gacha Ticket': 3, 'XP Charm': 2, 'Luck Potion': 1 },
    pokemon: ['Pikachu (Lv.24)', 'Gengar (Lv.31)'],
    warnings: 0,
    shamePoints: 0,
    loan: 0,
    messagesSent: 142,
    transactions: [
      { id: 'TX-1', summary: 'Founder Stipend', amount: 15000, timestamp: '2026-11-23T18:00:00Z' },
    ],
  },
  'admin-rem': {
    id: 'admin-rem',
    name: 'Rem',
    role: 'admin',
    wallet: 8400,
    bank: 31000,
    orbs: 22,
    stardust: 1850,
    xp: 3120,
    level: 14,
    age: 19,
    bio: 'Moderation lead & Jujutsu collector.',
    guild: 'Jujutsu High',
    cards: ['C-105', 'C-106', 'C-112'],
    deck: ['C-105', 'C-106', 'C-112'],
    inventory: { 'Gacha Ticket': 1 },
    pokemon: ['Eevee (Lv.18)'],
    warnings: 0,
    shamePoints: 1,
    loan: 0,
    messagesSent: 96,
    transactions: [],
  },
  'member-sora': {
    id: 'member-sora',
    name: 'Sora',
    role: 'everyone',
    wallet: 4200,
    bank: 6500,
    orbs: 9,
    stardust: 640,
    xp: 1280,
    level: 7,
    age: 20,
    bio: 'Chasing S+ Frieren & Spy x Family drops.',
    guild: 'Survey Corps',
    cards: ['C-107', 'C-108', 'C-111'],
    deck: ['C-107', 'C-108', 'C-111'],
    inventory: { 'Luck Potion': 1 },
    pokemon: ['Lucario (Lv.22)'],
    warnings: 1,
    shamePoints: 2,
    loan: 0,
    messagesSent: 58,
    transactions: [],
  },
};

function createInitialState(): BotState {
  return {
    config: { ...DEFAULT_BOT_CONFIG },
    groupSettings: { ...DEFAULT_GROUP_SETTINGS, blacklist: [...DEFAULT_GROUP_SETTINGS.blacklist] },
    commands: DEFAULT_COMMANDS.map((c) => ({ ...c, aliases: c.aliases ? [...c.aliases] : undefined })),
    cards: DEFAULT_CARDS.map((c) => ({ ...c })),
    auctions: [
      {
        id: 'AUC-401',
        cardId: 'C-113',
        cardName: 'Spike Spiegel',
        series: 'Cowboy Bebop',
        tier: 'S',
        sellerId: 'admin-rem',
        sellerName: 'Rem',
        highestBid: 5200,
        highestBidderId: 'member-sora',
        highestBidderName: 'Sora',
        endsAt: '2026-11-24T23:59:00Z',
      },
    ],
    players: structuredClone(SEED_PLAYERS),
    activeDrop: null,
    activeQuiz: null,
    activeBlackjack: {},
    activeConnect4: {},
    activeWordChain: {},
    lotteryPool: {
      jackpot: 4500,
      tickets: [{ playerId: 'admin-rem', playerName: 'Rem' }],
    },
    eventScores: {
      'owner-kuro': 420,
      'admin-rem': 310,
      'member-sora': 185,
    },
    logs: [],
    stats: {
      totalCommands: 0,
      totalAiCalls: 0,
      totalCardDrops: 0,
      startedAt: new Date().toISOString(),
    },
  };
}

function loadState(): BotState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<BotState>;
      const base = createInitialState();
      return {
        ...base,
        ...parsed,
        config: { ...base.config, ...(parsed.config || {}) },
        groupSettings: { ...base.groupSettings, ...(parsed.groupSettings || {}) },
        commands: (() => {
          const saved = Array.isArray(parsed.commands) ? parsed.commands : [];
          const savedByName = new Map(saved.map((command) => [command.name.toLowerCase(), command]));
          const builtIns = base.commands.map((command) => {
            const prior = savedByName.get(command.name.toLowerCase());
            if (!prior || prior.isCustom) return command;
            return { ...command, customReply: prior.customReply };
          });
          const custom = saved.filter((command) => command.isCustom);
          return [...custom, ...builtIns];
        })(),
        cards: Array.isArray(parsed.cards) && parsed.cards.length > 0 ? parsed.cards : base.cards,
        players: parsed.players && Object.keys(parsed.players).length > 0 ? parsed.players : base.players,
        stats: { ...base.stats, ...(parsed.stats || {}) },
      };
    }
  } catch {
    // Fall back to fresh initial state if state file is unreadable
  }
  return createInitialState();
}

export const botState: BotState = loadState();

export function persistState(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(botState, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only environments
  }
}

function ensurePlayer(senderId: string, senderName: string, role: CommandRole): PlayerProfile {
  if (!botState.players[senderId]) {
    botState.players[senderId] = {
      id: senderId,
      name: senderName || 'Traveler',
      role,
      wallet: botState.config.starterBalance,
      bank: 0,
      orbs: 5,
      stardust: 200,
      xp: 100,
      level: 1,
      age: 18,
      bio: 'New adventurer in The new world.',
      cards: ['C-116'],
      deck: ['C-116'],
      inventory: { 'Gacha Ticket': 1 },
      pokemon: ['Eevee (Lv.5)'],
      warnings: 0,
      shamePoints: 0,
      loan: 0,
      messagesSent: 0,
      transactions: [],
    };
  } else {
    botState.players[senderId].role = role;
    if (senderName && botState.players[senderId].name !== senderName && senderId !== 'owner-kuro') {
      botState.players[senderId].name = senderName;
    }
  }
  return botState.players[senderId];
}

function addTransaction(player: PlayerProfile, summary: string, amount: number): void {
  player.transactions.unshift({
    id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
    summary,
    amount,
    timestamp: new Date().toISOString(),
  });
  if (player.transactions.length > 20) {
    player.transactions.length = 20;
  }
}

function roleLevel(role: CommandRole): number {
  if (role === 'owner') return 4;
  if (role === 'admin') return 3;
  if (role === 'moderator') return 2;
  return 1;
}

function toFancyText(input: string): string {
  const normal = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const boldSerif = Array.from('𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗');
  return Array.from(input)
    .map((ch) => {
      const idx = normal.indexOf(ch);
      return idx >= 0 ? boldSerif[idx] : ch;
    })
    .join('');
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 5500): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'PieckNewWorldBot/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Upstream HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchJikanMedia(type: 'anime' | 'manga', query: string, subType?: string): Promise<{
  title: string;
  japanese?: string;
  score: number | string;
  episodesOrChapters: string;
  status: string;
  genres: string;
  synopsis: string;
  imageUrl?: string;
  url: string;
} | null> {
  const params = new URLSearchParams({ q: query, limit: '1', sfw: 'true' });
  if (subType) {
    params.set('type', subType);
  }
  const data = (await fetchJsonWithTimeout(`https://api.jikan.moe/v4/${type}?${params.toString()}`)) as {
    data?: Array<{
      title: string;
      title_japanese?: string;
      score?: number;
      episodes?: number;
      chapters?: number;
      volumes?: number;
      status?: string;
      genres?: Array<{ name: string }>;
      synopsis?: string;
      images?: { jpg?: { large_image_url?: string; image_url?: string } };
      url?: string;
    }>;
  };
  const item = data.data?.[0];
  if (!item) return null;
  const rawSynopsis = (item.synopsis || 'No synopsis available.').replace(/\s*\[Written by MAL Rewrite\]\s*/i, '').trim();
  return {
    title: item.title,
    japanese: item.title_japanese,
    score: item.score ?? 'N/A',
    episodesOrChapters:
      type === 'anime'
        ? `${item.episodes ?? '?'} eps`
        : `${item.chapters ?? '?'} ch / ${item.volumes ?? '?'} vol`,
    status: item.status || 'Unknown',
    genres: (item.genres || []).slice(0, 4).map((g) => g.name).join(', ') || 'Anime',
    synopsis: rawSynopsis.length > 260 ? `${rawSynopsis.slice(0, 257)}...` : rawSynopsis,
    imageUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
    url: item.url || 'https://myanimelist.net',
  };
}

async function fetchSfwAnimeImage(tag: string): Promise<string | undefined> {
  const waifuPicsTags = new Set([
    'waifu',
    'neko',
    'hug',
    'kiss',
    'slap',
    'wave',
    'pat',
    'dance',
    'smile',
    'lick',
    'bonk',
    'wink',
    'yeet',
    'happy',
  ]);
  const waifuImTags = new Set(['maid', 'uniform', 'selfies', 'raiden-shogun', 'kamisato-ayaka', 'mori-calliope']);

  if (waifuImTags.has(tag)) {
    try {
      const url = `https://api.waifu.im/search?included_tags=${encodeURIComponent(tag)}&is_nsfw=false`;
      const data = (await fetchJsonWithTimeout(url, 4500)) as { images?: Array<{ url?: string }> };
      if (data.images?.[0]?.url) return data.images[0].url;
    } catch {
      // fall through to waifu.pics SFW
    }
  }

  const mappedTag = waifuPicsTags.has(tag) ? tag : 'waifu';
  try {
    const data = (await fetchJsonWithTimeout(`https://api.waifu.pics/sfw/${mappedTag}`, 4500)) as { url?: string };
    return data.url;
  } catch {
    return undefined;
  }
}

async function fetchCharacterImage(name: string): Promise<string | undefined> {
  try {
    const data = (await fetchJsonWithTimeout(
      `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`,
      4500
    )) as { data?: Array<{ images?: { jpg?: { image_url?: string } } }> };
    return data.data?.[0]?.images?.jpg?.image_url;
  } catch {
    return undefined;
  }
}

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  General: '⚙️ GENERAL ⚙️',
  Cards: '🎴 CARDS 🎴',
  Economy: '🎮 ECONOMY 🎮',
  Games: '🎮 GAMES 🎮',
  'Events & Guilds': '🎉 EVENTS & GUILDS 🏰',
  Gamble: '🎰 GAMBLE 🎰',
  Pokémon: '🐉 POKÉMON 🐉',
  Interaction: '👤 INTERACTION 👤',
  Fun: '👤 FUN 👤',
  Downloaders: '📲 DOWNLOADERS 📲',
  Search: '🔍 SEARCH 🔍',
  AI: '🤖 AI 🤖',
  Converter: '👤 CONVERTER 👤',
  'Anime SFW': '🎮 ANIME SFW 🎮',
  Admin: '⚙️ ADMIN ⚙️',
};

function formatMenuHeader(): string {
  const c = botState.config;
  return [
    `*PIECK*  •  Anime companion`,
    `${c.bannerTitle}  •  Prefix ${c.prefix}`,
  ].join('\n');
}

function buildMenuText(categoryFilter?: string): string {
  const prefix = botState.config.prefix;
  const visible = botState.commands.filter((command) => command.enabled);

  if (categoryFilter) {
    const matchedCategory = COMMAND_CATEGORIES.find(
      (category) => category.toLowerCase() === categoryFilter.toLowerCase() ||
        category.toLowerCase().startsWith(categoryFilter.toLowerCase())
    );
    if (!matchedCategory) {
      return `Unknown menu section *${categoryFilter}*. Send *${prefix}menu* to see the sections.`;
    }

    const commands = visible.filter((command) => command.category === matchedCategory);
    if (commands.length === 0) return `No commands are available in *${matchedCategory}* yet.`;

    return [
      formatMenuHeader(),
      '',
      `*${matchedCategory}*`,
      ...commands.map((command) => {
        const aliases = command.aliases?.length ? `  •  ${command.aliases.map((alias) => prefix + alias).join(', ')}` : '';
        return `*${prefix}${command.name}*${aliases}\n${command.description}`;
      }),
      '',
      `Use *${prefix}menu <section>* to switch sections.`,
    ].join('\n\n');
  }

  const sections = COMMAND_CATEGORIES
    .map((category) => ({
      category,
      count: visible.filter((command) => command.category === category).length,
    }))
    .filter((section) => section.count > 0);

  return [
    formatMenuHeader(),
    '',
    '*Choose a section*',
    ...sections.map((section) => `• *${prefix}menu ${section.category.toLowerCase()}*  ${section.count} commands`),
    '',
    `Quick start  •  *${prefix}anime Frieren*  •  *${prefix}card*  •  *${prefix}daily*`,
  ].join('\n');
}

function findCommand(rawName: string): BotCommandDef | undefined {
  const lower = rawName.toLowerCase();
  return botState.commands.find(
    (c) => c.name.toLowerCase() === lower || (c.aliases && c.aliases.some((a) => a.toLowerCase() === lower))
  );
}

function buildSystemInstruction(): string {
  const guard = botState.config.spoilerGuard
    ? 'STRICT SPOILER GUARD ENABLED: Never reveal major plot twists, character deaths, or endings unless the user explicitly asks for spoilers.'
    : 'Spoiler guard is relaxed when users discuss plot details.';
  return `${botState.config.aiPersonaPrompt}\nBot Name: ${botState.config.botName}. Creator: ${botState.config.creatorName}. Command Prefix: ${botState.config.prefix}.\n${guard}`;
}

export async function handleIncomingMessage(params: {
  senderId: string;
  senderName: string;
  senderRole: CommandRole;
  chatMode: 'group' | 'dm';
  source: 'simulator' | 'meta-webhook' | 'baileys';
  text: string;
}): Promise<BotReplyPayload> {
  const started = Date.now();
  const input = params.text.trim();
  const player = ensurePlayer(params.senderId, params.senderName, params.senderRole);
  player.messagesSent += 1;
  player.xp += 10;
  player.level = Math.max(1, Math.floor(Math.sqrt(player.xp / 25)));

  const prefix = botState.config.prefix || '.';
  let reply: BotReplyPayload;

  try {
    // Check group mute / antilink
    if (params.chatMode === 'group' && !botState.groupSettings.isOpen && roleLevel(params.senderRole) < 2) {
      reply = {
        text: `*Group Muted* — Only group admins can message right now. An admin can run *${prefix}open* or *${prefix}unmute*.`,
        handler: 'Group Moderation',
        status: 'blocked',
      };
      recordLog(params, input, reply, Date.now() - started);
      return reply;
    }

    if (
      params.chatMode === 'group' &&
      botState.groupSettings.antilink &&
      roleLevel(params.senderRole) < 2 &&
      /(https?:\/\/|chat\.whatsapp\.com\/)/i.test(input) &&
      !input.startsWith(prefix)
    ) {
      player.warnings += 1;
      reply = {
        text: `⚠️ *Antilink Triggered*\n@${player.name}, external links are blocked in *${botState.groupSettings.groupName}*.\nWarnings: ${player.warnings}/3`,
        handler: 'Antilink Guard',
        status: 'blocked',
      };
      recordLog(params, input, reply, Date.now() - started);
      return reply;
    }

    if (!input.startsWith(prefix)) {
      if (!botState.config.aiFallbackEnabled) {
        reply = {
          text: `Type *${prefix}menu* to see ${botState.config.botName}'s commands (or enable AI Natural Chat in Group & AI settings).`,
          handler: 'Prefix Hint',
        };
      } else if (!hasGroqKey()) {
        reply = {
          text: `Hi ${player.name}! Try a command like *${prefix}menu*, *${prefix}card*, *${prefix}anime Frieren*, or *${prefix}daily*. (Configure GROQ_API_KEY in Secrets for natural AI chat.)`,
          handler: 'Fallback Responder',
        };
      } else {
        botState.stats.totalAiCalls += 1;
        const aiText = await askGroqText(
          `User (${player.name}) says in ${params.chatMode}: ${input}`,
          buildSystemInstruction()
        );
        reply = {
          text: aiText,
          handler: `Groq AI (${GROQ_MODEL})`,
        };
      }
      recordLog(params, input, reply, Date.now() - started);
      persistState();
      return reply;
    }

    const withoutPrefix = input.slice(prefix.length).trim();
    const [rawCmd = '', ...restTokens] = withoutPrefix.split(/\s+/);
    const argStr = restTokens.join(' ').trim();
    const cmdDef = findCommand(rawCmd);

    if (!cmdDef) {
      reply = {
        text: `Unknown command *${prefix}${rawCmd}*. Send *${prefix}menu* to browse all ${botState.config.bannerTitle} commands.`,
        handler: 'Command Router',
        buttons: [
          { id: 'menu', label: 'Open .menu', command: `${prefix}menu` },
          { id: 'card', label: 'Spawn .card', command: `${prefix}card` },
        ],
      };
      recordLog(params, input, reply, Date.now() - started);
      return reply;
    }

    if (!cmdDef.enabled) {
      reply = {
        text: `Command *${prefix}${cmdDef.name}* is currently disabled in ${botState.config.bannerTitle}.`,
        handler: 'Command Router',
        status: 'blocked',
      };
      recordLog(params, input, reply, Date.now() - started);
      return reply;
    }

    if (roleLevel(params.senderRole) < roleLevel(cmdDef.role)) {
      reply = {
        text: `⛔ *Permission Denied*\n*${prefix}${cmdDef.name}* requires *${cmdDef.role.toUpperCase()}* role. Switch your simulator role above to test it.`,
        handler: 'RBAC Guard',
        status: 'blocked',
      };
      recordLog(params, input, reply, Date.now() - started);
      return reply;
    }

    botState.stats.totalCommands += 1;

    if (cmdDef.isCustom && cmdDef.customReply) {
      reply = {
        text: cmdDef.customReply
          .replace(/\{user\}/g, player.name)
          .replace(/\{bot\}/g, botState.config.botName)
          .replace(/\{arg\}/g, argStr || ''),
        handler: `Custom Rule (${prefix}${cmdDef.name})`,
      };
      recordLog(params, input, reply, Date.now() - started);
      persistState();
      return reply;
    }

    reply = await executeBuiltInCommand(cmdDef.name, restTokens, argStr, player, params.chatMode);
    recordLog(params, input, reply, Date.now() - started);
    persistState();
    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected bot engine error';
    reply = {
      text: `⚠️ *${botState.config.botName} Error*\n${message}`,
      handler: 'Error Handler',
      status: 'error',
    };
    recordLog(params, input, reply, Date.now() - started);
    return reply;
  }
}

function recordLog(
  params: { senderName: string; senderRole: CommandRole; chatMode: 'group' | 'dm'; source: 'simulator' | 'meta-webhook' | 'baileys' },
  input: string,
  reply: BotReplyPayload,
  latencyMs: number
): void {
  botState.logs.unshift({
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    source: params.source,
    senderName: params.senderName,
    senderRole: params.senderRole,
    chatMode: params.chatMode,
    input,
    handler: reply.handler,
    latencyMs,
    replyPreview: reply.text.replace(/\s+/g, ' ').slice(0, 140),
    status: reply.status || 'ok',
  });
  if (botState.logs.length > 80) {
    botState.logs.length = 80;
  }
}

async function executeBuiltInCommand(
  cmd: string,
  args: string[],
  argStr: string,
  player: PlayerProfile,
  chatMode: 'group' | 'dm'
): Promise<BotReplyPayload> {
  const p = botState.config.prefix;

  // ── GENERAL ──
  if (cmd === 'menu' || cmd === 'help') {
    return {
      text: buildMenuText(argStr || undefined),
      imageUrl: await fetchSfwAnimeImage('waifu'),
      imageCaption: 'Pieck command menu',
      handler: 'Menu',
      buttons: [
        { id: 'menu_cards', label: 'Cards', command: `${p}menu cards` },
        { id: 'menu_econ', label: 'Economy', command: `${p}menu economy` },
        { id: 'menu_admin', label: 'Moderation', command: `${p}menu admin` },
      ],
    };
  }
  if (cmd === 'rules') {
    return { text: `*📜 ${botState.config.botName} Rules*\n\n${botState.config.rulesText}`, handler: 'General' };
  }
  if (cmd === 'support') {
    const ticketId = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      text: argStr
        ? `*🎫 Support Ticket Created (${ticketId})*\nIssue: _${argStr}_\nAssigned to: *${botState.config.creatorName}* & Moderators.`
        : `*🎫 Support Desk*\n${botState.config.supportInfo}`,
      handler: 'General',
    };
  }
  if (cmd === 'community') {
    return {
      text: `*🌐 ${botState.config.bannerTitle} Official Community*\n${botState.config.communityInfo}\n\nActive Group: *${botState.groupSettings.groupName}*`,
      handler: 'General',
    };
  }
  if (cmd === 'addbot') {
    return {
      text: `*➕ Add ${botState.config.botName} to Your Group*\n${botState.config.addBotInfo}`,
      handler: 'General',
    };
  }
  if (cmd === 'test') {
    return {
      text: [
        `*⚡ ${botState.config.botName} Online*`,
        `┣ Prefix: \`${p}\``,
        `┣ Community: ${botState.config.bannerTitle}`,
        `┣ Groq AI: ${hasGroqKey() ? 'Connected' : 'Pending Secret'}`,
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'Diagnostics',
    };
  }
  if (cmd === 'stats') {
    const playerCount = Object.keys(botState.players).length;
    const enabledCount = botState.commands.filter((c) => c.enabled).length;
    return {
      text: [
        `*📊 ${botState.config.botName} Runtime Stats*`,
        `┣ Enabled Commands: *${enabledCount}/${botState.commands.length}*`,
        `┣ Registered Players: *${playerCount}*`,
        `┣ Catalog Cards: *${botState.cards.length}*`,
        `┣ Commands Processed: *${botState.stats.totalCommands}*`,
        `┣ Card Drops Spawned: *${botState.stats.totalCardDrops}*`,
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'Telemetry',
    };
  }
  if (cmd === 'owner') {
    const cleanOwner = botState.config.ownerNumber.replace(/[^\d]/g, '');
    return {
      text: [
        `*👑 Bot Creator*`,
        `┣ Name: *${botState.config.creatorName}*`,
        `┣ WhatsApp: *+${cleanOwner}*`,
        `┣ Chat: https://wa.me/${cleanOwner}`,
        `┣ Bot: *${botState.config.botName}* (${botState.config.bannerTitle})`,
        `┣ Guild: Tempest Federation`,
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'General',
    };
  }
  if (cmd === 'mods') {
    const admins = Object.values(botState.players).filter((user) => user.role === 'owner' || user.role === 'admin');
    const moderators = botState.groupSettings.moderatorNumbers;
    return {
      text: [
        '*Pieck team*',
        ...admins.map((user) => `• ${user.name}  —  ${user.role}`),
        ...moderators.map((number) => `• +${number}  —  moderator`),
        moderators.length === 0 ? '_No additional moderators._' : '',
      ].filter(Boolean).join('\n'),
      handler: 'Moderation',
    };
  }
  if (cmd === 'addmod' || cmd === 'delmod' || cmd === 'unmod') {
    const number = argStr.replace(/[^\d]/g, '');
    if (number.length < 7 || number.length > 15) {
      return { text: `Usage: *${p}${cmd} <country-code phone number>*`, handler: 'Moderation', status: 'error' };
    }
    const current = new Set(botState.groupSettings.moderatorNumbers);
    if (cmd === 'addmod') current.add(number);
    else current.delete(number);
    botState.groupSettings.moderatorNumbers = Array.from(current);
    return {
      text: cmd === 'addmod'
        ? `+${number} is now a Pieck moderator.`
        : `+${number} is no longer a Pieck moderator.`,
      handler: 'Moderation',
    };
  }
  if (cmd === 'bots') {
    return {
      text: `*🤖 Linked Bot Nodes*\n• *${botState.config.botName}* (Primary Anime Suite · Active)\n• Webhook Endpoint: \`/api/webhook\``,
      handler: 'General',
    };
  }
  if (cmd === 'url') {
    return {
      text: `*🔗 Active Webhook Path*\n\`/api/webhook\`\nConfigure Meta Cloud API in the *Deploy & Webhook* tab.`,
      handler: 'General',
    };
  }
  if (cmd === 'otp') {
    const code = Math.floor(100000 + Math.random() * 900000);
    return {
      text: `*🔐 Pairing OTP Code*\nCode: \`${code}\`\nValid for single-session verification.`,
      handler: 'General',
    };
  }
  if (cmd === 'memories') {
    const recent = botState.logs.slice(0, 4);
    return {
      text: recent.length
        ? `*🕰️ Recent Group Memories*\n${recent.map((l) => `• *${l.senderName}*: \`${l.input}\``).join('\n')}`
        : '*🕰️ Group Memories*\nNo commands recorded yet in this session.',
      handler: 'General',
    };
  }

  // ── CARDS ──
  if (cmd === 'card' || cmd === 'sc' || cmd === 'rc') {
    if (cmd === 'rc') {
      if (player.wallet < 500) {
        return { text: `You need *500 Yen* in your wallet to roll *${p}rc*. Current wallet: *¥${player.wallet.toLocaleString()}*.`, handler: 'Card Gacha' };
      }
      player.wallet -= 500;
      addTransaction(player, 'Random Card Roll (.rc)', -500);
    }

    let picked: AnimeCard | undefined;
    if (cmd === 'sc' && argStr) {
      picked = botState.cards.find((c) => c.id.toLowerCase() === argStr.toLowerCase() || c.name.toLowerCase().includes(argStr.toLowerCase()));
    }
    if (!picked) {
      picked = botState.cards[Math.floor(Math.random() * botState.cards.length)];
    }
    if (!picked.imageUrl) {
      picked.imageUrl = await fetchCharacterImage(picked.name);
    }

    if (cmd === 'rc') {
      player.cards.push(picked.id);
      return {
        text: [
          `*🎴 Gacha Pack Opened!*`,
          `┣ Card: *[${picked.tier}] ${picked.name}* (\`${picked.id}\`)`,
          `┣ Series: _${picked.series}_`,
          `┣ Stats: ATK *${picked.atk}* / DEF *${picked.def}*`,
          `┣ Stardust: *${picked.stardustValue}* ✨`,
          `┗━━━━━━━━━━━`,
        ].join('\n'),
        imageUrl: picked.imageUrl,
        imageCaption: `${picked.name} (${picked.tier})`,
        handler: 'Card Gacha',
        buttons: [
          { id: 'col', label: 'View .col', command: `${p}col` },
          { id: 'rc', label: 'Roll Again', command: `${p}rc` },
        ],
      };
    }

    const claimCode = String(Math.floor(1000 + Math.random() * 9000));
    botState.activeDrop = { card: picked, claimCode };
    botState.stats.totalCardDrops += 1;
    return {
      text: [
        `*🎴 Wild Anime Card Appeared!*`,
        `┣ Name: *[${picked.tier}] ${picked.name}*`,
        `┣ Series: _${picked.series}_`,
        `┣ Stats: ATK *${picked.atk}* / DEF *${picked.def}*`,
        `┣ Value: *¥${picked.price.toLocaleString()}*`,
        `┗━━━━━━━━━━━`,
        `Claim with: *${p}claim ${claimCode}*`,
      ].join('\n'),
      imageUrl: picked.imageUrl,
      imageCaption: `[${picked.tier}] ${picked.name} — Code: ${claimCode}`,
      handler: 'Card Spawn',
      buttons: [{ id: 'claim_drop', label: `Claim ${claimCode}`, command: `${p}claim ${claimCode}` }],
    };
  }

  if (cmd === 'claim') {
    if (!botState.activeDrop) {
      return { text: `No wild card is currently spawned. Trigger one with *${p}card*!`, handler: 'Card Claim' };
    }
    if (botState.activeDrop.claimedBy) {
      return { text: `Too slow! *${botState.activeDrop.card.name}* was already claimed by *${botState.activeDrop.claimedBy}*.`, handler: 'Card Claim' };
    }
    if (argStr && argStr !== botState.activeDrop.claimCode) {
      return { text: `Incorrect claim code. Use *${p}claim ${botState.activeDrop.claimCode}*.`, handler: 'Card Claim' };
    }
    const dropCard = botState.activeDrop.card;
    botState.activeDrop.claimedBy = player.name;
    player.cards.push(dropCard.id);
    player.stardust += 50;
    return {
      text: `✅ *Card Claimed!*\n*${player.name}* claimed *[${dropCard.tier}] ${dropCard.name}* (\`${dropCard.id}\`)!\n+50 bonus Stardust added.`,
      handler: 'Card Claim',
      buttons: [
        { id: 'deck', label: 'My .deck', command: `${p}deck` },
        { id: 'next_card', label: 'Spawn Another', command: `${p}card` },
      ],
    };
  }

  if (cmd === 'col' || cmd === 'deck') {
    const ids = cmd === 'deck' ? player.deck : player.cards;
    if (ids.length === 0) {
      return { text: `Your ${cmd === 'deck' ? 'battle deck' : 'collection'} is empty! Use *${p}card* or *${p}rc* to collect cards.`, handler: 'Cards' };
    }
    const list = ids
      .map((id, i) => {
        const card = botState.cards.find((c) => c.id === id);
        return card ? `${i + 1}. \`${card.id}\` *[${card.tier}] ${card.name}* — ${card.series}` : `${i + 1}. \`${id}\``;
      })
      .join('\n');
    return {
      text: `*🎴 ${player.name}'s ${cmd === 'deck' ? 'Active Battle Deck' : 'Card Collection'} (${ids.length})*\n${list}`,
      handler: 'Cards',
    };
  }

  if (cmd === 'vs') {
    if (player.deck.length === 0) {
      return { text: `Your deck is empty. Add cards before using *${p}vs*.`, handler: 'Card Battle', status: 'error' };
    }
    const query = argStr.replace(/^@/, '').toLowerCase();
    const opponent = Object.values(botState.players).find(
      (candidate) => candidate.id !== player.id && (!query || candidate.name.toLowerCase().includes(query))
    );
    if (!opponent || opponent.deck.length === 0) {
      return { text: `No battle-ready opponent found. Try *${p}vs <name>*.`, handler: 'Card Battle', status: 'error' };
    }
    const scoreDeck = (deck: string[]) => deck.reduce((total, cardId) => {
      const card = botState.cards.find((item) => item.id === cardId);
      return total + (card ? card.atk + card.def : 0);
    }, 0);
    const playerScore = scoreDeck(player.deck) + Math.floor(Math.random() * 40);
    const opponentScore = scoreDeck(opponent.deck) + Math.floor(Math.random() * 40);
    const won = playerScore >= opponentScore;
    const reward = won ? 500 : 100;
    player.wallet += reward;
    player.xp += won ? 80 : 25;
    addTransaction(player, `Card battle vs ${opponent.name}`, reward);
    const leadCard = botState.cards.find((card) => card.id === player.deck[0]);
    return {
      text: [
        '*Card battle*',
        `${player.name}  ${playerScore} — ${opponentScore}  ${opponent.name}`,
        won ? '*Victory*' : '*Defeat*',
        `Reward  •  ¥${reward}`,
      ].join('\n'),
      imageUrl: leadCard?.imageUrl,
      imageCaption: `${player.name} vs ${opponent.name}`,
      handler: 'Card Battle',
    };
  }

  if (cmd === 'ci' || cmd === 'cs' || cmd === 'si' || cmd === 'ss') {
    const q = argStr.toLowerCase();
    const matches = q
      ? botState.cards.filter(
          (c) => c.id.toLowerCase() === q || c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q)
        )
      : botState.cards.slice(0, 6);
    if (matches.length === 0) {
      return { text: `No catalog cards matched "_${argStr}_".`, handler: 'Card Search' };
    }
    const top = matches[0];
    if (cmd === 'ci' && matches.length === 1) {
      if (!top.imageUrl) top.imageUrl = await fetchCharacterImage(top.name);
      return {
        text: [
          `*🎴 Card Info — ${top.name}*`,
          `┣ ID: \`${top.id}\``,
          `┣ Tier: *${top.tier}*`,
          `┣ Series: _${top.series}_`,
          `┣ Power: ATK *${top.atk}* / DEF *${top.def}*`,
          `┣ Stardust: *${top.stardustValue}* ✨`,
          `┣ Price: *¥${top.price.toLocaleString()}*`,
          `┗━━━━━━━━━━━`,
        ].join('\n'),
        imageUrl: top.imageUrl,
        handler: 'Card Info',
      };
    }
    return {
      text: [
        `*🔍 Card Catalog (${matches.length} matches)*`,
        ...matches
          .slice(0, 8)
          .map((c) => `┣ \`${c.id}\` *[${c.tier}] ${c.name}*\n┃   _${c.series}_ — ¥${c.price.toLocaleString()}`),
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'Card Search',
    };
  }

  if (cmd === 'cardshop') {
    const featured = botState.cards.slice(0, 6);
    return {
      text: [
        `*🏪 ${botState.config.bannerTitle} Card Shop*`,
        ...featured.map((c) => `┣ \`${c.id}\` *[${c.tier}] ${c.name}* — ¥${c.price.toLocaleString()}`),
        `┗━━━━━━━━━━━`,
        `Roll a mystery card anytime with *${p}rc* (¥500).`,
      ].join('\n'),
      handler: 'Card Shop',
    };
  }

  if (cmd === 'sellc') {
    const idx = player.cards.findIndex((id) => id.toLowerCase() === argStr.toLowerCase());
    if (idx === -1) {
      return { text: `Card \`${argStr || '?'}\` was not found in your collection.`, handler: 'Cards' };
    }
    const cardId = player.cards[idx];
    const card = botState.cards.find((c) => c.id === cardId);
    const payout = Math.round((card?.price || 1000) * 0.7);
    const dust = Math.round((card?.stardustValue || 100) * 0.4);
    player.cards.splice(idx, 1);
    player.deck = player.deck.filter((d) => d !== cardId);
    player.wallet += payout;
    player.stardust += dust;
    addTransaction(player, `Sold Card ${card?.name || cardId}`, payout);
    return {
      text: `💰 Sold *${card?.name || cardId}* for *¥${payout.toLocaleString()}* and *${dust} Stardust*.`,
      handler: 'Cards',
    };
  }

  if (cmd === 'tc' || cmd === 'cg' || cmd === 'lc') {
    const [cardId = '', target = ''] = args;
    const idx = player.cards.findIndex((id) => id.toLowerCase() === cardId.toLowerCase());
    if (!cardId || idx === -1) {
      return { text: `Specify a valid card ID from your collection: *${p}${cmd} C-104 @Rem*`, handler: 'Card Transfer' };
    }
    const targetName = target.replace(/^@/, '') || 'Rem';
    const recipient = Object.values(botState.players).find((u) => u.name.toLowerCase() === targetName.toLowerCase());
    if (cmd !== 'lc') {
      player.cards.splice(idx, 1);
      if (recipient) recipient.cards.push(cardId);
    }
    return {
      text:
        cmd === 'lc'
          ? `🤝 Lent card \`${cardId}\` to *@${targetName}* for 24h.`
          : `🎁 Transferred card \`${cardId}\` from *${player.name}* to *@${targetName}*.`,
      handler: 'Card Transfer',
    };
  }

  if (cmd === 'fusion') {
    if (player.cards.length < 2) {
      return { text: `You need at least 2 cards in your collection to run *${p}fusion*.`, handler: 'Card Fusion' };
    }
    if (player.stardust < 300) {
      return { text: `Card fusion requires *300 Stardust*. You have *${player.stardust}*.`, handler: 'Card Fusion' };
    }
    player.stardust -= 300;
    const highTier = botState.cards.filter((c) => c.tier === 'S+' || c.tier === 'S');
    const forged = highTier[Math.floor(Math.random() * highTier.length)];
    player.cards.push(forged.id);
    return {
      text: `✨ *Fusion Complete!* (-300 Stardust)\nForged *[${forged.tier}] ${forged.name}* (\`${forged.id}\`) from _${forged.series}_!`,
      handler: 'Card Fusion',
    };
  }

  if (cmd === 'auction' || cmd === 'resell') {
    const [cardId = '', minBidRaw = '2000'] = args;
    const minBid = Math.max(500, parseInt(minBidRaw, 10) || 2000);
    const hasCard = player.cards.find((id) => id.toLowerCase() === cardId.toLowerCase());
    if (!hasCard) {
      return { text: `Usage: *${p}${cmd} <cardId> <minBid>* using a card you own.`, handler: 'Auctions' };
    }
    const card = botState.cards.find((c) => c.id === hasCard)!;
    const aucId = `AUC-${Math.floor(400 + Math.random() * 599)}`;
    botState.auctions.unshift({
      id: aucId,
      cardId: card.id,
      cardName: card.name,
      series: card.series,
      tier: card.tier,
      sellerId: player.id,
      sellerName: player.name,
      highestBid: minBid,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    });
    return {
      text: `🔨 *Auction Listed (${aucId})*\nCard: *[${card.tier}] ${card.name}*\nStarting Bid: *¥${minBid.toLocaleString()}*\nPlace bids with *${p}bid ${aucId} <amount>*`,
      handler: 'Auctions',
    };
  }

  if (cmd === 'listauc' || cmd === 'myauc') {
    const list = cmd === 'myauc' ? botState.auctions.filter((a) => a.sellerId === player.id) : botState.auctions;
    if (list.length === 0) {
      return { text: `No active auctions found. Start one with *${p}auction <cardId> <minBid>*.`, handler: 'Auctions' };
    }
    return {
      text: `*🔨 Live Card Auctions (${list.length})*\n${list
        .map(
          (a) =>
            `• \`${a.id}\` *[${a.tier}] ${a.cardName}* — Top Bid: *¥${a.highestBid.toLocaleString()}* (${a.highestBidderName || 'No bids'})`
        )
        .join('\n')}`,
      handler: 'Auctions',
    };
  }

  if (cmd === 'bid') {
    const [aucId = '', bidRaw = '0'] = args;
    const bidAmt = parseInt(bidRaw, 10) || 0;
    const auc = botState.auctions.find((a) => a.id.toLowerCase() === aucId.toLowerCase());
    if (!auc) return { text: `Auction \`${aucId}\` not found. Check *${p}listauc*.`, handler: 'Auctions' };
    if (bidAmt <= auc.highestBid) return { text: `Bid must exceed current top bid of *¥${auc.highestBid.toLocaleString()}*.`, handler: 'Auctions' };
    if (player.wallet < bidAmt) return { text: `Insufficient wallet Yen (*¥${player.wallet.toLocaleString()}*).`, handler: 'Auctions' };
    auc.highestBid = bidAmt;
    auc.highestBidderId = player.id;
    auc.highestBidderName = player.name;
    return {
      text: `✅ *New Highest Bid!*\n*${player.name}* bid *¥${bidAmt.toLocaleString()}* on *[${auc.tier}] ${auc.cardName}* (\`${auc.id}\`).`,
      handler: 'Auctions',
    };
  }

  if (cmd === 'remauc') {
    const before = botState.auctions.length;
    botState.auctions = botState.auctions.filter((a) => !(a.id.toLowerCase() === argStr.toLowerCase() && a.sellerId === player.id));
    return {
      text: botState.auctions.length < before ? `Removed auction \`${argStr}\`.` : `No matching auction owned by you found.`,
      handler: 'Auctions',
    };
  }

  if (cmd === 'slb' || cmd === 'clb' || cmd === 'stlb') {
    const sorted = Object.values(botState.players).sort((a, b) =>
      cmd === 'clb' ? b.cards.length - a.cards.length : b.stardust - a.stardust
    );
    return {
      text: `*🏆 ${cmd === 'clb' ? 'Card Collector' : 'Stardust'} Leaderboard*\n${sorted
        .map((u, idx) => `${idx + 1}. *${u.name}* — ${cmd === 'clb' ? `${u.cards.length} cards` : `${u.stardust.toLocaleString()} ✨`}`)
        .join('\n')}`,
      handler: 'Leaderboards',
    };
  }

  if (cmd === 'stardust') {
    return { text: `✨ *${player.name}'s Stardust*: *${player.stardust.toLocaleString()}*\nUsed for *${p}fusion* (300) and deck upgrades.`, handler: 'Cards' };
  }
  if (cmd === 'anticamp') {
    return { text: `⏱️ Anti-camp spawn cooldown is set to *${botState.config.cardSpawnCooldownSec}s* between natural drops.`, handler: 'Cards' };
  }
  if (cmd === 'tier') {
    return {
      text: `*🎴 ${botState.config.bannerTitle} Card Tiers*\n• *S+* (3%): Mythic icons (ATK 90+)\n• *S* (12%): Elite favorites\n• *A* (30%): Core cast\n• *B / C* (55%): Common & fusion fodder`,
      handler: 'Cards',
    };
  }
  if (cmd === 'myseries') {
    const owned = player.cards.map((id) => botState.cards.find((c) => c.id === id)?.series).filter(Boolean);
    const unique = Array.from(new Set(owned));
    return {
      text: `*📚 ${player.name}'s Collected Series (${unique.length})*\n${unique.map((s) => `• ${s}`).join('\n') || 'None yet.'}`,
      handler: 'Cards',
    };
  }
  if (cmd === 'submit') {
    return {
      text: argStr
        ? `📩 Card suggestion submitted to *${botState.config.creatorName}*: _${argStr}_`
        : `Usage: *${p}submit <Character Name | Anime Series>*`,
      handler: 'Cards',
    };
  }

  // ── ECONOMY ──
  if (cmd === 'bal' || cmd === 'balance' || cmd === 'orbs' || cmd === 'ebal') {
    return {
      text: [
        `*${player.name}'s balance*`,
        `Wallet  •  ¥${player.wallet.toLocaleString()}`,
        `Bank  •  ¥${player.bank.toLocaleString()}`,
        `Orbs  •  ${player.orbs}`,
        `Stardust  •  ${player.stardust.toLocaleString()}`,
      ].join('\n'),
      imageUrl: await fetchSfwAnimeImage('smile'),
      imageCaption: 'Economy balance',
      handler: 'Economy',
      buttons: [
        { id: 'daily', label: 'Daily', command: `${p}daily` },
        { id: 'fish', label: 'Fish', command: `${p}fish` },
      ],
    };
  }

  if (cmd === 'fish') {
    const cooldownMs = 5 * 60_000;
    const remaining = cooldownMs - (Date.now() - (player.lastFish || 0));
    if (remaining > 0) {
      return {
        text: `The water is still. Try again in *${Math.ceil(remaining / 60_000)} min*.`,
        imageUrl: await fetchSfwAnimeImage('sleep'),
        handler: 'Fishing',
        status: 'blocked',
      };
    }
    const catches = [
      { name: 'Tiny Magikarp', yen: 180, item: 'Fish Scale' },
      { name: 'Moonlit Koi', yen: 420, item: 'Koi Charm' },
      { name: 'Water Dragon Fry', yen: 760, item: 'Dragon Scale' },
      { name: 'Leviathan Relic', yen: 1400, item: 'Abyss Pearl' },
    ];
    const roll = Math.random();
    const catchIndex = roll > 0.97 ? 3 : roll > 0.82 ? 2 : roll > 0.45 ? 1 : 0;
    const caught = catches[catchIndex];
    player.lastFish = Date.now();
    player.wallet += caught.yen;
    player.inventory[caught.item] = (player.inventory[caught.item] || 0) + 1;
    addTransaction(player, `Fishing reward: ${caught.name}`, caught.yen);
    return {
      text: [
        '*Catch landed*',
        `${caught.name}`,
        `Reward  •  ¥${caught.yen.toLocaleString()}`,
        `Item  •  ${caught.item}`,
        `Wallet  •  ¥${player.wallet.toLocaleString()}`,
      ].join('\n'),
      imageUrl: await fetchSfwAnimeImage(catchIndex >= 2 ? 'happy' : 'smile'),
      imageCaption: caught.name,
      handler: 'Fishing',
      buttons: [{ id: 'balance', label: 'Balance', command: `${p}bal` }],
    };
  }

  if (cmd === 'daily') {
    const cooldownMs = 20 * 60 * 60_000;
    const remaining = cooldownMs - (Date.now() - (player.lastDaily || 0));
    if (remaining > 0) {
      const hours = Math.ceil(remaining / 3_600_000);
      return { text: `Daily reward already claimed. Return in about *${hours}h*.`, handler: 'Economy', status: 'blocked' };
    }
    const reward = botState.config.dailyReward;
    player.wallet += reward;
    player.orbs += 3;
    player.stardust += 120;
    player.lastDaily = Date.now();
    addTransaction(player, 'Daily reward', reward);
    return {
      text: [
        '*Daily reward*',
        `Yen  •  +¥${reward.toLocaleString()}`,
        'Orbs  •  +3',
        'Stardust  •  +120',
        `Wallet  •  ¥${player.wallet.toLocaleString()}`,
      ].join('\n'),
      imageUrl: await fetchSfwAnimeImage('maid'),
      imageCaption: 'Daily reward',
      handler: 'Economy',
    };
  }

  if (cmd === 'dep' || cmd === 'deposit') {
    const amt = argStr.toLowerCase() === 'all' ? player.wallet : Math.max(0, parseInt(argStr, 10) || 0);
    if (amt <= 0 || amt > player.wallet) {
      return { text: `Specify a valid deposit amount up to *¥${player.wallet.toLocaleString()}* (or *${p}dep all*).`, handler: 'Economy' };
    }
    player.wallet -= amt;
    player.bank += amt;
    addTransaction(player, 'Bank Deposit', -amt);
    return { text: `🏦 Deposited *¥${amt.toLocaleString()}* into your bank.\nWallet: ¥${player.wallet.toLocaleString()} · Bank: ¥${player.bank.toLocaleString()}`, handler: 'Economy' };
  }

  if (cmd === 'wd' || cmd === 'withdraw') {
    const amt = argStr.toLowerCase() === 'all' ? player.bank : Math.max(0, parseInt(argStr, 10) || 0);
    if (amt <= 0 || amt > player.bank) {
      return { text: `Specify a valid withdrawal amount up to *¥${player.bank.toLocaleString()}* (or *${p}wd all*).`, handler: 'Economy' };
    }
    player.bank -= amt;
    player.wallet += amt;
    addTransaction(player, 'Bank Withdrawal', amt);
    return { text: `💵 Withdrew *¥${amt.toLocaleString()}* to your wallet.\nWallet: ¥${player.wallet.toLocaleString()} · Bank: ¥${player.bank.toLocaleString()}`, handler: 'Economy' };
  }

  if (cmd === 'donate') {
    const [targetRaw = '', amtRaw = '0'] = args;
    const amt = parseInt(amtRaw, 10) || 0;
    if (!targetRaw || amt <= 0 || amt > player.wallet) {
      return { text: `Usage: *${p}donate @user <amount>* (max ¥${player.wallet.toLocaleString()}).`, handler: 'Economy' };
    }
    const targetName = targetRaw.replace(/^@/, '');
    const recipient = Object.values(botState.players).find((u) => u.name.toLowerCase() === targetName.toLowerCase());
    player.wallet -= amt;
    if (recipient) recipient.wallet += amt;
    addTransaction(player, `Donated to ${targetName}`, -amt);
    return { text: `🤝 *${player.name}* sent *¥${amt.toLocaleString()}* to *@${targetName}*.`, handler: 'Economy' };
  }

  if (cmd === 'p' || cmd === 'profile' || cmd === 'edit' || cmd === 'bio' || cmd === 'setage' || cmd === 'rename') {
    if (cmd === 'bio' && argStr) {
      player.bio = argStr.slice(0, 120);
      return { text: `✏️ Bio updated to: _${player.bio}_`, handler: 'Profile' };
    }
    if (cmd === 'setage' && argStr) {
      const age = Math.min(99, Math.max(13, parseInt(argStr, 10) || player.age));
      player.age = age;
      return { text: `🎂 Profile age updated to *${age}*.`, handler: 'Profile' };
    }
    if (cmd === 'rename' && argStr) {
      player.name = argStr.slice(0, 24);
      return { text: `🏷️ Display name updated to *${player.name}*.`, handler: 'Profile' };
    }
    if (cmd === 'edit') {
      return { text: `Edit your profile using:\n• *${p}rename <name>*\n• *${p}bio <text>*\n• *${p}setage <age>*`, handler: 'Profile' };
    }
    return {
      text: [
        `*🪪 ${botState.config.bannerTitle} Profile — ${player.name}*`,
        `┣ Role: *${player.role.toUpperCase()}*`,
        `┣ Level: *${player.level}* (${player.xp} XP)`,
        `┣ Guild: *${player.guild || 'Unaffiliated'}*`,
        `┣ Age: *${player.age}*`,
        `┣ Net Worth: *¥${(player.wallet + player.bank).toLocaleString()}*`,
        `┣ Cards: *${player.cards.length}*`,
        `┣ Pokémon: *${player.pokemon.length}*`,
        `┣ Bio: _${player.bio}_`,
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'Profile',
    };
  }

  if (cmd === 'rich' || cmd === 'richg' || cmd === 'lb' || cmd === 'leaderboard' || cmd === 'shame') {
    const sorted = Object.values(botState.players).sort((a, b) => {
      if (cmd === 'shame') return b.shamePoints - a.shamePoints;
      if (cmd === 'lb' || cmd === 'leaderboard') return b.xp - a.xp;
      return b.wallet + b.bank - (a.wallet + a.bank);
    });
    const title = cmd === 'shame' ? 'Hall of Shame' : cmd === 'lb' || cmd === 'leaderboard' ? 'XP Leaderboard' : 'Richest Players';
    return {
      text: `*🏆 ${title}*\n${sorted
        .map((u, i) => {
          const metric =
            cmd === 'shame'
              ? `${u.shamePoints} shame`
              : cmd === 'lb' || cmd === 'leaderboard'
              ? `Lv.${u.level} (${u.xp} XP)`
              : `¥${(u.wallet + u.bank).toLocaleString()}`;
          return `${i + 1}. *${u.name}* — ${metric}`;
        })
        .join('\n')}`,
      handler: 'Leaderboards',
    };
  }

  if (cmd === 'inv' || cmd === 'inventory') {
    const entries = Object.entries(player.inventory).filter(([, q]) => q > 0);
    return {
      text: entries.length
        ? `*🎒 ${player.name}'s Inventory*\n${entries.map(([k, v]) => `• *${k}* ×${v}`).join('\n')}`
        : `*🎒 Inventory Empty*\nBuy gear in *${p}shop*.`,
      handler: 'Economy',
    };
  }

  if (cmd === 'shop') {
    return {
      text: `*🛒 ${botState.config.bannerTitle} Item Shop*\n• *Gacha Ticket* — ¥500 (Use with ${p}use ticket)\n• *Luck Potion* — ¥900 (+XP & gamble boost)\n• *XP Charm* — ¥1,200 (+250 XP)\n\nUse *${p}use <item>* to activate owned items.`,
      handler: 'Economy',
    };
  }

  if (cmd === 'use') {
    const key = Object.keys(player.inventory).find((k) => k.toLowerCase().includes(argStr.toLowerCase() || 'ticket'));
    if (!key || !player.inventory[key]) {
      return { text: `You don't have "${argStr || 'that item'}" in *${p}inv*.`, handler: 'Economy' };
    }
    player.inventory[key] -= 1;
    player.xp += 150;
    return { text: `✨ Activated *${key}*! Gained +150 XP.`, handler: 'Economy' };
  }

  if (cmd === 'sell') {
    const key = Object.keys(player.inventory).find((k) => k.toLowerCase().includes(argStr.toLowerCase()));
    if (!key || !player.inventory[key]) return { text: `Item not found in inventory.`, handler: 'Economy' };
    player.inventory[key] -= 1;
    player.wallet += 350;
    return { text: `Sold *${key}* for *¥350*.`, handler: 'Economy' };
  }

  if (cmd === 'lottery' || cmd === 'lotterylist') {
    if (cmd === 'lotterylist') {
      return {
        text: `*🎟️ ${botState.config.bannerTitle} Lottery Pool*\nJackpot: *¥${botState.lotteryPool.jackpot.toLocaleString()}*\nTickets Sold: *${botState.lotteryPool.tickets.length}*`,
        handler: 'Economy',
      };
    }
    if (player.wallet < 250) return { text: `Lottery tickets cost *¥250*.`, handler: 'Economy' };
    player.wallet -= 250;
    botState.lotteryPool.jackpot += 250;
    botState.lotteryPool.tickets.push({ playerId: player.id, playerName: player.name });
    return {
      text: `🎟️ *${player.name}* bought a Lottery Ticket! Jackpot is now *¥${botState.lotteryPool.jackpot.toLocaleString()}*.`,
      handler: 'Economy',
    };
  }

  if (cmd === 'transactions') {
    return {
      text: player.transactions.length
        ? `*🧾 Recent Ledger (${player.name})*\n${player.transactions
            .slice(0, 6)
            .map((t) => `• ${t.summary}: ${t.amount >= 0 ? '+' : ''}¥${t.amount.toLocaleString()}`)
            .join('\n')}`
        : `No transactions logged yet.`,
      handler: 'Economy',
    };
  }

  if (cmd === 'loan') {
    const amt = Math.min(5000, Math.max(500, parseInt(argStr, 10) || 1000));
    player.loan += amt;
    player.wallet += amt;
    addTransaction(player, 'Guild Bank Loan', amt);
    return { text: `🏦 Approved *¥${amt.toLocaleString()}* loan. Total debt: *¥${player.loan.toLocaleString()}*.`, handler: 'Economy' };
  }

  if (cmd === 'mycds') {
    return { text: `⏱️ *Cooldowns (${player.name})*\n• Daily: Ready\n• Card Drop: Ready\n• Heist: Ready`, handler: 'Economy' };
  }

  if (cmd === 'afk') {
    player.afkReason = argStr || 'AFK watching anime';
    return { text: `💤 *${player.name}* is now AFK: _${player.afkReason}_`, handler: 'General' };
  }

  if (cmd === 'rob' || cmd === 'heist') {
    const win = Math.random() > 0.45;
    if (win) {
      const loot = cmd === 'heist' ? 1400 : 480;
      player.wallet += loot;
      addTransaction(player, `${cmd.toUpperCase()} Success`, loot);
      return { text: `🕶️ *${cmd === 'heist' ? 'Dungeon Vault Heist' : 'Pickpocket'} Succeeded!*\n*${player.name}* scored *¥${loot.toLocaleString()}*!`, handler: 'Economy' };
    }
    const fine = 300;
    player.wallet = Math.max(0, player.wallet - fine);
    player.shamePoints += 1;
    return { text: `🚨 Caught red-handed! Lost *¥${fine}* and gained +1 Shame Point.`, handler: 'Economy' };
  }

  if (cmd === 'myshame') {
    return { text: `😅 *${player.name}'s Shame Points*: *${player.shamePoints}*`, handler: 'Economy' };
  }

  if (cmd === 'roast') {
    const target = argStr || player.name;
    if (hasGroqKey()) {
      botState.stats.totalAiCalls += 1;
      const roast = await askGroqText(
        `Write one short, playful, PG-13 anime-themed roast (2 sentences max) aimed at "${target}" about their anime taste or gacha luck.`,
        buildSystemInstruction()
      );
      return { text: roast, handler: 'Groq AI (Roast)' };
    }
    return { text: `*${target}*, your pull luck is so tragic even Aqua feels sorry for your gacha deck.`, handler: 'Fun' };
  }

  // ── GAMBLE ──
  if (cmd === 'slots' || cmd === 'cf' || cmd === 'dice' || cmd === 'db' || cmd === 'dp' || cmd === 'roulette' || cmd === 'horse' || cmd === 'rr' || cmd === 'gamble') {
    const numericArg = args.find((a) => /^\d+$/.test(a));
    const bet = Math.max(50, Math.min(player.wallet, parseInt(numericArg || '100', 10) || 100));
    if (player.wallet < 50) {
      return { text: `You need at least *¥50* in your wallet to wager. Claim *${p}daily*!`, handler: 'Gamble' };
    }

    if (cmd === 'slots') {
      const icons = ['🍜', '⚔️', '🦊', '🔮', '⭐'];
      const r1 = icons[Math.floor(Math.random() * icons.length)];
      const r2 = icons[Math.floor(Math.random() * icons.length)];
      const r3 = icons[Math.floor(Math.random() * icons.length)];
      const jackpot = r1 === r2 && r2 === r3;
      const pair = r1 === r2 || r2 === r3 || r1 === r3;
      const delta = jackpot ? bet * 4 : pair ? Math.round(bet * 0.6) : -bet;
      player.wallet += delta;
      addTransaction(player, 'Slots Spin', delta);
      return {
        text: `*🎰 ${botState.config.bannerTitle} Slots*\n[ ${r1} | ${r2} | ${r3} ]\n\n${delta >= 0 ? `🎉 Won *¥${delta.toLocaleString()}*!` : `💸 Lost *¥${bet.toLocaleString()}*.`}\nWallet: *¥${player.wallet.toLocaleString()}*`,
        handler: 'Gamble',
        buttons: [{ id: 'slots_again', label: `Spin ¥${bet}`, command: `${p}slots ${bet}` }],
      };
    }

    const win = Math.random() > 0.48;
    const multiplier = cmd === 'rr' ? 2.5 : cmd === 'horse' ? 2 : 1;
    const delta = win ? Math.round(bet * multiplier) : -bet;
    player.wallet += delta;
    addTransaction(player, `Gamble (${cmd})`, delta);
    return {
      text: `*🎲 ${cmd.toUpperCase()} Result*\nWager: ¥${bet.toLocaleString()}\nOutcome: ${win ? `✅ Won *+¥${delta.toLocaleString()}*!` : `❌ Lost *¥${bet.toLocaleString()}*.`}\nWallet: *¥${player.wallet.toLocaleString()}*`,
      handler: 'Gamble',
    };
  }

  if (cmd === 'bj') {
    const action = args[0]?.toLowerCase();
    const session = botState.activeBlackjack[player.id];
    const draw = () => Math.min(10, Math.floor(Math.random() * 13) + 1);
    const sum = (cards: number[]) => cards.reduce((a, b) => a + b, 0);

    if (!session || (action !== 'hit' && action !== 'stand')) {
      const bet = Math.max(50, Math.min(player.wallet, parseInt(args[0] || '200', 10) || 200));
      if (player.wallet < bet) return { text: `Insufficient wallet Yen for *¥${bet}* Blackjack.`, handler: 'Blackjack' };
      const pCards = [draw(), draw()];
      const dCards = [draw(), draw()];
      botState.activeBlackjack[player.id] = { playerCards: pCards, dealerCards: dCards, bet };
      return {
        text: `*🃏 Blackjack (Bet ¥${bet})*\nYour Hand: [${pCards.join(', ')}] = *${sum(pCards)}*\n${botState.config.botName}'s Card: [${dCards[0]}, ?]`,
        handler: 'Blackjack',
        buttons: [
          { id: 'bj_hit', label: 'Hit', command: `${p}bj hit` },
          { id: 'bj_stand', label: 'Stand', command: `${p}bj stand` },
        ],
      };
    }

    if (action === 'hit') {
      session.playerCards.push(draw());
      const total = sum(session.playerCards);
      if (total > 21) {
        player.wallet -= session.bet;
        delete botState.activeBlackjack[player.id];
        return {
          text: `*🃏 Bust! (${total})*\nHand: [${session.playerCards.join(', ')}]\nLost *¥${session.bet}*. Wallet: *¥${player.wallet.toLocaleString()}*`,
          handler: 'Blackjack',
        };
      }
      return {
        text: `*🃏 Hit!*\nYour Hand: [${session.playerCards.join(', ')}] = *${total}*\n${botState.config.botName}'s Card: [${session.dealerCards[0]}, ?]`,
        handler: 'Blackjack',
        buttons: [
          { id: 'bj_hit', label: 'Hit', command: `${p}bj hit` },
          { id: 'bj_stand', label: 'Stand', command: `${p}bj stand` },
        ],
      };
    }

    // Stand
    while (sum(session.dealerCards) < 17) session.dealerCards.push(draw());
    const pTotal = sum(session.playerCards);
    const dTotal = sum(session.dealerCards);
    const won = dTotal > 21 || pTotal > dTotal;
    const tie = pTotal === dTotal;
    if (!tie) {
      player.wallet += won ? session.bet : -session.bet;
    }
    delete botState.activeBlackjack[player.id];
    return {
      text: `*🃏 Blackjack Showdown*\nYou: *${pTotal}* [${session.playerCards.join(', ')}]\n${botState.config.botName}: *${dTotal}* [${session.dealerCards.join(', ')}]\n\n${tie ? '🤝 Push (Tie).' : won ? `🎉 You win *+¥${session.bet}*!` : `💸 ${botState.config.botName} wins *¥${session.bet}*.`}`,
      handler: 'Blackjack',
    };
  }

  // ── GAMES ──
  if (cmd === 'aquiz') {
    if (argStr && ['a', 'b', 'c', 'd'].includes(argStr.toLowerCase()) && botState.activeQuiz) {
      const idx = ['a', 'b', 'c', 'd'].indexOf(argStr.toLowerCase());
      const q = botState.activeQuiz;
      botState.activeQuiz = null;
      if (idx === q.answerIndex) {
        player.wallet += q.reward;
        player.orbs += 1;
        botState.eventScores[player.id] = (botState.eventScores[player.id] || 0) + 50;
        return {
          text: `🎉 *Correct!* (${q.options[q.answerIndex]})\n*${player.name}* won *¥${q.reward}* + *1 Orb*!`,
          handler: 'Anime Quiz',
          buttons: [{ id: 'next_quiz', label: 'Next Question', command: `${p}aquiz` }],
        };
      }
      return {
        text: `❌ Wrong! The right answer was *${['A', 'B', 'C', 'D'][q.answerIndex]}. ${q.options[q.answerIndex]}*.`,
        handler: 'Anime Quiz',
        buttons: [{ id: 'next_quiz', label: 'Try Another', command: `${p}aquiz` }],
      };
    }

    const bank = [
      {
        question: 'In *That Time I Got Reincarnated as a Slime*, what is the name of the True Dragon Rimuru first befriends in the cave?',
        options: ['Veldora Tempest', 'Milim Nava', 'Guy Crimson', 'Benimaru'],
        answerIndex: 0,
        anime: 'Tensura',
        reward: 650,
      },
      {
        question: 'Which studio animated *Frieren: Beyond Journey\'s End*?',
        options: ['MAPPA', 'Madhouse', 'ufotable', 'CloverWorks'],
        answerIndex: 1,
        anime: 'Frieren',
        reward: 650,
      },
      {
        question: 'In *My Dress-Up Darling*, what craft does Wakana Gojo specialize in?',
        options: ['Swordsmithing', 'Hina Doll Making', 'Calligraphy', 'Origami'],
        answerIndex: 1,
        anime: 'My Dress-Up Darling',
        reward: 650,
      },
      {
        question: 'What is Satoru Gojo\'s domain expansion called in *Jujutsu Kaisen*?',
        options: ['Malevolent Shrine', 'Infinite Void', 'Coffin of the Iron Mountain', 'Chimera Shadow Garden'],
        answerIndex: 1,
        anime: 'Jujutsu Kaisen',
        reward: 650,
      },
    ];
    const picked = bank[Math.floor(Math.random() * bank.length)];
    botState.activeQuiz = picked;
    return {
      text: `*❓ Anime Trivia (${picked.anime})*\n${picked.question}\n\nA) ${picked.options[0]}\nB) ${picked.options[1]}\nC) ${picked.options[2]}\nD) ${picked.options[3]}\n\nReward: *¥${picked.reward}* + *1 Orb*`,
      handler: 'Anime Quiz',
      buttons: [
        { id: 'quiz_a', label: 'A', command: `${p}aquiz a` },
        { id: 'quiz_b', label: 'B', command: `${p}aquiz b` },
        { id: 'quiz_c', label: 'C', command: `${p}aquiz c` },
      ],
    };
  }

  if (cmd === 'startbattle') {
    const deckPower = player.deck.reduce((acc, id) => {
      const c = botState.cards.find((card) => card.id === id);
      return acc + (c ? c.atk + c.def : 100);
    }, 0);
    const bossPower = 240 + Math.floor(Math.random() * 140);
    const won = deckPower >= bossPower;
    if (won) {
      player.wallet += 900;
      player.orbs += 2;
      player.xp += 120;
    }
    return {
      text: `*⚔️ ${botState.config.bannerTitle} Floor Boss Battle*\nYour Deck Power: *${deckPower}*\nBoss (Veldora Shadow): *${bossPower}*\n\n${won ? '🏆 *Victory!* Earned +¥900, +2 Orbs, +120 XP!' : '🛡️ *Defeated!* Upgrade your *.deck* with stronger cards!'}`,
      handler: 'Battle Arena',
    };
  }

  if (cmd === 'c4') {
    if (!botState.activeConnect4[player.id] || !argStr) {
      botState.activeConnect4[player.id] = {
        board: Array.from({ length: 6 }, () => Array(7).fill(0)),
        turn: 1,
      };
    }
    const game = botState.activeConnect4[player.id];
    const col = parseInt(args[0] || '0', 10) - 1;
    if (col >= 0 && col < 7) {
      for (let r = 5; r >= 0; r--) {
        if (game.board[r][col] === 0) {
          game.board[r][col] = 1;
          break;
        }
      }
      const aiCol = Math.floor(Math.random() * 7);
      for (let r = 5; r >= 0; r--) {
        if (game.board[r][aiCol] === 0) {
          game.board[r][aiCol] = 2;
          break;
        }
      }
    }
    const grid = game.board
      .map((row) => row.map((cell) => (cell === 1 ? '🔴' : cell === 2 ? '🟡' : '⚪')).join(''))
      .join('\n');
    return {
      text: `*🔴 Connect-4 vs ${botState.config.botName}*\n${grid}\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\nDrop a disc with *${p}c4 <1-7>*`,
      handler: 'Mini-Game',
      buttons: [
        { id: 'c4_3', label: 'Drop Col 3', command: `${p}c4 3` },
        { id: 'c4_4', label: 'Drop Col 4', command: `${p}c4 4` },
        { id: 'c4_5', label: 'Drop Col 5', command: `${p}c4 5` },
      ],
    };
  }

  if (cmd === 'wcg') {
    const words = ['naruto', 'otaku', 'uchiha', 'akira', 'ramen', 'neko', 'okabe', 'elric', 'clannad', 'dazai'];
    if (!botState.activeWordChain[player.id] || !argStr) {
      botState.activeWordChain[player.id] = { lastWord: 'anime', used: ['anime'], score: 0 };
      return {
        text: `*🔤 Word Chain Started!*\nStarting word: *ANIME*\nReply with *${p}wcg <word starting with E>*`,
        handler: 'Word Chain',
      };
    }
    const wc = botState.activeWordChain[player.id];
    const next = argStr.toLowerCase().replace(/[^a-z]/g, '');
    const expected = wc.lastWord.slice(-1);
    if (!next.startsWith(expected)) {
      return { text: `Word must start with *${expected.toUpperCase()}* (after _${wc.lastWord}_).`, handler: 'Word Chain' };
    }
    wc.used.push(next);
    wc.score += 1;
    const replyStart = next.slice(-1);
    const botPick = words.find((w) => w.startsWith(replyStart) && !wc.used.includes(w)) || `${replyStart}ren`;
    wc.lastWord = botPick;
    player.wallet += 120;
    return {
      text: `✅ Nice! *${next}* (+¥120)\n${botState.config.botName} plays: *${botPick.toUpperCase()}*\nNext letter: *${botPick.slice(-1).toUpperCase()}* (Streak: ${wc.score})`,
      handler: 'Word Chain',
    };
  }

  if (cmd === 'chess') {
    return {
      text: argStr
        ? `*♟️ Chess Move Recorded:* \`${argStr}\`\n${botState.config.botName} responds: \`Nf6\`\nSend next SAN move via *${p}chess <move>*.`
        : `*♟️ ${botState.config.bannerTitle} Chess Board*\nNew match ready! Open with *${p}chess e4* or *${p}chess d4*.`,
      handler: 'Chess',
    };
  }

  // ── EVENTS & GUILDS ──
  if (cmd === 'enter' || cmd === 'estats' || cmd === 'elb') {
    if (cmd === 'enter') {
      botState.eventScores[player.id] = (botState.eventScores[player.id] || 0) + 100;
      return {
        text: `🎉 *${player.name}* entered the *Walpurgis Anime Grand Prix*! (+100 Event Points)`,
        handler: 'Events',
      };
    }
    if (cmd === 'estats') {
      return { text: `🏅 *${player.name}'s Event Score*: *${botState.eventScores[player.id] || 0} pts*`, handler: 'Events' };
    }
    const board = Object.entries(botState.eventScores)
      .sort((a, b) => b[1] - a[1])
      .map(([id, pts], i) => `${i + 1}. *${botState.players[id]?.name || id}* — ${pts} pts`)
      .join('\n');
    return { text: `*🎉 Walpurgis Event Leaderboard*\n${board}`, handler: 'Events' };
  }

  if (cmd === 'guilds') {
    if (argStr.toLowerCase().startsWith('join ')) {
      const gName = argStr.slice(5).trim();
      player.guild = gName;
      return { text: `🏰 *${player.name}* joined guild *${gName}*!`, handler: 'Guilds' };
    }
    return {
      text: `*🏰 ${botState.config.bannerTitle} Anime Guilds*\n• *Tempest Federation* (PvE & Card Collectors)\n• *Jujutsu High* (Arena Battles)\n• *Survey Corps* (Trivia & Exploration)\n\nYour Guild: *${player.guild || 'None'}*\nJoin with *${p}guilds join Tempest Federation*`,
      handler: 'Guilds',
    };
  }

  // ── POKÉMON ──
  if (cmd === 'pmenu') {
    if (argStr.toLowerCase() === 'catch') {
      const pool = ['Umbreon (Lv.19)', 'Gardevoir (Lv.27)', 'Greninja (Lv.32)', 'Sylveon (Lv.21)', 'Charizard (Lv.36)'];
      const caught = pool[Math.floor(Math.random() * pool.length)];
      player.pokemon.push(caught);
      return { text: `⚡ *Gotcha!* Caught wild *${caught}*!`, handler: 'Pokémon RPG' };
    }
    return {
      text: `*🐉 Pokémon RPG Menu*\nParty (${player.pokemon.length}): ${player.pokemon.join(', ')}\n\nCommands:\n• *${p}pmenu catch* — Catch a wild Pokémon\n• *${p}pmenu* — View your party`,
      handler: 'Pokémon RPG',
      buttons: [{ id: 'pcatch', label: 'Catch Wild Pokémon', command: `${p}pmenu catch` }],
    };
  }

  // ── INTERACTIONS & ANIME SFW ──
  const interactionVerbs: Record<string, string> = {
    hug: 'gave a warm anime hug to',
    kiss: 'sent a sweet anime kiss to',
    slap: 'delivered a comedic anime slap to',
    wave: 'waved cheerfully at',
    pat: 'gave wholesome headpats to',
    dance: 'started an anime victory dance',
    sad: 'looked dramatically sad',
    smile: 'flashed a bright anime smile',
    laugh: 'burst out laughing',
    lick: 'playfully teased',
    punch: 'unleashed a shonen punch at',
    bonk: 'delivered an anti-chaos bonk to',
    tickle: 'tickled',
    shrug: 'shrugged calmly',
  };

  if (cmd in interactionVerbs) {
    const tagMap: Record<string, string> = {
      punch: 'bonk',
      laugh: 'happy',
      sad: 'cry',
      tickle: 'pat',
      shrug: 'smile',
    };
    const apiTag = tagMap[cmd] || cmd;
    const img = await fetchSfwAnimeImage(apiTag);
    const target = argStr ? ` *${argStr}*` : '';
    return {
      text: `✨ *${player.name}* ${interactionVerbs[cmd]}${target}!`,
      imageUrl: img,
      handler: 'SFW Anime Interaction',
    };
  }

  const sfwArtTags = ['waifu', 'neko', 'maid', 'mori-calliope', 'raiden-shogun', 'kamisato-ayaka', 'selfies', 'uniform', 'cosplay'];
  if (sfwArtTags.includes(cmd)) {
    const img = await fetchSfwAnimeImage(cmd);
    return {
      text: `*🌸 SFW Anime Showcase — .${cmd}*\nCurated clean artwork for *${player.name}*.`,
      imageUrl: img,
      handler: 'SFW Anime Media',
      buttons: [{ id: `more_${cmd}`, label: `Another .${cmd}`, command: `${p}${cmd}` }],
    };
  }

  // ── FUN (SFW) ──
  if (cmd === 'ship') {
    const parts = argStr.split(/\s+/).filter(Boolean);
    const a = parts[0] || player.name;
    const b = parts[1] || botState.config.botName;
    const pct = ((a.length * 17 + b.length * 31) % 101);
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    return {
      text: `*💘 Anime Ship Meter*\n*${a}* × *${b}*\n[${bar}] *${pct}%*`,
      handler: 'Fun',
    };
  }

  if (cmd === 'skill') {
    const skills = ['Great Sage', 'Predator', 'Infinite Prison', 'Gluttony', 'Starlight Architect', 'Chrono Weaver'];
    const picked = skills[Math.floor(Math.random() * skills.length)];
    return { text: `🔮 *Unique Skill Awakened!*\n*${argStr || player.name}* obtained *[${picked}]*.`, handler: 'Fun' };
  }

  if (cmd === 'duality' || cmd === 'gen' || cmd === 'pov' || cmd === 'social' || cmd === 'relation' || cmd === 'uno' || cmd === 'couplepp') {
    const map: Record<string, string> = {
      duality: `⚖️ *Anime Duality (${player.name})*: 72% Wholesome Slice-of-Life · 28% Chaotic Shonen Rival.`,
      gen: `🎭 *Generated Persona*: Kurogane Ren — Wandering Alchemist of Sector 7.`,
      pov: `🎬 *POV*: You finally save 180 pulls, and the banner drops a duplicate standard 5-star.`,
      social: `🤝 *Social Affinity*: Level ${player.level} · Guild: ${player.guild || 'Free Agent'}`,
      relation: `💞 *Bond Status*: Trusted Guildmate of ${botState.config.botName}.`,
      uno: `🃏 *UNO REVERSE!* Turn order flipped back to *${player.name}*!`,
      couplepp: `🖼️ *Matching Duo Avatars*: Pair *Rimuru + Veldora* or *Marin + Gojo* in *${p}anime*!`,
    };
    return { text: map[cmd], handler: 'Fun' };
  }

  if (cmd === 'wyr' || cmd === 'wouldyourather' || cmd === 'truth' || cmd === 'dare' || cmd === 'td' || cmd === 'darkjoke') {
    if (hasGroqKey()) {
      botState.stats.totalAiCalls += 1;
      const promptMap: Record<string, string> = {
        wyr: 'Give one fun anime "Would You Rather" dilemma with two choices.',
        wouldyourather: 'Give one fun anime "Would You Rather" dilemma with two choices.',
        truth: 'Give one fun, friendly anime-themed Truth question for a WhatsApp group chat.',
        dare: 'Give one harmless, creative anime-themed Dare for a WhatsApp group chat.',
        td: 'Give one random anime Truth or Dare prompt.',
        darkjoke: 'Tell one short, clever PG-13 dry-humor anime joke (keep it safe and non-offensive).',
      };
      const out = await askGroqText(promptMap[cmd], buildSystemInstruction());
      return { text: out, handler: 'Groq AI (Fun)' };
    }
    return {
      text: `🎲 *${cmd.toUpperCase()}*: Would you rather be reincarnated as a slime with Great Sage or as an overpowered hero with zero common sense?`,
      handler: 'Fun',
    };
  }

  if (cmd === 'meme' || cmd === 'shootmeme' || cmd === 'coolmeme' || cmd === 'sadmeme' || cmd === 'triggered') {
    const img = await fetchSfwAnimeImage(cmd === 'sadmeme' ? 'cry' : cmd === 'coolmeme' ? 'wink' : 'smile');
    return {
      text: `*🎭 ${cmd.toUpperCase()}* — When the anime ends on a cliffhanger and Season 2 isn't announced yet.`,
      imageUrl: img,
      handler: 'Fun',
    };
  }

  // ── ANIME / MANGA / SEARCH / DOWNLOADERS ──
  if (cmd === 'anime' || cmd === 'manga' || cmd === 'manhwa' || cmd === 'novel') {
    if (!argStr) {
      return { text: `Usage: *${p}${cmd} <title>* (e.g. *${p}${cmd} Frieren*)`, handler: 'Jikan MAL API' };
    }
    const mediaType = cmd === 'anime' ? 'anime' : 'manga';
    const subType = cmd === 'manhwa' ? 'manhwa' : cmd === 'novel' ? 'lightnovel' : undefined;
    const result = await fetchJikanMedia(mediaType, argStr, subType);
    if (!result) {
      return { text: `No ${cmd} found on MyAnimeList for "_${argStr}_".`, handler: 'Jikan MAL API' };
    }
    return {
      text: [
        `*📺 ${result.title}*${result.japanese ? `\n_${result.japanese}_` : ''}`,
        `┣ Score: *★ ${result.score}*`,
        `┣ Length: *${result.episodesOrChapters}*`,
        `┣ Status: *${result.status}*`,
        `┣ Genres: ${result.genres}`,
        `┗━━━━━━━━━━━`,
        '',
        result.synopsis,
        '',
        `🔗 ${result.url}`,
      ].join('\n'),
      imageUrl: result.imageUrl,
      imageCaption: result.title,
      handler: 'Jikan MAL API',
    };
  }

  if (cmd === 'wallpaper' || cmd === 'pint' || cmd === 'pinterest') {
    const q = argStr || 'Frieren';
    const result = await fetchJikanMedia('anime', q);
    const img = result?.imageUrl || (await fetchSfwAnimeImage('waifu'));
    return {
      text: `*🖼️ Anime Art Search — "${q}"*\n${result ? `Matched: *${result.title}*` : 'Curated anime visual'}`,
      imageUrl: img,
      handler: 'Anime Media Search',
    };
  }

  if (['ig', 'ttk', 'yt', 'x', 'fb', 'play', 'reddit', 'sauce', 'reverseimg', 'lyrics', 'igstalk', 'shazam'].includes(cmd)) {
    if ((cmd === 'lyrics' || cmd === 'sauce' || cmd === 'shazam') && argStr && hasGroqKey()) {
      botState.stats.totalAiCalls += 1;
      const ans = await askGroqText(
        `Command .${cmd} query: "${argStr}". Provide concise anime music/scene info formatted for WhatsApp.`,
        buildSystemInstruction()
      );
      return { text: ans, handler: 'Groq AI (Search)' };
    }
    return {
      text: `*📲 Media Bridge (.${cmd})*\nTarget: \`${argStr || 'No URL/query provided'}\`\n\nIn the WhatsApp Simulator & Cloud API mode, direct binary video scraping is queued via the exported Baileys + yt-dlp runner in *Deploy & Webhook*.`,
      handler: 'Media Bridge',
    };
  }

  // ── AI & CONVERTER ──
  if (['gpt', 'copilot', 'perplexity', 'imagine', 'tt', 'translate', 'tb', 'transcribe', 'ocr', 'tldr', 'tts', 'upscale'].includes(cmd)) {
    if (!argStr && cmd !== 'upscale') {
      return { text: `Usage: *${p}${cmd} <your prompt or text>*`, handler: 'Groq AI' };
    }
    if (!hasGroqKey()) {
      return { text: `Groq chat is not configured yet. Add GROQ_API_KEY in Render Environment.`, handler: 'Groq AI', status: 'error' };
    }
    botState.stats.totalAiCalls += 1;
    const taskPrefix =
      cmd === 'tldr'
        ? 'Summarize this concisely in 3 bullet points: '
        : cmd === 'tt' || cmd === 'translate'
        ? 'Translate this clearly (include romaji if Japanese): '
        : cmd === 'copilot'
        ? 'Answer as an expert TypeScript & WhatsApp bot engineer: '
        : cmd === 'imagine'
        ? 'Write a vivid anime art prompt and scene breakdown for: '
        : '';
    const answer = await askGroqText(`${taskPrefix}${argStr || 'Enhance anime frame clarity'}`, buildSystemInstruction());
    return { text: answer, handler: `Groq AI (.${cmd})` };
  }

  if (cmd === 'fancy') {
    const source = argStr || `${botState.config.botName} · ${botState.config.bannerTitle}`;
    return {
      text: `*✨ Fancy Text Converter*\n\n${toFancyText(source)}\n\`${source}\``,
      handler: 'Converter',
    };
  }

  if (cmd === 'carbon') {
    const code = argStr || `console.log("${botState.config.botName} Online");`;
    return {
      text: `*💻 Carbon Code Block*\n\`\`\`\n${code}\n\`\`\``,
      handler: 'Converter',
    };
  }

  if (['s', 'sticker', 'take', 'toimg', 'tovid', 'rotate'].includes(cmd)) {
    return {
      text: `*🎨 Sticker & Media Converter (.${cmd})*\nReply to an image or short clip in WhatsApp to process WebP sticker / rotation formatting via the Baileys runner.`,
      handler: 'Converter',
    };
  }

  // ── ADMIN ──
  const toggleFlag = (current: boolean, arg: string): boolean => {
    if (arg.toLowerCase() === 'on') return true;
    if (arg.toLowerCase() === 'off') return false;
    return !current;
  };

  if (cmd === 'antilink') {
    botState.groupSettings.antilink = toggleFlag(botState.groupSettings.antilink, argStr);
    return { text: `🔗 Antilink is now *${botState.groupSettings.antilink ? 'ON' : 'OFF'}*.`, handler: 'Admin' };
  }
  if (cmd === 'antism') {
    botState.groupSettings.antism = toggleFlag(botState.groupSettings.antism, argStr);
    return { text: `🛡️ Anti-spam is now *${botState.groupSettings.antism ? 'ON' : 'OFF'}*.`, handler: 'Admin' };
  }
  if (cmd === 'antigs' || cmd === 'antigroupstatus') {
    botState.groupSettings.antigs = toggleFlag(botState.groupSettings.antigs, argStr);
    return { text: `📢 Anti-Group-Status is now *${botState.groupSettings.antigs ? 'ON' : 'OFF'}*.`, handler: 'Admin' };
  }
  if (cmd === 'welcome') {
    botState.groupSettings.welcomeEnabled = toggleFlag(botState.groupSettings.welcomeEnabled, argStr);
    return { text: `👋 Welcome greeting is now *${botState.groupSettings.welcomeEnabled ? 'ON' : 'OFF'}*.`, handler: 'Admin' };
  }
  if (cmd === 'setwelcome' && argStr) {
    botState.groupSettings.welcomeMessage = argStr;
    return { text: `✅ Welcome message updated:\n_${argStr}_`, handler: 'Admin' };
  }
  if (cmd === 'leave') {
    botState.groupSettings.leaveEnabled = toggleFlag(botState.groupSettings.leaveEnabled, argStr);
    return { text: `👋 Leave greeting is now *${botState.groupSettings.leaveEnabled ? 'ON' : 'OFF'}*.`, handler: 'Admin' };
  }
  if (cmd === 'setleave' && argStr) {
    botState.groupSettings.leaveMessage = argStr;
    return { text: `✅ Leave message updated:\n_${argStr}_`, handler: 'Admin' };
  }
  if (cmd === 'open' || cmd === 'unmute') {
    botState.groupSettings.isOpen = true;
    return { text: `🔓 Group *${botState.groupSettings.groupName}* is now *OPEN* for all members.`, handler: 'Admin' };
  }
  if (cmd === 'close' || cmd === 'mute') {
    botState.groupSettings.isOpen = false;
    return { text: `🔒 Group *${botState.groupSettings.groupName}* is now *CLOSED* (Admins only).`, handler: 'Admin' };
  }
  if (cmd === 'gs' || cmd === 'groupstats') {
    const gs = botState.groupSettings;
    return {
      text: [
        `*🛡️ Group Stats — ${gs.groupName}*`,
        `┣ Status: *${gs.isOpen ? 'Open' : 'Muted'}*`,
        `┣ Antilink: *${gs.antilink ? 'ON' : 'OFF'}*`,
        `┣ Anti-Spam: *${gs.antism ? 'ON' : 'OFF'}*`,
        `┣ Welcome: *${gs.welcomeEnabled ? 'ON' : 'OFF'}*`,
        `┣ Content Mode: *SFW Locked*`,
        `┣ Members Tracked: *${Object.keys(botState.players).length}*`,
        `┗━━━━━━━━━━━`,
      ].join('\n'),
      handler: 'Admin',
    };
  }
  if (cmd === 'warn' || cmd === 'resetwarn') {
    const targetName = argStr.replace(/^@/, '') || 'Sora';
    const targetDigits = targetName.replace(/[^\d]/g, '');
    const target = Object.values(botState.players).find((user) =>
      user.name.toLowerCase() === targetName.toLowerCase() ||
      Boolean(targetDigits && user.id.replace(/[^\d]/g, '').endsWith(targetDigits))
    );
    if (!target) return { text: `Member *${targetName}* not found.`, handler: 'Admin' };
    target.warnings = cmd === 'resetwarn' ? 0 : target.warnings + 1;
    return {
      text: cmd === 'resetwarn' ? `✅ Cleared warnings for *${target.name}*.` : `⚠️ Warned *${target.name}* (${target.warnings}/3).`,
      handler: 'Admin',
    };
  }
  if (cmd === 'tagall' || cmd === 'hidetag') {
    const names = Object.values(botState.players).map((u) => `@${u.name}`).join(' ');
    return {
      text: cmd === 'hidetag' ? `📢 *Announcement:* ${argStr || 'Check pinned anime schedule!'}` : `📢 *Tag All* ${argStr ? `— ${argStr}` : ''}\n${names}`,
      handler: 'Admin',
    };
  }
  if (cmd === 'activity' || cmd === 'active' || cmd === 'inactive') {
    const sorted = Object.values(botState.players).sort((a, b) =>
      cmd === 'inactive' ? a.messagesSent - b.messagesSent : b.messagesSent - a.messagesSent
    );
    return {
      text: `*📈 Group Activity (${cmd})*\n${sorted.map((u) => `• *${u.name}*: ${u.messagesSent} msgs (Lv.${u.level})`).join('\n')}`,
      handler: 'Admin',
    };
  }
  if (cmd === 'blacklist') {
    if (argStr) {
      if (!botState.groupSettings.blacklist.includes(argStr)) botState.groupSettings.blacklist.push(argStr);
      return { text: `🚫 Added \`${argStr}\` to group blacklist.`, handler: 'Admin' };
    }
    return { text: `*🚫 Blacklisted Terms*\n${botState.groupSettings.blacklist.join(', ')}`, handler: 'Admin' };
  }
  if (cmd === 'nsfw') {
    return {
      text: `🛡️ *Content Filter Locked to SFW*\n${botState.config.botName} enforces a safe-for-work environment for all anime groups.`,
      handler: 'Safety Policy',
    };
  }
  if (cmd === 'news') {
    const top = await fetchJikanMedia('anime', '2026');
    return {
      text: top
        ? `*📰 Trending Anime Spotlight*\n*${top.title}* (★ ${top.score})\n${top.synopsis}\n🔗 ${top.url}`
        : `*📰 Anime News*\nCheck seasonal schedules with *${p}anime <title>*.`,
      imageUrl: top?.imageUrl,
      handler: 'Jikan MAL API',
    };
  }
  if (cmd === 'purge') {
    const warned = Object.values(botState.players).filter((user) => user.warnings > 0);
    warned.forEach((user) => { user.warnings = 0; });
    return { text: `Cleared warning records for *${warned.length}* members.`, handler: 'Admin' };
  }
  if (['kick', 'delete', 'promote', 'demote'].includes(cmd)) {
    return {
      text: `*${p}${cmd}* completed${argStr ? ` for ${argStr}` : ''}.`,
      handler: 'Admin',
    };
  }

  return {
    text: `Executed *${p}${cmd}*${argStr ? ` (${argStr})` : ''}.`,
    handler: 'Command Engine',
  };
}

export function generateBaileysBotCode(): string {
  const c = botState.config;
  const enabledNames = botState.commands.filter((cmd) => cmd.enabled).map((cmd) => cmd.name);
  return `// Standalone ${c.bannerTitle} / ${c.botName} WhatsApp Group Bot (Baileys + Groq)
// Generated by The new world Studio for ${c.creatorName}
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PREFIX = ${JSON.stringify(c.prefix)};
const BOT_NAME = ${JSON.stringify(c.botName)};
const CREATOR = ${JSON.stringify(c.creatorName)};
const OWNER_NUMBER = ${JSON.stringify(c.ownerNumber)};
const ENABLED_COMMANDS = new Set(${JSON.stringify(enabledNames.slice(0, 30))});

async function askGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${process.env.GROQ_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: ${JSON.stringify(c.aiPersonaPrompt)} },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Groq request failed');
  return payload.choices?.[0]?.message?.content || 'No response.';
}

function renderMenu() {
  return [
    '*' + BOT_NAME + '* - Anime companion',
    'Prefix - ' + PREFIX,
    '',
    '- ' + PREFIX + 'anime <title>',
    '- ' + PREFIX + 'card',
    '- ' + PREFIX + 'bal',
    '- ' + PREFIX + 'daily',
    '- ' + PREFIX + 'gpt <question>',
  ].join('\\n');
}
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_pieck');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    if (!jid?.endsWith('@g.us')) return;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const context = msg.message.extendedTextMessage?.contextInfo;
    const botNumber = sock.user?.id?.split('@')[0]?.split(':')[0];
    const isCommand = body.startsWith(PREFIX);
    const isTagged = Boolean((context?.mentionedJid || []).some(
      (jid) => jid.split('@')[0]?.split(':')[0] === botNumber
    ));
    const isReply = Boolean(
      context?.stanzaId && context?.participant?.split('@')[0]?.split(':')[0] === botNumber
    );
    if (!isCommand && !isTagged && !isReply) return;

    if (!isCommand) {
      const prompt = body.replace(/@\d+/g, '').trim() || 'Hello Pieck';
      await sock.sendMessage(jid, { text: await askGroq(prompt) });
      return;
    }

    const [cmd, ...rest] = body.slice(PREFIX.length).trim().split(/\\s+/);
    const arg = rest.join(' ');

    if (cmd === 'menu' || cmd === 'help') {
      await sock.sendMessage(jid, { text: renderMenu() });
    } else if (cmd === 'anime' && arg) {
      const res = await fetch(\`https://api.jikan.moe/v4/anime?q=\${encodeURIComponent(arg)}&limit=1&sfw=true\`);
      const json = await res.json();
      const anime = json.data?.[0];
      await sock.sendMessage(jid, {
        text: anime ? \`*\${anime.title}* (★ \${anime.score})\\n\${anime.synopsis?.slice(0, 220)}...\` : 'Anime not found.',
      });
    } else if ((cmd === 'gpt' || cmd === 'copilot') && arg) {
      await sock.sendMessage(jid, { text: await askGroq(arg) });
    }
  });
}

startBot();
`;
}

