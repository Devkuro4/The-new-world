import fs from 'node:fs';
import path from 'node:path';

// Bot artwork lives in server/assets and is served at /assets/<file>.
export const ASSET_DIR = path.resolve(process.cwd(), 'server/assets');
export const MENU_IMAGE_URL = '/assets/pieck.jpg';

/** Maps "/assets/x.jpg" to a file on disk, or null if it is not a bundled asset. */
export function resolveLocalAsset(url: string | undefined): string | null {
  if (!url || !url.startsWith('/assets/')) return null;
  const file = path.basename(url);
  const full = path.join(ASSET_DIR, file);
  return fs.existsSync(full) ? full : null;
}

let thumbCache: Buffer | null | undefined;
/** Small JPEG used for the link-preview thumbnail card. */
export function getThumbBuffer(): Buffer | null {
  if (thumbCache !== undefined) return thumbCache;
  try {
    thumbCache = fs.readFileSync(path.join(ASSET_DIR, 'pieck-thumb.jpg'));
  } catch {
    thumbCache = null;
  }
  return thumbCache;
}

/** Public link the thumbnail card points to (the /pieck preview page). */
export function getPreviewLink(ownerNumber: string): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (appUrl && /^https?:\/\//i.test(appUrl)) return `${appUrl}/pieck`;
  const digits = ownerNumber.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : 'https://whatsapp.com';
}
