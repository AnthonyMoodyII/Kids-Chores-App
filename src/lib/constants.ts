export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3000');

export const PARENT_SESSION_KEY = 'chore_parent_auth_v1';
export const DEFAULT_PARENT_USERNAME = 'parent';
export const DEFAULT_PARENT_PASSWORD = 'changeme';

export const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const IMG_HOME = '/kids.jpg';
export const IMG_KIDS = '/parents.jpg';

/** Format a points number with thousands separator: 1000 → "1,000" */
export const fmtPts = (n: number): string => Math.round(n).toLocaleString();

/** Shared Tailwind class fragments */
export const btnBase =
  'transition-colors duration-150 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2';

export const btnPress =
  'active:scale-[0.97] active:brightness-[0.97] active:shadow-inner hover:brightness-[1.02]';

export const cardSurface =
  'rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_2px_1px_rgba(0,0,0,0.03),0_6px_28px_-6px_rgba(109,40,217,0.07),0_1px_4px_rgba(0,0,0,0.04)]';
