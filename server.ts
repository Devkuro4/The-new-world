import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import {
  autoResumeBaileysIfSaved,
  disconnectBaileysSession,
  getBaileysStatus,
  refreshBaileysGroups,
  requestPairingForNumber,
} from './server/baileysManager.ts';
import {
  botState,
  generateBaileysBotCode,
  handleIncomingMessage,
  persistState,
} from './server/botEngine.ts';
import { hasGroqKey } from './server/groqClient.ts';
import type { AnimeCard, BotCommandDef, CommandRole } from './src/shared/botSchema.ts';

dotenv.config();

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getWhatsAppConfigStatus() {
  return {
    groqConfigured: hasGroqKey(),
    verifyTokenConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
    appSecretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
  };
}

async function sendMetaWhatsAppReply(toPhone: string, text: string, imageUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set in Secrets.' };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = imageUrl
    ? {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'image',
        image: {
          link: imageUrl,
          caption: text.slice(0, 1024),
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: text.slice(0, 4096),
        },
      };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Meta Graph API ${res.status}: ${errText.slice(0, 200)}` };
  }
  return { ok: true };
}

async function processMetaWebhookBody(body: unknown): Promise<{ processed: number; replies: Array<{ to: string; handler: string; text: string }> }> {
  void body;
  // Meta Cloud API messages handled here are direct messages. Pieck is group-only.
  return { processed: 0, replies: [] };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    })
  );

  // ── HEALTH & STATE API ──
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      bot: botState.config.botName,
      community: botState.config.bannerTitle,
      baileysStatus: getBaileysStatus().status,
    });
  });

  app.get('/api/state', (_req: Request, res: Response) => {
    res.json({
      config: botState.config,
      groupSettings: botState.groupSettings,
      commands: botState.commands,
      cards: botState.cards,
      auctions: botState.auctions,
      players: Object.values(botState.players),
      logs: botState.logs,
      stats: botState.stats,
      secrets: getWhatsAppConfigStatus(),
      baileys: getBaileysStatus(),
    });
  });

  app.put('/api/config', (req: Request, res: Response) => {
    const body = req.body as Partial<typeof botState.config>;
    if (typeof body.botName === 'string' && body.botName.trim()) {
      botState.config.botName = body.botName.trim().slice(0, 32);
    }
    if (typeof body.creatorName === 'string' && body.creatorName.trim()) {
      botState.config.creatorName = body.creatorName.trim().slice(0, 32);
    }
    if (typeof body.ownerNumber === 'string') {
      const digits = body.ownerNumber.replace(/[^\d]/g, '').slice(0, 15);
      if (digits.length >= 7) {
        botState.config.ownerNumber = digits;
      }
    }
    if (typeof body.bannerTitle === 'string' && body.bannerTitle.trim()) {
      botState.config.bannerTitle = body.bannerTitle.trim().slice(0, 40);
    }
    if (typeof body.prefix === 'string' && body.prefix.trim()) {
      botState.config.prefix = body.prefix.trim().slice(0, 3);
    }
    if (typeof body.rulesText === 'string') {
      botState.config.rulesText = body.rulesText.slice(0, 1000);
    }
    if (typeof body.supportInfo === 'string') {
      botState.config.supportInfo = body.supportInfo.slice(0, 400);
    }
    if (typeof body.communityInfo === 'string') {
      botState.config.communityInfo = body.communityInfo.slice(0, 400);
    }
    if (typeof body.addBotInfo === 'string') {
      botState.config.addBotInfo = body.addBotInfo.slice(0, 400);
    }
    if (typeof body.aiPersonaPrompt === 'string') {
      botState.config.aiPersonaPrompt = body.aiPersonaPrompt.slice(0, 1500);
    }
    if (typeof body.spoilerGuard === 'boolean') {
      botState.config.spoilerGuard = body.spoilerGuard;
    }
    if (typeof body.aiFallbackEnabled === 'boolean') {
      botState.config.aiFallbackEnabled = body.aiFallbackEnabled;
    }
    if (typeof body.dailyReward === 'number' && Number.isFinite(body.dailyReward)) {
      botState.config.dailyReward = Math.max(100, Math.min(50000, Math.round(body.dailyReward)));
    }
    if (typeof body.starterBalance === 'number' && Number.isFinite(body.starterBalance)) {
      botState.config.starterBalance = Math.max(0, Math.min(50000, Math.round(body.starterBalance)));
    }
    if (typeof body.cardSpawnCooldownSec === 'number' && Number.isFinite(body.cardSpawnCooldownSec)) {
      botState.config.cardSpawnCooldownSec = Math.max(5, Math.min(600, Math.round(body.cardSpawnCooldownSec)));
    }
    persistState();
    res.json({ config: botState.config });
  });

  app.put('/api/group', (req: Request, res: Response) => {
    const body = req.body as Partial<typeof botState.groupSettings>;
    if (typeof body.groupName === 'string' && body.groupName.trim()) {
      botState.groupSettings.groupName = body.groupName.trim().slice(0, 60);
    }
    if (typeof body.isOpen === 'boolean') botState.groupSettings.isOpen = body.isOpen;
    if (typeof body.antilink === 'boolean') botState.groupSettings.antilink = body.antilink;
    if (typeof body.antism === 'boolean') botState.groupSettings.antism = body.antism;
    if (typeof body.antigs === 'boolean') botState.groupSettings.antigs = body.antigs;
    if (typeof body.welcomeEnabled === 'boolean') botState.groupSettings.welcomeEnabled = body.welcomeEnabled;
    if (typeof body.welcomeMessage === 'string') botState.groupSettings.welcomeMessage = body.welcomeMessage.slice(0, 400);
    if (typeof body.leaveEnabled === 'boolean') botState.groupSettings.leaveEnabled = body.leaveEnabled;
    if (typeof body.leaveMessage === 'string') botState.groupSettings.leaveMessage = body.leaveMessage.slice(0, 400);
    persistState();
    res.json({ groupSettings: botState.groupSettings });
  });

  app.patch('/api/commands/:name', (req: Request, res: Response) => {
    const cmdName = String(req.params.name || '').toLowerCase();
    const cmd = botState.commands.find((c) => c.name.toLowerCase() === cmdName);
    if (!cmd) {
      res.status(404).json({ error: 'Command not found.' });
      return;
    }
    const body = req.body as { enabled?: boolean; role?: CommandRole; customReply?: string };
    if (typeof body.enabled === 'boolean') cmd.enabled = body.enabled;
    if (body.role === 'everyone' || body.role === 'moderator' || body.role === 'admin' || body.role === 'owner') cmd.role = body.role;
    if (typeof body.customReply === 'string') cmd.customReply = body.customReply.slice(0, 1000);
    persistState();
    res.json({ command: cmd });
  });

  app.post('/api/commands', (req: Request, res: Response) => {
    const body = req.body as Partial<BotCommandDef>;
    const cleanName = String(body.name || '')
      .trim()
      .toLowerCase()
      .replace(/^\.+/, '')
      .replace(/[^a-z0-9_-]/g, '');
    if (!cleanName) {
      res.status(400).json({ error: 'Valid command name is required.' });
      return;
    }
    if (botState.commands.some((c) => c.name.toLowerCase() === cleanName)) {
      res.status(409).json({ error: `Command .${cleanName} already exists.` });
      return;
    }
    const newCmd: BotCommandDef = {
      name: cleanName,
      category: body.category || 'General',
      description: (body.description || 'Custom The new world command').slice(0, 160),
      usage: `${botState.config.prefix}${cleanName}`,
      role: body.role === 'moderator' || body.role === 'admin' || body.role === 'owner' ? body.role : 'everyone',
      enabled: true,
      isCustom: true,
      customReply: (body.customReply || 'Custom response from *{bot}* for *{user}*!').slice(0, 1000),
    };
    botState.commands.unshift(newCmd);
    persistState();
    res.status(201).json({ command: newCmd });
  });

  app.delete('/api/commands/:name', (req: Request, res: Response) => {
    const cmdName = String(req.params.name || '').toLowerCase();
    const target = botState.commands.find((c) => c.name.toLowerCase() === cmdName);
    if (!target || !target.isCustom) {
      res.status(400).json({ error: 'Only custom commands can be deleted.' });
      return;
    }
    botState.commands = botState.commands.filter((c) => c.name.toLowerCase() !== cmdName);
    persistState();
    res.json({ deleted: cmdName });
  });

  app.post('/api/cards', (req: Request, res: Response) => {
    const body = req.body as Partial<AnimeCard>;
    const name = String(body.name || '').trim().slice(0, 48);
    const series = String(body.series || '').trim().slice(0, 64);
    if (!name || !series) {
      res.status(400).json({ error: 'Card name and anime series are required.' });
      return;
    }
    const tier = body.tier === 'S+' || body.tier === 'S' || body.tier === 'A' || body.tier === 'B' || body.tier === 'C' ? body.tier : 'A';
    const card: AnimeCard = {
      id: `C-${Math.floor(200 + Math.random() * 799)}`,
      name,
      series,
      tier,
      atk: Math.min(99, Math.max(30, Number(body.atk) || 85)),
      def: Math.min(99, Math.max(30, Number(body.def) || 80)),
      stardustValue: Math.max(100, Number(body.stardustValue) || 450),
      price: Math.max(500, Number(body.price) || 3200),
    };
    botState.cards.unshift(card);
    persistState();
    res.status(201).json({ card });
  });

  // ── SIMULATOR ENDPOINT ──
  app.post('/api/simulate', async (req: Request, res: Response) => {
    const body = req.body as {
      text?: string;
      senderRole?: CommandRole;
      chatMode?: 'group' | 'dm';
    };
    const text = String(body.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const role: CommandRole = body.senderRole === 'owner' || body.senderRole === 'admin' || body.senderRole === 'moderator' ? body.senderRole : 'everyone';
    const senderMap: Record<CommandRole, { id: string; name: string }> = {
      owner: { id: 'owner-kuro', name: 'kuro' },
      admin: { id: 'admin-rem', name: 'Rem' },
      moderator: { id: 'moderator-hange', name: 'Hange' },
      everyone: { id: 'member-sora', name: 'Sora' },
    };
    const sender = senderMap[role];
    const chatMode = 'group' as const;

    const reply = await handleIncomingMessage({
      senderId: sender.id,
      senderName: sender.name,
      senderRole: role,
      chatMode,
      source: 'simulator',
      text,
    });

    res.json({
      reply,
      players: Object.values(botState.players),
      auctions: botState.auctions,
      groupSettings: botState.groupSettings,
      logs: botState.logs.slice(0, 40),
      stats: botState.stats,
    });
  });

  // ── META WHATSAPP CLOUD API WEBHOOK ──
  app.get('/api/webhook', (req: Request, res: Response) => {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

    if (mode !== 'subscribe' || !challenge) {
      res.status(400).send('Invalid webhook verification query.');
      return;
    }
    if (!expectedToken) {
      res.status(503).send('WHATSAPP_VERIFY_TOKEN is not configured in server secrets.');
      return;
    }
    if (!safeEqual(token, expectedToken)) {
      res.status(403).send('Forbidden: verify token mismatch.');
      return;
    }
    res.status(200).send(challenge);
  });

  app.post('/api/webhook', async (req: RawBodyRequest, res: Response) => {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (appSecret) {
      const signature = String(req.headers['x-hub-signature-256'] || '');
      const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(raw).digest('hex')}`;
      if (!signature || !safeEqual(signature, expected)) {
        res.status(401).json({ error: 'Invalid X-Hub-Signature-256 signature.' });
        return;
      }
    }

    const result = await processMetaWebhookBody(req.body);
    res.status(200).json({ ok: true, ...result });
  });

  app.post('/api/webhook/test-payload', async (req: Request, res: Response) => {
    const sampleText = String((req.body as { text?: string })?.text || `${botState.config.prefix}anime Frieren`);
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'TEST_WABA_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: 'WebhookTester' }, wa_id: '15550199999' }],
                messages: [
                  {
                    from: '15550199999',
                    id: `wamid.${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: sampleText },
                    type: 'text',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processMetaWebhookBody(samplePayload);
    res.json({ payloadSent: samplePayload, result, logs: botState.logs.slice(0, 40) });
  });

  app.post('/api/whatsapp/send-test', async (req: Request, res: Response) => {
    const body = req.body as { to?: string; message?: string };
    const to = String(body.to || '').replace(/[^\d]/g, '');
    const message = String(body.message || '').trim();
    if (!to || to.length < 7 || to.length > 15 || !message) {
      res.status(400).json({ error: 'Provide a valid E.164 digits phone number (7-15 digits) and message.' });
      return;
    }
    const result = await sendMetaWhatsAppReply(to, message);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, to });
  });

  app.get('/api/export-code', (_req: Request, res: Response) => {
    res.json({
      filename: 'pieck-baileys-bot.js',
      code: generateBaileysBotCode(),
    });
  });

  // ── BAILEYS WHATSAPP MULTI-DEVICE (PAIRING CODE & GROUPS) ──
  app.get('/api/baileys/status', (_req: Request, res: Response) => {
    res.json(getBaileysStatus());
  });

  app.post('/api/baileys/pair', async (req: Request, res: Response) => {
    try {
      const body = req.body as { phoneNumber?: string; customCode?: string };
      const snapshot = await requestPairingForNumber(String(body.phoneNumber || ''), body.customCode);
      res.json(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request pairing code.';
      res.status(400).json({ error: message, ...getBaileysStatus() });
    }
  });

  app.post('/api/baileys/disconnect', async (_req: Request, res: Response) => {
    const snapshot = await disconnectBaileysSession();
    res.json(snapshot);
  });

  app.post('/api/baileys/groups/refresh', async (_req: Request, res: Response) => {
    const groups = await refreshBaileysGroups();
    res.json({ ...getBaileysStatus(), groups });
  });

  // ── VITE / STATIC SERVING ──
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`The new world Studio (Pieck Bot) running on http://0.0.0.0:${port}`);
    autoResumeBaileysIfSaved().catch(() => {});
  });
}

startServer();

