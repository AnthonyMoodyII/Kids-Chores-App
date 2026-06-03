import { useState } from 'react';
import { Lock, Sparkles, ShoppingCart, CheckCircle2 } from 'lucide-react';
import type { RewardTemplate } from '../types';
import { btnBase, btnPress, fmtPts } from '../lib/constants';

const isIconUrl = (s: string) =>
  s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('data:');

const renderRewardIcon = (icon: string | undefined) =>
  icon && isIconUrl(icon)
    ? <img src={icon} className="mb-3 h-10 w-10 object-contain" alt="" />
    : <div className="mb-3 text-3xl">{icon || '🎁'}</div>;

interface RewardsCatalogProps {
  rewards: RewardTemplate[];
  balance: number;
  kidId: string;
  kidName?: string;
  goalRewardIds: string[];
  onToggleGoal: (id: string) => void;
  onBuyReward: (rewardTemplateId: string) => Promise<void>;
}

export function RewardsCatalog({
  rewards,
  balance,
  kidId: _kidId,
  kidName: _kidName,
  goalRewardIds,
  onToggleGoal,
  onBuyReward,
}: RewardsCatalogProps) {
  const [buying, setBuying] = useState<string | null>(null);
  const [boughtIds, setBoughtIds] = useState<Set<string>>(new Set());

  const active = rewards.filter(r => r.isActive);

  const handleBuy = async (rewardId: string) => {
    setBuying(rewardId);
    try {
      await onBuyReward(rewardId);
      setBoughtIds(prev => new Set([...prev, rewardId]));
      // Clear the "bought" flash after 2 seconds
      setTimeout(() => {
        setBoughtIds(prev => {
          const next = new Set(prev);
          next.delete(rewardId);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setBuying(null);
    }
  };

  if (active.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map(reward => {
          const affordable = balance >= reward.pointCost;
          const isBuying = buying === reward.id;
          const justBought = boughtIds.has(reward.id);
          const isGoal = goalRewardIds.includes(reward.id);
          const progress = Math.min((balance / reward.pointCost) * 100, 100);

          return (
            <div
              key={reward.id}
              className={`relative flex flex-col rounded-3xl border p-5 ${
                affordable
                  ? 'border-amber-200 bg-amber-50 shadow-md shadow-amber-100/60'
                  : 'border-slate-100 bg-white shadow-sm'
              }`}
            >
              {/* Goal toggle */}
              <button
                type="button"
                onClick={() => onToggleGoal(reward.id)}
                className={`${btnBase} absolute right-3 top-3 rounded-full p-1.5 text-xs transition-colors ${
                  isGoal
                    ? 'bg-violet-100 text-violet-600'
                    : 'text-slate-300 hover:text-violet-400'
                }`}
                title={isGoal ? 'Remove from goals' : 'Add to goals'}
              >
                <Sparkles size={14} />
              </button>

              {renderRewardIcon(reward.icon)}
              <h4 className="mb-1 font-black text-slate-900">{reward.title}</h4>
              {reward.description && (
                <p className="mb-3 text-xs text-slate-500">{reward.description}</p>
              )}

              {/* Progress bar */}
              <div className="mb-3 mt-auto">
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className={affordable ? 'text-amber-700' : 'text-slate-400'}>
                    {fmtPts(balance)} / {fmtPts(reward.pointCost)} pts
                  </span>
                  {!affordable && (
                    <span className="text-slate-400">{fmtPts(reward.pointCost - balance)} more needed</span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      affordable
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                        : 'bg-violet-300'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* CTA */}
              {affordable ? (
                <button
                  type="button"
                  disabled={isBuying || justBought}
                  onClick={() => handleBuy(reward.id)}
                  className={`${btnBase} ${btnPress} w-full rounded-2xl py-2.5 text-sm font-black uppercase tracking-wide transition-all ${
                    justBought
                      ? 'cursor-default bg-emerald-100 text-emerald-700'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-900 shadow-md shadow-amber-300/50 disabled:opacity-60'
                  }`}
                >
                  {justBought ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} /> Added to Stash!
                    </span>
                  ) : isBuying ? (
                    'Buying…'
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <ShoppingCart size={14} /> Buy Now
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-50 py-2.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200/80">
                  <Lock size={11} className="opacity-60" /> {fmtPts(reward.pointCost)} pts needed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
