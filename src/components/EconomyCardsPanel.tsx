import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { BotConfig, PlayerProfile } from '../shared/botSchema';
import catalogData from '../../server/cardBattle/mazoku-cards.json';
import artworkMap from '../../server/cardBattle/card-artwork-map.json';

interface CatalogCard {
  card_id: string;
  character_name: string;
  series: string;
  rarity: 'C' | 'UC' | 'R' | 'SR' | 'SSR' | 'UR';
  image_url: string;
  card_url: string;
}

const CARD_CATALOG = catalogData as CatalogCard[];
const BATTLE_READY_ART = new Set(Object.values(artworkMap as Record<string, string>));
const CARDS_PER_PAGE = 24;

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
  const [cardName, setCardName] = useState('');
  const [cardSeries, setCardSeries] = useState('all');
  const [cardTier, setCardTier] = useState('all');
  const [cardPage, setCardPage] = useState(1);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const seriesOptions = useMemo(
    () => [...new Set(CARD_CATALOG.map(card => card.series))].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const filteredCards = useMemo(() => {
    const name = cardName.trim().toLowerCase();
    return CARD_CATALOG.filter(card =>
      (!name || card.character_name.toLowerCase().includes(name)) &&
      (cardSeries === 'all' || card.series === cardSeries) &&
      (cardTier === 'all' || card.rarity === cardTier),
    );
  }, [cardName, cardSeries, cardTier]);
  const cardPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE));
  const safeCardPage = Math.min(cardPage, cardPages);
  const visibleCards = filteredCards.slice((safeCardPage - 1) * CARDS_PER_PAGE, safeCardPage * CARDS_PER_PAGE);

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

  const triggerZipDownload = async (key: string, params: Record<string, string>, fallbackName: string) => {
    setDownloadingKey(key);
    setDownloadError(null);
    try {
      const qs = new URLSearchParams(params);
      const res = await fetch(`/api/cards/download-zip?${qs.toString()}`);
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || 'Failed to generate zip archive.');
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || fallbackName;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingKey(null);
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
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Card Battle Catalog</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {CARD_CATALOG.length} collectible cards · {BATTLE_READY_ART.size} battle-ready
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['cb', 'starter', 'cards', 'ss', 'ci', 'deck', 'swap', 't2col', 'wild', 'claim', 'cardshop'].map(command => (
                  <button key={command} type="button" onClick={() => onRunInSimulator(config.prefix + command)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
                    {config.prefix}{command}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">
                Search by name
                <input
                  value={cardName}
                  onChange={event => { setCardName(event.target.value); setCardPage(1); }}
                  placeholder="Gojo Satoru"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Series
                <select
                  value={cardSeries}
                  onChange={event => { setCardSeries(event.target.value); setCardPage(1); }}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="all">All series</option>
                  {seriesOptions.map(series => <option key={series} value={series}>{series}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Tier
                <select
                  value={cardTier}
                  onChange={event => { setCardTier(event.target.value); setCardPage(1); }}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="all">All tiers</option>
                  {['C', 'UC', 'R', 'SR', 'SSR', 'UR'].map(tier => <option key={tier} value={tier}>{tier}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{filteredCards.length} cards found</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={cardSeries === 'all' || downloadingKey !== null}
                  onClick={() =>
                    triggerZipDownload(
                      `series:${cardSeries}`,
                      cardTier === 'all' ? { series: cardSeries } : { series: cardSeries, tier: cardTier },
                      `${cardSeries.replace(/[^a-zA-Z0-9._-]+/g, '_')}.zip`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>
                    {downloadingKey === `series:${cardSeries}`
                      ? 'Zipping series...'
                      : cardSeries === 'all'
                      ? 'Select Series to Download .zip'
                      : `Download ${cardSeries} (.zip)`}
                  </span>
                </button>
                <span className="font-mono text-xs text-slate-500">Page {safeCardPage} / {cardPages}</span>
              </div>
            </div>

            {downloadError && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {downloadError}
              </div>
            )}

            {visibleCards.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleCards.map(card => {
                  const battleReady = BATTLE_READY_ART.has(card.card_id);
                  const cardBusy = downloadingKey === `card:${card.card_id}`;
                  const seriesBusy = downloadingKey === `card-series:${card.card_id}`;
                  return (
                    <article key={card.card_id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <div className="aspect-[5/7] bg-slate-200">
                        <img
                          src={card.image_url}
                          alt={`${card.character_name} card`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-1.5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900" title={card.character_name}>
                            {card.character_name}
                          </h3>
                          <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                            {card.rarity}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500" title={card.series}>{card.series}</p>
                        <p className={`text-[11px] font-medium ${battleReady ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {battleReady ? 'Battle-ready' : 'Collectible · sprite pending'}
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={downloadingKey !== null}
                            onClick={() =>
                              triggerZipDownload(
                                `card:${card.card_id}`,
                                { cardId: card.card_id },
                                `${card.character_name.replace(/[^a-zA-Z0-9._-]+/g, '_')}_${card.rarity}.zip`,
                              )
                            }
                            title={`Download ${card.character_name} card as .zip`}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45"
                          >
                            <Download className="h-3 w-3 shrink-0" />
                            <span>{cardBusy ? 'Zipping...' : 'Card .zip'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={downloadingKey !== null}
                            onClick={() =>
                              triggerZipDownload(
                                `card-series:${card.card_id}`,
                                { series: card.series },
                                `${card.series.replace(/[^a-zA-Z0-9._-]+/g, '_')}.zip`,
                              )
                            }
                            title={`Download all ${card.series} cards as .zip`}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-45"
                          >
                            {seriesBusy ? '...' : 'Series .zip'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                No cards match those filters.
              </div>
            )}

            {cardPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button type="button" disabled={safeCardPage === 1} onClick={() => setCardPage(page => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={safeCardPage === cardPages} onClick={() => setCardPage(page => Math.min(cardPages, page + 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Next
                </button>
              </div>
            )}
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

