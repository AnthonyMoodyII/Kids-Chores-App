import { PARENT_SESSION_KEY } from './constants';

export function readParentSession(): boolean {
  try {
    return sessionStorage.getItem(PARENT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeParentSession(authed: boolean): void {
  try {
    if (authed) {
      sessionStorage.setItem(PARENT_SESSION_KEY, '1');
    } else {
      sessionStorage.removeItem(PARENT_SESSION_KEY);
    }
  } catch {
    /* ignore — storage unavailable (e.g. private browsing restrictions) */
  }
}
