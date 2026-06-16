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

const RANK_RING = [
  'ring-2 ring-amber-400',
  'ring-2 ring-slate-300',
  'ring-2 ring-orange-300',
];

const RANK_AVATAR_BG = [
  'bg-gradient-to-br from-amber-400 to-yellow-500',
  'bg-gradient-to-br from-slate-300 to-slate-400',
  'bg-gradient-to-br from-orange-300 to-orange-400',
];

const RANK_BAR = [
  'bg-gradient-to-r from-amber-400 to-yellow-400',
  'bg-gradient-to-r from-slate-300 to-slate-400',
  'bg-gradient-to-r from-orange-300 to-orange-400',
];

export function Leaderboard({ entries, highlightId, title = 'Leaderboard', compact = false }: LeaderboardProps) {
  const ranked = [...entries].sort((a, b) => b.points - a.points);

  if (ranked.length === 0) return null;

  const topScore = Math.max(...ranked.map(e => e.points), 1);

  return (
    <div className={`${cardSurface} relative overflow-hidden ${compact ? 'p-4' : 'p-5'}`}>
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-200/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-violet-200/30 blur-2xl" />

      <h3 className="relative mb-3 flex items-center gap-1.5 text-base font-black text-black">
        <span className="text-lg">🏆</span> {title}
      </h3>

      <div className="relative space-y-2">
        {ranked.map((entry, i) => {
          const isActive = entry.id === highlightId;
          const isTop3 = i < 3;
          const pct = Math.max(6, Math.round((entry.points / topScore) * 100));
          const initial = entry.name.trim().charAt(0).toUpperCase() || '?';

          return (
            <div
              key={entry.id}
              className={`relative overflow-hidden rounded-2xl px-3 py-2.5 transition-all ${
                isActive
                  ? 'border border-violet-300 bg-violet-50 shadow-sm'
                  : isTop3
                  ? 'border border-slate-100 bg-white shadow-sm'
                  : 'border border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge / medal */}
                <span className="relative w-6 shrink-0 text-center text-lg">
                  {RANK_MEDALS[i] ?? (
                    <span className="text-xs font-black text-slate-400">#{i + 1}</span>
                  )}
                </span>

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white shadow-sm ${
                      isTop3 ? RANK_AVATAR_BG[i] : 'bg-gradient-to-br from-violet-400 to-indigo-500'
                    } ${isTop3 ? RANK_RING[i] : isActive ? 'ring-2 ring-violet-300' : ''}`}
                  >
                    {initial}
                  </div>
                  {i === 0 && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-sm">👑</span>
                  )}
                </div>

                {/* Name + progress bar */}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-bold ${isActive ? 'text-violet-800' : 'text-slate-700'}`}>
                    {entry.name}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isTop3 ? RANK_BAR[i] : 'bg-gradient-to-r from-violet-400 to-indigo-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {entry.money !== undefined && (
                    <span className="text-[11px] font-black text-emerald-600">${entry.money.toFixed(2)}</span>
                  )}
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                    ⭐ {fmtPts(entry.points)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
