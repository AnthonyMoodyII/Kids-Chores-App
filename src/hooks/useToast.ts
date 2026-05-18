import { useState, useCallback } from 'react';

const TOAST_DURATION_MS = 3500;

export function useToast() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), TOAST_DURATION_MS);
  }, []);

  return { toastMsg, showToast };
}
