import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CommandsPanel } from './components/CommandsPanel';
import { DeployWebhookPanel, type BaileysStatusSnapshot } from './components/DeployWebhookPanel';
import { EconomyCardsPanel } from './components/EconomyCardsPanel';
import { GroupAiPanel } from './components/GroupAiPanel';
import { LogsPanel } from './components/LogsPanel';
import { WhatsAppSimulator, type SimMessage } from './components/WhatsAppSimulator';
import {
  DEFAULT_BOT_CONFIG,
  DEFAULT_COMMANDS,
  DEFAULT_GROUP_SETTINGS,
  type ActivityLogEntry,
  type AnimeCard,
  type AuctionItem,
  type BotCommandDef,
  type BotConfig,
  type BotReplyPayload,
  type CommandCategory,
  type CommandRole,
  type GroupSettings,
  type PlayerProfile,
} from './shared/botSchema';

type WorkspaceTab = 'commands' | 'economy' | 'group-ai' | 'deploy' | 'logs';

interface SecretsStatus {
  groqConfigured: boolean;
  verifyTokenConfigured: boolean;
  accessTokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  appSecretConfigured: boolean;
}

interface StateApiResponse {
  config: BotConfig;
  groupSettings: GroupSettings;
  commands: BotCommandDef[];
  cards: AnimeCard[];
  auctions: AuctionItem[];
  players: PlayerProfile[];
  logs: ActivityLogEntry[];
  stats: {
    totalCommands: number;
    totalAiCalls: number;
    totalCardDrops: number;
    startedAt: string;
  };
  secrets: SecretsStatus;
  baileys: BaileysStatusSnapshot;
}

function nowStamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeWelcomeSimMessages(cfg: BotConfig): SimMessage[] {
  return [
    {
      id: 'welcome-1',
      sender: 'bot',
      senderLabel: cfg.botName,
      handler: `${cfg.botName} Ready`,
      text: [
        `✦ ${cfg.bannerTitle.toUpperCase()} ✦`,
        `${cfg.botName} · prefix ${cfg.prefix}`,
        ``,
        `▎✦ 📖 WELCOME ✦`,
        `▎┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈`,
        `▎🤖 Bot ❯ ${cfg.botName}`,
        `▎👑 Creator ❯ ${cfg.creatorName}`,
        `▎⌨️ Prefix ❯ ${cfg.prefix}`,
        `▎`,
        `▎↳ try ${cfg.prefix}menu · ${cfg.prefix}cards · ${cfg.prefix}bal · ${cfg.prefix}mem`,
      ].join('\n'),
      buttons: [
        { id: 'init_menu', label: `Open ${cfg.prefix}menu`, command: `${cfg.prefix}menu` },
        { id: 'init_wild', label: `Spawn ${cfg.prefix}wild`, command: `${cfg.prefix}wild` },
        { id: 'init_quiz', label: `Play ${cfg.prefix}aquiz`, command: `${cfg.prefix}aquiz` },
      ],
      timestamp: nowStamp(),
    },
  ];
}

