import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import type { PlayerProfile } from '../src/shared/botSchema.ts';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
const COVER_DIR = path.join(DATA_DIR, 'covers');

const TEMPLATE_CANDIDATES = [
  path.resolve(process.cwd(), 'public/assets/aistudio/image_a37127f6.png'),
  path.resolve(process.cwd(), 'server/assets/profile-template.png'),
];

// Measured directly from the 1254x1254 Attack on Titan template artwork.
const CARD_SIZE = 1254;
const AVATAR_CX = 625.5;
const AVATAR_CY = 366.5;
const AVATAR_INNER_R = 196.5;
const AVATAR_RING_R = 198.5;
const CENTER_X = 626.5;

let cachedTemplate: Image | null | undefined;

async function getTemplateImage(): Promise<Image | null> {
  if (cachedTemplate !== undefined) return cachedTemplate;
  for (const candidate of TEMPLATE_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      try {
        cachedTemplate = await loadImage(candidate);
        return cachedTemplate;
      } catch {
        // try next candidate
      }
    }
  }
  cachedTemplate = null;
  return null;
}

export function getPlayerRank(level: number): string {
  if (level >= 30) return 'Legend';
  if (level >= 20) return 'Commander';
  if (level >= 15) return 'Elite';
  if (level >= 10) return 'Veteran';
  if (level >= 6) return 'Cadet';
  if (level >= 3) return 'Scout';
  return 'Rookie';
}

export function getLevelXpProgress(xp: number, level: number): {
  current: number;
  needed: number;
  ratio: number;
  nextTotalXp: number;
} {
  const safeLevel = Math.max(1, level);
  const levelFloor = safeLevel <= 1 ? 0 : 25 * safeLevel * safeLevel;
  const nextCeiling = 25 * (safeLevel + 1) * (safeLevel + 1);
  const needed = Math.max(100, nextCeiling - levelFloor);
  const current = Math.max(0, Math.min(needed, Math.round(xp - levelFloor)));
  const ratio = Math.max(0, Math.min(1, current / needed));
  return { current, needed, ratio, nextTotalXp: nextCeiling };
}

/**
 * Vertically interpolates background pixels across [yTop..yBot] per column so
 * baked-in template text disappears seamlessly into the sky or wall backdrop.
 */
