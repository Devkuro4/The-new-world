import React, { useEffect, useState } from 'react';
import type { BotConfig, PlayerProfile } from '../shared/botSchema';

interface EconomyCardsPanelProps {
  config: BotConfig;
  players: PlayerProfile[];
  onUpdateRates: (patch: Partial<BotConfig>) => Promise<void>;
  onRunInSimulator: (cmd: string) => void;
}

export const EconomyCardsPanel: React.FC<EconomyCardsPanelProps> = ({
  config,
  players,
  onUpdateRates,
  onRunInSimulator,
}) => {
  const [subTab, setSubTab] = useState<'cards' | 'players' | 'rates'>('cards');
  const [dailyReward, setDailyReward] = useState(config.dailyReward);
  const [starterBalance, setStarterBalance] = useState(config.starterBalance);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    setDailyReward(config.dailyReward);
    setStarterBalance(config.starterBalance);
  }, [config.dailyReward, config.starterBalance]);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    try {
      await onUpdateRates({
        dailyReward,
        starterBalance,
      });
    } finally {
      setSavingRates(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Economy & Card Battle
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {players.length} players
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              ['cards', 'Cards'],
              ['players', 'Players'],
              ['rates', 'Rates'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                subTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'cards' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Card Battle</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {['cb', 'starter', 'cards', 'deck', 'wild', 'claim', 'cardshop'].map(command => (
              <button key={command} type="button" onClick={() => onRunInSimulator(config.prefix + command)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
                {config.prefix}{command}
              </button>
            ))}
          </div>
        </div>
      )}

      {subTab === 'players' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Player</th>
                <th className="px-4 py-2.5">Guild</th>
                <th className="px-4 py-2.5 text-right">Level</th>
                <th className="px-4 py-2.5 text-right">Wallet</th>
                <th className="px-4 py-2.5 text-right">Bank</th>
                <th className="px-4 py-2.5 text-right">Debt</th>
                <th className="px-4 py-2.5 text-right">Stardust</th>
                <th className="px-4 py-2.5 text-right">Cards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {players.map((pl) => (
                <tr key={pl.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{pl.name}</div>
                    <div className="text-xs text-slate-500">{pl.role}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{pl.guild || 'None'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">Lv.{pl.level}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-900">
                    🪙 {pl.wallet.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                    🪙 {pl.bank.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-amber-700">
                    {(pl.loan || 0) > 0 ? `🪙 ${pl.loan.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                    {pl.stardust.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-medium text-emerald-700">
                    {pl.cards.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'rates' && (
        <form onSubmit={handleSaveRates} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Economy Rates
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-700">
              Daily Reward (.daily 🪙 Gold)
              <input
                type="number"
                value={dailyReward}
                onChange={(e) => setDailyReward(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Starter Wallet (New Users)
              <input
                type="number"
                value={starterBalance}
                onChange={(e) => setStarterBalance(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingRates}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingRates ? 'Saving...' : 'Save Economy Rates'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

