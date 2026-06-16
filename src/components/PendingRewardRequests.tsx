import { Check, X, Gift } from 'lucide-react';
import type { RedemptionRequest } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface PendingRewardRequestsProps {
  requests: RedemptionRequest[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function PendingRewardRequests({ requests, onApprove, onReject }: PendingRewardRequestsProps) {
  const pending = requests.filter(r => r.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-700">
        <Gift size={13} /> Reward Requests ({pending.length})
      </p>
      <div className="space-y-2">
        {pending.map(req => (
          <div
            key={req.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-bold text-slate-800">
                {req.childName} wants: <span className="text-amber-700">{req.rewardTitle}</span>
              </p>
              <p className="text-xs text-slate-400">{req.pointCost} pts</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onApprove(req.id)}
                className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white`}
              >
                <Check size={13} /> Approve
              </button>
              <button
                type="button"
                onClick={() => onReject(req.id)}
                className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:border-red-200 hover:text-red-600`}
              >
                <X size={13} /> Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
