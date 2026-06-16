import { useId } from 'react';
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
  const LABEL_OFFSET = 24; // h-5 label row (20px) + mb-1 (4px)
  const interactive = !!onSelectDay;
  const gradientId = useId();

  // Trend line — one point per day, normalized to the bar area (0,0 top-left .. 100,100 bottom-right)
  const daysWithPts = totalPts.filter(p => p > 0).length;
  const avgPts = daysWithPts > 0 ? weekTotal / 7 : 0;
  const avgYPct = 100 - Math.min(100, (avgPts / maxPts) * 100);
  const trendPoints = totalPts
    .map((pts, i) => {
      const x = ((i + 0.5) / 7) * 100;
      const y = 100 - Math.min(100, (pts / maxPts) * 100);
      return `${x},${y}`;
    })
    .join(' ');
  const peakIdx = totalPts.indexOf(maxPts);
  const hasAnyPts = weekTotal > 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400">
          ⭐ Points this week
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-400">
            {weekTotal.toLocaleString()} pts total
          </p>
          {selectedDay && onSelectDay && (
            <button
              type="button"
              onClick={() => onSelectDay(null)}
              className={`${btnBase} rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-600 hover:bg-violet-100`}
            >
              ← All Week
            </button>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end gap-1.5" style={{ height: `${BAR_MAX_H + 36}px` }}>
        {/* Trend line overlay — average reference + connecting line across the week */}
        {hasAnyPts && (
          <svg
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: `${LABEL_OFFSET}px`, height: `${BAR_MAX_H}px`, left: 0, right: 0, width: '100%' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <line
              x1="0" y1={avgYPct} x2="100" y2={avgYPct}
              stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={trendPoints}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.85"
            />
            {totalPts.map((pts, i) => {
              if (pts === 0) return null;
              const x = ((i + 0.5) / 7) * 100;
              const y = 100 - Math.min(100, (pts / maxPts) * 100);
              return (
                <circle
                  key={i}
                  cx={x} cy={y} r="2.2"
                  fill={i === selectedIdx ? '#7c3aed' : i === todayIdx ? '#f59e0b' : '#ffffff'}
                  stroke="#a78bfa"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        )}
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
                      <span className="text-[10px] leading-none">🔥</span>
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
                className={`w-full overflow-hidden rounded-lg transition-all duration-300 ${
                  isSelected
                    ? 'ring-2 ring-violet-500 ring-offset-1'
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
                      className={`w-full rounded-lg ${isToday ? 'bg-violet-100' : 'bg-slate-100'}`}
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
        {hasAnyPts && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded-sm bg-gradient-to-r from-violet-400 to-amber-400" /> Trend
          </span>
        )}
        {interactive && (
          <span className="ml-auto text-slate-300">Tap a bar to filter</span>
        )}
      </div>
    </div>
  );
}
