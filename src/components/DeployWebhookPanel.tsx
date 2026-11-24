import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Link2, RefreshCw, Send, Smartphone, Terminal, Unlink } from 'lucide-react';

interface SecretsStatus {
  geminiConfigured: boolean;
  verifyTokenConfigured: boolean;
  accessTokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  appSecretConfigured: boolean;
}

export interface BaileysGroupSummary {
  id: string;
  subject: string;
  participantCount: number;
  botIsAdmin: boolean;
  announce: boolean;
}

export interface BaileysStatusSnapshot {
  status: 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'error';
  pairingCode: string | null;
  pairingPhone: string | null;
  connectedUser: { id: string; name?: string } | null;
  lastError: string | null;
  hasSavedSession: boolean;
  sessionEnvConfigured?: boolean;
  groups: BaileysGroupSummary[];
}

interface DeployWebhookPanelProps {
  prefix: string;
  secrets: SecretsStatus;
  initialBaileys: BaileysStatusSnapshot;
  onRefreshLogs: () => void;
}

export const DeployWebhookPanel: React.FC<DeployWebhookPanelProps> = ({
  prefix,
  secrets,
  initialBaileys,
  onRefreshLogs,
}) => {
  const webhookUrl = `${window.location.origin}/api/webhook`;
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPairing, setCopiedPairing] = useState(false);

  // Baileys pairing state
  const [baileys, setBaileys] = useState<BaileysStatusSnapshot>(initialBaileys);
  const [phoneInput, setPhoneInput] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');
  const [refreshingGroups, setRefreshingGroups] = useState(false);
  const [backupSending, setBackupSending] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Meta webhook tester state
  const [testCommand, setTestCommand] = useState(`${prefix}anime Frieren`);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const [targetPhone, setTargetPhone] = useState('');
  const [targetMsg, setTargetMsg] = useState(`Hello from Pieck! Send ${prefix}menu to begin.`);
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sendingReal, setSendingReal] = useState(false);

  const [exportedCode, setExportedCode] = useState('');

  useEffect(() => {
    setBaileys(initialBaileys);
  }, [initialBaileys]);

  // Poll Baileys connection state while pairing or connecting
  useEffect(() => {
    if (baileys.status !== 'pairing' && baileys.status !== 'connecting') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/baileys/status');
        if (res.ok) {
          const snap = (await res.json()) as BaileysStatusSnapshot;
          setBaileys(snap);
        }
      } catch {
        // ignore transient poll error
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [baileys.status]);

  useEffect(() => {
    fetch('/api/export-code')
      .then((r) => r.json())
      .then((data: { code?: string }) => {
        if (data.code) setExportedCode(data.code);
      })
      .catch(() => {});
  }, [prefix]);

  const copyText = async (value: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(value);
    setter(true);
    setTimeout(() => setter(false), 1800);
  };

  const getPhonePreview = (raw: string): { normalized: string; warning: string | null } => {
    let digits = raw.replace(/[^\d]/g, '');
    if (!digits) return { normalized: '', warning: null };
    if (digits.startsWith('00')) digits = digits.slice(2);
    digits = digits
      .replace(/^2340(\d{10})$/, '234$1')
      .replace(/^440(\d{10})$/, '44$1')
      .replace(/^2330(\d{9})$/, '233$1')
      .replace(/^2540(\d{9})$/, '254$1')
      .replace(/^270(\d{9})$/, '27$1');
    if (digits.startsWith('0')) {
      return {
        normalized: '',
        warning: 'Include the country code without "+" or leading "0" (e.g. 14155550199 or 447700900123).',
      };
    }
    return { normalized: digits, warning: null };
  };

  const phonePreview = getPhonePreview(phoneInput);

  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingError('');
    setPairingLoading(true);
    try {
      const res = await fetch('/api/baileys/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phonePreview.normalized || phoneInput,
          customCode: customCodeInput.trim() || undefined,
        }),
      });
      const json = (await res.json()) as BaileysStatusSnapshot & { error?: string };
      if (!res.ok) {
        setPairingError(json.error || 'Could not generate pairing code.');
      }
      if (json.status) setBaileys(json);
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    setPairingLoading(true);
    try {
      const res = await fetch('/api/baileys/disconnect', { method: 'POST' });
      const json = (await res.json()) as BaileysStatusSnapshot;
      setBaileys(json);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleRefreshGroups = async () => {
    setRefreshingGroups(true);
    try {
      const res = await fetch('/api/baileys/groups/refresh', { method: 'POST' });
      const json = (await res.json()) as BaileysStatusSnapshot;
      setBaileys(json);
    } finally {
      setRefreshingGroups(false);
    }
  };

  const handleSendBackupToOwner = async () => {
    setBackupSending(true);
    setBackupStatus(null);
    try {
      const res = await fetch('/api/baileys/backup-to-owner', { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; sentTo?: string; error?: string };
      if (!res.ok) {
        setBackupStatus({ ok: false, text: json.error || 'Could not send session backup.' });
      } else {
        setBackupStatus({
          ok: true,
          text: `Sent BAILEYS_SESSION_B64 privately to ${json.sentTo} on WhatsApp. Paste it in Render Environment Variables.`,
        });
      }
    } catch (err) {
      setBackupStatus({ ok: false, text: err instanceof Error ? err.message : 'Request failed.' });
    } finally {
      setBackupSending(false);
    }
  };

  const handleFireTestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setTestResult('');
    try {
      const res = await fetch('/api/webhook/test-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCommand }),
      });
      const json = await res.json();
      setTestResult(JSON.stringify(json.result, null, 2));
      onRefreshLogs();
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSendRealWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReal(true);
    setSendStatus(null);
    try {
      const res = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetPhone, message: targetMsg }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; to?: string };
      if (!res.ok) {
        setSendStatus({ ok: false, text: json.error || 'Failed to send message.' });
      } else {
        setSendStatus({ ok: true, text: `Delivered to +${json.to} via Meta Graph API.` });
      }
    } catch (err) {
      setSendStatus({ ok: false, text: err instanceof Error ? err.message : 'Request failed.' });
    } finally {
      setSendingReal(false);
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([exportedCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pieck-baileys-bot.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel =
    baileys.status === 'connected'
      ? `Connected (+${baileys.connectedUser?.id || 'Linked'})`
      : baileys.status === 'pairing'
      ? 'Waiting for Phone Pairing'
      : baileys.status === 'connecting'
      ? 'Connecting to WhatsApp...'
      : baileys.status === 'error'
      ? 'Connection Error'
      : 'Disconnected';

  const statusColor =
    baileys.status === 'connected'
      ? 'text-emerald-700'
      : baileys.status === 'pairing' || baileys.status === 'connecting'
      ? 'text-amber-700'
      : baileys.status === 'error'
      ? 'text-rose-600'
      : 'text-slate-600';

  const secretRows = [
    { name: 'GEMINI_API_KEY', desc: 'Powers .gpt, .copilot, .roast, .wyr & natural AI replies', ok: secrets.geminiConfigured },
    { name: 'WHATSAPP_VERIFY_TOKEN', desc: 'Meta Webhook GET verification token', ok: secrets.verifyTokenConfigured },
    { name: 'WHATSAPP_ACCESS_TOKEN', desc: 'Meta Cloud API Graph bearer token for outbound replies', ok: secrets.accessTokenConfigured },
    { name: 'WHATSAPP_PHONE_NUMBER_ID', desc: 'WhatsApp Business sender phone number ID', ok: secrets.phoneNumberIdConfigured },
    { name: 'WHATSAPP_APP_SECRET', desc: 'Verifies X-Hub-Signature-256 on incoming webhooks', ok: secrets.appSecretConfigured },
  ];

  const metaReady = secrets.accessTokenConfigured && secrets.phoneNumberIdConfigured;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900">
          Link WhatsApp (Baileys Pairing Code)
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Sync Pieck directly to your WhatsApp number using an 8-digit pairing code so the bot runs live inside your WhatsApp groups.
        </p>
      </div>

      {/* Live Baileys Pairing Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-4 w-4 text-emerald-700 shrink-0" />
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                WhatsApp Multi-Device Session
              </h2>
              <div className={`text-xs font-medium ${statusColor}`}>{statusLabel}</div>
            </div>
          </div>

          {(baileys.status === 'connected' || baileys.status === 'pairing' || baileys.hasSavedSession) && (
            <button
              type="button"
              disabled={pairingLoading}
              onClick={handleDisconnectBaileys}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 whitespace-nowrap"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Unlink Session</span>
            </button>
          )}
        </div>

        {baileys.status !== 'connected' && (
          <form onSubmit={handleRequestPairing} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Any WhatsApp Number (country code, no + or leading 0)
                </label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (pairingError) setPairingError('');
                  }}
                  placeholder="e.g. 14155550199, 447700900123, or 2348012345678"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Custom Code (optional, 8 chars)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Auto"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 uppercase focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                {phonePreview.warning ? (
                  <span className="font-medium text-rose-600">{phonePreview.warning}</span>
                ) : phonePreview.normalized ? (
                  <span className="text-slate-600">
                    Will pair <span className="font-mono font-semibold text-slate-900">+{phonePreview.normalized}</span> (must match the WhatsApp phone entering the code).
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Any WhatsApp number can connect — enter country code + digits without + or leading 0.
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={pairingLoading || !phoneInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>{pairingLoading ? 'Generating Code...' : 'Get Pairing Code'}</span>
              </button>
            </div>
          </form>
        )}

        {pairingError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {pairingError}
          </div>
        )}

        {baileys.lastError && !pairingError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            {baileys.lastError}
          </div>
        )}

        {/* Active Pairing Code Box */}
        {baileys.pairingCode && baileys.status !== 'connected' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-emerald-800">
                  Pairing Code for +{baileys.pairingPhone}
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tracking-[0.18em] text-slate-900 tabular-nums">
                  {baileys.pairingCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyText(baileys.pairingCode || '', setCopiedPairing)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
              >
                {copiedPairing ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedPairing ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700">
              <li>On the phone registered to <span className="font-mono font-semibold">+{baileys.pairingPhone}</span>, open WhatsApp → <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong> → <strong>Link with phone number instead</strong>.</li>
              <li>Enter <span className="font-mono font-semibold">{baileys.pairingCode}</span> within 60 seconds. This panel switches to Connected automatically.</li>
            </ol>
          </div>
        )}

        {/* Connected WhatsApp Groups + Render Redeploy Persistence */}
        {baileys.status === 'connected' && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Stay Connected After Render Redeploys
                  </div>
                  <div className="text-xs text-slate-500">
                    {baileys.sessionEnvConfigured
                      ? 'BAILEYS_SESSION_B64 is set — Pieck auto-restores after container resets.'
                      : 'Send your session backup privately to the owner WhatsApp DM and save it as BAILEYS_SESSION_B64 in Render.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={backupSending}
                  onClick={handleSendBackupToOwner}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{backupSending ? 'Sending...' : 'DM Backup to Owner'}</span>
                </button>
              </div>
              {backupStatus && (
                <div className={`text-xs font-medium ${backupStatus.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {backupStatus.text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-700">
                Participating WhatsApp Groups ({baileys.groups.length})
              </div>
              <button
                type="button"
                disabled={refreshingGroups}
                onClick={handleRefreshGroups}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingGroups ? 'animate-spin' : ''}`} />
                <span>Refresh Groups</span>
              </button>
            </div>

            {baileys.groups.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                No WhatsApp groups found yet. Add the linked number to any WhatsApp group and send <span className="font-mono">{prefix}menu</span>!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3.5 py-2">Group Name</th>
                      <th className="px-3.5 py-2 text-right">Members</th>
                      <th className="px-3.5 py-2 text-right">Bot Role</th>
                      <th className="px-3.5 py-2 text-right">Chat Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {baileys.groups.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2 font-medium text-slate-900">{g.subject}</td>
                        <td className="px-3.5 py-2 text-right font-mono text-slate-700">{g.participantCount}</td>
                        <td className={`px-3.5 py-2 text-right font-medium ${g.botIsAdmin ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {g.botIsAdmin ? 'Group Admin' : 'Member'}
                        </td>
                        <td className="px-3.5 py-2 text-right text-slate-600">
                          {g.announce ? 'Admins Only' : 'Open'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta Cloud API Webhook Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Optional: Meta WhatsApp Cloud API Webhook
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Alternatively connect an official Meta Business API webhook endpoint.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText(webhookUrl, setCopiedWebhook)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 break-all">
          {webhookUrl}
        </div>

        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
            Server Secrets Status (configure in Settings → Secrets)
          </div>
          {secretRows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <div className="font-mono text-xs font-medium text-slate-900">{row.name}</div>
                <div className="text-xs text-slate-500">{row.desc}</div>
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                  row.ok ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {row.ok ? 'Configured' : 'Not set'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Webhook Payload Tester & Meta Send */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={handleFireTestWebhook} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Simulate Incoming Meta Webhook
          </h2>
          <p className="text-xs text-slate-500">
            Dispatches a test WhatsApp JSON event through POST /api/webhook.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={testLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>{testLoading ? 'Running...' : 'Run Webhook'}</span>
            </button>
          </div>
          {testResult && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
              {testResult}
            </pre>
          )}
        </form>

        <form onSubmit={handleSendRealWhatsApp} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Send Meta Graph Outbound Test
          </h2>
          <p className="text-xs text-slate-500">
            {metaReady
              ? 'Meta Cloud API secrets detected. Send a test message.'
              : 'Optional: add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID for Cloud API.'}
          </p>
          <input
            type="text"
            value={targetPhone}
            onChange={(e) => setTargetPhone(e.target.value)}
            placeholder="Recipient E.164 digits (e.g. 15551234567)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={targetMsg}
              onChange={(e) => setTargetMsg(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!metaReady || sendingReal || !targetPhone.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sendingReal ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
          {sendStatus && (
            <p className={`text-xs font-medium ${sendStatus.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
              {sendStatus.text}
            </p>
          )}
        </form>
      </div>

      {/* Standalone Baileys Export */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Export Standalone Baileys Script
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Download a lightweight standalone Node.js file if you also want to self-host Pieck on another VPS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(exportedCode, setCopiedCode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCode}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .js</span>
            </button>
          </div>
        </div>

        <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11.5px] leading-relaxed text-slate-100">
          {exportedCode || 'Loading generated runner code...'}
        </pre>
      </div>
    </div>
  );
};
