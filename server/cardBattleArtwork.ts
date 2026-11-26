import { createRequire } from 'node:module';

export type CardArtwork = { imageUrl: string; pageUrl: string };

const require = createRequire(import.meta.url);
const maxBytes = 2 * 1024 * 1024;

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

    try {
      const sharp = require('sharp');
      return await sharp(avif, { limitInputPixels: 2_000_000 }).resize({
        width: 450, height: 650, fit: 'inside', withoutEnlargement: true,
      }).jpeg({ quality: 90 }).toBuffer();
    } catch {
      const { loadImage, createCanvas } = require('@napi-rs/canvas');
      const image = await loadImage(avif);
      if (image.width * image.height > 2_000_000) return;
      const scale = Math.min(1, 450 / image.width, 650 / image.height);
      const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toBuffer('image/jpeg');
    }
  } catch {
    return undefined;
  }
}
