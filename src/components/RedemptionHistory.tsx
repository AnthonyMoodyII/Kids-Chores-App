import { useState } from 'react';
import { Trash2, RotateCcw, CheckCircle2, Package } from 'lucide-react';
import type { RewardRedemption } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface RedemptionHistoryProps {
  redemptions: RewardRedemption[];
  kidId: string;
  onDelete: (id: string) => Promise<void>;
  onMarkUsed?: (id: string) => Promise<void>;
  onMarkUnused?: (id: string) => Promise<void>;
}

export function RedemptionHistory({
  redemptions,
  kidId,
  onDelete,
  onMarkUsed,
  onMarkUnused,
}: RedemptionHistoryProps) {
  const [actingId, setActingId] = useState<string | null>(null);

  const kidRedemptions = redemptions
    .filter(r => r.childId === kidId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const inventory = kidRedemptions.filter(r => !r.usedAt);
  const used = kidRedemptions.filter(r => !!r.usedAt);

  const wrap = async (id: string, fn: (id: string) => Promise<void>) => {
    setActingId(id);
    try { await fn(id); } finally { setActingId(null); }
  };

  const RedemptionRow = ({ r }: { r: RewardRedemption }) => (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 ${
        r.usedAt ? 'bg-slate-50' : 'bg-violet-50'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${r.usedAt ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          {r.rewardTitle}
        </p>
        <p className="text-xs text-slate-400">
          {r.pointCost} pts · Earned {new Date(r.timestamp).toLocaleDateString()}
          {r.usedAt && ` · Used ${new Date(r.usedAt).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!r.usedAt && onMarkUsed && (
          <button
            type="button"
            disabled={actingId === r.id}
            onClick={() => wrap(r.id, onMarkUsed)}
            className={`${btnBase} ${btnPress} flex items-center gap-1 rounded-xl border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-black text-violet-600 hover:bg-violet-50 disabled:opacity-40`}
            title="Mark as used"
          >
            <CheckCircle2 size={13} /> Use
          </button>
        )}
        {r.usedAt && onMarkUnused && (
          <button
            type="button"
            disabled={actingId === r.id}
            onClick={() => wrap(r.id, onMarkUnused)}
            className={`${btnBase} ${btnPress} flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-400 hover:text-violet-600 disabled:opacity-40`}
            title="Move back to inventory"
          >
            <RotateCcw size={13} /> Undo
          </button>
        )}
        <button
          type="button"
          disabled={actingId === r.id}
          onClick={() => wrap(r.id, onDelete)}
          className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white p-2 text-slate-300 hover:border-red-200 hover:text-red-500 disabled:opacity-40`}
          title="Delete and refund points"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5">
      {kidRedemptions.length === 0 ? (
        <>
          <p className="mb-1 text-sm font-black uppercase tracking-widest text-slate-500">
            Reward History
          </p>
          <p className="text-sm text-slate-400">No rewards redeemed yet.</p>
        </>
      ) : (
        <div className="space-y-5">
          {/* Inventory — approved but not yet used */}
          {inventory.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Package size={14} className="text-violet-500" />
                <p className="text-xs font-black uppercase tracking-widest text-violet-600">
                  In Stash ({inventory.length})
                </p>
              </div>
              <div className="space-y-2">
                {inventory.map(r => <RedemptionRow key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {/* Used history */}
          {used.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Used / History ({used.length})
              </p>
              <div className="space-y-2">
                {used.map(r => <RedemptionRow key={r.id} r={r} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
