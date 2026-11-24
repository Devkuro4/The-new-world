import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AnimeCard, AuctionItem, BotConfig, PlayerProfile } from '../shared/botSchema';

interface EconomyCardsPanelProps {
  config: BotConfig;
  cards: AnimeCard[];
  players: PlayerProfile[];
  auctions: AuctionItem[];
  onAddCard: (card: {
    name: string;
    series: string;
    tier: AnimeCard['tier'];
    atk: number;
    def: number;
    price: number;
    stardustValue: number;
  }) => Promise<void>;
  onUpdateRates: (patch: Partial<BotConfig>) => Promise<void>;
  onRunInSimulator: (cmd: string) => void;
}

export const EconomyCardsPanel: React.FC<EconomyCardsPanelProps> = ({
  config,
  cards,
  players,
  auctions,
  onAddCard,
  onUpdateRates,
  onRunInSimulator,
}) => {
  const [subTab, setSubTab] = useState<'cards' | 'players' | 'auctions' | 'rates'>('cards');
  const [showAddCard, setShowAddCard] = useState(false);

  const [cardName, setCardName] = useState('');
  const [cardSeries, setCardSeries] = useState('');
  const [cardTier, setCardTier] = useState<AnimeCard['tier']>('S');
  const [cardAtk, setCardAtk] = useState(90);
  const [cardDef, setCardDef] = useState(85);
  const [cardPrice, setCardPrice] = useState(4500);

  const [dailyReward, setDailyReward] = useState(config.dailyReward);
  const [starterBalance, setStarterBalance] = useState(config.starterBalance);
  const [cooldown, setCooldown] = useState(config.cardSpawnCooldownSec);
  const [savingRates, setSavingRates] = useState(false);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !cardSeries.trim()) return;
    await onAddCard({
      name: cardName.trim(),
      series: cardSeries.trim(),
      tier: cardTier,
      atk: cardAtk,
      def: cardDef,
      price: cardPrice,
      stardustValue: Math.round(cardPrice * 0.12),
    });
    setCardName('');
    setCardSeries('');
    setShowAddCard(false);
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    try {
      await onUpdateRates({
        dailyReward,
        starterBalance,
        cardSpawnCooldownSec: cooldown,
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
            Economy & Anime Cards
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {cards.length} catalog cards · {players.length} players · {auctions.length} live auctions
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              ['cards', 'Cards'],
              ['players', 'Players'],
              ['auctions', 'Auctions'],
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
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">Spawnable Character Catalog</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRunInSimulator(`${config.prefix}card`)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Test {config.prefix}card
              </button>
              <button
                type="button"
                onClick={() => setShowAddCard((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {showAddCard && (
            <form onSubmit={handleCreateCard} className="border-b border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Character name (e.g. Fern)"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={cardSeries}
                  onChange={(e) => setCardSeries(e.target.value)}
                  placeholder="Anime series"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
                <select
                  value={cardTier}
                  onChange={(e) => setCardTier(e.target.value as AnimeCard['tier'])}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="S+">Tier S+</option>
                  <option value="S">Tier S</option>
                  <option value="A">Tier A</option>
                  <option value="B">Tier B</option>
                  <option value="C">Tier C</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs text-slate-600">
                  ATK
                  <input
                    type="number"
                    value={cardAtk}
                    onChange={(e) => setCardAtk(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  DEF
                  <input
                    type="number"
                    value={cardDef}
                    onChange={(e) => setCardDef(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Price (Yen)
                  <input
                    type="number"
                    value={cardPrice}
                    onChange={(e) => setCardPrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Save Card
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Character</th>
                  <th className="px-4 py-2.5">Series</th>
                  <th className="px-4 py-2.5">Tier</th>
                  <th className="px-4 py-2.5 text-right">ATK / DEF</th>
                  <th className="px-4 py-2.5 text-right">Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{card.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{card.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{card.series}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-emerald-700">{card.tier}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                      {card.atk} / {card.def}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-900">
                      ¥{card.price.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    ¥{pl.wallet.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                    ¥{pl.bank.toLocaleString()}
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

      {subTab === 'auctions' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">Active Card Auction House</span>
            <button
              type="button"
              onClick={() => onRunInSimulator(`${config.prefix}listauc`)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Inspect in Simulator
            </button>
          </div>
          {auctions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No active auctions right now. Start one with {config.prefix}auction &lt;cardId&gt; &lt;minBid&gt;.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auctions.map((auc) => (
                <div key={auc.id} className="flex items-center justify-between px-4 py-3 text-sm tabular-nums">
                  <div>
                    <div className="font-medium text-slate-900">
                      [{auc.tier}] {auc.cardName} · <span className="font-mono text-xs text-slate-500">{auc.id}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {auc.series} · Seller: {auc.sellerName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-emerald-700">
                      ¥{auc.highestBid.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {auc.highestBidderName ? `Top bid: ${auc.highestBidderName}` : 'No bids yet'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'rates' && (
        <form onSubmit={handleSaveRates} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Economy & Card Drop Rates
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-700">
              Daily Reward (.daily Yen)
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
            <label className="text-xs font-medium text-slate-700">
              Anti-Camp Cooldown (sec)
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
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
