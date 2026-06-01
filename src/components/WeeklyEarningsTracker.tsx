import type { Chore, ChoreTemplate, DailyChoreSelection } from '../types';
import { getChoreEarnedAmount } from '../lib/earnings';
import { cardSurface } from '../lib/constants';

interface WeeklyEarningsTrackerProps {
  mandatoryChores: Chore[];        // kid's assigned (non-archived) chores
  poolTemplates?: ChoreTemplate[];  // unused — kept for API compat
  dailySelections: DailyChoreSelection[]; // all selections for this kid this week
}

export function WeeklyEarningsTracker({
  mandatoryChores,
  dailySelections,
}: WeeklyEarningsTrackerProps) {
  // Mandatory earned so far this week
  const mandatoryEarned = mandatoryChores.reduce(
    (sum, c) => sum + getChoreEarnedAmount(c.completedDays.length, c.baseValue),
    0,
  );

  // Optional earned so far this week (across all days)
  const optionalEarned = dailySelections.reduce(
    (sum, s) => sum + s.completions * (s.baseValue / 5),
    0,
  );

  const totalEarned = mandatoryEarned + optionalEarned;

  // Potential max: only mandatory chores at full 7/7 completion
  // (optional is unbounded so we don't inflate the denominator with it)
  const mandatoryPotential = mandatoryChores.reduce(
    (sum, c) => sum + Math.round((c.baseValue + 1) * 100) / 100,
    0,
  );

  // Progress % is based on mandatory potential only so the bar fills meaningfully
  const totalPotential = Math.max(totalEarned, mandatoryPotential);

  const pct = totalPotential > 0 ? Math.min(100, (totalEarned / totalPotential) * 100) : 0;

  if (mandatoryChores.length === 0 && dailySelections.length === 0) return null;

  return (
    <div className={`${cardSurface} p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">💰</span>
        <h3 className="text-base font-black uppercase tracking-wider text-slate-700">
          Earnings This Week
        </h3>
      </div>

      {/* Progress bar row */}
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xl font-black text-emerald-700">
          ${totalEarned.toFixed(2)}
        </span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-400">
          / ${mandatoryPotential.toFixed(2)} goal
        </span>
      </div>

      {/* Sub-labels */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          📋 Mandatory: <strong className="text-slate-700">${mandatoryEarned.toFixed(2)}</strong>
        </span>
        {optionalEarned > 0 && (
          <span>
            🎯 Optional picks: <strong className="text-emerald-700">${optionalEarned.toFixed(2)}</strong>
          </span>
        )}
        {totalEarned === 0 && (
          <span className="italic text-slate-400">Complete chores to start earning!</span>
        )}
      </div>
    </div>
  );
}
