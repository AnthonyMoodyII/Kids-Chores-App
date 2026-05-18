export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3000');

export const PARENT_SESSION_KEY = 'chore_parent_auth_v1';
export const DEFAULT_PARENT_USERNAME = 'parent';
export const DEFAULT_PARENT_PASSWORD = 'changeme';

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const IMG_HOME = '/kids.jpg';
export const IMG_KIDS = '/parents.jpg';

/** Shared Tailwind class fragments */
export const btnBase =
  'transition-all duration-200 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2';

export const btnPress =
  'active:scale-[0.97] active:brightness-[0.97] active:shadow-inner hover:brightness-[1.02]';

export const cardSurface =
  'rounded-[1.75rem] border border-white/60 bg-white/80 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm';
