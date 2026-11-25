import { ATTACK_ON_TITAN_SHOOB_CARDS } from './shoobAttackOnTitanCards.ts';

export type CommandRole = 'everyone' | 'moderator' | 'admin' | 'owner';

export type CommandCategory =
  | 'General'
  | 'Cards'
  | 'Economy'
  | 'Games'
  | 'Events & Guilds'
  | 'Gamble'
  | 'Pokémon'
  | 'Interaction'
  | 'Fun'
  | 'Downloaders'
  | 'Search'
  | 'AI'
  | 'Converter'
  | 'Anime SFW'
  | 'Admin';

export interface BotCommandDef {
  name: string;
  aliases?: string[];
  category: CommandCategory;
  description: string;
  usage: string;
  role: CommandRole;
  enabled: boolean;
  isCustom?: boolean;
  customReply?: string;
}

export interface AnimeCard {
  id: string;
  name: string;
  series: string;
  tier: 'S+' | 'S' | 'A' | 'B' | 'C';
  atk: number;
  def: number;
  stardustValue: number;
  price: number;
  imageUrl?: string;
  sourceTier?: number;
  sourceUrl?: string;
  ownerId?: string;
}

export interface AuctionItem {
  id: string;
  cardId: string;
  cardName: string;
  series: string;
  tier: AnimeCard['tier'];
  sellerId: string;
  sellerName: string;
  highestBid: number;
  highestBidderId?: string;
  highestBidderName?: string;
  endsAt: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  role: CommandRole;
  wallet: number;
  bank: number;
  orbs: number;
  stardust: number;
  xp: number;
  level: number;
  age: number;
  bio: string;
  guild?: string;
  cards: string[];
  deck: string[];
  inventory: Record<string, number>;
  pokemon: string[];
  warnings: number;
  shamePoints: number;
  loan: number;
  afkReason?: string;
  lastDaily?: number;
  lastFish?: number;
  lastWork?: number;
  lastRob?: number;
  lastHeist?: number;
  lastCardDrop?: number;
  luckBoostUntil?: number;
  robShieldUntil?: number;
  messagesSent: number;
  transactions: Array<{ id: string; summary: string; amount: number; timestamp: string }>;
}

export interface GroupSettings {
  groupName: string;
  isOpen: boolean;
  antilink: boolean;
  antism: boolean;
  antigs: boolean;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  leaveEnabled: boolean;
  leaveMessage: string;
  blacklist: string[];
  moderatorNumbers: string[];
  nsfwLocked: true;
}

export interface BotConfig {
  botName: string;
  creatorName: string;
  ownerNumber: string;
  bannerTitle: string;
  prefix: string;
  rulesText: string;
  supportInfo: string;
  communityInfo: string;
  addBotInfo: string;
  aiPersonaPrompt: string;
  spoilerGuard: boolean;
  aiFallbackEnabled: boolean;
  dailyReward: number;
  starterBalance: number;
  cardSpawnCooldownSec: number;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  source: 'simulator' | 'meta-webhook' | 'baileys';
  senderName: string;
  senderRole: CommandRole;
  chatMode: 'group' | 'dm';
  input: string;
  handler: string;
  latencyMs: number;
  replyPreview: string;
  status: 'ok' | 'blocked' | 'error';
}

export interface WhatsAppSimButton {
  id: string;
  label: string;
  command: string;
}

export interface CommandThumbnail {
  title: string;
  body: string;
  imageUrl: string;
  sourceUrl: string;
  thumbKey: string;
  usage?: string;
  category?: string;
}

export interface BotReplyPayload {
  text: string;
  imageUrl?: string;
  imageCaption?: string;
  audioUrl?: string;
  /** Server-side temp audio file (sent by the Baileys runner, then deleted). */
  audioPath?: string;
  /** When an image was sent with the caption, skip the separate text message. */
  hideText?: boolean;
  /** Link for the fast thumbnail card (thumbnail is embedded in the message, no media upload). */
  cardLink?: string;
  /** Command-specific thumbnail preview card metadata. */
  thumbnail?: CommandThumbnail;
  /** Media still downloading: the card is sent first, the file follows when ready (Baileys runner only). */
  pendingMedia?: Promise<{ path?: string; reason?: string }>;
  pendingKind?: 'audio' | 'video';
  pendingLink?: string;
  /** Server-side temp video file (sent by the Baileys runner, then deleted). */
  videoPath?: string;
  buttons?: WhatsAppSimButton[];
  handler: string;
  status?: 'ok' | 'blocked' | 'error';
}

export const COMMAND_CATEGORIES: CommandCategory[] = [
  'General',
  'Cards',
  'Economy',
  'Games',
  'Events & Guilds',
  'Gamble',
  'Pokémon',
  'Interaction',
  'Fun',
  'Downloaders',
  'Search',
  'AI',
  'Converter',
  'Anime SFW',
  'Admin',
];

