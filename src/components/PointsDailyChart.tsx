import type { Chore } from '../types';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PointsDailyChartProps {
  /** Active chores for this kid — completedDays tells us exactly which weekdays were done */
  chores: Chore[];
}

function chorePointsPerDay(baseValue: number) {
  return 10 + Math.round(baseValue * 4);
}

export function PointsDailyChart({ chores }: PointsDailyChartProps) {
  // Sum points per weekday directly from completedDays (day names are the source of truth)
  const dailyPts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const chore of chores) {
    const ptsPerDay = chorePointsPerDay(chore.baseValue);
    for (const day of chore.completedDays) {
      const idx = DAYS_ORDER.indexOf(day);
      if (idx >= 0) dailyPts[idx] += ptsPerDay;
    }
  }

  const maxPts = Math.max(...dailyPts, 1);

  // Today's day index (Mon=0 … Sun=6)
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-amber-700">
        Points this week
      </p>
      <div className="flex items-end gap-2">
        {DAYS_ORDER.map((day, i) => {
          const pts = dailyPts[i];
          const pct = Math.round((pts / maxPts) * 100);
          const isToday = i === todayIdx;
          return (
            <div key={day} className="flex flex-1 flex-col items-center gap-1">
              {pts > 0 && (
                <span className="text-[10px] font-black text-amber-700">{pts}</span>
              )}
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  isToday
                    ? 'bg-gradient-to-t from-amber-500 to-yellow-400 shadow-md shadow-amber-300/50'
                    : pts > 0
                    ? 'bg-gradient-to-t from-amber-300 to-yellow-200'
                    : 'bg-amber-100'
                }`}
                style={{ height: `${Math.max(pct, 4)}px`, minHeight: '4px', maxHeight: '64px' }}
              />
              <span className={`text-[10px] font-bold ${isToday ? 'text-amber-700' : 'text-slate-400'}`}>
                {DAY_SHORT[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
