import { useState } from 'react';
import { Package, Clock, Send } from 'lucide-react';
import type { RewardRedemption } from '../types';
import { btnBase, btnPress, cardSurface } from '../lib/constants';

interface RewardInventoryProps {
  childId: string;
  redemptions: RewardRedemption[];
  onRequestUse: (id: string) => Promise<void>;
}

export function RewardInventory({ childId, redemptions, onRequestUse }: RewardInventoryProps) {
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const inventory = redemptions.filter(r => r.childId === childId && !r.usedAt);

  if (inventory.length === 0) return null;

  const handleRequestUse = async (id: string) => {
    setRequestingId(id);
    try {
      await onRequestUse(id);
    } catch (err) {
      console.error(err);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className={`${cardSurface} p-6 md:p-8`}>
      <div className="mb-5 flex items-center gap-2">
        <Package size={22} className="text-violet-500" />
        <div>
          <h3 className="text-xl font-black text-slate-900">My Reward Stash</h3>
          <p className="text-sm text-slate-500">
            Rewards you've bought — ask a parent when you're ready to use one!
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {inventory.map(r => {
          const isPending = !!r.useApprovalToken;
          const isRequesting = requestingId === r.id;

          return (
            <div
              key={r.id}
              className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${
                isPending
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-violet-200 bg-violet-50'
              }`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm ${
                isPending ? 'bg-amber-100' : 'bg-white'
              }`}>
                🎁
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-800">{r.rewardTitle}</p>
                <p className="text-xs text-slate-500">
                  Bought {new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  <span className="font-bold text-violet-600">⭐ {r.pointCost} pts</span>
                  {isPending && (
                    <span className="ml-2 font-bold text-amber-600">· Waiting for parent approval</span>
                  )}
                </p>
              </div>
              {isPending ? (
                <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-100 px-4 py-2.5 text-xs font-black text-amber-700">
                  <Clock size={14} />
                  Pending…
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isRequesting}
                  onClick={() => handleRequestUse(r.id)}
                  className={`${btnBase} ${btnPress} flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
                >
                  <Send size={14} />
                  {isRequesting ? 'Sending…' : 'Ask to Use'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
