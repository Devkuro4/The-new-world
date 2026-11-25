import React, { useState } from 'react';
import type { BotConfig, GroupSettings } from '../shared/botSchema';

interface GroupAiPanelProps {
  config: BotConfig;
  groupSettings: GroupSettings;
  onSaveConfig: (patch: Partial<BotConfig>) => Promise<void>;
  onSaveGroup: (patch: Partial<GroupSettings>) => Promise<void>;
}

export const GroupAiPanel: React.FC<GroupAiPanelProps> = ({
  config,
  groupSettings,
  onSaveConfig,
  onSaveGroup,
}) => {
  const [botName, setBotName] = useState(config.botName);
  const [creatorName, setCreatorName] = useState(config.creatorName);
  const [ownerNumber, setOwnerNumber] = useState(config.ownerNumber);
  const [bannerTitle, setBannerTitle] = useState(config.bannerTitle);
  const [prefix, setPrefix] = useState(config.prefix);
  const [rulesText, setRulesText] = useState(config.rulesText);
  const [aiPersonaPrompt, setAiPersonaPrompt] = useState(config.aiPersonaPrompt);
  const [spoilerGuard, setSpoilerGuard] = useState(config.spoilerGuard);
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(config.aiFallbackEnabled);
  const [savingBot, setSavingBot] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  const [groupName, setGroupName] = useState(groupSettings.groupName);
  const [welcomeMessage, setWelcomeMessage] = useState(groupSettings.welcomeMessage);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBot(true);
    setSavedNotice('');
    try {
      await onSaveConfig({
        botName,
        creatorName,
        ownerNumber,
        bannerTitle,
        prefix,
        rulesText,
        aiPersonaPrompt,
        spoilerGuard,
        aiFallbackEnabled,
      });
      await onSaveGroup({
        groupName,
        welcomeMessage,
      });
      setSavedNotice('Settings saved and synced to live Pieck engine.');
    } finally {
      setSavingBot(false);
    }
  };

  const toggleFlags: Array<{
    key: keyof GroupSettings;
    label: string;
    desc: string;
    value: boolean;
  }> = [
    { key: 'isOpen', label: 'Group Open', desc: 'Allow all members to message (off = Admin-only mute)', value: groupSettings.isOpen },
    { key: 'antilink', label: 'Antilink Guard', desc: 'Block unauthorized external & WhatsApp invite links', value: groupSettings.antilink },
    { key: 'antism', label: 'Anti-Spam Filter', desc: 'Throttle repetitive command floods in group chats', value: groupSettings.antism },
    { key: 'antigs', label: 'Anti-Group-Status', desc: 'Block unwanted group status mention forwards', value: groupSettings.antigs },
    { key: 'welcomeEnabled', label: 'Welcome Greeting', desc: 'Send custom welcome card when new members join', value: groupSettings.welcomeEnabled },
    { key: 'leaveEnabled', label: 'Leave Greeting', desc: 'Send farewell notice when members exit the group', value: groupSettings.leaveEnabled },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900">
          Group Moderation & AI Persona
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Customize Pieck&apos;s identity, The new world group protection flags, and Groq GPT-OSS AI behavior.
        </p>
      </div>

      {/* Group Moderation Switches */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-slate-900">
            Live Group Moderation Flags
          </span>
          <span className="text-xs text-slate-500">Synced with {config.prefix}gs & admin commands</span>
        </div>

        {toggleFlags.map((flag) => (
          <div key={flag.key} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <div className="text-sm font-medium text-slate-900">{flag.label}</div>
              <div className="text-xs text-slate-500">{flag.desc}</div>
            </div>
            <button
              type="button"
              onClick={() => onSaveGroup({ [flag.key]: !flag.value })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                flag.value
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {flag.value ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>

      {/* Bot Identity + AI Persona Form */}
      <form onSubmit={handleSaveIdentity} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-slate-900">
          Bot Identity & Groq AI Prompt
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <label className="text-xs font-medium text-slate-700">
            Bot Name
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Creator
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Owner Number
            <input
              type="text"
              value={ownerNumber}
              onChange={(e) => setOwnerNumber(e.target.value)}
              placeholder="2347061426124"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Prefix
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Menu Banner
            <input
              type="text"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-700">
            Group Name
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Welcome Template
            <input
              type="text"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-slate-700">
          Rules Text ({prefix}rules)
          <textarea
            rows={3}
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Groq AI Persona Instruction ({prefix}gpt, {prefix}copilot, natural chat)
          <textarea
            rows={3}
            value={aiPersonaPrompt}
            onChange={(e) => setAiPersonaPrompt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={spoilerGuard}
              onChange={(e) => setSpoilerGuard(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            <span>Spoiler Guard (protect anime plot twists)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={aiFallbackEnabled}
              onChange={(e) => setAiFallbackEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            <span>Respond naturally with AI to non-prefix messages</span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-medium text-emerald-700">{savedNotice}</span>
          <button
            type="submit"
            disabled={savingBot}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingBot ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