function clearVerticalBand(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  xStart: number,
  xEnd: number,
  yTop: number,
  yBot: number
): void {
  const width = xEnd - xStart;
  const height = yBot - yTop;
  const band = ctx.getImageData(xStart, yTop, width, height);
  const d = band.data;

  for (let x = 0; x < width; x += 1) {
    const topIdx = x * 4;
    const botIdx = ((height - 1) * width + x) * 4;
    const r0 = d[topIdx];
    const g0 = d[topIdx + 1];
    const b0 = d[topIdx + 2];
    const r1 = d[botIdx];
    const g1 = d[botIdx + 1];
    const b1 = d[botIdx + 2];

    for (let y = 1; y < height - 1; y += 1) {
      const t = y / (height - 1);
      const idx = (y * width + x) * 4;
      d[idx] = Math.round(r0 + (r1 - r0) * t);
      d[idx + 1] = Math.round(g0 + (g1 - g0) * t);
      d[idx + 2] = Math.round(b0 + (b1 - b0) * t);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(band, xStart, yTop);
}

function traceXpRibbon(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  left: number,
  right: number,
  top: number,
  bottom: number,
  tipInset = 34
): void {
  const midY = (top + bottom) / 2;
  ctx.beginPath();
  ctx.moveTo(left, midY);
  ctx.lineTo(left + tipInset, top);
  ctx.lineTo(right - tipInset, top);
  ctx.lineTo(right, midY);
  ctx.lineTo(right - tipInset, bottom);
  ctx.lineTo(left + tipInset, bottom);
  ctx.closePath();
}

function drawWalletAndBankIcons(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>
): void {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#f8fafc';
  ctx.shadowColor = 'rgba(8, 16, 36, 0.72)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Wallet icon around (54, 42)
  ctx.beginPath();
  ctx.roundRect(54, 42, 46, 34, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(80, 52, 22, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(88, 59, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Bank icon around (54, 102)
  ctx.beginPath();
  ctx.moveTo(77, 98);
  ctx.lineTo(52, 112);
  ctx.lineTo(102, 112);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(58, 115, 6, 17);
  ctx.fillRect(74, 115, 6, 17);
  ctx.fillRect(90, 115, 6, 17);
  ctx.fillRect(52, 134, 50, 5);
  ctx.restore();
}

function drawCustomCoverOrnament(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  width: number
): void {
  const y = 1096;
  ctx.save();
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)';
  ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(6, 12, 26, 0.7)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(240, y);
  ctx.lineTo(CENTER_X - 42, y);
  ctx.moveTo(CENTER_X + 42, y);
  ctx.lineTo(width - 240, y);
  ctx.stroke();

  // Subtle diamond crest center
  ctx.beginPath();
  ctx.moveTo(CENTER_X, y - 14);
  ctx.lineTo(CENTER_X + 14, y);
  ctx.lineTo(CENTER_X, y + 14);
  ctx.lineTo(CENTER_X - 14, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBlankAvatarPlaceholder(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_INNER_R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const radial = ctx.createRadialGradient(
    AVATAR_CX,
    AVATAR_CY - 30,
    20,
    AVATAR_CX,
    AVATAR_CY,
    AVATAR_INNER_R
  );
  radial.addColorStop(0, 'rgba(30, 41, 59, 0.88)');
  radial.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
  ctx.fillStyle = radial;
  ctx.fillRect(
    AVATAR_CX - AVATAR_INNER_R,
    AVATAR_CY - AVATAR_INNER_R,
    AVATAR_INNER_R * 2,
    AVATAR_INNER_R * 2
  );

  // Subtle minimal silhouette (indicates unset avatar without showing L Lawliet)
  ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY - 42, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY + 146, 128, Math.PI * 1.12, Math.PI * 1.88);
  ctx.fill();
  ctx.restore();
}

function getPlayerAvatarPath(player: PlayerProfile): string | null {
  if (!player.avatarFile) return null;
  const safeName = path.basename(player.avatarFile);
  const full = path.join(AVATAR_DIR, safeName);
  return fs.existsSync(full) ? full : null;
}

function getPlayerCoverPath(player: PlayerProfile): string | null {
  if (!player.coverFile) return null;
  const safeName = path.basename(player.coverFile);
  const full = path.join(COVER_DIR, safeName);
  return fs.existsSync(full) ? full : null;
}

/**
 * Validates, center-crops, and saves a custom square avatar PNG for `.setpp`.
 */
export async function savePlayerAvatar(playerId: string, rawBuffer: Buffer): Promise<string> {
  const img = await loadImage(rawBuffer);
  if (!img.width || !img.height) {
    throw new Error('Could not decode that image.');
  }

  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }

  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const side = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - side) / 2);
  const sy = Math.floor((img.height - side) / 2);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  const safeId = playerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'player';
  const filename = `${safeId}.png`;
  const target = path.join(AVATAR_DIR, filename);
  fs.writeFileSync(target, canvas.toBuffer('image/png'));
  return filename;
}

export function deletePlayerAvatar(player: PlayerProfile): void {
  const existing = getPlayerAvatarPath(player);
  if (existing) {
    try {
      fs.rmSync(existing, { force: true });
    } catch {
      // ignore
    }
  }
  player.avatarFile = undefined;
}

/**
 * Validates, center-crops, and saves a custom square cover JPEG for `.setcover`.
 */
export async function savePlayerCover(playerId: string, rawBuffer: Buffer): Promise<string> {
  const img = await loadImage(rawBuffer);
  if (!img.width || !img.height) {
    throw new Error('Could not decode that cover image.');
  }

  if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
  }

  const canvas = createCanvas(CARD_SIZE, CARD_SIZE);
  const ctx = canvas.getContext('2d');
  const side = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - side) / 2);
  const sy = Math.floor((img.height - side) / 2);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, CARD_SIZE, CARD_SIZE);

  const safeId = playerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'player';
  const filename = `${safeId}.jpg`;
  const target = path.join(COVER_DIR, filename);
  fs.writeFileSync(target, canvas.toBuffer('image/jpeg', 90));
  return filename;
}

