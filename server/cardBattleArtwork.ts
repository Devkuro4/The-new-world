import { createRequire } from 'node:module';

export type CardArtwork = { imageUrl: string; pageUrl: string };

const require = createRequire(import.meta.url);
const maxBytes = 2 * 1024 * 1024;
export const CARD_ART_WIDTH = 450;
export const CARD_ART_HEIGHT = 650;

/** Put every card on one portrait canvas without cutting off any artwork. */
export async function normalizeCardArtwork(imageData: Buffer): Promise<Buffer | undefined> {
  try {
    const sharp = require('sharp');
    return await sharp(imageData, { limitInputPixels: 2_000_000 })
      .resize({
        width: CARD_ART_WIDTH,
        height: CARD_ART_HEIGHT,
        fit: 'contain',
        position: 'centre',
        background: { r: 10, g: 12, b: 20, alpha: 1 },
      })
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch {
    try {
      const { loadImage, createCanvas } = require('@napi-rs/canvas');
      const image = await loadImage(imageData);
      if (image.width * image.height > 2_000_000) return;
      const canvas = createCanvas(CARD_ART_WIDTH, CARD_ART_HEIGHT);
      const context = canvas.getContext('2d');
      context.fillStyle = '#0a0c14';
      context.fillRect(0, 0, CARD_ART_WIDTH, CARD_ART_HEIGHT);
      const scale = Math.min(CARD_ART_WIDTH / image.width, CARD_ART_HEIGHT / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, Math.round((CARD_ART_WIDTH - width) / 2), Math.round((CARD_ART_HEIGHT - height) / 2), width, height);
      return canvas.toBuffer('image/jpeg');
    } catch {
      return undefined;
    }
  }
}

export async function loadCardArtwork(artwork: CardArtwork): Promise<Buffer | undefined> {
  if (!/^https:\/\/cdn7\.mazoku\.cc\/cards\/[a-f0-9-]{36}\.avif\?width=300$/.test(artwork.imageUrl)) return;
  try {
    const response = await fetch(artwork.imageUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxBytes) return;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return;
      }
      chunks.push(value);
    }
    if (!length) return;
    const avif = Buffer.concat(chunks, length);

    return await normalizeCardArtwork(avif);
  } catch {
    return undefined;
  }
}
