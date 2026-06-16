import { Flame, TrendingUp } from 'lucide-react';
import type { Chore, DailyChoreSelection, DayOfWeek } from '../types';
import { btnBase, fmtPts } from '../lib/constants';

const DAYS_ORDER: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PointsDailyChartProps {
  chores: Chore[];
  dailySelections?: DailyChoreSelection[];
  /** Currently highlighted day (null = all week view) */
  selectedDay?: DayOfWeek | null;
  /** Called when user clicks a bar; pass null to deselect (return to all-week) */
  onSelectDay?: (day: DayOfWeek | null) => void;
}

function chorePointsPerDay(baseValue: number) {
  return Math.max(10, 10 + Math.round(baseValue * 4));
}

export function PointsDailyChart({
  chores,
  dailySelections = [],
  selectedDay = null,
  onSelectDay,
}: PointsDailyChartProps) {
  const mandatoryPts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const optionalPts: number[]  = [0, 0, 0, 0, 0, 0, 0];

  for (const chore of chores) {
    const pts = chorePointsPerDay(chore.baseValue);
    for (const day of chore.completedDays) {
      const idx = DAYS_ORDER.indexOf(day);
      if (idx >= 0) mandatoryPts[idx] += pts;
    }
  }

  for (const sel of dailySelections) {
    if (sel.completions > 0) {
      const idx = DAYS_ORDER.indexOf(sel.day as DayOfWeek);
      if (idx >= 0) optionalPts[idx] += chorePointsPerDay(sel.baseValue) * sel.completions;
    }
  }

  const totalPts = DAYS_ORDER.map((_, i) => mandatoryPts[i] + optionalPts[i]);
  const maxPts   = Math.max(...totalPts, 1);
  // getDay(): 0=Sun, 1=Mon … 6=Sat — matches DAYS_ORDER directly now that week starts Sunday
  const todayIdx = new Date().getDay();
  const selectedIdx = selectedDay ? DAYS_ORDER.indexOf(selectedDay) : -1;

  const weekTotal = totalPts.reduce((a, b) => a + b, 0);
  const BAR_MAX_H = 96;
  const interactive = !!onSelectDay;
  const peakIdx = totalPts.indexOf(maxPts);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-violet-50/60 via-slate-50/60 to-amber-50/40 p-5">
      {/* Accessible data-table fallback for screen readers — chart above is visual-only */}
      <table className="sr-only">
        <caption>Points earned per day this week</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Mandatory points</th><th scope="col">Bonus points</th><th scope="col">Total points</th></tr>
        </thead>
        <tbody>
          {DAYS_ORDER.map((day, i) => (
            <tr key={day}>
              <th scope="row">{day}</th>
              <td>{mandatoryPts[i]}</td>
              <td>{optionalPts[i]}</td>
              <td>{totalPts[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Decorative glow, matches Leaderboard's premium treatment */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-200/20 blur-2xl" />

      {/* Header row */}
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-500/30">
            <TrendingUp size={12} strokeWidth={2.5} />
          </span>
          Points this week
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
            {weekTotal.toLocaleString()} pts total
          </span>
          {selectedDay && onSelectDay && (
            <button
              type="button"
              onClick={() => onSelectDay(null)}
              className={`${btnBase} rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-600 hover:bg-violet-100`}
            >
              ← All Week
            </button>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end gap-1.5" style={{ height: `${BAR_MAX_H + 36}px` }}>
        {DAYS_ORDER.map((day, i) => {
          const mPts  = mandatoryPts[i];
          const oPts  = optionalPts[i];
          const total = mPts + oPts;
          const totalH = Math.round((total / maxPts) * BAR_MAX_H);
          const mH = total > 0 ? Math.round((mPts / total) * totalH) : 0;
          const oH = totalH - mH;
          const isToday    = i === todayIdx;
          const isSelected = i === selectedIdx;
          const isDimmed   = selectedIdx >= 0 && !isSelected;
          const hasPts     = total > 0;

          return (
            <button
              key={day}
              type="button"
              disabled={!interactive}
              onClick={() => onSelectDay && onSelectDay(isSelected ? null : day)}
              className={`group relative flex flex-1 flex-col items-center outline-none ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              }`}
              title={interactive ? (isSelected ? 'Show all week' : `View ${day}`) : undefined}
            >
              {/* Point label */}
              <div className="mb-1 flex h-5 items-end justify-center gap-0.5">
                {hasPts && (
                  <>
                    {i === peakIdx && totalPts.filter(p => p === maxPts).length === 1 && (
                      <Flame size={11} className="text-orange-500" fill="currentColor" />
                    )}
                    <span className={`text-[10px] font-black leading-none transition-colors ${
                      isSelected ? 'text-violet-700' : isToday ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {fmtPts(total)}
                    </span>
                  </>
                )}
              </div>

              {/* Bar container */}
              <div
                className={`w-full overflow-hidden rounded-xl transition-all duration-300 ${
                  isSelected
                    ? 'shadow-md shadow-violet-500/30 ring-2 ring-violet-500 ring-offset-1'
                    : interactive && !isDimmed
                    ? 'group-hover:ring-1 group-hover:ring-slate-300'
                    : ''
                } ${isDimmed ? 'opacity-30' : ''}`}
                style={{ height: `${BAR_MAX_H}px` }}
              >
                <div className="flex h-full flex-col-reverse">
                  {/* Empty placeholder */}
                  {!hasPts && (
                    <div
                      className={`w-full rounded-xl ${isToday ? 'bg-violet-100' : 'bg-slate-100'}`}
                      style={{ height: '6px' }}
                    />
                  )}

                  {/* Mandatory segment — solid color fallback + gradient enhancement */}
                  {mH > 0 && (
                    <div
                      className={`w-full flex-shrink-0 transition-all duration-700 ${
                        isSelected
                          ? 'bg-violet-500 bg-gradient-to-t from-violet-600 to-violet-400'
                          : isToday
                          ? 'bg-violet-500 bg-gradient-to-t from-violet-500 to-violet-400'
                          : 'bg-amber-400 bg-gradient-to-t from-amber-500 to-amber-300'
                      }`}
                      style={{ height: `${mH}px` }}
                    />
                  )}

                  {/* Optional segment — solid color fallback + gradient enhancement */}
                  {oH > 0 && (
                    <div
                      className={`w-full flex-shrink-0 transition-all duration-700 ${
                        isSelected || isToday
                          ? 'bg-violet-400 bg-gradient-to-t from-violet-400 to-purple-300'
                          : 'bg-emerald-400 bg-gradient-to-t from-emerald-400 to-teal-300'
                      }`}
                      style={{ height: `${oH}px` }}
                    />
                  )}
                </div>
              </div>

              {/* Day label */}
              <span className={`mt-1.5 text-[10px] font-bold transition-colors ${
                isSelected
                  ? 'text-violet-700'
                  : isToday
                  ? 'text-amber-600'
                  : hasPts ? 'text-slate-600' : 'text-slate-300'
              }`}>
                {DAY_SHORT[i]}
              </span>

              {/* Today / selected indicator dot */}
              {(isToday || isSelected) && (
                <div className={`mt-0.5 h-1 w-1 rounded-full ${
                  isSelected ? 'bg-violet-500' : 'bg-amber-400'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-amber-400" /> Mandatory
        </span>
        {dailySelections.some(s => s.completions > 0) && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" /> Bonus picks
          </span>
        )}
        {interactive && (
          <span className="ml-auto text-slate-300">Tap a bar to filter</span>
        )}
      </div>
    </div>
  );
}
