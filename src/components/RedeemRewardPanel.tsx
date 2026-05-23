import { useState } from 'react';
import { Gift, X } from 'lucide-react';
import type { RewardTemplate } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface RedeemRewardPanelProps {
  kidId: string;
  kidName: string;
  balance: number;
  rewards: RewardTemplate[];
  onRedeem: (rewardTemplateId: string) => Promise<void>;
  onClose: () => void;
}

export function RedeemRewardPanel({
  kidId: _kidId,
  kidName,
  balance,
  rewards,
  onRedeem,
  onClose,
}: RedeemRewardPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const active = rewards.filter(r => r.isActive);
  const selectedReward = active.find(r => r.id === selected);

  const handleRedeem = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await onRedeem(selected);
      setSuccess(`✅ Redeemed "${selectedReward?.title}"!`);
      setSelected(null);
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to redeem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift size={20} className="text-amber-600" />
          <p className="font-black text-amber-900">Redeem for {kidName}</p>
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-800">
            ⭐ {balance} pts
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`${btnBase} rounded-xl p-1.5 text-slate-400 hover:text-slate-600`}
        >
          <X size={18} />
        </button>
      </div>

      {success ? (
        <p className="py-4 text-center font-bold text-emerald-600">{success}</p>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {active.map(r => {
              const canAfford = balance >= r.pointCost;
              const isSelected = selected === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!canAfford}
                  onClick={() => setSelected(isSelected ? null : r.id)}
                  className={`${btnBase} ${btnPress} flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all disabled:pointer-events-none disabled:opacity-40 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-300/50'
                      : 'border-slate-200 bg-white hover:border-amber-200'
                  }`}
                >
                  <span className="text-2xl">{r.icon || '🎁'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{r.title}</p>
                    <p className={`text-xs font-black ${canAfford ? 'text-amber-600' : 'text-slate-400'}`}>
                      {r.pointCost} pts
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {error && <p className="mb-3 text-sm font-bold text-red-600">{error}</p>}

          <button
            type="button"
            disabled={!selected || loading}
            onClick={handleRedeem}
            className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 font-black uppercase tracking-wide text-amber-900 shadow-lg shadow-amber-300/40 disabled:pointer-events-none disabled:opacity-40`}
          >
            {loading
              ? 'Redeeming…'
              : selected
              ? `Redeem "${selectedReward?.title}" (${selectedReward?.pointCost} pts)`
              : 'Select a reward above'}
          </button>
        </>
      )}
    </div>
  );
}
