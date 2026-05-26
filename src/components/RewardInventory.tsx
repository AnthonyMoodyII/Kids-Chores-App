import { useState } from 'react';
import { Package, CheckCircle2 } from 'lucide-react';
import type { RewardRedemption } from '../types';
import { btnBase, btnPress, cardSurface } from '../lib/constants';

interface RewardInventoryProps {
  childId: string;
  redemptions: RewardRedemption[];
  onMarkUsed: (id: string) => Promise<void>;
}

export function RewardInventory({ childId, redemptions, onMarkUsed }: RewardInventoryProps) {
  const [markingId, setMarkingId] = useState<string | null>(null);

  const inventory = redemptions.filter(r => r.childId === childId && !r.usedAt);

  if (inventory.length === 0) return null;

  const handleUse = async (id: string) => {
    setMarkingId(id);
    try {
      await onMarkUsed(id);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className={`${cardSurface} p-6 md:p-8`}>
      <div className="mb-5 flex items-center gap-2">
        <Package size={22} className="text-violet-500" />
        <div>
          <h3 className="text-xl font-black text-slate-900">My Reward Stash</h3>
          <p className="text-sm text-slate-500">
            Rewards you've earned but haven't used yet — use them whenever you're ready!
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {inventory.map(r => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              🎁
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-800">{r.rewardTitle}</p>
              <p className="text-xs text-slate-500">
                Earned {new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                <span className="font-bold text-violet-600">⭐ {r.pointCost} pts</span>
              </p>
            </div>
            <button
              type="button"
              disabled={markingId === r.id}
              onClick={() => handleUse(r.id)}
              className={`${btnBase} ${btnPress} flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
            >
              <CheckCircle2 size={14} />
              {markingId === r.id ? 'Using…' : 'Use it!'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
