import { useState, useCallback } from 'react';
import type { Chore, ChoreTemplate, DayOfWeek } from '../types';
import { API_URL } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';

export interface KidStats {
  active: Chore[];
  approved: number;
  pending: number;
  canPayout: boolean;
}

export interface UseChoresReturn {
  chores: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  choreTemplates: ChoreTemplate[];
  setChoreTemplates: React.Dispatch<React.SetStateAction<ChoreTemplate[]>>;
  getKidStats: (kidId: string) => KidStats;
  handleToggleDay: (
    choreId: string,
    day: DayOfWeek,
    onMilestone: (title: string, isMilestone: boolean) => void,
  ) => Promise<void>;
  handleApproveChore: (choreId: string) => Promise<void>;
  handleApproveAll: () => Promise<void>;
  handleWeeklyReset: () => Promise<void>;
}

export function useChores(): UseChoresReturn {
  const [chores, setChores] = useState<Chore[]>([]);
  const [choreTemplates, setChoreTemplates] = useState<ChoreTemplate[]>([]);

  const getKidStats = useCallback(
    (kidId: string): KidStats => {
      const active = chores
        .filter(c => c.assignedTo === kidId && !c.isArchived)
        .sort((a, b) => {
          if (a.isMandatory && !b.isMandatory) return -1;
          if (!a.isMandatory && b.isMandatory) return 1;
          return 0;
        });

      const approved = active
        .filter(c => c.isApproved)
        .reduce((s, c) => s + getChoreEarnedAmount(c.completedDays.length, c.baseValue), 0);

      const pending = active.filter(c => c.completedDays.length >= 4 && !c.isApproved).length;

      return { active, approved, pending, canPayout: approved > 0 };
    },
    [chores],
  );

  const handleToggleDay = useCallback(
    async (
      choreId: string,
      day: DayOfWeek,
      onMilestone: (title: string, isMilestone: boolean) => void,
    ) => {
      const choreToUpdate = chores.find(c => c.id === choreId);
      if (!choreToUpdate) return;

      const isCompleted = choreToUpdate.completedDays.includes(day);
      const newCompletedDays = isCompleted
        ? choreToUpdate.completedDays.filter(d => d !== day)
        : [...choreToUpdate.completedDays, day];

      const optimisticChore = { ...choreToUpdate, completedDays: newCompletedDays };
      setChores(prev => prev.map(c => (c.id === choreId ? optimisticChore : c)));

      if (!isCompleted) {
        const n = newCompletedDays.length;
        if (n === 4 || n === 7) {
          onMilestone(choreToUpdate.title, true);
        }
      }

      try {
        const response = await fetch(`${API_URL}/api/chores/${choreId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day }),
        });
        if (!response.ok) throw new Error('Failed to toggle chore day');
        const serverUpdated = await response.json();
        setChores(prev => prev.map(c => (c.id === choreId ? serverUpdated : c)));
      } catch (error) {
        console.error('Toggle failed, reverting:', error);
        setChores(prev => prev.map(c => (c.id === choreId ? choreToUpdate : c)));
      }
    },
    [chores],
  );

  const handleApproveChore = useCallback(async (choreId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/chores/${choreId}/approve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to toggle approval');
      const updated = await response.json();
      setChores(prev => prev.map(c => (c.id === choreId ? updated : c)));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleApproveAll = useCallback(async () => {
    const eligible = chores.filter(
      c => !c.isArchived && !c.isApproved && c.completedDays.length >= 4,
    );
    if (eligible.length === 0) return;
    if (
      !window.confirm(
        `Approve all ${eligible.length} eligible chore${eligible.length > 1 ? 's' : ''} across all kids?`,
      )
    )
      return;

    try {
      const response = await fetch(`${API_URL}/api/chores/approve-all`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to approve all chores');
      const { chores: updatedChores } = await response.json();
      setChores(updatedChores);
    } catch (error) {
      console.error(error);
    }
  }, [chores]);

  const handleWeeklyReset = useCallback(async () => {
    if (
      !window.confirm(
        "Reset the week for all active chores? This clears every day's checkmarks and approval state (paid-out / archived chores stay as they are). Use this at the end of the week, typically Sunday.",
      )
    )
      return;

    try {
      const response = await fetch(`${API_URL}/api/chores/reset`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reset chores');
      const updated = await response.json();
      setChores(updated);
    } catch (error) {
      console.error(error);
    }
  }, []);

  return {
    chores,
    setChores,
    choreTemplates,
    setChoreTemplates,
    getKidStats,
    handleToggleDay,
    handleApproveChore,
    handleApproveAll,
    handleWeeklyReset,
  };
}
