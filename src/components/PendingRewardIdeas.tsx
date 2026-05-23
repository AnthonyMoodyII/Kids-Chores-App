import { useState } from 'react';
import { Check, X, Lightbulb } from 'lucide-react';
import type { RewardRequest } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface PendingRewardIdeasProps {
  requests: RewardRequest[];
  onApprove: (id: string, pointCost: number) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function PendingRewardIdeas({ requests, onApprove, onReject }: PendingRewardIdeasProps) {
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const pending = requests.filter(r => r.status === 'pending');
  if (pending.length === 0) return null;

  const handleApprove = async (id: string) => {
    const cost = parseInt(costs[id] || '');
    if (!cost || cost < 1) return;
    setLoading(id);
    try {
      await onApprove(id, cost);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-700">
        <Lightbulb size={14} /> Reward Ideas from Kids ({pending.length})
      </p>
      <div className="space-y-3">
        {pending.map(req => (
          <div
            key={req.id}
            className="rounded-2xl border border-violet-200 bg-white p-4"
          >
            <div className="mb-2">
              <p className="font-bold text-slate-800">{req.title}</p>
              <p className="text-xs text-slate-400">from {req.childName}</p>
              {req.description && (
                <p className="mt-1 text-sm text-slate-600">{req.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min="1"
                placeholder="Point cost"
                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none ring-violet-500/30 focus:ring-2"
                value={costs[req.id] || ''}
                onChange={e => setCosts(prev => ({ ...prev, [req.id]: e.target.value }))}
              />
              <button
                type="button"
                disabled={!costs[req.id] || loading === req.id}
                onClick={() => handleApprove(req.id)}
                className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white disabled:pointer-events-none disabled:opacity-40`}
              >
                <Check size={13} /> {loading === req.id ? 'Adding…' : 'Approve & Add'}
              </button>
              <button
                type="button"
                onClick={() => onReject(req.id)}
                className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:border-red-200 hover:text-red-600`}
              >
                <X size={13} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
