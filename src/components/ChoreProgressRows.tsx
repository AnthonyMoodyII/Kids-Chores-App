import { ShieldCheck, AlertCircle } from 'lucide-react';
import type { Chore } from '../types';
import { btnBase, btnPress } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';

interface ChoreProgressRowsProps {
  choreList: Chore[];
  showParentApprove: boolean;
  /** Called when parent clicks the approve toggle on a chore. */
  onApprove?: (choreId: string) => void;
}

export function ChoreProgressRows({
  choreList,
  showParentApprove,
  onApprove,
}: ChoreProgressRowsProps) {
  return (
    <div className="space-y-6">
      {choreList.map(chore => (
        <div key={chore.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800">{chore.title}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {chore.completedDays.length}/7 days
                {chore.completedDays.length >= 4 && chore.completedDays.length < 5 && (
                  <span className="ml-1 normal-case text-violet-600">· 80%</span>
                )}
                {chore.completedDays.length >= 5 && chore.completedDays.length < 7 && (
                  <span className="ml-1 normal-case text-emerald-600">· 100%</span>
                )}
                {chore.completedDays.length >= 7 && (
                  <span className="ml-1 normal-case text-emerald-600">· 100% + $1</span>
                )}
              </p>
              {!showParentApprove && chore.completedDays.length >= 4 && (
                <p className="mt-1 text-[10px] font-bold normal-case text-slate-500">
                  {chore.isApproved ? 'Parent approved' : 'Waiting for parent approval'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-slate-900">
                ${getChoreEarnedAmount(chore.completedDays.length, chore.baseValue).toFixed(2)}
              </span>
              {showParentApprove && chore.completedDays.length >= 4 && onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(chore.id)}
                  className={`${btnBase} ${btnPress} rounded-xl p-2.5 ${
                    chore.isApproved
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {chore.isApproved ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                </button>
              )}
            </div>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="absolute left-[57%] top-0 z-10 h-full w-px bg-slate-300" />
            <div
              className={`h-full transition-all duration-1000 ${
                chore.isApproved ? 'bg-emerald-500' : 'bg-violet-500'
              }`}
              style={{ width: `${(chore.completedDays.length / 7) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