export default function App() {
  const [authState, setAuthState] = useState<'checking' | 'locked' | 'authenticated'>('checking');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('commands');
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [groupSettings, setGroupSettings] = useState<GroupSettings>(DEFAULT_GROUP_SETTINGS);
  const [commands, setCommands] = useState<BotCommandDef[]>(DEFAULT_COMMANDS);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState({ totalCommands: 0, totalAiCalls: 0, totalCardDrops: 0, startedAt: '' });
  const [secrets, setSecrets] = useState<SecretsStatus>({
    groqConfigured: false,
    verifyTokenConfigured: false,
    accessTokenConfigured: false,
    phoneNumberIdConfigured: false,
    appSecretConfigured: false,
  });
  const [baileys, setBaileys] = useState<BaileysStatusSnapshot>({
    status: 'disconnected',
    pairingCode: null,
    pairingPhone: null,
    connectedUser: null,
    lastError: null,
    hasSavedSession: false,
    groups: [],
  });

  const [senderRole, setSenderRole] = useState<CommandRole>('owner');
  const [chatMode, setChatMode] = useState<'group' | 'dm'>('group');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<SimMessage[]>(() => makeWelcomeSimMessages(DEFAULT_BOT_CONFIG));

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = (await res.json()) as StateApiResponse;
      setConfig(data.config);
      setGroupSettings(data.groupSettings);
      setCommands(data.commands);
      setPlayers(data.players);
      setLogs(data.logs);
      setStats(data.stats);
      setSecrets(data.secrets);
      if (data.baileys) setBaileys(data.baileys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/status').then(res => {
      setAuthState(res.ok ? 'authenticated' : 'locked');
    }).catch(() => {
      setAuthError('Unable to reach the dashboard server.');
      setAuthState('locked');
    });
  }, []);

  useEffect(() => {
    if (authState === 'authenticated') void fetchState();
  }, [authState, fetchState]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Unable to sign in.');
      setPassword('');
      setAuthState('authenticated');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSendMessage = async (
    text: string,
    quotedText?: string,
    quotedSender?: string,
    quotedImageUrl?: string
  ) => {
    const senderLabel = senderRole === 'owner' ? config.creatorName : senderRole === 'admin' ? 'Rem (Admin)' : 'Sora';
    const userMsg: SimMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      senderLabel,
      text,
      quotedText,
      quotedSender,
      timestamp: nowStamp(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, senderRole, chatMode, quotedText, quotedImageUrl }),
      });
      const data = (await res.json()) as {
        reply?: BotReplyPayload;
        players?: PlayerProfile[];
        auctions?: AuctionItem[];
        groupSettings?: GroupSettings;
        logs?: ActivityLogEntry[];
        stats?: typeof stats;
        error?: string;
      };

      const replyPayload = data.reply;
      const toSimMsg = (payload: BotReplyPayload | undefined, suffix: string): SimMessage => ({
        id: `b-${Date.now()}${suffix}`,
        sender: 'bot',
        senderLabel: config.botName,
        text: payload?.text || data.error || 'Unable to process command.',
        imageUrl: payload?.imageUrl,
        audioUrl: payload?.audioUrl,
        imageCaption: payload?.imageCaption,
        thumbnail: payload?.thumbnail,
        buttons: payload?.buttons,
        handler: payload?.handler,
        timestamp: nowStamp(),
      });
      const outgoingMsgs: SimMessage[] = [toSimMsg(replyPayload, '')];
      if (replyPayload?.followUp) {
        outgoingMsgs.push(toSimMsg(replyPayload.followUp, '-fu'));
      }
      setMessages((prev) => [...prev, ...outgoingMsgs]);

      if (data.players) setPlayers(data.players);
      if (data.groupSettings) setGroupSettings(data.groupSettings);
      if (data.logs) setLogs(data.logs);
      if (data.stats) setStats(data.stats);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-err-${Date.now()}`,
          sender: 'bot',
          senderLabel: config.botName,
          text: `Network error reaching ${config.botName} backend.`,
          handler: 'Error',
          timestamp: nowStamp(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleToggleCommand = async (name: string, enabled: boolean) => {
    setCommands((prev) => prev.map((c) => (c.name === name ? { ...c, enabled } : c)));
    await fetch(`/api/commands/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  };

  const handleChangeCommandRole = async (name: string, role: CommandRole) => {
    setCommands((prev) => prev.map((c) => (c.name === name ? { ...c, role } : c)));
    await fetch(`/api/commands/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
  };

  const handleCreateCommand = async (payload: {
    name: string;
    category: CommandCategory;
    description: string;
    role: CommandRole;
    customReply: string;
  }) => {
    const res = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { command?: BotCommandDef; error?: string };
    if (!res.ok) throw new Error(json.error || 'Failed to add command');
    if (json.command) setCommands((prev) => [json.command!, ...prev]);
  };

  const handleDeleteCommand = async (name: string) => {
    const res = await fetch(`/api/commands/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.ok) {
      setCommands((prev) => prev.filter((c) => c.name !== name));
    }
  };



  const handleSaveConfig = async (patch: Partial<BotConfig>) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = (await res.json()) as { config?: BotConfig };
    if (json.config) setConfig(json.config);
  };

  const handleSaveGroup = async (patch: Partial<GroupSettings>) => {
    const res = await fetch('/api/group', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = (await res.json()) as { groupSettings?: GroupSettings };
    if (json.groupSettings) setGroupSettings(json.groupSettings);
  };

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'commands', label: 'Commands' },
    { id: 'economy', label: 'Economy & Cards' },
    { id: 'group-ai', label: 'Group & AI' },
    { id: 'deploy', label: 'WhatsApp Link' },
    { id: 'logs', label: 'Activity Logs' },
  ];

  if (authState === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">Opening secure dashboard…</div>;
  }

  if (authState === 'locked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">The new world</p>
            <h1 className="mt-2 text-2xl font-semibold">Admin access</h1>
            <p className="mt-2 text-sm text-slate-400">Enter the dashboard password to continue.</p>
          </div>
          <label className="text-xs font-medium text-slate-300">
            Password
            <input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
              placeholder="Enter password" autoComplete="current-password" />
          </label>
          {authError && <p className="mt-3 text-xs text-rose-400">{authError}</p>}
          <button type="submit" disabled={authBusy || !password}
            className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
            {authBusy ? 'Checking…' : 'Enter dashboard'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('commands');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            The new world
          </a>

          <nav className="hidden md:flex items-center gap-6 overflow-x-auto">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-emerald-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button type="button" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setAuthState('locked'); }}
              className="mr-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Lock
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('deploy')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {baileys.status === 'connected' ? 'WhatsApp Linked' : 'Pair Phone'}
            </button>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                activeTab === item.id ? 'text-emerald-700 font-semibold' : 'text-slate-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Configuration & Control Viewport */}
          <section className="lg:col-span-7">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
                <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-64 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <>
                {activeTab === 'commands' && (
                  <CommandsPanel
                    prefix={config.prefix}
                    commands={commands}
                    onToggleCommand={handleToggleCommand}
                    onChangeRole={handleChangeCommandRole}
                    onCreateCommand={handleCreateCommand}
                    onDeleteCommand={handleDeleteCommand}
                    onRunInSimulator={handleSendMessage}
                  />
                )}
                {activeTab === 'economy' && (
                  <EconomyCardsPanel
                    config={config}
                    players={players}
                    onUpdateRates={handleSaveConfig}
                    onRunInSimulator={handleSendMessage}
                  />
                )}
                {activeTab === 'group-ai' && (
                  <GroupAiPanel
                    config={config}
                    groupSettings={groupSettings}
                    onSaveConfig={handleSaveConfig}
                    onSaveGroup={handleSaveGroup}
                  />
                )}
                {activeTab === 'deploy' && (
                  <DeployWebhookPanel
                    prefix={config.prefix}
                    secrets={secrets}
                    initialBaileys={baileys}
                    onRefreshLogs={fetchState}
                  />
                )}
                {activeTab === 'logs' && (
                  <LogsPanel
                    logs={logs}
                    totalCommands={stats.totalCommands}
                    totalAiCalls={stats.totalAiCalls}
                    totalCardDrops={stats.totalCardDrops}
                  />
                )}
              </>
            )}
          </section>

          {/* Right Persistent WhatsApp Simulator */}
          <div className="lg:col-span-5 lg:sticky lg:top-[4.75rem]">
            <WhatsAppSimulator
              config={config}
              groupSettings={groupSettings}
              messages={messages}
              sending={sending}
              senderRole={senderRole}
              chatMode={chatMode}
              onChangeRole={setSenderRole}
              onChangeChatMode={setChatMode}
              onSendMessage={handleSendMessage}
              onClearChat={() => setMessages(makeWelcomeSimMessages(config))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

