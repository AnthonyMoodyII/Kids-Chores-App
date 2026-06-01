import { useState, useCallback } from 'react';
import type { PayoutRecord, CashPayment, User } from '../types';
import { API_URL } from '../lib/constants';
import type { KidStats } from './useChores';

export interface UsePayoutsReturn {
  payouts: PayoutRecord[];
  setPayouts: React.Dispatch<React.SetStateAction<PayoutRecord[]>>;
  cashPayments: CashPayment[];
  setCashPayments: React.Dispatch<React.SetStateAction<CashPayment[]>>;
  processPayout: (kidId: string, onError: (msg: string) => void, customAmount?: number) => Promise<void>;
  processPayoutAll: (
    kids: User[],
    getKidStats: (id: string) => KidStats,
    onError: (msg: string) => void,
  ) => Promise<void>;
  handleDeletePayout: (payoutId: string) => Promise<void>;
  handleClearPayoutHistory: (kidId: string) => Promise<void>;
  handleClearAllPayouts: () => Promise<void>;
  handleAddCashPayment: (
    kidId: string,
    kidName: string,
    amount: string,
    note: string,
  ) => Promise<void>;
  handleDeleteCashPayment: (paymentId: string) => Promise<void>;
}

export function usePayouts(): UsePayoutsReturn {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [cashPayments, setCashPayments] = useState<CashPayment[]>([]);

  const processPayout = useCallback(
    async (kidId: string, onError: (msg: string) => void, customAmount?: number) => {
      try {
        const response = await fetch(`${API_URL}/api/payouts/${kidId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customAmount != null ? { customAmount } : {}),
        });
        if (!response.ok) throw new Error('Failed to process payout');
        const { payout } = await response.json();
        setPayouts(prev => [payout, ...prev]);
      } catch (error) {
        console.error(error);
        onError('Payout failed — please try again.');
      }
    },
    [],
  );

  const processPayoutAll = useCallback(
    async (
      kids: User[],
      getKidStats: (id: string) => KidStats,
      onError: (msg: string) => void,
    ) => {
      const eligibleKids = kids.filter(k => getKidStats(k.id).canPayout);
      if (eligibleKids.length === 0) return;
      if (
        !window.confirm(
          `Process payout for ${eligibleKids.length} kid${eligibleKids.length > 1 ? 's' : ''}?`,
        )
      )
        return;

      for (const kid of eligibleKids) {
        await processPayout(kid.id, onError);
      }
    },
    [processPayout],
  );

  const handleDeletePayout = useCallback(async (payoutId: string) => {
    if (!window.confirm('Delete this payout entry?')) return;
    try {
      const response = await fetch(`${API_URL}/api/payouts/${payoutId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete payout entry');
      setPayouts(prev => prev.filter(p => p.id !== payoutId));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleClearPayoutHistory = useCallback(async (kidId: string) => {
    if (!window.confirm('Clear all payout history for this child?')) return;
    try {
      const response = await fetch(`${API_URL}/api/payouts?childId=${kidId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear payout history');
      setPayouts(prev => prev.filter(p => p.childId !== kidId));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleClearAllPayouts = useCallback(async () => {
    if (!window.confirm('Clear all payout history for all children?')) return;
    try {
      const response = await fetch(`${API_URL}/api/payouts`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear all payout history');
      setPayouts([]);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleAddCashPayment = useCallback(
    async (kidId: string, kidName: string, amount: string, note: string) => {
      const parsed = parseFloat(amount);
      if (!parsed || parsed <= 0) return;
      try {
        const response = await fetch(`${API_URL}/api/cash-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: kidId,
            childName: kidName,
            amount: parsed,
            note: note.trim() || undefined,
          }),
        });
        if (!response.ok) throw new Error('Failed to log cash payment');
        const newPayment = await response.json();
        setCashPayments(prev => [newPayment, ...prev]);
      } catch (error) {
        console.error(error);
      }
    },
    [],
  );

  const handleDeleteCashPayment = useCallback(async (paymentId: string) => {
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      const response = await fetch(`${API_URL}/api/cash-payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete cash payment');
      setCashPayments(prev => prev.filter(p => p.id !== paymentId));
    } catch (error) {
      console.error(error);
    }
  }, []);

  return {
    payouts,
    setPayouts,
    cashPayments,
    setCashPayments,
    processPayout,
    processPayoutAll,
    handleDeletePayout,
    handleClearPayoutHistory,
    handleClearAllPayouts,
    handleAddCashPayment,
    handleDeleteCashPayment,
  };
}
