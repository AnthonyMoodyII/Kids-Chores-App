interface PointsBadgeProps {
  points: number;
  todayPoints?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function PointsBadge({ points, todayPoints, size = 'md' }: PointsBadgeProps) {
  const sizes = {
    sm: { badge: 'px-3 py-1 text-sm gap-1', star: 'text-base' },
    md: { badge: 'px-4 py-2 text-base gap-1.5', star: 'text-lg' },
    lg: { badge: 'px-5 py-3 text-xl gap-2', star: 'text-2xl' },
  };
  const s = sizes[size];

  return (
    <div className={`inline-flex items-center ${s.badge} rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 font-black text-amber-900 shadow-md shadow-amber-300/40`}>
      <span className={s.star}>⭐</span>
      <span>{points.toLocaleString()} pts</span>
      {todayPoints !== undefined && todayPoints > 0 && (
        <span className="ml-1 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-xs font-black text-amber-800">
          +{todayPoints} today
        </span>
      )}
    </div>
  );
}