export function deletePlayerCover(player: PlayerProfile): void {
  const existing = getPlayerCoverPath(player);
  if (existing) {
    try {
      fs.rmSync(existing, { force: true });
    } catch {
      // ignore
    }
  }
  player.coverFile = undefined;
}

/**
 * Composites live Wallet, Bank, custom/blank `.setpp` avatar, custom/default `.setcover` background,
 * optional Name & Bio (blank until set), Level/Rank, and dynamic XP bar onto the profile card.
 */
export async function renderProfileCardBuffer(player: PlayerProfile): Promise<Buffer | null> {
  const coverPath = getPlayerCoverPath(player);
  let customCoverImg: Image | null = null;
  if (coverPath) {
    try {
      customCoverImg = await loadImage(coverPath);
    } catch {
      customCoverImg = null;
    }
  }

  const template = customCoverImg ? null : await getTemplateImage();
  const w = customCoverImg ? CARD_SIZE : template ? template.width : CARD_SIZE;
  const h = customCoverImg ? CARD_SIZE : template ? template.height : CARD_SIZE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  if (customCoverImg) {
    const scale = Math.max(w / customCoverImg.width, h / customCoverImg.height);
    const drawW = customCoverImg.width * scale;
    const drawH = customCoverImg.height * scale;
    ctx.drawImage(customCoverImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);

    // Subtle dark gradient scrim so white HUD labels pop cleanly over any cover art.
    const topScrim = ctx.createLinearGradient(0, 0, 0, 260);
    topScrim.addColorStop(0, 'rgba(9, 14, 28, 0.56)');
    topScrim.addColorStop(1, 'rgba(9, 14, 28, 0.14)');
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, w, 260);

    const lowerScrim = ctx.createLinearGradient(0, 520, 0, h);
    lowerScrim.addColorStop(0, 'rgba(9, 14, 28, 0.18)');
    lowerScrim.addColorStop(1, 'rgba(9, 14, 28, 0.72)');
    ctx.fillStyle = lowerScrim;
    ctx.fillRect(0, 520, w, h - 520);

    drawWalletAndBankIcons(ctx);
    drawCustomCoverOrnament(ctx, w);
  } else if (template) {
    ctx.drawImage(template, 0, 0);
    // Erase baked-in template text cleanly before rendering live values.
    clearVerticalBand(ctx, 120, 415, 38, 86);
    clearVerticalBand(ctx, 120, 415, 98, 146);
    clearVerticalBand(ctx, 400, 865, 596, 684);
    clearVerticalBand(ctx, 290, 965, 700, 750);
    clearVerticalBand(ctx, 445, 830, 804, 855);
  } else {
    // Clean minimalist dark slate fallback if template file is missing
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawWalletAndBankIcons(ctx);
    drawCustomCoverOrnament(ctx, w);
  }

  // 1) Top-left Wallet & Bank
  const walletText = `Wallet: $${Math.round(player.wallet || 0).toLocaleString()}`;
  const bankText = `Bank: $${Math.round(player.bank || 0).toLocaleString()}`;
  const balLen = Math.max(walletText.length, bankText.length);
  const balFont = balLen > 16 ? 28 : balLen > 13 ? 32 : 36;

  ctx.save();
  ctx.font = `${balFont}px "Liberation Serif", "DejaVu Serif", Georgia, serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(8, 16, 36, 0.78)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(walletText, 128, 74);
  ctx.fillText(bankText, 128, 134);
  ctx.restore();

  // 2) Center circular portrait (blank silhouette until user sets one with `.setpp`).
  const avatarPath = getPlayerAvatarPath(player);
  let drewAvatar = false;
  if (avatarPath) {
    try {
      const avatar = await loadImage(avatarPath);
      ctx.save();
      ctx.beginPath();
      ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_INNER_R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const diameter = AVATAR_INNER_R * 2;
      const scale = Math.max(diameter / avatar.width, diameter / avatar.height);
      const drawW = avatar.width * scale;
      const drawH = avatar.height * scale;
      ctx.drawImage(avatar, AVATAR_CX - drawW / 2, AVATAR_CY - drawH / 2, drawW, drawH);
      ctx.restore();
      drewAvatar = true;
    } catch {
      drewAvatar = false;
    }
  }
  if (!drewAvatar) {
    drawBlankAvatarPlaceholder(ctx);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RING_R, 0, Math.PI * 2);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(241, 245, 252, 0.94)';
  ctx.stroke();
  ctx.restore();

  // 3) Center Username (blank until user sets one with `.setname` / `.rename`).
  const displayName = ((player.name || '').trim() || 'Unnamed player').slice(0, 24);
  if (displayName) {
    const nameFontSize = displayName.length > 18 ? 44 : displayName.length > 13 ? 52 : 64;
    ctx.save();
    ctx.font = `bold ${nameFontSize}px "Liberation Serif", "DejaVu Serif", Georgia, serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(6, 12, 26, 0.82)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.fillText(displayName, CENTER_X, 666, 760);
    ctx.restore();
  }

  // 4) Center Bio quote (blank until user sets one with `.setbio` / `.bio`).
  const rawBio = (player.bio || '').replace(/\s+/g, ' ').trim();
  if (rawBio) {
    const clippedBio = rawBio.length > 52 ? `${rawBio.slice(0, 49)}...` : rawBio;
    const bioText = `(${clippedBio})`;
    const bioFontSize = bioText.length > 44 ? 26 : 31;
    ctx.save();
    ctx.font = `italic ${bioFontSize}px "Liberation Serif", "DejaVu Serif", Georgia, serif`;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(6, 12, 26, 0.82)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillText(bioText, CENTER_X, 736, 780);
    ctx.restore();
  }

  // 5) Level & Rank line
  const rank = getPlayerRank(player.level);
  const levelLine = `Lv. ${player.level}  |  ${rank}`;
  ctx.save();
  ctx.font = `35px "Liberation Serif", "DejaVu Serif", Georgia, serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(6, 12, 26, 0.82)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(levelLine, CENTER_X, 840, 620);
  ctx.restore();

  // 6) Dynamic XP bar & XP counter
  const barLeft = 226;
  const barRight = 1027;
  const barTop = 882;
  const barBottom = 940;
  if (!customCoverImg && template) {
    clearVerticalBand(ctx, barLeft - 4, barRight + 4, barTop - 4, barBottom + 4);
  }

  const xpInfo = getLevelXpProgress(player.xp, player.level);

  ctx.save();
  traceXpRibbon(ctx, barLeft, barRight, barTop, barBottom, 34);
  ctx.fillStyle = 'rgba(18, 25, 42, 0.78)';
  ctx.fill();
  ctx.clip();

  if (xpInfo.ratio > 0) {
    const fillW = Math.max(12, Math.round((barRight - barLeft) * xpInfo.ratio));
    const grad = ctx.createLinearGradient(barLeft, 0, barLeft + fillW, 0);
    grad.addColorStop(0, 'rgba(248, 250, 252, 0.94)');
    grad.addColorStop(1, 'rgba(203, 213, 225, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(barLeft, barTop, fillW, barBottom - barTop);
  }
  ctx.restore();

  ctx.save();
  traceXpRibbon(ctx, barLeft, barRight, barTop, barBottom, 34);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
  ctx.stroke();

  const xpLabel = `${xpInfo.current.toLocaleString()} / ${xpInfo.needed.toLocaleString()} XP`;
  ctx.font = `30px "Liberation Serif", "DejaVu Serif", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeText(xpLabel, CENTER_X, (barTop + barBottom) / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(xpLabel, CENTER_X, (barTop + barBottom) / 2 + 1);
  ctx.restore();

  return canvas.toBuffer('image/jpeg', 90);
}
