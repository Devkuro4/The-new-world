import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Reply, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import type { BotConfig, CommandRole, CommandThumbnail, GroupSettings, WhatsAppSimButton } from '../shared/botSchema';
import { WhatsAppText } from './WhatsAppText';

export interface SimMessage {
  id: string;
  sender: 'user' | 'bot';
  senderLabel: string;
  text: string;
  quotedText?: string;
  quotedSender?: string;
  imageUrl?: string;
  imageCaption?: string;
  audioUrl?: string;
  thumbnail?: CommandThumbnail;
  buttons?: WhatsAppSimButton[];
  handler?: string;
  timestamp: string;
}

interface WhatsAppSimulatorProps {
  config: BotConfig;
  groupSettings: GroupSettings;
  messages: SimMessage[];
  sending: boolean;
  senderRole: CommandRole;
  chatMode: 'group' | 'dm';
  onChangeRole: (role: CommandRole) => void;
  onChangeChatMode: (mode: 'group' | 'dm') => void;
  onSendMessage: (text: string, quotedText?: string, quotedSender?: string, quotedImageUrl?: string) => void;
  onClearChat: () => void;
}

const AVATAR_SRC = 'https://raw.githubusercontent.com/Devkuro4/The-new-world/02becd7fdb0ce0ce5077d044cb01eb95eefdb862/src/assets/images/anime_bot_avatar_1795503045811.jpg';

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  config,
  groupSettings,
  messages,
  sending,
  senderRole,
  chatMode,
  onChangeRole,
  onChangeChatMode,
  onSendMessage,
  onClearChat,
}) => {
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ text: string; senderLabel: string; imageUrl?: string } | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const p = config.prefix || '.';
  const quickCommands = [
    `${p}menu`,
    `${p}p`,
    `${p}wild`,
    `${p}daily`,
    `${p}anime Frieren`,
    `${p}aquiz`,
    `${p}waifu`,
    `${p}slots 100`,
    `${p}bal`,
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    const activeReply = replyingTo;
    setDraft('');
    setReplyingTo(null);
    onSendMessage(trimmed, activeReply?.text, activeReply?.senderLabel, activeReply?.imageUrl);
  };

  const handleReplyClick = (msg: SimMessage) => {
    setReplyingTo({
      text: msg.text,
      senderLabel: msg.senderLabel,
      imageUrl: msg.imageUrl,
    });
    inputRef.current?.focus();
  };

  return (
    <aside className="flex h-[calc(100vh-5.5rem)] min-h-[620px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Simulator Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-0.5">
          {(['everyone', 'moderator', 'admin', 'owner'] as CommandRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onChangeRole(role)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                senderRole === role ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {role === 'everyone' ? 'Member' : role === 'moderator' ? 'Moderator' : role === 'admin' ? 'Admin' : `Owner (${config.creatorName})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md bg-slate-200/70 px-2.5 py-1 text-xs font-medium text-slate-700">
            Group only
          </div>

          <button
            type="button"
            onClick={() => {
              setReplyingTo(null);
              onClearChat();
            }}
            title="Reset simulator conversation"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Authentic Header */}
      <div className="flex items-center justify-between gap-3 bg-[#008069] px-4 py-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          {!avatarBroken ? (
            <img
              src={AVATAR_SRC}
              alt={`${config.botName} avatar`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarBroken(true)}
              className="h-10 w-10 shrink-0 rounded-full border border-white/25 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900 font-display text-sm font-bold text-emerald-50">
              {config.botName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold leading-tight">
              {chatMode === 'group' ? groupSettings.groupName : config.botName}
            </div>
            <div className="truncate text-xs text-emerald-100/90">
              {chatMode === 'group'
                ? `${config.botName} · Prefix ${config.prefix} · ${groupSettings.isOpen ? 'Open' : 'Muted'}`
                : `${config.botName} · Anime Bot by ${config.creatorName}`}
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-emerald-100/85 whitespace-nowrap shrink-0">
          {config.bannerTitle}
        </div>
      </div>

      {/* Chat Messages Canvas */}
      <div className="whatsapp-wallpaper flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`relative max-w-[92%] rounded-lg px-3.5 py-2.5 shadow-xs ${
                  isUser ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900 border border-slate-200/70'
                }`}
              >
                {!isUser && (
                  <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium text-emerald-700">
                    <span>{msg.senderLabel}</span>
                    <div className="flex items-center gap-2">
                      {msg.handler && <span className="font-normal text-slate-400">{msg.handler}</span>}
                      <button
                        type="button"
                        onClick={() => handleReplyClick(msg)}
                        title="Reply to this message"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
                      >
                        <Reply className="h-3 w-3" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>
                )}

                {msg.quotedText && (
                  <div
                    className={`mb-2 rounded-md border-l-4 border-emerald-600 px-2.5 py-1.5 text-xs ${
                      isUser ? 'bg-black/5' : 'bg-slate-100/80'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-emerald-700">
                      {msg.quotedSender || config.botName}
                    </div>
                    <div className="line-clamp-2 text-[11px] text-slate-600">{msg.quotedText}</div>
                  </div>
                )}

                {msg.imageUrl && !brokenImages[msg.id] && (
                  <div className="mb-2 w-full max-w-[260px] overflow-hidden rounded-md bg-slate-100">
                    <img
                      src={msg.imageUrl}
                      alt={msg.imageCaption || 'Anime media preview'}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [msg.id]: true }))}
                      className="max-h-60 w-full object-cover"
                    />
                    {msg.imageCaption && msg.imageCaption !== msg.text && (
                      <div className="bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-100">
                        {msg.imageCaption}
                      </div>
                    )}
                  </div>
                )}

                {msg.audioUrl && (
                  <audio controls preload="none" src={msg.audioUrl} className="mb-2 w-full max-w-[260px]" />
                )}

                {msg.imageUrl && brokenImages[msg.id] && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{msg.imageCaption || 'Anime media preview unavailable'}</span>
                  </div>
                )}

                {!isUser && msg.thumbnail && !msg.imageUrl && (
                  <a
                    href={msg.thumbnail.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={msg.thumbnail.title}
                    className="mb-2 block w-full min-w-[200px] max-w-[260px] overflow-hidden rounded-md transition-opacity hover:opacity-95"
                  >
                    {!brokenThumbs[msg.id] ? (
                      <img
                        src={msg.thumbnail.imageUrl}
                        alt={msg.thumbnail.title}
                        onError={() => setBrokenThumbs((prev) => ({ ...prev, [msg.id]: true }))}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-emerald-50 text-emerald-700">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    )}
                  </a>
                )}

                <WhatsAppText text={msg.text} />

                <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500 tabular-nums">
                  {isUser && (
                    <button
                      type="button"
                      onClick={() => handleReplyClick(msg)}
                      title="Reply to this message"
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-emerald-700 transition-opacity"
                    >
                      <Reply className="h-3 w-3" />
                    </button>
                  )}
                  <span>{msg.timestamp}</span>
                  {isUser && <CheckCheck className="h-3.5 w-3.5 text-sky-600" />}
                </div>
              </div>

              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-1.5 flex max-w-[88%] flex-wrap gap-1.5">
                  {msg.buttons.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      disabled={sending}
                      onClick={() => onSendMessage(btn.command)}
                      className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-slate-200/70 bg-white px-3.5 py-2 text-xs text-slate-500 shadow-xs">
              {config.botName} is typing...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Command Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2">
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            type="button"
            disabled={sending}
            onClick={() => onSendMessage(cmd)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 whitespace-nowrap shrink-0 transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Active Reply Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-100 px-3 py-2">
          <div className="min-w-0 flex-1 rounded border-l-4 border-emerald-600 bg-white px-2.5 py-1.5">
            <div className="text-[11px] font-semibold text-emerald-700">
              Replying to {replyingTo.senderLabel}
            </div>
            <div className="truncate text-xs text-slate-600">{replyingTo.text}</div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Message Composer */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-[#f0f2f5] px-3 py-2.5">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            replyingTo
              ? `Reply to ${replyingTo.senderLabel}...`
              : `Message ${config.botName} (try ${p}menu, ${p}mem, or ask anything)...`
          }
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#008069] text-white transition-colors hover:bg-[#006d59] disabled:opacity-45"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
};

