import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type GroupMetadata,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { botState, handleIncomingMessage } from './botEngine.ts';
import { getPreviewLink, getThumbBuffer, resolveLocalAsset } from './assets.ts';
import type { CommandRole } from '../src/shared/botSchema.ts';

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
let cachedGroups: BaileysGroupSummary[] = [];

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
  return fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
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

function extractMessageText(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return '';
  const inner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m;

  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
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
  return (
    q.conversation ||
    q.extendedTextMessage?.text ||
    q.imageMessage?.caption ||
    q.videoMessage?.caption ||
    ''
  ).trim();
}

function extractContextInfo(msg: WAMessage) {
  const message = msg.message;
  if (!message) return undefined;
  const inner =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message;
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

async function sendBotReply(
  sock: WASocket,
  remoteJid: string,
  quoted: WAMessage,
  reply: { text: string; imageUrl?: string; imageCaption?: string; audioUrl?: string; audioPath?: string; videoPath?: string; buttons?: Array<{ label: string; command: string }> },
  mentions?: string[]
): Promise<void> {
  let finalText = reply.text;
  if (reply.buttons && reply.buttons.length > 0) {
    const quickLines = reply.buttons.map((b) => `↳ *${b.command}* — ${b.label}`).join('\n');
    finalText = `${finalText}\n\n*Quick Actions*\n${quickLines}`;
  }

  if (reply.imageUrl) {
    try {
      // Bundled artwork (e.g. the Pieck menu image) is read from disk; anything else is a URL.
      const localFile = resolveLocalAsset(reply.imageUrl);
      const imageMessage = await sock.sendMessage(
        remoteJid,
        {
          image: localFile ? fs.readFileSync(localFile) : { url: reply.imageUrl },
          caption: (reply.imageCaption || botState.config.botName).slice(0, 1024),
          mentions,
        },
        { quoted }
      );
      trackSentId(imageMessage?.key?.id);
    } catch {
      // Continue with the complete text when an external thumbnail is unavailable.
    }
  }

  // Replies without their own image get a small link-preview card with the Pieck thumbnail.
  // Off by default: only enabled with LINK_THUMBNAILS=on, so a card problem can never block replies.
  const cardsEnabled = process.env.LINK_THUMBNAILS?.trim().toLowerCase() === 'on';
  const thumb = cardsEnabled && !reply.imageUrl && !(mentions && mentions.length > 1) ? getThumbBuffer() : null;
  const linkCard = thumb
    ? {
        externalAdReply: {
          title: botState.config.bannerTitle,
          body: `${botState.config.botName} · ${botState.config.prefix}menu`,
          thumbnail: thumb,
          mediaType: 1,
          renderLargerThumbnail: false,
          showAdAttribution: false,
          sourceUrl: getPreviewLink(botState.config.ownerNumber),
        },
      }
    : undefined;

  const plainContent = { text: finalText.slice(0, 4096), mentions };
  let textMessage;
  try {
    textMessage = await sock.sendMessage(
      remoteJid,
      linkCard ? { ...plainContent, contextInfo: { ...linkCard, mentionedJid: mentions || [] } } : plainContent,
      { quoted }
    );
  } catch (error) {
    if (!linkCard) throw error;
    // The thumbnail card was rejected: always fall back to the plain reply.
    textMessage = await sock.sendMessage(remoteJid, plainContent, { quoted });
  }
  trackSentId(textMessage?.key?.id);

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
  const cmd = rawCmd.toLowerCase();
  const command = botState.commands.find(
    (item) => item.name === cmd || item.aliases?.includes(cmd)
  );
  if (!command || roleRank(senderRole) < roleRank(command.role)) return {};

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

  const botNums = jidNumbers(sock.user?.id, sock.user?.lid);
  const botParticipant = participants.find((participant) =>
    sharesNumber(participantNumbers(participant), botNums)
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
      const context = msg.message?.extendedTextMessage?.contextInfo;
      if (!context?.stanzaId) return { error: `Reply to the message you want Pieck to delete.` };
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

async function startSocket(): Promise<WASocket> {
  clearReconnectTimer();
  manualDisconnect = false;
  lastError = null;
  status = 'connecting';

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    if (activeSock !== sock) return;
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      status = 'connected';
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
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {
          // ignore
        }
        return;
      }

      // Reconnect automatically (including DisconnectReason.restartRequired 515 right after pairing!)
      status = pairingCode ? 'pairing' : 'connecting';
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        if (!manualDisconnect) {
          startSocket().catch((err) => {
            status = 'error';
            lastError = err instanceof Error ? err.message : 'Reconnect failed';
          });
        }
      }, 1500);
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
        if (!isCommand && !taggedOrReplied) continue;
        const text = isCommand ? rawText : stripBotMention(sock, rawText);

        const senderJid = isGroup ? msg.key.participant || remoteJid : remoteJid;
        const senderNumber = normalizeJidToNumber(senderJid);
        const ownerDigits = (botState.config.ownerNumber || '').replace(/[^\d]/g, '');
        const senderNums = jidNumbers(msg.key.participant, msg.key.participantAlt, senderJid);
        const isOwnerNumber = Boolean(ownerDigits && senderNums.has(ownerDigits));
        const senderName = isOwnerNumber
          ? botState.config.creatorName
          : msg.pushName || `WA-${senderNumber.slice(-4)}`;

        let senderRole: CommandRole = 'everyone';
        let meta: GroupMetadata | null = null;

        if (msg.key.fromMe || isOwnerNumber) {
          senderRole = 'owner';
        } else if (isGroup) {
          meta = await getGroupMeta(sock, remoteJid);
          const participant = meta?.participants.find((pt) =>
            sharesNumber(participantNumbers(pt), senderNums)
          );
          if (participant?.admin === 'admin' || participant?.admin === 'superadmin') {
            senderRole = 'admin';
          } else if ([...senderNums].some((n) => botState.groupSettings.moderatorNumbers.includes(n))) {
            senderRole = 'moderator';
          }
        }

        if (isGroup && senderRole === 'everyone' && botState.groupSettings.antism) {
          const now = Date.now();
          const key = `${remoteJid}:${senderNumber}`;
          const times = (recentMessages.get(key) || []).filter((time) => now - time < 10_000);
          times.push(now);
          recentMessages.set(key, times);
          if (times.length > 6) {
            await sendBotReply(sock, remoteJid, msg, {
              text: `Slow down, @${senderNumber}. Anti-spam is active.`,
            }, [senderJid]);
            continue;
          }
        }

        const effect: GroupCommandEffect = isGroup
          ? await handleBaileysGroupCommandSideEffects(sock, remoteJid, msg, text, senderRole, meta)
          : {};
        if (effect.error) {
          await sendBotReply(sock, remoteJid, msg, {
            text: `*Command failed*\n${effect.error}`,
          });
          continue;
        }

        const reply = await handleIncomingMessage({
          senderId: isOwnerNumber ? 'owner-kuro' : `wa-${senderNumber}`,
          senderName,
          senderRole,
          chatMode: 'group',
          source: 'baileys',
          text,
          quotedText: extractQuotedText(msg),
        });

        let outgoing = reply;
        if (effect.tagList) {
          const note = text.slice(prefix.length).trim().split(/\s+/).slice(1).join(' ');
          const isHidden = text.slice(prefix.length).trim().toLowerCase().startsWith('hidetag');
          outgoing = {
            ...reply,
            text: isHidden
              ? `📢 *Announcement:* ${note || 'Check pinned anime schedule!'}`
              : `📢 *TAG ALL*${note ? `  ·  ${note}` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${effect.tagList}`,
          };
        }
        await sendBotReply(sock, remoteJid, msg, outgoing, effect.mentions);
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Message handler error';
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
  if (hasSavedCreds() && !activeSock) {
    try {
      await startSocket();
    } catch (err) {
      status = 'error';
      lastError = err instanceof Error ? err.message : 'Failed to resume saved WhatsApp session.';
    }
  }
}

