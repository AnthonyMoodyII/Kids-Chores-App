import { useState } from 'react';
import { Lock, Sparkles, Clock } from 'lucide-react';
import type { RewardTemplate, RedemptionRequest } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface RewardsCatalogProps {
  rewards: RewardTemplate[];
  balance: number;
  kidId: string;
  kidName?: string;
  redemptionRequests: RedemptionRequest[];
  goalRewardIds: string[];
  onToggleGoal: (id: string) => void;
  onRequestRedemption: (rewardTemplateId: string) => Promise<void>;
}

export function RewardsCatalog({
  rewards,
  balance,
  kidId,
  kidName: _kidName,
  redemptionRequests,
  goalRewardIds,
  onToggleGoal,
  onRequestRedemption,
}: RewardsCatalogProps) {
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const active = rewards.filter(r => r.isActive);

  const pendingRequestIds = new Set(
    redemptionRequests
      .filter(r => r.childId === kidId && r.status === 'pending')
      .map(r => r.rewardTemplateId),
  );

  const handleRequest = async (rewardId: string) => {
    setRequesting(rewardId);
    try {
      await onRequestRedemption(rewardId);
      setRequestedIds(prev => new Set([...prev, rewardId]));
    } catch (err) {
      console.error(err);
    } finally {
      setRequesting(null);
    }
  };

  if (active.length === 0) return null;

  const canAfford = active.filter(r => balance >= r.pointCost);
  if (balance >= (active[0]?.pointCost ?? Infinity) && canAfford.length > 0) {
    // Show nudge banner handled by parent
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map(reward => {
          const affordable = balance >= reward.pointCost;
          const isPending = pendingRequestIds.has(reward.id) || requestedIds.has(reward.id);
          const isGoal = goalRewardIds.includes(reward.id);
          const progress = Math.min((balance / reward.pointCost) * 100, 100);

          return (
            <div
              key={reward.id}
              className={`relative flex flex-col rounded-3xl border-2 p-5 transition-all ${
                affordable
                  ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg shadow-amber-200/40'
                  : 'border-slate-200 bg-white'
              } ${affordable ? 'animate-pulse-slow' : ''}`}
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

              <div className="mb-3 text-3xl">{reward.icon || '🎁'}</div>
              <h4 className="mb-1 font-black text-slate-900">{reward.title}</h4>
              {reward.description && (
                <p className="mb-3 text-xs text-slate-500">{reward.description}</p>
              )}

              {/* Progress bar */}
              <div className="mb-3 mt-auto">
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className={affordable ? 'text-amber-700' : 'text-slate-400'}>
                    {balance} / {reward.pointCost} pts
                  </span>
                  {!affordable && (
                    <span className="text-slate-400">{reward.pointCost - balance} more needed</span>
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
                  disabled={isPending || requesting === reward.id}
                  onClick={() => handleRequest(reward.id)}
                  className={`${btnBase} ${btnPress} w-full rounded-2xl py-2.5 text-sm font-black uppercase tracking-wide transition-all ${
                    isPending
                      ? 'cursor-default bg-slate-100 text-slate-400'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-900 shadow-md shadow-amber-300/50'
                  }`}
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Clock size={14} /> Requested ⏳
                    </span>
                  ) : requesting === reward.id ? (
                    'Sending…'
                  ) : (
                    '🙋 Ask Parent'
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-2.5 text-xs font-black uppercase tracking-wide text-slate-400">
                  <Lock size={12} /> {reward.pointCost} pts needed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
