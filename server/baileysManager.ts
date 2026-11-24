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

function extractTargetJids(msg: WAMessage): string[] {
  const m = msg.message;
  if (!m) return [];
  const ctx =
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo;
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
  reply: { text: string; imageUrl?: string; buttons?: Array<{ label: string; command: string }> },
  mentions?: string[]
): Promise<void> {
  let finalText = reply.text;
  if (reply.buttons && reply.buttons.length > 0) {
    const quickLine = reply.buttons.map((b) => `*${b.command}* (${b.label})`).join(' · ');
    finalText = `${finalText}\n\n_Quick actions:_ ${quickLine}`;
  }

  if (reply.imageUrl) {
    try {
      const sent = await sock.sendMessage(
        remoteJid,
        {
          image: { url: reply.imageUrl },
          caption: finalText.slice(0, 1024),
          mentions,
        },
        { quoted }
      );
      trackSentId(sent?.key?.id);
      return;
    } catch {
      // Fall back to text if external image CDN fails
    }
  }

  const sent = await sock.sendMessage(
    remoteJid,
    {
      text: finalText.slice(0, 4096),
      mentions,
    },
    { quoted }
  );
  trackSentId(sent?.key?.id);
}

async function handleBaileysGroupCommandSideEffects(
  sock: WASocket,
  remoteJid: string,
  msg: WAMessage,
  text: string,
  senderRole: CommandRole,
  meta: GroupMetadata | null
): Promise<string[] | undefined> {
  const prefix = botState.config.prefix || '.';
  if (!text.startsWith(prefix)) return undefined;
  const [rawCmd = ''] = text.slice(prefix.length).trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();

  if (cmd === 'tagall' || cmd === 'hidetag') {
    if (senderRole === 'everyone') return undefined;
    return meta?.participants.map((p) => p.id) || [];
  }

  if (senderRole === 'everyone') return undefined;

  try {
    if (cmd === 'mute' || cmd === 'close') {
      await sock.groupSettingUpdate(remoteJid, 'announcement');
    } else if (cmd === 'unmute' || cmd === 'open') {
      await sock.groupSettingUpdate(remoteJid, 'not_announcement');
    } else if (cmd === 'kick' || cmd === 'promote' || cmd === 'demote') {
      const targets = extractTargetJids(msg);
      if (targets.length > 0) {
        const action = cmd === 'kick' ? 'remove' : cmd;
        await sock.groupParticipantsUpdate(remoteJid, targets, action);
      }
    } else if (cmd === 'delete') {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      if (ctx?.stanzaId) {
        await sock.sendMessage(remoteJid, {
          delete: {
            remoteJid,
            fromMe: false,
            id: ctx.stanzaId,
            participant: ctx.participant,
          },
        });
      }
    }
  } catch {
    // Non-fatal if bot is not yet group admin
  }
  return undefined;
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

        const text = extractMessageText(msg);
        if (!text) continue;

        const isGroup = remoteJid.endsWith('@g.us');
        // Allow owner testing commands starting with prefix from their own paired phone, but ignore non-prefix self messages
        if (msg.key.fromMe && !text.startsWith(prefix)) continue;

        const senderJid = isGroup ? msg.key.participant || remoteJid : remoteJid;
        const senderNumber = normalizeJidToNumber(senderJid);
        const ownerDigits = (botState.config.ownerNumber || '').replace(/[^\d]/g, '');
        const isOwnerNumber = Boolean(ownerDigits && senderNumber === ownerDigits);
        const senderName = isOwnerNumber
          ? botState.config.creatorName
          : msg.pushName || `WA-${senderNumber.slice(-4)}`;

        let senderRole: CommandRole = 'everyone';
        let meta: GroupMetadata | null = null;

        if (msg.key.fromMe || isOwnerNumber) {
          senderRole = 'owner';
        } else if (isGroup) {
          meta = await getGroupMeta(sock, remoteJid);
          const participant = meta?.participants.find(
            (pt) => normalizeJidToNumber(pt.id) === senderNumber
          );
          if (participant?.admin === 'admin' || participant?.admin === 'superadmin') {
            senderRole = 'admin';
          }
        }

        const mentions = isGroup
          ? await handleBaileysGroupCommandSideEffects(sock, remoteJid, msg, text, senderRole, meta)
          : undefined;

        const reply = await handleIncomingMessage({
          senderId: isOwnerNumber ? 'owner-kuro' : `wa-${senderNumber}`,
          senderName,
          senderRole,
          chatMode: isGroup ? 'group' : 'dm',
          source: 'baileys',
          text,
        });

        await sendBotReply(sock, remoteJid, msg, reply, mentions);
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