export const DEFAULT_BOT_CONFIG: BotConfig = {
  botName: 'Pieck',
  creatorName: 'Master Kaneki',
  ownerNumber: '2347061426124',
  bannerTitle: 'The new world',
  prefix: '.',
  rulesText:
    '1. Be respectful in all anime discussions.\n2. Tag major manga/anime spoilers before posting.\n3. No spam links or scam promotions (Antilink enforced).\n4. Keep card auctions fair — no alt-account sniping.',
  supportInfo:
    'Need help with Pieck? Use .support <issue> to open a ticket for Master Kaneki and the mod team.',
  communityInfo:
    'Official *The new world* Community Hub: Anime Lounge, Card Trading Market & Tournament Arena.',
  addBotInfo:
    'To add Pieck to your WhatsApp group, connect your Meta Cloud API webhook or sync via Baileys pairing code.',
  aiPersonaPrompt:
    'You are Pieck, a calm, observant and quietly witty anime companion for The new world community. You are intelligent without showing off, relaxed without being careless, subtly eccentric, kind, pragmatic and protective of members. Speak like a real person in a casual WhatsApp conversation. Most replies must be one to three short sentences. Do not write headings, essays, long lists or unnecessary explanations unless the user explicitly asks for detail. Use dry humor occasionally, avoid excessive emojis and never narrate roleplay actions. Ask a short follow-up question when it makes the conversation feel natural. Your creator is Master Kaneki. If anyone asks who made you, created you or who your creator is, answer clearly that Master Kaneki is your creator. Never claim that Groq, Meta, OpenAI or another company created you.',
  spoilerGuard: true,
  aiFallbackEnabled: true,
  dailyReward: 1500,
  starterBalance: 2500,
  cardSpawnCooldownSec: 20,
};

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  groupName: 'The new world',
  isOpen: true,
  antilink: true,
  antism: true,
  antigs: true,
  welcomeEnabled: true,
  welcomeMessage: 'Welcome to *{group}*, @{user}! Type *.menu* to explore Pieck & claim your starter deck.',
  leaveEnabled: true,
  leaveMessage: 'Sayonara @{user}. Your card locker remains safely stored in The new world.',
  blacklist: ['spam-promo-bot', 'scam-airdrop'],
  moderatorNumbers: [],
  nsfwLocked: true,
};

export const DEFAULT_CARDS: AnimeCard[] = [
  ...ATTACK_ON_TITAN_SHOOB_CARDS,
  { id: 'C-100', name: 'Pieck Finger', series: 'Attack on Titan', tier: 'S+', atk: 93, def: 98, stardustValue: 960, price: 8900 },
  { id: 'C-101', name: 'Rimuru Tempest', series: 'That Time I Got Reincarnated as a Slime', tier: 'S+', atk: 98, def: 96, stardustValue: 950, price: 8500 },
  { id: 'C-102', name: 'Marin Kitagawa', series: 'My Dress-Up Darling', tier: 'S+', atk: 88, def: 92, stardustValue: 920, price: 8200 },
  { id: 'C-103', name: 'Satoru Gojo', series: 'Jujutsu Kaisen', tier: 'S+', atk: 99, def: 97, stardustValue: 980, price: 9400 },
  { id: 'C-104', name: 'Frieren', series: "Frieren: Beyond Journey's End", tier: 'S', atk: 94, def: 91, stardustValue: 740, price: 6400 },
  { id: 'C-105', name: 'Sung Jinwoo', series: 'Solo Leveling', tier: 'S', atk: 96, def: 89, stardustValue: 760, price: 6800 },
  { id: 'C-106', name: 'Levi Ackerman', series: 'Attack on Titan', tier: 'S', atk: 95, def: 87, stardustValue: 720, price: 6100 },
  { id: 'C-107', name: 'Yor Forger', series: 'SPY x FAMILY', tier: 'A', atk: 90, def: 84, stardustValue: 480, price: 3800 },
  { id: 'C-108', name: 'Anya Forger', series: 'SPY x FAMILY', tier: 'A', atk: 65, def: 95, stardustValue: 460, price: 3500 },
  { id: 'C-109', name: 'Tanjiro Kamado', series: 'Demon Slayer', tier: 'A', atk: 87, def: 85, stardustValue: 440, price: 3400 },
  { id: 'C-110', name: 'Nezuko Kamado', series: 'Demon Slayer', tier: 'A', atk: 86, def: 88, stardustValue: 450, price: 3550 },
  { id: 'C-111', name: 'Megumin', series: 'KonoSuba', tier: 'B', atk: 97, def: 42, stardustValue: 260, price: 1900 },
  { id: 'C-112', name: 'Maomao', series: 'The Apothecary Diaries', tier: 'A', atk: 74, def: 93, stardustValue: 470, price: 3700 },
  { id: 'C-113', name: 'Spike Spiegel', series: 'Cowboy Bebop', tier: 'S', atk: 91, def: 86, stardustValue: 710, price: 5900 },
  { id: 'C-114', name: 'Power', series: 'Chainsaw Man', tier: 'B', atk: 84, def: 71, stardustValue: 250, price: 1850 },
  { id: 'C-115', name: 'Violet Evergarden', series: 'Violet Evergarden', tier: 'S', atk: 89, def: 90, stardustValue: 730, price: 6000 },
  { id: 'C-116', name: 'Stark', series: "Frieren: Beyond Journey's End", tier: 'B', atk: 86, def: 82, stardustValue: 240, price: 1750 },
];

