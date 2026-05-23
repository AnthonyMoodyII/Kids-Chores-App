import { useState, useCallback } from 'react';
import type { RewardTemplate, RewardRequest } from '../types';
import { API_URL } from '../lib/constants';

export function useRewards() {
  const [rewards, setRewards] = useState<RewardTemplate[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);

  const updateReward = useCallback(async (id: string, patch: Partial<RewardTemplate>) => {
    const res = await fetch(`${API_URL}/api/rewards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update reward');
    const updated: RewardTemplate = await res.json();
    setRewards(prev => prev.map(r => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const addReward = useCallback(
    async (title: string, pointCost: number, icon: string, description?: string) => {
      const res = await fetch(`${API_URL}/api/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, pointCost, icon, description }),
      });
      if (!res.ok) throw new Error('Failed to add reward');
      const reward: RewardTemplate = await res.json();
      setRewards(prev => [...prev, reward]);
      return reward;
    },
    [],
  );

  const deleteReward = useCallback(async (id: string) => {
    await fetch(`${API_URL}/api/rewards/${id}`, { method: 'DELETE' });
    setRewards(prev => prev.filter(r => r.id !== id));
  }, []);

  const submitRewardIdea = useCallback(
    async (childId: string, childName: string, title: string, description?: string) => {
      const res = await fetch(`${API_URL}/api/reward-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, childName, title, description }),
      });
      if (!res.ok) throw new Error('Failed to submit idea');
      const request: RewardRequest = await res.json();
      setRewardRequests(prev => [request, ...prev]);
      return request;
    },
    [],
  );

  const approveRewardRequest = useCallback(
    async (id: string, pointCost: number) => {
      const res = await fetch(`${API_URL}/api/reward-requests/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointCost }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      const { request, reward } = await res.json();
      setRewardRequests(prev => prev.map(r => (r.id === id ? request : r)));
      setRewards(prev => [...prev, reward]);
    },
    [],
  );

  const rejectRewardRequest = useCallback(async (id: string) => {
    await fetch(`${API_URL}/api/reward-requests/${id}/reject`, { method: 'PUT' });
    setRewardRequests(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
    );
  }, []);

  return {
    rewards,
    setRewards,
    rewardRequests,
    setRewardRequests,
    updateReward,
    addReward,
    deleteReward,
    submitRewardIdea,
    approveRewardRequest,
    rejectRewardRequest,
  };
}
