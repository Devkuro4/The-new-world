// Text UI — "Style B": minimalist header, thin divider, aligned label/value rows.
// WhatsApp only aligns columns inside a monospace (```) block, so every
// structured reply is wrapped in one. Bold/italic markers are stripped inside.

const DIVIDER = '━'.repeat(26);
const FENCE = '```';
const MAX_LABEL = 22;

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

export function stripMarkup(text: string): string {
  return text
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1$2')
    .replace(/`([^`\n]*)`/g, '$1');
}

function fence(lines: string[]): string {
  return [FENCE, ...lines, FENCE].join('\n');
}

function header(title: string, subtitle?: string): string[] {
  const lines = [stripMarkup(title).toUpperCase()];
  if (subtitle) lines.push(subtitle);
  lines.push(DIVIDER);
  return lines;
}

// ───────────── Menu ─────────────

export function buildMenuUi(opts: {
  title: string;
  botName: string;
  prefix: string;
  groups: Array<{ category: string; commands: string[] }>;
  example: string;
}): { caption: string; body: string } {
  // Short header — goes in the image caption (WhatsApp captions are length-limited).
  const caption = fence([
    `✦ ${opts.title.toUpperCase()} ✦`,
    `${opts.botName}  ·  prefix ${opts.prefix}`,
    DIVIDER,
    `  try  ${opts.prefix}${opts.example}`,
  ]);

  const lines: string[] = [];
  // One column width for the whole menu so every category lines up.
  const allCmds = opts.groups.flatMap((g) => g.commands.map((c) => `${opts.prefix}${c}`));
  const width = Math.min(Math.max(0, ...allCmds.map((c) => c.length)) + 2, 16);

  for (const group of opts.groups) {
    if (group.commands.length === 0) continue;
    const icon = CATEGORY_ICONS[group.category] || '•';
    lines.push(`${icon} ${group.category.toUpperCase()}`);

    const cmds = group.commands.map((c) => `${opts.prefix}${c}`);
    for (let i = 0; i < cmds.length; i += 2) {
      const left = cmds[i].length >= width ? `${cmds[i]} ` : cmds[i].padEnd(width);
      const right = cmds[i + 1] || '';
      lines.push(`  ${left}${right}`.trimEnd());
    }
    lines.push('');
  }

  lines.push(DIVIDER);
  return { caption, body: fence(lines) };
}

// ───────────── Automatic reply styling ─────────────

type Row = { kind: 'row'; label: string; value: string } | { kind: 'text'; text: string; indent: number };

const TITLE_RE = /^\*([^*\n]+)\*$/;
const BOX_ROW_RE = /^┣\s*(.*)$/;
const BOX_CONT_RE = /^┃\s*(.*)$/;
const BOX_END_RE = /^┗━+$/;
const DOT_ROW_RE = /^(.+?) {2}• {2}(.+)$/;
const BULLET_RE = /^• (.+)$/;
const KV_RE = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{0,13}): (.+)$/;

function isRowLine(line: string): boolean {
  return BOX_ROW_RE.test(line) || DOT_ROW_RE.test(line) || BULLET_RE.test(line) || KV_RE.test(stripMarkup(line));
}

function parseRow(rawLine: string): Row | null {
  let m = rawLine.match(BOX_CONT_RE);
  if (m) return { kind: 'text', text: stripMarkup(m[1]), indent: 4 };

  m = rawLine.match(BOX_ROW_RE);
  if (m) return splitKv(stripMarkup(m[1]));

  m = rawLine.match(DOT_ROW_RE);
  if (m) return { kind: 'row', label: stripMarkup(m[1]), value: stripMarkup(m[2]) };

  m = rawLine.match(BULLET_RE);
  if (m) return splitBullet(stripMarkup(m[1]));

  const clean = stripMarkup(rawLine);
  if (KV_RE.test(clean)) return splitKv(clean);
  return { kind: 'text', text: clean, indent: 0 };
}

function splitKv(text: string): Row {
  const idx = text.indexOf(': ');
  if (idx > 0 && idx <= 18) {
    return { kind: 'row', label: text.slice(0, idx), value: text.slice(idx + 2) };
  }
  return { kind: 'text', text, indent: 0 };
}

function splitBullet(text: string): Row {
  const dash = text.indexOf(' — ');
  if (dash > 0 && dash <= 26) return { kind: 'row', label: text.slice(0, dash), value: text.slice(dash + 3) };
  const colon = text.indexOf(': ');
  if (colon > 0 && colon <= 18) return { kind: 'row', label: text.slice(0, colon), value: text.slice(colon + 2) };
  return { kind: 'text', text, indent: 0 };
}

function renderBlock(title: string, bodyLines: string[]): string {
  const rows = bodyLines.map(parseRow).filter((r): r is Row => r !== null);
  const labelWidth = Math.min(
    MAX_LABEL,
    Math.max(0, ...rows.map((r) => (r.kind === 'row' ? r.label.length : 0)))
  );

  const out = header(title);
  for (const row of rows) {
    if (row.kind === 'row') {
      const label = row.label.length > labelWidth ? row.label : row.label.padEnd(labelWidth);
      out.push(`${label}  ${row.value}`);
    } else {
      out.push(`${' '.repeat(row.indent)}${row.text}`);
    }
  }
  return fence(out);
}

/**
 * Restyles a built-in command reply into Style B. Text without a bold title
 * followed by row-like lines is returned unchanged (rules text, AI answers…).
 */
export function applyTextUi(text: string): string {
  if (!text || text.includes(FENCE)) return text;

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

    // Collect following lines up to a blank line or the end of a box.
    let j = i + 1;
    const body: string[] = [];
    let closedByBox = false;
    while (j < lines.length && lines[j].trim() !== '') {
      if (BOX_END_RE.test(lines[j])) {
        closedByBox = true;
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

    result.push(renderBlock(line.slice(1, -1), body));
    i = j;
    if (closedByBox && lines[i] === undefined) break;
  }

  return result.join('\n');
}
