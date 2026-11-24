import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ActivityLogEntry } from '../shared/botSchema';

interface LogsPanelProps {
  logs: ActivityLogEntry[];
  totalCommands: number;
  totalAiCalls: number;
  totalCardDrops: number;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  logs,
  totalCommands,
  totalAiCalls,
  totalCardDrops,
}) => {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'baileys' | 'simulator' | 'meta-webhook'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        entry.input.toLowerCase().includes(q) ||
        entry.handler.toLowerCase().includes(q) ||
        entry.senderName.toLowerCase().includes(q) ||
        entry.replyPreview.toLowerCase().includes(q)
      );
    });
  }, [logs, sourceFilter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Execution & Webhook Logs
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {totalCommands} commands · {totalAiCalls} AI replies · {totalCardDrops} card spawns
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              ['all', 'All Sources'],
              ['baileys', 'Live WhatsApp'],
              ['simulator', 'Simulator'],
              ['meta-webhook', 'Webhook'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSourceFilter(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                sourceFilter === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs by sender, command, or handler..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No activity logged yet. Send a command like <span className="font-mono">.menu</span> or{' '}
            <span className="font-mono">.card</span> in the Pieck simulator to inspect live traces.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Caller</th>
                  <th className="px-4 py-2.5">Input</th>
                  <th className="px-4 py-2.5">Handler</th>
                  <th className="px-4 py-2.5 text-right">Latency</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleTimeString([], { hour12: false })}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-900">{row.senderName}</div>
                      <div className="text-[11px] text-slate-500">
                        {row.source} · {row.chatMode}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate font-mono text-xs text-slate-800">
                      {row.input}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                      {row.handler}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 whitespace-nowrap">
                      {row.latencyMs}ms
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right text-xs font-medium whitespace-nowrap ${
                        row.status === 'error'
                          ? 'text-rose-600'
                          : row.status === 'blocked'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {row.status === 'ok' ? 'OK' : row.status === 'blocked' ? 'Blocked' : 'Error'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

