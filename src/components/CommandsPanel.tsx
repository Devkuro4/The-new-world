import React, { useMemo, useState } from 'react';
import { Play, Plus, Search, Trash2 } from 'lucide-react';
import {
  COMMAND_CATEGORIES,
  type BotCommandDef,
  type CommandCategory,
  type CommandRole,
} from '../shared/botSchema';

interface CommandsPanelProps {
  prefix: string;
  commands: BotCommandDef[];
  onToggleCommand: (name: string, enabled: boolean) => void;
  onChangeRole: (name: string, role: CommandRole) => void;
  onCreateCommand: (payload: {
    name: string;
    category: CommandCategory;
    description: string;
    role: CommandRole;
    customReply: string;
  }) => Promise<void>;
  onDeleteCommand: (name: string) => void;
  onRunInSimulator: (command: string) => void;
}

export const CommandsPanel: React.FC<CommandsPanelProps> = ({
  prefix,
  commands,
  onToggleCommand,
  onChangeRole,
  onCreateCommand,
  onDeleteCommand,
  onRunInSimulator,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CommandCategory>('All');
  const [showCreator, setShowCreator] = useState(false);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<CommandCategory>('General');
  const [newRole, setNewRole] = useState<CommandRole>('everyone');
  const [newDesc, setNewDesc] = useState('');
  const [newReply, setNewReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commands.filter((cmd) => {
      if (selectedCategory !== 'All' && cmd.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        (cmd.aliases && cmd.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    });
  }, [commands, search, selectedCategory]);

  const enabledCount = useMemo(() => commands.filter((c) => c.enabled).length, [commands]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newName.trim() || !newReply.trim()) {
      setFormError('Enter both a command trigger name and a reply message.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateCommand({
        name: newName,
        category: newCategory,
        description: newDesc || 'Custom Pieck command',
        role: newRole,
        customReply: newReply,
      });
      setNewName('');
      setNewDesc('');
      setNewReply('');
      setShowCreator(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add command.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Command Registry
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {enabledCount} active of {commands.length} total commands · Prefix {prefix}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreator((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{showCreator ? 'Close Builder' : 'New Command'}</span>
        </button>
      </div>

      {/* Custom Command Builder */}
      {showCreator && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Add Custom {prefix} Command
            </h2>
            <span className="text-xs text-slate-500">
              Supports {'{user}'}, {'{bot}'}, {'{arg}'} variables
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Command Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. schedule"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CommandCategory)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {COMMAND_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Minimum Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as CommandRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="everyone">Everyone</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Short Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What does this command do?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">WhatsApp Reply Text</label>
            <textarea
              rows={3}
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              placeholder="Hi *{user}*! New anime episodes drop at 18:00 UTC."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreator(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Command'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search commands (${prefix}card, ${prefix}anime, ${prefix}daily, ${prefix}warn)...`}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              All ({commands.length})
            </button>
            {COMMAND_CATEGORIES.map((cat) => {
              const count = commands.filter((c) => c.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* High-Density Command Table */}
        <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No commands match your filter.
            </div>
          ) : (
            filtered.map((cmd) => (
              <div
                key={cmd.name}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-semibold text-slate-900">
                      {prefix}{cmd.name}
                    </span>
                    {cmd.aliases && cmd.aliases.length > 0 && (
                      <span className="font-mono text-xs text-slate-400">
                        / {prefix}{cmd.aliases[0]}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{cmd.category}</span>
                    {cmd.isCustom && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-emerald-700">Custom</span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{cmd.description}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <select
                    aria-label={`Role for ${cmd.name}`}
                    value={cmd.role}
                    onChange={(e) => onChangeRole(cmd.name, e.target.value as CommandRole)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => onToggleCommand(cmd.name, !cmd.enabled)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      cmd.enabled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {cmd.enabled ? 'Active' : 'Disabled'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sampleArg =
                        cmd.name === 'anime' || cmd.name === 'manga' || cmd.name === 'wallpaper'
                          ? ' Frieren'
                          : cmd.name === 'slots' || cmd.name === 'bj'
                          ? ' 100'
                          : cmd.name === 'gpt'
                          ? ' Recommend 3 dark fantasy anime'
                          : cmd.name === 'fancy'
                          ? ' The new world'
                          : '';
                      onRunInSimulator(`${prefix}${cmd.name}${sampleArg}`);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 whitespace-nowrap"
                  >
                    <Play className="h-3 w-3" />
                    <span>Run</span>
                  </button>

                  {cmd.isCustom && (
                    <button
                      type="button"
                      onClick={() => onDeleteCommand(cmd.name)}
                      aria-label={`Delete ${cmd.name}`}
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

