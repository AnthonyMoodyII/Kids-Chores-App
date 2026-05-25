import { useState, useCallback } from 'react';
import type { DailyChoreSelection, DayOfWeek } from '../types';
import { API_URL } from '../lib/constants';

/** Return the ISO date string (YYYY-MM-DD) of the Monday of the current week. */
export function getWeekOf(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export interface UseDailySelectionsReturn {
  dailySelections: DailyChoreSelection[];
  setDailySelections: React.Dispatch<React.SetStateAction<DailyChoreSelection[]>>;
  weekOf: string;
  refreshSelections: (childId: string) => Promise<void>;
  pickChore: (childId: string, childName: string, templateId: string, day: DayOfWeek) => Promise<void>;
  completeChore: (selectionId: string) => Promise<number>;
  unpickChore: (selectionId: string) => Promise<void>;
}

export function useDailySelections(): UseDailySelectionsReturn {
  const [dailySelections, setDailySelections] = useState<DailyChoreSelection[]>([]);
  const weekOf = getWeekOf();

  const refreshSelections = useCallback(async (childId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/daily-selections?childId=${childId}&weekOf=${weekOf}`);
      if (!res.ok) return;
      const data: DailyChoreSelection[] = await res.json();
      setDailySelections(prev => [
        ...prev.filter(s => s.childId !== childId),
        ...data,
      ]);
    } catch (err) {
      console.error('Failed to refresh daily selections:', err);
    }
  }, [weekOf]);

  const pickChore = useCallback(async (
    childId: string,
    childName: string,
    templateId: string,
    day: DayOfWeek,
  ) => {
    // Create the selection
    const pickRes = await fetch(`${API_URL}/api/daily-selections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, childName, templateId, day, weekOf }),
    });
    if (!pickRes.ok) {
      const err = await pickRes.json();
      throw new Error(err.error || 'Failed to pick chore');
    }
    const selection: DailyChoreSelection = await pickRes.json();

    // Auto-complete once on pick (first completion)
    const completeRes = await fetch(`${API_URL}/api/daily-selections/${selection.id}/complete`, {
      method: 'POST',
    });
    if (!completeRes.ok) {
      // Still add to state even if complete fails
      setDailySelections(prev => [...prev, selection]);
      return;
    }
    const { selection: completed } = await completeRes.json();
    setDailySelections(prev => [...prev, completed]);
  }, [weekOf]);

  const completeChore = useCallback(async (selectionId: string): Promise<number> => {
    const res = await fetch(`${API_URL}/api/daily-selections/${selectionId}/complete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to complete chore');
    }
    const { selection, pointsAwarded } = await res.json();
    setDailySelections(prev => prev.map(s => s.id === selectionId ? selection : s));
    return pointsAwarded as number;
  }, []);

  const unpickChore = useCallback(async (selectionId: string) => {
    const res = await fetch(`${API_URL}/api/daily-selections/${selectionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove chore');
    }
    setDailySelections(prev => prev.filter(s => s.id !== selectionId));
  }, []);

  return {
    dailySelections,
    setDailySelections,
    weekOf,
    refreshSelections,
    pickChore,
    completeChore,
    unpickChore,
  };
}
