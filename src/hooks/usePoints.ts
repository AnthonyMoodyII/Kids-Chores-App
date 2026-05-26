import { useState, useCallback } from 'react';
import type { RewardRedemption, RedemptionRequest } from '../types';
import { API_URL } from '../lib/constants';

export function usePoints() {
  const [pointBalances, setPointBalances] = useState<Record<string, number>>({});
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);

  const refreshBalances = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/points/balance`);
      if (res.ok) setPointBalances(await res.json());
    } catch (err) {
      console.error('Failed to refresh balances', err);
    }
  }, []);

  // Kid requests parent to redeem a reward
  const requestRedemption = useCallback(
    async (childId: string, childName: string, rewardTemplateId: string) => {
      const res = await fetch(`${API_URL}/api/redemption-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, childName, rewardTemplateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send request');
      }
      const request: RedemptionRequest = await res.json();
      setRedemptionRequests(prev => [request, ...prev.filter(r => r.id !== request.id)]);
      return request;
    },
    [],
  );

  // Parent approves a redemption request
  const approveRedemptionRequest = useCallback(
    async (id: string) => {
      const res = await fetch(`${API_URL}/api/redemption-requests/${id}/approve`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to approve');
      const { redemption } = await res.json();
      setRedemptionRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, status: 'approved' as const } : r)),
      );
      setRedemptions(prev => [redemption, ...prev]);
      await refreshBalances();
    },
    [refreshBalances],
  );

  // Parent rejects a redemption request
  const rejectRedemptionRequest = useCallback(async (id: string) => {
    await fetch(`${API_URL}/api/redemption-requests/${id}/reject`, { method: 'PUT' });
    setRedemptionRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
    );
  }, []);

  // Parent directly redeems a reward for a kid
  const redeemReward = useCallback(
    async (childId: string, rewardTemplateId: string) => {
      const res = await fetch(`${API_URL}/api/points/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, rewardTemplateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to redeem');
      }
      const redemption: RewardRedemption = await res.json();
      setRedemptions(prev => [redemption, ...prev]);
      await refreshBalances();
      return redemption;
    },
    [refreshBalances],
  );

  // Delete a redemption and refund points
  const deleteRedemption = useCallback(
    async (id: string) => {
      await fetch(`${API_URL}/api/points/redemptions/${id}`, { method: 'DELETE' });
      setRedemptions(prev => prev.filter(r => r.id !== id));
      await refreshBalances();
    },
    [refreshBalances],
  );

  // Mark a redeemed reward as used (moves it out of inventory)
  const markRedemptionUsed = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/api/points/redemptions/${id}/use`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to mark as used');
    const updated: RewardRedemption = await res.json();
    setRedemptions(prev => prev.map(r => r.id === id ? updated : r));
  }, []);

  // Move a redemption back to inventory (unmark used)
  const markRedemptionUnused = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/api/points/redemptions/${id}/unuse`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to unmark');
    const updated: RewardRedemption = await res.json();
    setRedemptions(prev => prev.map(r => r.id === id ? updated : r));
  }, []);

  return {
    pointBalances,
    setPointBalances,
    redemptions,
    setRedemptions,
    redemptionRequests,
    setRedemptionRequests,
    refreshBalances,
    requestRedemption,
    approveRedemptionRequest,
    rejectRedemptionRequest,
    redeemReward,
    deleteRedemption,
    markRedemptionUsed,
    markRedemptionUnused,
  };
}
