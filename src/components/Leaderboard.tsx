import { cardSurface, fmtPts } from '../lib/constants';

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  money?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightId?: string;
  title?: string;
  compact?: boolean;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ entries, highlightId, title = 'Leaderboard', compact = false }: LeaderboardProps) {
  const ranked = [...entries].sort((a, b) => b.points - a.points);

  if (ranked.length === 0) return null;

  return (
    <div className={`${cardSurface} ${compact ? 'p-4' : 'p-5'}`}>
      <h3 className="mb-3 text-base font-black text-black">🏆 {title}</h3>
      <div className="space-y-2">
        {ranked.map((entry, i) => {
          const isActive = entry.id === highlightId;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                isActive
                  ? 'border border-violet-300 bg-violet-50'
                  : 'border border-slate-100 bg-slate-50'
              }`}
            >
              <span className="w-6 shrink-0 text-center text-lg">
                {RANK_MEDALS[i] ?? `#${i + 1}`}
              </span>
              <span className={`flex-1 truncate text-sm font-bold ${isActive ? 'text-violet-800' : 'text-slate-700'}`}>
                {entry.name}
              </span>
              {entry.money !== undefined && (
                <span className="text-xs font-black text-emerald-600">${entry.money.toFixed(2)}</span>
              )}
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                ⭐ {fmtPts(entry.points)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
