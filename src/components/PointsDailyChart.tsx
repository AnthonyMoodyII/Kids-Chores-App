import type { PointLedgerEntry } from '../types';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PointsDailyChartProps {
  ledger: PointLedgerEntry[];
  childId: string;
}

export function PointsDailyChart({ ledger, childId }: PointsDailyChartProps) {
  // Sum points earned per day-of-week this week from the ledger
  // We use createdAt to bucket into day-of-week (Mon=0 … Sun=6)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const dailyPts: number[] = [0, 0, 0, 0, 0, 0, 0];

  for (const entry of ledger) {
    if (entry.childId !== childId) continue;
    const d = new Date(entry.createdAt);
    if (d < monday || d >= sunday) continue;
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0 Sun=6
    if (entry.amount > 0) dailyPts[dayIdx] += entry.amount;
  }

  const maxPts = Math.max(...dailyPts, 1);

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-amber-700">
        Points this week
      </p>
      <div className="flex items-end gap-2">
        {DAYS_ORDER.map((day, i) => {
          const pts = dailyPts[i];
          const pct = Math.round((pts / maxPts) * 100);
          const isToday = i === mondayOffset;
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
