import { userJid, identityJids, accountIds, selectTarget } from './whatsappIdentity.ts';
import { mentionsName, reactionVideo } from './animeReactions.ts';
import { cloudEnabled } from './supabaseStore.ts';
import { useCloudAuthState, clearCloudSession, inspectCloudSession, hasCloudSession } from './cloudAuth.ts';
import { linkReply } from './aiThreads.ts';
import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type GroupMetadata,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { botState, handleIncomingMessage, aiReplyThreads, tickCardBattle, findCommand } from './botEngine.ts';
import { getCommandImageBuffer, resolveLocalAsset } from './assets.ts';
import type { BotReplyPayload, CommandRole } from '../src/shared/botSchema.ts';

export type BaileysConnectionStatus = 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'error';

export interface BaileysGroupSummary {
  id: string;
  subject: string;
  participantCount: number;
  botIsAdmin: boolean;
  announce: boolean;
}

export interface BaileysStatusSnapshot {
  status: BaileysConnectionStatus;
  pairingCode: string | null;
  pairingPhone: string | null;
  connectedUser: { id: string; name?: string } | null;
  lastError: string | null;
  hasSavedSession: boolean;
  groups: BaileysGroupSummary[];
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const AUTH_DIR = path.join(DATA_DIR, 'baileys_auth');
const logger = pino({ level: 'silent' });

let activeSock: WASocket | null = null;
let status: BaileysConnectionStatus = 'disconnected';
let pairingCode: string | null = null;
let pairingPhone: string | null = null;
let connectedUser: { id: string; name?: string } | null = null;
let lastError: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let manualDisconnect = false;
let reconnectAttempts = 0;
let cachedGroups: BaileysGroupSummary[] = [];

let cardBattleTickBusy = false;
const cardBattleTimer = setInterval(async () => {
  if (cardBattleTickBusy || status !== 'connected' || !activeSock) return;
  cardBattleTickBusy = true;
  try {
    const sock = activeSock;
    for (const notice of tickCardBattle()) {
      if (!notice.group.endsWith('@g.us') || !cachedGroups.some(g => g.id === notice.group)) continue;
      try {
        const text = notice.text.replace(/\.cb claim/g, `${botState.config.prefix || '.'}cb claim`);
        const sent = await sock.sendMessage(notice.group, notice.imagePath ? {image: fs.readFileSync(notice.imagePath), caption: text} : {text});
        trackSentId(sent?.key?.id);
      } catch (err) { console.warn('[Card Battle] Notice failed', err); }
    }
  } catch (err) { console.warn('[Card Battle] Scheduled check failed', err); }
  finally { cardBattleTickBusy = false; }
}, 30_000);
cardBattleTimer.unref();

const sentMessageIds = new Set<string>();
const groupMetadataCache = new Map<string, { meta: GroupMetadata; fetchedAt: number }>();
const recentMessages = new Map<string, number[]>();

function trackSentId(id?: string | null): void {
  if (!id) return;
  sentMessageIds.add(id);
  if (sentMessageIds.size > 500) {
    const first = sentMessageIds.values().next().value;
    if (first) sentMessageIds.delete(first);
  }
}

function hasSavedCreds(): boolean {
  return cloudEnabled ? hasCloudSession() : fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
}

function normalizeJidToNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}

function jidNumbers(...jids: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const jid of jids) {
    if (jid) out.add(jid.split('@')[0].split(':')[0]);
  }
  return out;
}

// Newer WhatsApp groups use LIDs, so one person can appear under several identifiers.
function participantNumbers(pt: { id: string; lid?: string; phoneNumber?: string }): Set<string> {
  return jidNumbers(pt.id, pt.lid, pt.phoneNumber);
}

