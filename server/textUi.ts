// Text UI — "Design E": bar rail with ornaments.
// Clean left bar rail (▎), dotted dividers (┈), ornament headers (✦ TITLE ✦),
// chevron rows (❯), and arrow footers (↳) — crisp in both WhatsApp and web preview.

const RAIL = '▎';
const DOTS = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const FENCE = '```';

const CATEGORY_ICONS: Record<string, string> = {
  General: '⚙',
  Cards: '🎴',
  Economy: '💰',
  Games: '🎮',
  'Events & Guilds': '🎉',
  Gamble: '🎰',
  Pokémon: '🐉',
  Interaction: '👥',
  Fun: '🎭',
  Downloaders: '📲',
  Search: '🔍',
  AI: '🤖',
  Converter: '🔄',
  'Anime SFW': '🌸',
  Admin: '🛡',
};

const LABEL_ICONS: Array<[RegExp, string]> = [
  [/^(player|you are)$/i, '👤'],
  [/^name$/i, '🧑'],
  [/^user$/i, '👤'],
  [/^wallet$/i, '👛'],
  [/^bank$/i, '🏦'],
  [/^orbs$/i, '🔮'],
  [/^net worth$/i, '💎'],
  [/^stardust$/i, '✨'],
  [/^value|price|worth|reward|bet|payout|jackpot$/i, '🪙'],
  [/^series|anime|manga$/i, '📺'],
  [/^tier|rank|rarity$/i, '🏅'],
  [/^stats$/i, '⚔️'],
  [/^level|xp$/i, '⭐'],
  [/^guild$/i, '🏰'],
  [/^prefix$/i, '⌨️'],
  [/^community$/i, '🌐'],
  [/^groq ai|ai$/i, '🤖'],
  [/^whatsapp$/i, '📱'],
  [/^card$/i, '🎴'],
  [/^loan( debt)?$/i, '💳'],
];

const HAS_EMOJI_START_RE = /^[\p{Extended_Pictographic}\u2600-\u27BF]/u;

function withLabelIcon(label: string): string {
  if (HAS_EMOJI_START_RE.test(label)) return label;
  for (const [rx, icon] of LABEL_ICONS) {
    if (rx.test(label.trim())) return `${icon} ${label}`;
  }
  return label;
}

