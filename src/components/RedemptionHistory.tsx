import { Trash2 } from 'lucide-react';
import type { RewardRedemption } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface RedemptionHistoryProps {
  redemptions: RewardRedemption[];
  kidId: string;
  onDelete: (id: string) => Promise<void>;
}

export function RedemptionHistory({ redemptions, kidId, onDelete }: RedemptionHistoryProps) {
  const kidRedemptions = redemptions.filter(r => r.childId === kidId);

  return (
    <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5">
      <p className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">
        Redemption history
      </p>
      {kidRedemptions.length === 0 ? (
        <p className="text-sm text-slate-400">No rewards redeemed yet.</p>
      ) : (
        <div className="space-y-2">
          {kidRedemptions.map(r => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-bold text-slate-800">{r.rewardTitle}</p>
                <p className="text-xs text-slate-400">
                  {r.pointCost} pts · {new Date(r.timestamp).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(r.id)}
                className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white p-2 text-slate-300 hover:border-red-200 hover:text-red-500`}
                title="Delete and refund points"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
