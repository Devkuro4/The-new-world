import fs from 'node:fs';
import path from 'node:path';
import type { CommandCategory } from '../src/shared/botSchema.ts';

// Bot artwork lives in server/assets and is served at /assets/<file>.
export const ASSET_DIR = path.resolve(process.cwd(), 'server/assets');
export const MENU_IMAGE_URL = '/assets/pieck.jpg';

const THUMB_KEYS = new Set([
  'pieck',
  'economy',
  'fish',
  'vault',
  'lottery',
  'slots',
  'coin',
  'dice',
  'roulette',
  'blackjack',
  'horse',
  'chess',
  'games',
  'pokemon',
  'cards',
  'media',
  'video',
  'ai',
  'admin',
  'anime',
]);

/** Maps "/assets/x.jpg" or "/assets/thumbs/y.jpg" to a file on disk, or null if not found. */
export function resolveLocalAsset(url: string | undefined): string | null {
  if (!url || !url.startsWith('/assets/')) return null;
  const cleanUrl = url.split('?')[0];
  const rel = cleanUrl.slice('/assets/'.length).replace(/^\/+/, '');
  const full = path.resolve(ASSET_DIR, rel);
  if (!full.startsWith(ASSET_DIR + path.sep)) return null;
  return fs.existsSync(full) ? full : null;
}

/** Resolves the thumbnail artwork key corresponding to a command name and category. */
export function resolveThumbKey(cmdName?: string, category?: CommandCategory | string): string {
  const cmd = (cmdName || '').toLowerCase();
  if (['menu', 'help', 'owner', 'bots', 'support', 'community', 'addbot', 'rules', 'memories', 'mods'].includes(cmd)) {
    return 'pieck';
  }
  if (cmd === 'fish') return 'fish';
  if (['rob', 'heist', 'shame', 'myshame'].includes(cmd)) return 'vault';
  if (['lottery', 'lotterylist'].includes(cmd)) return 'lottery';
  if (cmd === 'cf') return 'coin';
  if (cmd === 'dice') return 'dice';
  if (cmd === 'roulette') return 'roulette';
  if (cmd === 'bj') return 'blackjack';
  if (cmd === 'horse') return 'horse';
  if (['slots', 'gamble', 'rr', 'dp', 'db'].includes(cmd)) return 'slots';
  if (cmd === 'chess') return 'chess';
  if (cmd === 'pmenu') return 'pokemon';
  if (['yt', 'ig', 'ttk', 'x', 'fb', 'reddit'].includes(cmd)) return 'video';
  if (['play', 'lyrics', 'shazam'].includes(cmd)) return 'media';
  if (['anime', 'manga', 'manhwa', 'novel', 'aquiz', 'pint', 'sauce', 'wallpaper'].includes(cmd)) {
    return 'anime';
  }
  switch (category) {
    case 'Economy':
      return 'economy';
    case 'Cards':
      return 'cards';
    case 'Gamble':
      return 'slots';
    case 'Games':
    case 'Events & Guilds':
      return 'games';
    case 'Pokémon':
      return 'pokemon';
    case 'AI':
    case 'Converter':
    case 'General':
      return 'ai';
    case 'Admin':
      return 'admin';
    case 'Downloaders':
    case 'Search':
      return 'media';
    case 'Anime SFW':
    case 'Interaction':
    case 'Fun':
    default:
      return 'anime';
  }
}

export function getThumbImageUrl(thumbKey?: string): string {
  const key = thumbKey && THUMB_KEYS.has(thumbKey) ? thumbKey : 'pieck';
  const basePath = key === 'pieck' ? '/assets/pieck-thumb.jpg' : `/assets/thumbs/${key}.jpg`;
  const diskPath = resolveLocalAsset(basePath);
  if (!diskPath) return basePath;
  try {
    const v = Math.floor(fs.statSync(diskPath).mtimeMs);
    return `${basePath}?v=${v}`;
  } catch {
    return basePath;
  }
}

const thumbCache = new Map<string, Buffer | null>();

/** Small JPEG (<10KB) used for WhatsApp Baileys externalAdReply thumbnail cards. */
export function getThumbBufferByKey(thumbKey?: string): Buffer | null {
  const key = thumbKey && THUMB_KEYS.has(thumbKey) ? thumbKey : 'pieck';
  if (thumbCache.has(key)) return thumbCache.get(key) ?? null;
  const waPath = path.join(ASSET_DIR, 'thumbs-wa', `${key}.jpg`);
  const relPath = key === 'pieck' ? 'pieck-thumb.jpg' : path.join('thumbs', `${key}.jpg`);
  let buf: Buffer | null = null;
  try {
    buf = fs.existsSync(waPath) ? fs.readFileSync(waPath) : fs.readFileSync(path.join(ASSET_DIR, relPath));
  } catch {
    try {
      buf = fs.readFileSync(path.join(ASSET_DIR, 'pieck-thumb.jpg'));
    } catch {
      buf = null;
    }
  }
  thumbCache.set(key, buf);
  return buf;
}

export function getThumbBuffer(): Buffer | null {
  return getThumbBufferByKey('pieck');
}

/** Public HTTPS link for WhatsApp externalAdReply thumbnail cards. */
export function getPreviewLink(ownerNumber: string, cmdName?: string): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const query = cmdName ? `?cmd=${encodeURIComponent(cmdName)}` : '';
  if (appUrl && /^https?:\/\//i.test(appUrl)) return `${appUrl}/pieck${query}`;
  const digits = ownerNumber.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : 'https://whatsapp.com';
}

/** Simulator/web preview URL that always resolves locally or against APP_URL. */
export function getCommandPreviewPath(cmdName?: string): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const query = cmdName ? `?cmd=${encodeURIComponent(cmdName)}` : '';
  if (appUrl && /^https?:\/\//i.test(appUrl)) return `${appUrl}/pieck${query}`;
  return `/pieck${query}`;
}