export function stripMarkup(text: string): string {
  return text
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1$2')
    .replace(/`([^`\n]*)`/g, '$1');
}

export function formatDesignERail(opts: {
  title: string;
  rows: Array<{ label?: string; value?: string; text?: string; dividerAfter?: boolean }>;
  footer?: string;
}): string {
  const lines = [
    `${RAIL}✦ ${stripMarkup(opts.title).toUpperCase()} ✦`,
    `${RAIL}${DOTS}`,
  ];
  for (const row of opts.rows) {
    if (row.text !== undefined) {
      lines.push(`${RAIL}${stripMarkup(row.text)}`);
    } else if (row.label !== undefined) {
      const label = withLabelIcon(stripMarkup(row.label));
      const val = stripMarkup(row.value || '');
      lines.push(val ? `${RAIL}${label} ❯ ${val}` : `${RAIL}${label}`);
    }
    if (row.dividerAfter) {
      lines.push(`${RAIL}${DOTS}`);
    }
  }
  if (opts.footer) {
    lines.push(RAIL);
    lines.push(`${RAIL}↳ ${stripMarkup(opts.footer)}`);
  }
  return lines.join('\n');
}

// ───────────── Menu ─────────────

export function buildMenuUi(opts: {
  title: string;
  botName: string;
  prefix: string;
  groups: Array<{ category: string; commands: string[] }>;
  activeCategory?: string;
  example: string;
}): { caption: string; body: string } {
  const captionLines = [
    `✦ ${opts.title.toUpperCase()} ✦`,
    `${opts.botName} · prefix ${opts.prefix}`,
    '',
    `${RAIL}✦ 📖 MENU ✦`,
    `${RAIL}${DOTS}`,
    `${RAIL}↳ try ${opts.prefix}${opts.example}`,
  ];
  const caption = captionLines.join('\n');

  if (opts.activeCategory) {
    const group = opts.groups.find(
      (g) => g.category.toLowerCase() === opts.activeCategory?.toLowerCase()
    );
    const icon = group ? CATEGORY_ICONS[group.category] || '•' : '📖';
    const cmds = group ? group.commands : [];
    const lines = [
      `✦ ${opts.title.toUpperCase()} ✦`,
      `${opts.botName} · prefix ${opts.prefix}`,
      '',
      `${RAIL}✦ ${icon} ${(group?.category || opts.activeCategory).toUpperCase()} MENU ✦`,
      `${RAIL}${DOTS}`,
    ];
    for (let i = 0; i < cmds.length; i += 2) {
      const left = `${opts.prefix}${cmds[i]}`;
      const right = cmds[i + 1] ? ` · ${opts.prefix}${cmds[i + 1]}` : '';
      lines.push(`${RAIL}${icon} ${left}${right}`);
    }
    lines.push(RAIL);
    lines.push(`${RAIL}↳ ${opts.prefix}menu for all categories`);
    return { caption, body: lines.join('\n') };
  }

  const lines = [
    `✦ ${opts.title.toUpperCase()} ✦`,
    `${opts.botName} · prefix ${opts.prefix}`,
    '',
    `${RAIL}✦ 📖 MENU ✦`,
    `${RAIL}${DOTS}`,
  ];

  for (const group of opts.groups) {
    if (group.commands.length === 0) continue;
    const icon = CATEGORY_ICONS[group.category] || '•';
    const slug = group.category.toLowerCase().split(/[\s&]+/)[0];
    lines.push(`${RAIL}${icon} ${opts.prefix}menu ${slug} ❯ ${group.commands.length}`);
  }

  lines.push(RAIL);
  lines.push(`${RAIL}↳ ${opts.prefix}menu <category> · ${opts.prefix}${opts.example}`);
  return { caption, body: lines.join('\n') };
}

// ───────────── Automatic reply styling (Design E) ─────────────

type Row = { kind: 'row'; label: string; value: string } | { kind: 'text'; text: string };

const TITLE_RE = /^\*([^*\n]+)\*$/;
const BOX_ROW_RE = /^┣\s*(.*)$/;
const BOX_CONT_RE = /^┃\s*(.*)$/;
const BOX_END_RE = /^┗━+$/;
const DOT_ROW_RE = /^(.+?) {2}• {2}(.+)$/;
const BULLET_RE = /^• (.+)$/;
const KV_RE = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{0,15}): (.+)$/;
const HINT_RE = /^(Manage:|Use |Claim with:|Try |Send )/i;

function isRowLine(line: string): boolean {
  return BOX_ROW_RE.test(line) || DOT_ROW_RE.test(line) || BULLET_RE.test(line) || KV_RE.test(stripMarkup(line));
}

function parseRow(rawLine: string): Row | null {
  let m = rawLine.match(BOX_CONT_RE);
  if (m) return { kind: 'text', text: stripMarkup(m[1]) };

  m = rawLine.match(BOX_ROW_RE);
  if (m) return splitKv(stripMarkup(m[1]));

  m = rawLine.match(DOT_ROW_RE);
  if (m) return { kind: 'row', label: stripMarkup(m[1]), value: stripMarkup(m[2]) };

  m = rawLine.match(BULLET_RE);
  if (m) return splitBullet(stripMarkup(m[1]));

  const clean = stripMarkup(rawLine);
  if (KV_RE.test(clean)) return splitKv(clean);
  return { kind: 'text', text: clean };
}

function splitKv(text: string): Row {
  const idx = text.indexOf(': ');
  if (idx > 0 && idx <= 20) {
    return { kind: 'row', label: text.slice(0, idx), value: text.slice(idx + 2) };
  }
  return { kind: 'text', text };
}

function splitBullet(text: string): Row {
  const dash = text.indexOf(' — ');
  if (dash > 0 && dash <= 26) return { kind: 'row', label: text.slice(0, dash), value: text.slice(dash + 3) };
  const colon = text.indexOf(': ');
  if (colon > 0 && colon <= 20) return { kind: 'row', label: text.slice(0, colon), value: text.slice(colon + 2) };
  return { kind: 'text', text };
}

function renderBlock(title: string, bodyLines: string[], footerHint?: string): string {
  const rows = bodyLines.map(parseRow).filter((r): r is Row => r !== null);
  const out = [
    `${RAIL}✦ ${stripMarkup(title).toUpperCase()} ✦`,
    `${RAIL}${DOTS}`,
  ];
  for (const row of rows) {
    if (row.kind === 'row') {
      const label = withLabelIcon(row.label);
      out.push(`${RAIL}${label} ❯ ${row.value}`);
    } else {
      out.push(`${RAIL}${row.text}`);
    }
  }
  if (footerHint) {
    out.push(RAIL);
    out.push(`${RAIL}↳ ${stripMarkup(footerHint)}`);
  }
  return out.join('\n');
}

/**
 * Restyles a built-in command reply into Design E (bar rail with ornaments).
 * Already-styled Design E rails, fenced blocks, and plain conversational AI replies
 * are preserved unchanged.
 */
export function applyTextUi(text: string): string {
  if (!text || text.includes(FENCE) || text.includes(`${RAIL}✦`)) return text;

  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!TITLE_RE.test(line)) {
      result.push(line);
      i += 1;
      continue;
    }

    let j = i + 1;
    const body: string[] = [];
    while (j < lines.length && lines[j].trim() !== '') {
      if (BOX_END_RE.test(lines[j])) {
        j += 1;
        break;
      }
      body.push(lines[j]);
      j += 1;
    }

    if (!body.some(isRowLine)) {
      result.push(line);
      i += 1;
      continue;
    }

    let footerHint: string | undefined;
    if (body.length > 1 && HINT_RE.test(stripMarkup(body[body.length - 1]))) {
      footerHint = body.pop();
    } else if (lines[j] !== undefined && lines[j].trim() === '' && lines[j + 1] && HINT_RE.test(stripMarkup(lines[j + 1]))) {
      footerHint = lines[j + 1];
      j += 2;
    }

    result.push(renderBlock(line.slice(1, -1), body, footerHint));
    i = j;
  }

  return result.join('\n');
}