function sharesNumber(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

function unwrapMessage(message: WAMessage['message']) {
  let inner = message;
  for (let depth = 0; inner && depth < 8; depth++) {
    const nested = inner.ephemeralMessage?.message || inner.viewOnceMessage?.message ||
      inner.viewOnceMessageV2?.message || inner.viewOnceMessageV2Extension?.message ||
      inner.documentWithCaptionMessage?.message;
    if (!nested) break;
    inner = nested;
  }
  return inner;
}

function extractMessageText(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return '';
  const inner = unwrapMessage(m) ?? m;

  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    inner.buttonsResponseMessage?.selectedButtonId ||
    inner.templateButtonReplyMessage?.selectedId ||
    inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

function extractQuotedText(msg: WAMessage): string {
  const ctx = extractContextInfo(msg);
  const q = ctx?.quotedMessage;
  if (!q) return '';
  const inner = unwrapMessage(q) ?? q;
  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    ''
  ).trim();
}

function extractContextInfo(msg: WAMessage) {
  const message = msg.message;
  if (!message) return undefined;
  const inner = unwrapMessage(message) ?? message;
  return (
    inner.extendedTextMessage?.contextInfo ||
    inner.imageMessage?.contextInfo ||
    inner.videoMessage?.contextInfo ||
    inner.documentMessage?.contextInfo ||
    inner.buttonsResponseMessage?.contextInfo ||
    inner.templateButtonReplyMessage?.contextInfo ||
    inner.listResponseMessage?.contextInfo
  );
}

async function extractImageMediaBuffer(sock: WASocket, msg: WAMessage): Promise<Buffer | undefined> {
  const m = msg.message;
  if (!m) return undefined;
  const ownInner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m;
  if (ownInner.imageMessage) {
    try {
      const buf = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      );
      if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
    } catch {
      // ignore own-image download failure and inspect quoted message next
    }
  }

  const ctx = extractContextInfo(msg);
  const q = ctx?.quotedMessage;
  if (!q) return undefined;
  const quotedInner =
    q.ephemeralMessage?.message ||
    q.viewOnceMessage?.message ||
    q.viewOnceMessageV2?.message ||
    q;
  if (!quotedInner.imageMessage && !quotedInner.stickerMessage) return undefined;

  try {
    const quotedWrapper = {
      key: {
        remoteJid: msg.key.remoteJid || '',
        id: ctx?.stanzaId || msg.key.id || '',
        participant: ctx?.participant || undefined,
      },
      message: quotedInner,
    } as WAMessage;
    const buf = await downloadMediaMessage(
      quotedWrapper,
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
  } catch (err) {
    console.warn('[Baileys] Failed to download quoted image for .setpp:', err instanceof Error ? err.message : err);
  }
  return undefined;
}

function getBotIdentifiers(sock: WASocket): string[] {
  const identifiers = new Set<string>();
  if (sock.user?.id) identifiers.add(normalizeJidToNumber(sock.user.id));
  const lid = (sock.user as { lid?: string } | undefined)?.lid;
  if (lid) identifiers.add(normalizeJidToNumber(lid));
  return Array.from(identifiers).filter(Boolean);
}

function isBotTaggedOrReplied(sock: WASocket, msg: WAMessage, text: string): boolean {
  const context = extractContextInfo(msg);
  const botIdentifiers = getBotIdentifiers(sock);
  const belongsToBot = (jid?: string | null): boolean =>
    Boolean(jid && botIdentifiers.includes(normalizeJidToNumber(jid)));

  if (
    context?.stanzaId &&
    (sentMessageIds.has(context.stanzaId) || belongsToBot(context.participant))
  ) {
    return true;
  }
  if ((context?.mentionedJid || []).some((jid) => belongsToBot(jid))) return true;

  const botName = (botState.config.botName || 'Pieck').trim();
  if (botName) {
    const escapedName = botName.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\s)@${escapedName}(\\b|$)`, 'i').test(text)) return true;
  }
  return botIdentifiers.some((identifier) =>
    new RegExp(`(^|\\s)@${identifier}(\\b|$)`).test(text)
  );
}

function stripBotMention(sock: WASocket, text: string): string {
  let cleaned = text;
  for (const identifier of getBotIdentifiers(sock)) {
    cleaned = cleaned.replace(new RegExp(`@${identifier}\\b`, 'g'), '');
  }
  const botName = (botState.config.botName || 'Pieck').trim();
  if (botName) {
    const escapedName = botName.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`@${escapedName}\\b`, 'gi'), '');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim() || 'Hello Pieck';
}

function extractTargetJids(msg: WAMessage): string[] {
  const ctx = extractContextInfo(msg);
  const mentioned = ctx?.mentionedJid || [];
  if (mentioned.length > 0) return mentioned;
  if (ctx?.participant) return [ctx.participant];
  return [];
}

async function getGroupMeta(sock: WASocket, groupJid: string): Promise<GroupMetadata | null> {
  const cached = groupMetadataCache.get(groupJid);
  if (cached && Date.now() - cached.fetchedAt < 60_000) {
    return cached.meta;
  }
  try {
    const meta = await sock.groupMetadata(groupJid);
    groupMetadataCache.set(groupJid, { meta, fetchedAt: Date.now() });
    return meta;
  } catch {
    return null;
  }
}

async function refreshGroupsList(sock: WASocket): Promise<BaileysGroupSummary[]> {
  try {
    const all = await sock.groupFetchAllParticipating();
    const myNumber = sock.user?.id ? normalizeJidToNumber(sock.user.id) : '';
    const summaries: BaileysGroupSummary[] = Object.values(all).map((g) => {
      const me = g.participants.find((pt) => normalizeJidToNumber(pt.id) === myNumber);
      const botIsAdmin = me?.admin === 'admin' || me?.admin === 'superadmin';
      return {
        id: g.id,
        subject: g.subject,
        participantCount: g.participants.length,
        botIsAdmin,
        announce: Boolean(g.announce),
      };
    });
    cachedGroups = summaries;
    return summaries;
  } catch {
    return cachedGroups;
  }
}

async function sendMediaFile(
  sock: WASocket,
  remoteJid: string,
  quoted: WAMessage,
  kind: 'audio' | 'video',
  filePath: string
): Promise<void> {
  try {
    const buffer = fs.readFileSync(filePath);
    const sent = await sock.sendMessage(
      remoteJid,
      kind === 'audio'
        ? { audio: buffer, mimetype: 'audio/mp4', ptt: false }
        : { video: buffer, mimetype: 'video/mp4' },
      { quoted }
    );
    trackSentId(sent?.key?.id);
  } catch {
    // The card / link was already sent.
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

export async function sendBotReply(
  sock: WASocket,
  remoteJid: string,
  quoted: WAMessage,
  reply: BotReplyPayload,
  mentions?: string[],
  onTextSent?: (id: string) => void
): Promise<void> {
  if (reply.reactionTag) {
    const reactionMentions = [...new Set(reply.reactionMentions || [])];
    try {
      const video = await reactionVideo(reply.reactionTag);
      const sent = await sock.sendMessage(remoteJid, { video, gifPlayback: true, caption: reply.text, mentions: reactionMentions }, { quoted });
      trackSentId(sent?.key?.id);
      return;
    } catch {
      const sent = await sock.sendMessage(remoteJid, { text: `${reply.text}\n(GIF temporarily unavailable.)`, mentions: reactionMentions }, { quoted });
      trackSentId(sent?.key?.id);
      return;
    }
  }
  let finalText = reply.text;
  if (reply.buttons && reply.buttons.length > 0 && !finalText.includes('▎↳')) {
    const quickLines = reply.buttons.map((b) => `${b.command} (${b.label})`).join(' · ');
    finalText = `${finalText}\n▎\n▎↳ ${quickLines}`;
  }

  let imageSent = false;

  // Fast path: a text message with the thumbnail embedded in it. Nothing is uploaded to WhatsApp's
  // media servers, so it arrives faster but looks like a link preview. Off by default: set PLAY_THUMB=card to enable it.
  if (reply.imageUrl && reply.cardLink && process.env.PLAY_THUMB?.trim().toLowerCase() === 'card') {
    try {
      const res = await fetch(reply.imageUrl, { signal: AbortSignal.timeout(4_000) });
      if (res.ok) {
        const thumbnail = Buffer.from(await res.arrayBuffer());
        const caption = (reply.imageCaption || reply.text).slice(0, 200);
        const cardMessage = await sock.sendMessage(
          remoteJid,
          {
            text: caption,
            contextInfo: {
              externalAdReply: {
                title: caption,
                body: 'YouTube',
                thumbnail,
                mediaType: 1,
                renderLargerThumbnail: true,
                showAdAttribution: false,
                sourceUrl: reply.cardLink,
              },
            },
          },
          { quoted }
        );
        trackSentId(cardMessage?.key?.id);
        imageSent = true;
      }
    } catch {
      // Fall back to the normal image below.
    }
  }

  if ((reply.imageBuffer || reply.imageUrl) && !imageSent) {
    try {
      let imgPayload: Buffer | null = reply.imageBuffer ? Buffer.from(reply.imageBuffer) : null;
      if (!imgPayload && reply.imageUrl) {
        // Bundled artwork (e.g. the Pieck menu image) is read from disk; anything else is fetched from HTTP(S) URL.
        const localFile = resolveLocalAsset(reply.imageUrl);
        if (localFile) {
          imgPayload = fs.readFileSync(localFile);
        } else if (/^https?:\/\//i.test(reply.imageUrl)) {
          try {
            const imgRes = await fetch(reply.imageUrl, { signal: AbortSignal.timeout(5_000) });
            if (imgRes.ok) imgPayload = Buffer.from(await imgRes.arrayBuffer());
          } catch {
            imgPayload = null;
          }
        }
      }
      if (imgPayload) {
        const captionText =
          reply.hideText && finalText.length <= 1024
            ? finalText
            : reply.imageCaption || botState.config.botName;
        const imagePayload =
          mentions && mentions.length > 0
            ? { image: imgPayload, caption: captionText.slice(0, 1024), mentions }
            : { image: imgPayload, caption: captionText.slice(0, 1024) };
        const imageMessage = await sock.sendMessage(
          remoteJid,
          imagePayload,
          { quoted }
        );
        trackSentId(imageMessage?.key?.id);
        imageSent = true;
      }
    } catch (err) {
      console.warn('[Baileys] reply image send failed, continuing with text:', err instanceof Error ? err.message : err);
    }
  }

  const hasExplicitImage = Boolean(reply.imageBuffer || reply.imageUrl);
  if (!(reply.hideText && (imageSent || !hasExplicitImage))) {
    // Commands without their own image send their matched anime artwork + caption in ONE native WhatsApp message
    // (disable with COMMAND_IMAGES=off or LINK_THUMBNAILS=off). No externalAdReply is used so WhatsApp never drops replies.
    const thumbsEnabled =
      process.env.COMMAND_IMAGES?.trim().toLowerCase() !== 'off' &&
      process.env.LINK_THUMBNAILS?.trim().toLowerCase() !== 'off';
    const canAttachCommandImage =
      thumbsEnabled &&
      !imageSent &&
      !hasExplicitImage &&
      Boolean(reply.thumbnail) &&
      reply.status !== 'blocked' &&
      reply.status !== 'error' &&
      !(mentions && mentions.length > 0) &&
      finalText.length <= 1024;

    const cmdImageBuf = canAttachCommandImage ? getCommandImageBuffer(reply.thumbnail?.thumbKey) : null;
    if (cmdImageBuf) {
      try {
        const imgMsg = await sock.sendMessage(
          remoteJid,
          {
            image: cmdImageBuf,
            caption: finalText,
          },
          { quoted }
        );
        trackSentId(imgMsg?.key?.id);
        imageSent = true;
      } catch (err) {
        console.warn('[Baileys] command image send failed, falling back to text:', err instanceof Error ? err.message : err);
      }
    }

    if (!imageSent || hasExplicitImage) {
      const plainContent =
        mentions && mentions.length > 0
          ? { text: finalText.slice(0, 4096), mentions }
          : { text: finalText.slice(0, 4096) };
      const textMessage = await sock.sendMessage(remoteJid, plainContent, { quoted });
      trackSentId(textMessage?.key?.id);
      if (textMessage?.key?.id) onTextSent?.(textMessage.key.id);
    }
  }

  if (reply.pendingMedia) {
    const result = await reply.pendingMedia;
    const kind = reply.pendingKind || 'audio';
    if (result.path) {
      await sendMediaFile(sock, remoteJid, quoted, kind, result.path);
    } else {
      const failure = await sock.sendMessage(
        remoteJid,
        { text: `⚠️ ${kind === 'audio' ? 'Audio' : 'Video'} unavailable: ${result.reason || 'unknown error'}${reply.pendingLink ? `\n🔗 ${reply.pendingLink}` : ''}` },
        { quoted }
      );
      trackSentId(failure?.key?.id);
    }
  }

  if (reply.videoPath) {
    try {
      const videoMessage = await sock.sendMessage(
        remoteJid,
        { video: fs.readFileSync(reply.videoPath), mimetype: 'video/mp4' },
        { quoted }
      );
      trackSentId(videoMessage?.key?.id);
    } catch {
      // The text with the source link was already sent.
    } finally {
      fs.rmSync(reply.videoPath, { force: true });
    }
  }

  if (reply.audioPath) {
    try {
      const audioMessage = await sock.sendMessage(
        remoteJid,
        { audio: fs.readFileSync(reply.audioPath), mimetype: 'audio/mp4', ptt: false },
        { quoted }
      );
      trackSentId(audioMessage?.key?.id);
    } catch {
      // Details card already sent; link is in the text.
    } finally {
      fs.rmSync(reply.audioPath, { force: true });
    }
  } else if (reply.audioUrl) {
    try {
      const audioMessage = await sock.sendMessage(
        remoteJid,
        { audio: { url: reply.audioUrl }, mimetype: 'audio/mp4', ptt: false },
        { quoted }
      );
      trackSentId(audioMessage?.key?.id);
    } catch {
      // The details card was already sent; a failed audio preview should not break the reply.
    }
  }
}

interface GroupCommandEffect {
  mentions?: string[];
  tagList?: string;
  error?: string;
}

function roleRank(role: CommandRole): number {
  if (role === 'owner') return 4;
  if (role === 'admin') return 3;
  if (role === 'moderator') return 2;
  return 1;
}

async function handleBaileysGroupCommandSideEffects(
  sock: WASocket,
  remoteJid: string,
  msg: WAMessage,
  text: string,
  senderRole: CommandRole,
  meta: GroupMetadata | null
): Promise<GroupCommandEffect> {
  const prefix = botState.config.prefix || '.';
  if (!text.startsWith(prefix)) return {};
  const [rawCmd = ''] = text.slice(prefix.length).trim().split(/\s+/);
  const command = findCommand(rawCmd);
  if (!command?.enabled || command.isCustom || roleRank(senderRole) < roleRank(command.role)) return {};
  if (!botState.groupSettings.isOpen && roleRank(senderRole) < roleRank('moderator')) return {};
  const cmd = command.name;

  const participants = meta?.participants || [];
  const mentions = participants.map((participant) => participant.id);
  if (cmd === 'tagall' || cmd === 'hidetag') {
    // Always use fresh metadata so new members are included and a stale cache never empties the list.
    let members = participants;
    try {
      const fresh = await sock.groupMetadata(remoteJid);
      groupMetadataCache.set(remoteJid, { meta: fresh, fetchedAt: Date.now() });
      members = fresh.participants;
    } catch {
      // fall back to cached participants
    }
    const botNums = jidNumbers(sock.user?.id, sock.user?.lid);
    const targets = members.filter((participant) => !sharesNumber(participantNumbers(participant), botNums));
    if (targets.length === 0) {
      return { error: 'Could not read the group member list. Try again in a few seconds.' };
    }
    // The visible @number must match the user part of each mentioned JID for WhatsApp to tag it.
    const tags = targets.map((participant) => `@${normalizeJidToNumber(participant.id)}`);
    return {
      mentions: targets.map((participant) => participant.id),
      tagList: tags.join('\n'),
    };
  }

  const mutating = new Set(['mute', 'close', 'unmute', 'open', 'kick', 'promote', 'demote', 'delete']);
  if (!mutating.has(cmd)) return {};

  const botJids = [sock.user?.id, sock.user?.lid].map(userJid).filter(Boolean);
  const botParticipant = participants.find(participant =>
    identityJids(participant.id, undefined, [participant]).some(jid => botJids.includes(jid))
  );
  if (botParticipant?.admin !== 'admin' && botParticipant?.admin !== 'superadmin') {
    return { error: 'Pieck must be a WhatsApp group admin to run that command.' };
  }

  try {
    if (cmd === 'mute' || cmd === 'close') {
      await sock.groupSettingUpdate(remoteJid, 'announcement');
    } else if (cmd === 'unmute' || cmd === 'open') {
      await sock.groupSettingUpdate(remoteJid, 'not_announcement');
    } else if (cmd === 'kick' || cmd === 'promote' || cmd === 'demote') {
      const targets = extractTargetJids(msg);
      if (targets.length === 0) return { error: `Reply to or mention the member for *${prefix}${cmd}*.` };
      const action = cmd === 'kick' ? 'remove' : cmd;
      await sock.groupParticipantsUpdate(remoteJid, targets, action);
    } else if (cmd === 'delete') {
      const context = extractContextInfo(msg);
      if (!context?.stanzaId || (context.remoteJid && context.remoteJid !== remoteJid)) return { error: `Reply to the message you want Pieck to delete.` };
      await sock.sendMessage(remoteJid, {
        delete: {
          remoteJid,
          fromMe: false,
          id: context.stanzaId,
          participant: context.participant,
        },
      });
    }
    groupMetadataCache.delete(remoteJid);
    return {};
  } catch (error) {
    return {
      error: error instanceof Error
        ? `WhatsApp rejected *${prefix}${cmd}*: ${error.message}`
        : `WhatsApp rejected *${prefix}${cmd}*.`,
    };
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  if (manualDisconnect) return;
  const delay = Math.min(60000, 1500 * 2 ** Math.min(reconnectAttempts++, 6));
  reconnectTimer = setTimeout(() => {
    if (manualDisconnect || activeSock) return;
    void startSocket().catch(err => {
      status = 'error'; lastError = err instanceof Error ? err.message : 'Reconnect failed';
      scheduleReconnect();
    });
  }, delay);
}

async function startSocket(): Promise<WASocket> {
  clearReconnectTimer();
  manualDisconnect = false;
  lastError = null;
  status = 'connecting';

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await (cloudEnabled ? useCloudAuthState() : useMultiFileAuthState(AUTH_DIR));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
  });

  activeSock = sock;

  sock.ev.on('creds.update', () => { if (activeSock === sock) void saveCreds().catch(err => { lastError = 'WhatsApp credential save failed'; console.error(lastError, err); }); });

  sock.ev.on('connection.update', async (update) => {
    if (activeSock !== sock) return;
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      status = 'connected';
      reconnectAttempts = 0;
      pairingCode = null;
      lastError = null;
      connectedUser = sock.user
        ? { id: normalizeJidToNumber(sock.user.id), name: sock.user.name }
        : null;
      await refreshGroupsList(sock);
      return;
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (manualDisconnect) {
        status = 'disconnected';
        connectedUser = null;
        return;
      }

      if (isLoggedOut) {
        status = 'disconnected';
        connectedUser = null;
        pairingCode = null;
        cachedGroups = [];
        lastError = 'WhatsApp session logged out from phone. Pair again with your phone number.';
        try {
          if (cloudEnabled) await clearCloudSession();
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {
          // ignore
        }
        return;
      }

      activeSock = null;
      if (statusCode === DisconnectReason.connectionReplaced) { status = 'disconnected'; lastError = 'Connection replaced by another instance'; return; }
      // Reconnect automatically (including DisconnectReason.restartRequired 515 right after pairing!)
      status = pairingCode ? 'pairing' : 'connecting';
      clearReconnectTimer();
      scheduleReconnect();
    }
  });

  sock.ev.on('group-participants.update', async (ev) => {
    if (activeSock !== sock) return;
    try {
      const meta = await getGroupMeta(sock, ev.id);
      const groupName = meta?.subject || botState.groupSettings.groupName;
      for (const participant of ev.participants) {
        const participantJid = typeof participant === 'string' ? participant : participant.id;
        const tag = `@${normalizeJidToNumber(participantJid)}`;
        if (ev.action === 'add' && botState.groupSettings.welcomeEnabled) {
          const text = botState.groupSettings.welcomeMessage
            .replace(/\{group\}/g, groupName)
            .replace(/@?\{user\}/g, tag);
          const sent = await sock.sendMessage(ev.id, { text, mentions: [participantJid] });
          trackSentId(sent?.key?.id);
        } else if (ev.action === 'remove' && botState.groupSettings.leaveEnabled) {
          const text = botState.groupSettings.leaveMessage
            .replace(/\{group\}/g, groupName)
            .replace(/@?\{user\}/g, tag);
          const sent = await sock.sendMessage(ev.id, { text, mentions: [participantJid] });
          trackSentId(sent?.key?.id);
        }
      }
    } catch {
      // Ignore group greeting send error
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    if (activeSock !== sock || upsert.type !== 'notify') return;
    const prefix = botState.config.prefix || '.';

    for (const msg of upsert.messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.id && sentMessageIds.has(msg.key.id)) continue;

        const remoteJid = msg.key.remoteJid || '';
        if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@newsletter')) continue;

        const rawText = extractMessageText(msg);
        if (!rawText) continue;
        const isGroup = remoteJid.endsWith('@g.us');
        if (!isGroup) continue;

        const isCommand = rawText.startsWith(prefix);
        if (msg.key.fromMe && !isCommand) continue;
        const taggedOrReplied = isBotTaggedOrReplied(sock, msg, rawText);
        if (!isCommand && !taggedOrReplied && !mentionsName(rawText, botState.config.botName)) continue;
        const text = isCommand ? rawText : stripBotMention(sock, rawText);

        const senderJid = userJid(msg.key.participant) ?? userJid(msg.key.participantAlt);
        if (!senderJid) continue;
        const meta = await getGroupMeta(sock, remoteJid);
        const participants = meta?.participants ?? [];
        const senderJids = identityJids(senderJid, msg.key.participantAlt, participants);
        const senderIds = msg.key.fromMe ? ['owner-kuro'] : accountIds(senderJids, botState.config.ownerNumber || '');
        const senderNumber = normalizeJidToNumber(senderJid);
        const senderName = senderIds[0] === 'owner-kuro'
          ? botState.config.creatorName
          : msg.pushName || `WA-${senderNumber.slice(-4)}`;
        const member = participants.find(row => userJid(row.id) === senderJid);
        const mappedMember = member ?? participants.find(row =>
          senderJids.length > 1 && senderJids.includes(userJid(row.id) ?? ''));
        const verifiedPhone = senderJids.find(jid => jid.endsWith('@s.whatsapp.net'))?.split('@')[0];
        let senderRole: CommandRole = 'everyone';
        if (senderIds[0] === 'owner-kuro') {
          senderRole = 'owner';
        } else if (mappedMember?.admin === 'admin' || mappedMember?.admin === 'superadmin') {
          senderRole = 'admin';
        } else if (verifiedPhone && botState.groupSettings.moderatorNumbers.includes(verifiedPhone)) {
          senderRole = 'moderator';
        }

        if (isGroup && senderRole === 'everyone' && botState.groupSettings.antism) {
          const now = Date.now();
          const key = `${remoteJid}:${senderIds[0]}`;
          const times = (recentMessages.get(key) || []).filter((time) => now - time < 10_000);
          times.push(now);
          recentMessages.set(key, times);
          if (times.length > 6) {
            await sendBotReply(sock, remoteJid, msg, {
              text: `Slow down, @${senderNumber}. Anti-spam is active.`,
              handler: 'Anti-Spam',
            }, [senderJid]);
            continue;
          }
        }

        // Instant feedback for slow media commands: react right away so people know it's working.
        if (isCommand) {
          const cmdName = text.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
          if (cmdName && ['play', 'yt', 'ttk', 'ig', 'x', 'fb'].includes(cmdName)) {
            sock.sendMessage(remoteJid, { react: { text: '🎧', key: msg.key } }).catch(() => {});
          }
        }

        const effect: GroupCommandEffect = isGroup
          ? await handleBaileysGroupCommandSideEffects(sock, remoteJid, msg, text, senderRole, meta)
          : {};
        if (effect.error) {
          await sendBotReply(sock, remoteJid, msg, {
            text: `*Command failed*\n${effect.error}`,
            handler: 'Group Admin',
          });
          continue;
        }

        const cmdToken = isCommand ? text.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase() : '';
        const mediaBuffer =
          cmdToken === 'setpp' ||
          cmdToken === 'setpfp' ||
          cmdToken === 'setavatar' ||
          cmdToken === 'setcover' ||
          cmdToken === 'setbanner' ||
          cmdToken === 'setbg'
            ? await extractImageMediaBuffer(sock, msg)
            : undefined;

        const context = extractContextInfo(msg);
        const mentions = context?.mentionedJid ?? [];
        const argsText = isCommand ? text.slice(prefix.length).trim().split(/\s+/).slice(1).join(' ') : '';
        const explicitProfileTarget = ['p', 'profile'].includes(cmdToken || '') && Boolean(argsText);
        const targetJid = !mentions.length && (explicitProfileTarget || /(?:^|\s)@/.test(argsText)) ? null :
          selectTarget(mentions, Boolean(context?.quotedMessage || context?.stanzaId),
          context?.remoteJid && context.remoteJid !== remoteJid ? undefined : context?.participant);
        const targetAccountIds = targetJid === undefined ? undefined :
          accountIds(identityJids(targetJid, senderJids.includes(targetJid || '') ?
            senderJids.find(jid => jid !== targetJid) : undefined, participants), botState.config.ownerNumber || '');
        const incoming = {
          senderId: senderIds[0],
          senderAccountIds: senderIds,
          targetAccountIds,
          hasTargetMention: mentions.length > 0,
          senderName,
          senderRole,
          chatMode: 'group' as const,
          source: 'baileys' as const,
          groupId: remoteJid,
          messageId: msg.key.id || undefined,
          quotedMessageId: context?.stanzaId || undefined,
          quotedSenderId: context?.participant || undefined,
          text,
          quotedText: extractQuotedText(msg),
          mediaBuffer,
          reactionSenderJid: senderJid,
          reactionTargetJid: extractTargetJids(msg)[0],
        };
        const reply = await handleIncomingMessage(incoming);

        let outgoing = reply;
        if (effect.tagList) {
          const note = text.slice(prefix.length).trim().split(/\s+/).slice(1).join(' ');
          const isHidden = text.slice(prefix.length).trim().toLowerCase().startsWith('hidetag');
          outgoing = {
            ...reply,
            text: isHidden
              ? `▎✦ 📢 ANNOUNCEMENT ✦\n▎┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n▎${note || 'Check pinned anime schedule!'}`
              : `▎✦ 📢 TAG ALL ✦\n▎┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${note ? `\n▎📝 ${note}` : ''}\n${effect.tagList
                  .split('\n')
                  .map((line) => `▎${line}`)
                  .join('\n')}`,
          };
        }
        await sendBotReply(sock, remoteJid, msg, outgoing, effect.mentions, id => {
          const key = aiReplyThreads.get(incoming);
          if (key) linkReply(incoming, incoming.senderId, key, id);
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Message handler error';
        console.error('[Baileys] incoming message error:', err);
      }
    }
  });

  return sock;
}

export async function requestPairingForNumber(
  rawPhone: string,
  customCode?: string
): Promise<BaileysStatusSnapshot> {
  const cleanNumber = rawPhone.replace(/[^\d]/g, '');
  if (cleanNumber.length < 7 || cleanNumber.length > 15) {
    throw new Error('Enter a valid WhatsApp phone number with country code (7–15 digits, e.g. 15551234567).');
  }

  // Cleanly tear down previous socket & unregistered auth so pairing starts fresh
  manualDisconnect = true;
  clearReconnectTimer();
  if (activeSock) {
    try {
      activeSock.end(undefined);
    } catch {
      // ignore
    }
    activeSock = null;
  }
  try {
    if (cloudEnabled) await clearCloudSession();
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }

  pairingCode = null;
  pairingPhone = cleanNumber;
  connectedUser = null;
  cachedGroups = [];

  const sock = await startSocket();

  // Wait for WhatsApp WebSocket & Noise handshake readiness (Baileys emits `qr` once pair-device arrives)
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      sock.ev.off('connection.update', onUpdate);
      if (err) reject(err);
      else resolve();
    };

    const onUpdate = (update: { qr?: string; connection?: string; lastDisconnect?: { error?: unknown } }) => {
      if ((activeSock as WASocket | null) !== sock) {
        finish(new Error('Socket restarted during pairing initialization. Please try again.'));
        return;
      }
      if (update.qr) {
        finish();
        return;
      }
      if (update.connection === 'close') {
        const msg =
          update.lastDisconnect?.error instanceof Error
            ? update.lastDisconnect.error.message
            : 'WhatsApp connection closed before pairing code could be requested.';
        finish(new Error(msg));
      }
    };

    const timeout = setTimeout(() => {
      finish(new Error('Timed out waiting for WhatsApp servers to initialize pairing.'));
    }, 12000);

    sock.ev.on('connection.update', onUpdate);
  });

  if ((activeSock as WASocket | null) !== sock) {
    throw new Error('Socket restarted during pairing initialization. Please try again.');
  }

  const sanitizedCustom = customCode?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const rawCode =
    sanitizedCustom && sanitizedCustom.length === 8
      ? await sock.requestPairingCode(cleanNumber, sanitizedCustom)
      : await sock.requestPairingCode(cleanNumber);

  const formatted = rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;
  pairingCode = formatted;
  status = 'pairing';
  lastError = null;

  return getBaileysStatus();
}

export async function disconnectBaileysSession(): Promise<BaileysStatusSnapshot> {
  manualDisconnect = true;
  clearReconnectTimer();
  if (activeSock) {
    try {
      await activeSock.logout();
    } catch {
      try {
        activeSock.end(undefined);
      } catch {
        // ignore
      }
    }
    activeSock = null;
  }
  try {
    if (cloudEnabled) await clearCloudSession();
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  status = 'disconnected';
  pairingCode = null;
  pairingPhone = null;
  connectedUser = null;
  cachedGroups = [];
  lastError = null;
  return getBaileysStatus();
}

export async function refreshBaileysGroups(): Promise<BaileysGroupSummary[]> {
  if (activeSock && status === 'connected') {
    return refreshGroupsList(activeSock);
  }
  return cachedGroups;
}

export function getBaileysStatus(): BaileysStatusSnapshot {
  return {
    status,
    pairingCode,
    pairingPhone,
    connectedUser,
    lastError,
    hasSavedSession: hasSavedCreds(),
    groups: cachedGroups,
  };
}

export async function autoResumeBaileysIfSaved(): Promise<void> {
  if (cloudEnabled) await inspectCloudSession();
  if (hasSavedCreds() && !activeSock) {
    try {
      await startSocket();
    } catch (err) {
      status = 'error';
      lastError = err instanceof Error ? err.message : 'Failed to resume saved WhatsApp session.';
      scheduleReconnect();
    }
  }
}