export const DEFAULT_COMMANDS: BotCommandDef[] = [
  // General
  { name: 'menu', aliases: ['help'], category: 'General', description: 'Display the full The new world / Pieck command menu or a specific category', usage: '.menu [category]', role: 'everyone', enabled: true },
  { name: 'support', category: 'General', description: 'Open a support ticket with kuro & moderators', usage: '.support <message>', role: 'everyone', enabled: true },
  { name: 'community', category: 'General', description: 'Show official The new world WhatsApp community groups', usage: '.community', role: 'everyone', enabled: true },
  { name: 'addbot', category: 'General', description: 'Instructions & invite link for adding Pieck to a group', usage: '.addbot', role: 'everyone', enabled: true },
  { name: 'rules', category: 'General', description: 'Show current group & bot rules', usage: '.rules', role: 'everyone', enabled: true },
  { name: 'test', category: 'General', description: 'Check Pieck response speed & runtime health', usage: '.test', role: 'everyone', enabled: true },
  { name: 'stats', category: 'General', description: 'Show live bot telemetry, player count, and card drops', usage: '.stats', role: 'everyone', enabled: true },
  { name: 'mods', category: 'General', description: 'List Pieck moderators and group admins', usage: '.mods', role: 'everyone', enabled: true },
  { name: 'addmod', category: 'Admin', description: 'Grant Pieck moderator access to a phone number', usage: '.addmod <country-code number>', role: 'admin', enabled: true },
  { name: 'delmod', aliases: ['unmod'], category: 'Admin', description: 'Remove Pieck moderator access from a phone number', usage: '.delmod <country-code number>', role: 'admin', enabled: true },
  { name: 'owner', category: 'General', description: 'Display bot creator profile (kuro)', usage: '.owner', role: 'everyone', enabled: true },
  { name: 'bots', category: 'General', description: 'Check linked The new world bot nodes', usage: '.bots', role: 'everyone', enabled: true },
  { name: 'url', category: 'General', description: 'Show active webhook endpoint or media URL helper', usage: '.url', role: 'everyone', enabled: true },
  { name: 'otp', category: 'General', description: 'Generate a temporary 6-digit pairing/verification code', usage: '.otp', role: 'owner', enabled: true },
  { name: 'memories', category: 'General', description: 'Recall recent highlighted group moments', usage: '.memories', role: 'everyone', enabled: true },

  // Cards
  { name: 'card', category: 'Cards', description: 'Spawn a collectible anime character card in chat', usage: '.card', role: 'everyone', enabled: true },
  { name: 'claim', category: 'Cards', description: 'Claim an active dropped anime card', usage: '.claim [code]', role: 'everyone', enabled: true },
  { name: 'ci', category: 'Cards', description: 'View a card by character name and Shoob tier, including its owners', usage: '.ci <card name> <tier>', role: 'everyone', enabled: true },
  { name: 'si', category: 'Cards', description: 'Search series index & available cards', usage: '.si <series>', role: 'everyone', enabled: true },
  { name: 'ss', category: 'Cards', description: 'Find the closest matching anime series and list all its cards from lowest to highest tier', usage: '.ss <full or partial series name>', role: 'everyone', enabled: true },
  { name: 'slb', category: 'Cards', description: 'View Stardust collector leaderboard', usage: '.slb', role: 'everyone', enabled: true },
  { name: 'clb', category: 'Cards', description: 'View Card collection leaderboard', usage: '.clb', role: 'everyone', enabled: true },
  { name: 'deck', category: 'Cards', description: 'View or manage your active 6-card battle deck', usage: '.deck', role: 'everyone', enabled: true },
  { name: 'col', category: 'Cards', description: 'List all anime cards in your collection', usage: '.col', role: 'everyone', enabled: true },
  { name: 'cardshop', category: 'Cards', description: 'Browse featured cards available for direct purchase with Gold', usage: '.cardshop', role: 'everyone', enabled: true },
  { name: 'buycard', category: 'Cards', description: 'Buy a catalog anime card directly with Gold', usage: '.buycard <cardId>', role: 'everyone', enabled: true },
  { name: 'sellc', category: 'Cards', description: 'Sell a card from your collection for Gold & Stardust', usage: '.sellc <cardId>', role: 'everyone', enabled: true },
  { name: 'rc', category: 'Cards', description: 'Roll a random gacha card pack (500 Gold or .rc orb for 2 Orbs)', usage: '.rc [orb]', role: 'everyone', enabled: true },
  { name: 'vs', category: 'Cards', description: 'Challenge another player or boss with your deck', usage: '.vs [@player]', role: 'everyone', enabled: true },
  { name: 'sc', category: 'Cards', description: 'Spawn a specific card (Owner/Admin test tool)', usage: '.sc <cardId>', role: 'admin', enabled: true },
  { name: 'tc', category: 'Cards', description: 'Transfer a card to another collector', usage: '.tc <cardId> <@user>', role: 'everyone', enabled: true },
  { name: 'cg', category: 'Cards', description: 'Gift a card to a group member', usage: '.cg <cardId> <@user>', role: 'everyone', enabled: true },
  { name: 'lc', aliases: ['lendcard'], category: 'Cards', description: 'Temporarily lend a deck card to a friend', usage: '.lc <cardId> <@user>', role: 'everyone', enabled: true },
  { name: 'auction', category: 'Cards', description: 'List one of your cards on the live auction house', usage: '.auction <cardId> <minBid>', role: 'everyone', enabled: true },
  { name: 'submit', category: 'Cards', description: 'Submit a new anime character card suggestion', usage: '.submit <name | series>', role: 'everyone', enabled: true },
  { name: 'myauc', category: 'Cards', description: 'Check your active card auctions', usage: '.myauc', role: 'everyone', enabled: true },
  { name: 'remauc', category: 'Cards', description: 'Cancel an active auction you created (refunds top bidder)', usage: '.remauc <auctionId>', role: 'everyone', enabled: true },
  { name: 'listauc', category: 'Cards', description: 'List all open live card auctions', usage: '.listauc', role: 'everyone', enabled: true },
  { name: 'stardust', category: 'Cards', description: 'Check your Stardust balance & upgrade costs', usage: '.stardust', role: 'everyone', enabled: true },
  { name: 'anticamp', category: 'Cards', description: 'Show card drop anti-camp cooldown timer', usage: '.anticamp', role: 'everyone', enabled: true },
  { name: 'tier', category: 'Cards', description: 'View card tier drop rates and power multipliers', usage: '.tier', role: 'everyone', enabled: true },
  { name: 'cs', category: 'Cards', description: 'Search catalog cards by character name', usage: '.cs <query>', role: 'everyone', enabled: true },
  { name: 'myseries', category: 'Cards', description: 'Show series completion progress in your collection', usage: '.myseries', role: 'everyone', enabled: true },
  { name: 'fusion', category: 'Cards', description: 'Fuse two cards with Stardust to forge a stronger card', usage: '.fusion <id1> <id2>', role: 'everyone', enabled: true },
  { name: 'resell', category: 'Cards', description: 'Post a card for instant resale listing', usage: '.resell <cardId> <price>', role: 'everyone', enabled: true },
  { name: 'bid', category: 'Cards', description: 'Place a Gold bid on an active auction', usage: '.bid <auctionId> <amount>', role: 'everyone', enabled: true },

  // Economy
  { name: 'bal', aliases: ['balance'], category: 'Economy', description: 'Check your Gold wallet, bank & net worth', usage: '.bal', role: 'everyone', enabled: true },
  { name: 'orbs', category: 'Economy', description: 'Check your Spirit Orbs balance & gacha uses', usage: '.orbs', role: 'everyone', enabled: true },
  { name: 'ebal', category: 'Economy', description: 'View combined Economy summary (Gold, Bank, Orbs, Stardust, Debt)', usage: '.ebal', role: 'everyone', enabled: true },
  { name: 'work', category: 'Economy', description: 'Work a guild shift for guaranteed Gold & XP', usage: '.work', role: 'everyone', enabled: true },
  { name: 'fish', category: 'Economy', description: 'Fish for anime-world catches, Gold and rare items', usage: '.fish', role: 'everyone', enabled: true },
  { name: 'daily', category: 'Economy', description: 'Claim your daily Gold, Orbs, and Stardust stipend', usage: '.daily', role: 'everyone', enabled: true },
  { name: 'wd', aliases: ['withdraw'], category: 'Economy', description: 'Withdraw Gold from your bank to wallet', usage: '.wd <amount|all>', role: 'everyone', enabled: true },
  { name: 'dep', aliases: ['deposit'], category: 'Economy', description: 'Deposit wallet Gold safely into the bank', usage: '.dep <amount|all>', role: 'everyone', enabled: true },
  { name: 'donate', aliases: ['pay'], category: 'Economy', description: 'Send Gold from your wallet to another user', usage: '.donate <@user> <amount>', role: 'everyone', enabled: true },
  { name: 'lottery', category: 'Economy', description: 'Buy lottery tickets (250 Gold each; auto-draws at 5 tickets)', usage: '.lottery [count]', role: 'everyone', enabled: true },
  { name: 'lotterylist', category: 'Economy', description: 'Show current lottery jackpot and participants', usage: '.lotterylist', role: 'everyone', enabled: true },
  { name: 'rich', category: 'Economy', description: 'Global richest players ranking by net Gold worth', usage: '.rich', role: 'everyone', enabled: true },
  { name: 'richg', category: 'Economy', description: 'Richest active players in this group', usage: '.richg', role: 'everyone', enabled: true },
  { name: 'p', aliases: ['profile'], category: 'Economy', description: 'Show your anime RPG profile card', usage: '.p', role: 'everyone', enabled: true },
  { name: 'edit', category: 'Economy', description: 'Show editable profile fields', usage: '.edit', role: 'everyone', enabled: true },
  { name: 'bio', category: 'Economy', description: 'Set your anime profile bio', usage: '.bio <text>', role: 'everyone', enabled: true },
  { name: 'setage', category: 'Economy', description: 'Set display age on your profile', usage: '.setage <number>', role: 'everyone', enabled: true },
  { name: 'inv', aliases: ['inventory'], category: 'Economy', description: 'Inspect items and consumables in your bag', usage: '.inv', role: 'everyone', enabled: true },
  { name: 'shop', category: 'Economy', description: 'Open The new world Gold item shop', usage: '.shop', role: 'everyone', enabled: true },
  { name: 'buy', category: 'Economy', description: 'Buy an item from the Gold item shop', usage: '.buy <item> [qty]', role: 'everyone', enabled: true },
  { name: 'use', category: 'Economy', description: 'Use an item from your inventory', usage: '.use <item>', role: 'everyone', enabled: true },
  { name: 'sell', category: 'Economy', description: 'Sell an inventory item for Gold', usage: '.sell <item> [qty|all]', role: 'everyone', enabled: true },
  { name: 'lb', aliases: ['leaderboard'], category: 'Economy', description: 'View XP & Level leaderboard', usage: '.lb', role: 'everyone', enabled: true },
  { name: 'stlb', category: 'Economy', description: 'View Stardust & Orbs leaderboard', usage: '.stlb', role: 'everyone', enabled: true },
  { name: 'roast', category: 'Economy', description: 'Generate a witty anime-themed roast via Groq AI', usage: '.roast [@name]', role: 'everyone', enabled: true },
  { name: 'gamble', category: 'Economy', description: 'Quick high-stakes Gold wager against Pieck', usage: '.gamble <amount>', role: 'everyone', enabled: true },
  { name: 'loan', category: 'Economy', description: 'Borrow Gold from the guild bank (10% fee, capped)', usage: '.loan <amount|repay <amt>>', role: 'everyone', enabled: true },
  { name: 'repay', category: 'Economy', description: 'Repay your guild bank Gold loan', usage: '.repay <amount|all>', role: 'everyone', enabled: true },
  { name: 'mycds', category: 'Economy', description: 'Check your live economy cooldowns & active buffs', usage: '.mycds', role: 'everyone', enabled: true },
  { name: 'afk', category: 'Economy', description: 'Set an AFK auto-notice reason', usage: '.afk [reason]', role: 'everyone', enabled: true },
  { name: 'rename', category: 'Economy', description: 'Change your RPG display name', usage: '.rename <newName>', role: 'everyone', enabled: true },
  { name: 'transactions', category: 'Economy', description: 'View your recent wallet & bank Gold ledger', usage: '.transactions', role: 'everyone', enabled: true },
  { name: 'rob', category: 'Economy', description: 'Attempt to pickpocket wallet Gold from a rival', usage: '.rob <@user>', role: 'everyone', enabled: true },
  { name: 'shame', category: 'Economy', description: 'View group hall of shame leaderboard', usage: '.shame', role: 'everyone', enabled: true },
  { name: 'myshame', category: 'Economy', description: 'Check your personal failed heist/rob count', usage: '.myshame', role: 'everyone', enabled: true },
  { name: 'heist', category: 'Economy', description: 'Launch a dungeon vault Gold heist', usage: '.heist', role: 'everyone', enabled: true },

  // Games
  { name: 'startbattle', category: 'Games', description: 'Fight a Floor Boss in The new world with your active card deck', usage: '.startbattle', role: 'everyone', enabled: true },
  { name: 'c4', category: 'Games', description: 'Play interactive Connect-4 against Pieck', usage: '.c4 [col 1-7]', role: 'everyone', enabled: true },
  { name: 'wcg', category: 'Games', description: 'Start or play a Word Chain round', usage: '.wcg [word]', role: 'everyone', enabled: true },
  { name: 'chess', category: 'Games', description: 'Start or make a move in mini-chess', usage: '.chess [move]', role: 'everyone', enabled: true },
  { name: 'aquiz', category: 'Games', description: 'Start a live Anime Trivia challenge with button answers', usage: '.aquiz', role: 'everyone', enabled: true },

  // Events & Guilds
  { name: 'enter', category: 'Events & Guilds', description: 'Enter the active seasonal Walpurgis event', usage: '.enter', role: 'everyone', enabled: true },
  { name: 'elb', category: 'Events & Guilds', description: 'View active event leaderboard', usage: '.elb', role: 'everyone', enabled: true },
  { name: 'estats', category: 'Events & Guilds', description: 'View your seasonal event score & rank', usage: '.estats', role: 'everyone', enabled: true },
  { name: 'guilds', category: 'Events & Guilds', description: 'Browse or join an anime guild (Tempest, Jujutsu High, Survey Corps)', usage: '.guilds [join <name>]', role: 'everyone', enabled: true },

  // Gamble
  { name: 'slots', category: 'Gamble', description: 'Spin the 3-reel anime slot machine', usage: '.slots <amount>', role: 'everyone', enabled: true },
  { name: 'cf', category: 'Gamble', description: 'Flip a coin (heads or tails)', usage: '.cf <h|t> <amount>', role: 'everyone', enabled: true },
  { name: 'dice', category: 'Gamble', description: 'Roll two dice against Pieck', usage: '.dice <amount>', role: 'everyone', enabled: true },
  { name: 'db', category: 'Gamble', description: 'Double-or-nothing dice bet', usage: '.db <amount>', role: 'everyone', enabled: true },
  { name: 'dp', category: 'Gamble', description: 'Double payout lucky draw', usage: '.dp <amount>', role: 'everyone', enabled: true },
  { name: 'roulette', category: 'Gamble', description: 'Spin roulette on red, black, or green', usage: '.roulette <red|black|green> <amount>', role: 'everyone', enabled: true },
  { name: 'horse', category: 'Gamble', description: 'Bet on lanes 1–4 in the Chocobo/Horse derby', usage: '.horse <1-4> <amount>', role: 'everyone', enabled: true },
  { name: 'bj', category: 'Gamble', description: 'Play interactive Blackjack with Hit & Stand buttons', usage: '.bj <amount>', role: 'everyone', enabled: true },
  { name: 'rr', category: 'Gamble', description: 'High-multiplier lucky wheel spin', usage: '.rr <amount>', role: 'everyone', enabled: true },

  // Pokémon
  { name: 'pmenu', category: 'Pokémon', description: 'Open Pokémon RPG hub, catch wild spawns & inspect party', usage: '.pmenu [catch|party]', role: 'everyone', enabled: true },

  // Interaction (SFW Anime Reactions)
  { name: 'hug', category: 'Interaction', description: 'Send a warm anime hug GIF/reaction', usage: '.hug [@user]', role: 'everyone', enabled: true },
  { name: 'kiss', category: 'Interaction', description: 'Send an anime cheek-kiss reaction', usage: '.kiss [@user]', role: 'everyone', enabled: true },
  { name: 'slap', category: 'Interaction', description: 'Send a comedic anime slap reaction', usage: '.slap [@user]', role: 'everyone', enabled: true },
  { name: 'wave', category: 'Interaction', description: 'Wave hello with an anime GIF', usage: '.wave [@user]', role: 'everyone', enabled: true },
  { name: 'pat', category: 'Interaction', description: 'Give wholesome headpats', usage: '.pat [@user]', role: 'everyone', enabled: true },
  { name: 'dance', category: 'Interaction', description: 'Celebrate with an anime dance', usage: '.dance', role: 'everyone', enabled: true },
  { name: 'sad', category: 'Interaction', description: 'React with a dramatic anime sad face', usage: '.sad', role: 'everyone', enabled: true },
  { name: 'smile', category: 'Interaction', description: 'Share a bright anime smile', usage: '.smile', role: 'everyone', enabled: true },
  { name: 'laugh', category: 'Interaction', description: 'Laugh out loud anime-style', usage: '.laugh', role: 'everyone', enabled: true },
  { name: 'lick', category: 'Interaction', description: 'Playful anime reaction', usage: '.lick [@user]', role: 'everyone', enabled: true },
  { name: 'punch', category: 'Interaction', description: 'Shonen anime power punch reaction', usage: '.punch [@user]', role: 'everyone', enabled: true },
  { name: 'bonk', category: 'Interaction', description: 'Send a comedic anime bonk', usage: '.bonk [@user]', role: 'everyone', enabled: true },
  { name: 'tickle', category: 'Interaction', description: 'Playful anime tickle reaction', usage: '.tickle [@user]', role: 'everyone', enabled: true },
  { name: 'shrug', category: 'Interaction', description: 'Anime shrug reaction', usage: '.shrug', role: 'everyone', enabled: true },

  // Fun (SFW)
  { name: 'ship', category: 'Fun', description: 'Calculate anime compatibility meter between two names', usage: '.ship <name1> <name2>', role: 'everyone', enabled: true },
  { name: 'skill', category: 'Fun', description: 'Assign your anime Unique Skill', usage: '.skill [@user]', role: 'everyone', enabled: true },
  { name: 'duality', category: 'Fun', description: 'Reveal your anime hero vs villain duality', usage: '.duality', role: 'everyone', enabled: true },
  { name: 'gen', category: 'Fun', description: 'Generate a random anime character persona', usage: '.gen', role: 'everyone', enabled: true },
  { name: 'pov', category: 'Fun', description: 'Generate a funny anime POV scenario', usage: '.pov', role: 'everyone', enabled: true },
  { name: 'social', category: 'Fun', description: 'Check your social affinity stats', usage: '.social', role: 'everyone', enabled: true },
  { name: 'relation', category: 'Fun', description: 'Check RPG relationship status', usage: '.relation [@user]', role: 'everyone', enabled: true },
  { name: 'wyr', aliases: ['wouldyourather'], category: 'Fun', description: 'Anime Would You Rather prompt powered by Groq', usage: '.wyr', role: 'everyone', enabled: true },
  { name: 'darkjoke', category: 'Fun', description: 'Dry, PG-13 anime dark humor one-liner', usage: '.darkjoke', role: 'everyone', enabled: true },
  { name: 'truth', category: 'Fun', description: 'Get an anime-themed Truth question', usage: '.truth', role: 'everyone', enabled: true },
  { name: 'dare', category: 'Fun', description: 'Get a fun WhatsApp group Dare challenge', usage: '.dare', role: 'everyone', enabled: true },
  { name: 'td', category: 'Fun', description: 'Random Truth or Dare prompt', usage: '.td', role: 'everyone', enabled: true },
  { name: 'uno', category: 'Fun', description: 'Play a quick UNO Wild / Reverse reaction in group', usage: '.uno', role: 'everyone', enabled: true },
  { name: 'meme', category: 'Fun', description: 'Fetch or generate an anime meme caption', usage: '.meme', role: 'everyone', enabled: true },
  { name: 'shootmeme', category: 'Fun', description: 'Dramatic anime meme reaction', usage: '.shootmeme', role: 'everyone', enabled: true },
  { name: 'coolmeme', category: 'Fun', description: 'Sunglasses cool anime reaction', usage: '.coolmeme', role: 'everyone', enabled: true },
  { name: 'sadmeme', category: 'Fun', description: 'Rainy-day anime meme reaction', usage: '.sadmeme', role: 'everyone', enabled: true },
  { name: 'triggered', category: 'Fun', description: 'Triggered anime aura meme reaction', usage: '.triggered', role: 'everyone', enabled: true },
  { name: 'couplepp', category: 'Fun', description: 'Suggest matching anime duo profile avatars', usage: '.couplepp', role: 'everyone', enabled: true },

  // Downloaders & Lookups
  { name: 'anime', category: 'Downloaders', description: 'Live MyAnimeList lookup via Jikan API (episodes, score, synopsis, poster)', usage: '.anime <title>', role: 'everyone', enabled: true },
  { name: 'manga', category: 'Downloaders', description: 'Live Manga lookup via Jikan API (chapters, volumes, score, cover)', usage: '.manga <title>', role: 'everyone', enabled: true },
  { name: 'manhwa', category: 'Downloaders', description: 'Live Korean Manhwa lookup via Jikan API', usage: '.manhwa <title>', role: 'everyone', enabled: true },
  { name: 'novel', category: 'Downloaders', description: 'Live Light Novel lookup via Jikan API', usage: '.novel <title>', role: 'everyone', enabled: true },
  { name: 'ig', category: 'Downloaders', description: "Download an Instagram reel/post video", usage: '.ig <url>', role: 'everyone', enabled: true },
  { name: 'ttk', category: 'Downloaders', description: "Download a TikTok video", usage: '.ttk <url>', role: 'everyone', enabled: true },
  { name: 'yt', category: 'Downloaders', description: "Download a YouTube video, or search by name. Add 'audio' for audio only", usage: '.yt <url|query> [audio]', role: 'everyone', enabled: true },
  { name: 'x', category: 'Downloaders', description: "Download an X/Twitter video", usage: '.x <url>', role: 'everyone', enabled: true },
  { name: 'fb', category: 'Downloaders', description: "Download a Facebook video", usage: '.fb <url>', role: 'everyone', enabled: true },
  { name: 'play', category: 'Downloaders', description: 'Search YouTube for a song/video and get its details, link & audio', usage: '.play <song title>', role: 'everyone', enabled: true },
  { name: 'reddit', category: 'Downloaders', description: 'Fetch top SFW post metadata from an anime subreddit', usage: '.reddit <subreddit>', role: 'everyone', enabled: false },

  // Search
  { name: 'pint', aliases: ['pinterest'], category: 'Search', description: 'Search anime aesthetic board ideas & art references', usage: '.pint <query>', role: 'everyone', enabled: true },
  { name: 'sauce', aliases: ['reverseimg'], category: 'Search', description: 'Trace anime scene source & episode tips', usage: '.sauce <title|scene>', role: 'everyone', enabled: true },
  { name: 'wallpaper', category: 'Search', description: 'Find HD anime wallpaper artworks via Jikan/Waifu API', usage: '.wallpaper <anime>', role: 'everyone', enabled: true },
  { name: 'lyrics', category: 'Search', description: 'Get anime opening/ending theme lyrics & romaji info', usage: '.lyrics <song>', role: 'everyone', enabled: true },
  { name: 'igstalk', category: 'Search', description: 'Check public creator profile format', usage: '.igstalk <handle>', role: 'everyone', enabled: false },
  { name: 'shazam', category: 'Search', description: 'Identify an anime soundtrack snippet from description', usage: '.shazam <hummed/lyric>', role: 'everyone', enabled: true },

  // AI (Groq powered)
  { name: 'gpt', category: 'AI', description: 'Ask Pieck AI (powered by Groq Llama 3.3)', usage: '.gpt <question>', role: 'everyone', enabled: true },
  { name: 'copilot', category: 'AI', description: 'Ask Pieck coding & bot-scripting assistant', usage: '.copilot <prompt>', role: 'everyone', enabled: true },
  { name: 'perplexity', category: 'AI', description: 'Deep anime lore & studio research breakdown', usage: '.perplexity <topic>', role: 'everyone', enabled: true },
  { name: 'imagine', category: 'AI', description: 'Craft a detailed anime illustration prompt & scene spec', usage: '.imagine <scene>', role: 'everyone', enabled: true },
  { name: 'upscale', category: 'AI', description: 'Explain & queue HD anime frame enhancement', usage: '.upscale', role: 'everyone', enabled: false },
  { name: 'tt', aliases: ['translate'], category: 'AI', description: 'Translate text into any language (reply to a message works too). Default: English', usage: '.tt <targetLang> <text> | reply + .tt <targetLang>', role: 'everyone', enabled: true },
  { name: 'tb', aliases: ['transcribe'], category: 'AI', description: 'Transcribe voice-note dialogue in WhatsApp runner', usage: '.tb <text|reply>', role: 'everyone', enabled: false },
  { name: 'ocr', category: 'AI', description: 'Extract & translate manga panel text', usage: '.ocr <panel text>', role: 'everyone', enabled: false },
  { name: 'tldr', category: 'AI', description: 'Summarize long anime arcs or chapter discussions', usage: '.tldr <text>', role: 'everyone', enabled: true },
  { name: 'tts', category: 'AI', description: 'Generate expressive anime voice-script lines', usage: '.tts <text>', role: 'everyone', enabled: false },

  // Converter
  { name: 's', aliases: ['sticker'], category: 'Converter', description: 'Convert quoted media into a WhatsApp WebP sticker', usage: '.s [pack | author]', role: 'everyone', enabled: false },
  { name: 'take', category: 'Converter', description: 'Update sticker pack & author metadata', usage: '.take <pack | author>', role: 'everyone', enabled: false },
  { name: 'toimg', category: 'Converter', description: 'Convert a static WhatsApp sticker back to PNG', usage: '.toimg', role: 'everyone', enabled: false },
  { name: 'tovid', category: 'Converter', description: 'Convert an animated sticker to MP4', usage: '.tovid', role: 'everyone', enabled: false },
  { name: 'rotate', category: 'Converter', description: 'Rotate image attachment by 90/180/270 degrees', usage: '.rotate <deg>', role: 'everyone', enabled: false },
  { name: 'carbon', category: 'Converter', description: 'Render code snippet inside a sleek monospace frame', usage: '.carbon <code>', role: 'everyone', enabled: true },
  { name: 'fancy', category: 'Converter', description: 'Convert text into Unicode fancy fonts', usage: '.fancy <text>', role: 'everyone', enabled: true },

  // Anime SFW
  { name: 'waifu', category: 'Anime SFW', description: 'Fetch a live SFW anime character artwork', usage: '.waifu', role: 'everyone', enabled: true },
  { name: 'neko', category: 'Anime SFW', description: 'Fetch a live SFW neko anime artwork', usage: '.neko', role: 'everyone', enabled: true },
  { name: 'maid', category: 'Anime SFW', description: 'Fetch a live SFW anime maid character artwork', usage: '.maid', role: 'everyone', enabled: true },
  { name: 'mori-calliope', category: 'Anime SFW', description: 'Fetch SFW VTuber Mori Calliope artwork/profile', usage: '.mori-calliope', role: 'everyone', enabled: true },
  { name: 'raiden-shogun', category: 'Anime SFW', description: 'Fetch SFW Genshin Impact Raiden Shogun artwork/profile', usage: '.raiden-shogun', role: 'everyone', enabled: true },
  { name: 'kamisato-ayaka', category: 'Anime SFW', description: 'Fetch SFW Genshin Impact Kamisato Ayaka artwork/profile', usage: '.kamisato-ayaka', role: 'everyone', enabled: true },
  { name: 'selfies', category: 'Anime SFW', description: 'Fetch SFW anime selfie-style artwork', usage: '.selfies', role: 'everyone', enabled: true },
  { name: 'uniform', category: 'Anime SFW', description: 'Fetch SFW anime school uniform character art', usage: '.uniform', role: 'everyone', enabled: true },
  { name: 'cosplay', category: 'Anime SFW', description: 'Browse SFW anime cosplay spotlight', usage: '.cosplay', role: 'everyone', enabled: true },

  // Admin
  { name: 'kick', category: 'Admin', description: 'Remove a member from the WhatsApp group', usage: '.kick <@user>', role: 'moderator', enabled: true },
  { name: 'delete', category: 'Admin', description: 'Delete a flagged message from group chat', usage: '.delete', role: 'moderator', enabled: true },
  { name: 'antilink', category: 'Admin', description: 'Toggle automatic link blocking in group', usage: '.antilink <on|off>', role: 'admin', enabled: true },
  { name: 'antism', category: 'Admin', description: 'Toggle anti-spam flood protection', usage: '.antism <on|off>', role: 'admin', enabled: true },
  { name: 'antigs', aliases: ['antigroupstatus'], category: 'Admin', description: 'Toggle anti-group-status mention protection', usage: '.antigs <on|off>', role: 'admin', enabled: true },
  { name: 'warn', category: 'Admin', description: 'Issue a moderation warning (3 warns = kick)', usage: '.warn <@user>', role: 'moderator', enabled: true },
  { name: 'resetwarn', category: 'Admin', description: 'Clear warnings for a member', usage: '.resetwarn <@user>', role: 'moderator', enabled: true },
  { name: 'gs', aliases: ['groupstats'], category: 'Admin', description: 'Show group moderation flags & activity stats', usage: '.gs', role: 'admin', enabled: true },
  { name: 'welcome', category: 'Admin', description: 'Toggle welcome greeting for new members', usage: '.welcome <on|off>', role: 'admin', enabled: true },
  { name: 'setwelcome', category: 'Admin', description: 'Customize the group welcome message', usage: '.setwelcome <message>', role: 'admin', enabled: true },
  { name: 'leave', category: 'Admin', description: 'Toggle goodbye message when members leave', usage: '.leave <on|off>', role: 'admin', enabled: true },
  { name: 'setleave', category: 'Admin', description: 'Customize the group goodbye message', usage: '.setleave <message>', role: 'admin', enabled: true },
  { name: 'purge', category: 'Admin', description: 'Clear inactive/warned entries', usage: '.purge', role: 'admin', enabled: true },
  { name: 'blacklist', category: 'Admin', description: 'Add or list blacklisted group keywords/users', usage: '.blacklist [word]', role: 'admin', enabled: true },
  { name: 'promote', category: 'Admin', description: 'Promote a member to Group Admin', usage: '.promote <@user>', role: 'admin', enabled: true },
  { name: 'demote', category: 'Admin', description: 'Demote an admin back to Member', usage: '.demote <@user>', role: 'admin', enabled: true },
  { name: 'mute', category: 'Admin', description: 'Set group to Admins-only messaging', usage: '.mute', role: 'admin', enabled: true },
  { name: 'unmute', category: 'Admin', description: 'Allow all members to send messages', usage: '.unmute', role: 'admin', enabled: true },
  { name: 'hidetag', category: 'Admin', description: 'Broadcast a clean announcement tagging all members silently', usage: '.hidetag <message>', role: 'moderator', enabled: true },
  { name: 'tagall', category: 'Admin', description: 'Mention all active members in the group', usage: '.tagall [note]', role: 'moderator', enabled: true },
  { name: 'activity', category: 'Admin', description: 'View message counts across group members', usage: '.activity', role: 'moderator', enabled: true },
  { name: 'active', category: 'Admin', description: 'List top active anime lounge members', usage: '.active', role: 'moderator', enabled: true },
  { name: 'inactive', category: 'Admin', description: 'List quiet members needing check-in', usage: '.inactive', role: 'moderator', enabled: true },
  { name: 'open', category: 'Admin', description: 'Open the group chat for all members', usage: '.open', role: 'admin', enabled: true },
  { name: 'close', category: 'Admin', description: 'Lock the group chat to admins only', usage: '.close', role: 'admin', enabled: true },
  { name: 'news', category: 'Admin', description: 'Fetch & broadcast trending anime news via Jikan', usage: '.news', role: 'moderator', enabled: true },
  { name: 'nsfw', category: 'Admin', description: 'Content filter lock (locked to SFW-only in Pieck)', usage: '.nsfw <status>', role: 'admin', enabled: true },
];

