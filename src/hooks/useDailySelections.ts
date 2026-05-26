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
  refreshSelections: () => Promise<void>;
  pickChore: (childId: string, childName: string, templateId: string, day: DayOfWeek) => Promise<void>;
  uncompleteChore: (selectionId: string) => Promise<void>;
  unpickChore: (selectionId: string) => Promise<void>;
}

export function useDailySelections(): UseDailySelectionsReturn {
  const [dailySelections, setDailySelections] = useState<DailyChoreSelection[]>([]);
  const weekOf = getWeekOf();

  // Fetch ALL kids' selections for the current week in one request.
  // This gives us the data needed for global-limit checks across kids.
  const refreshSelections = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/daily-selections?weekOf=${weekOf}`);
      if (!res.ok) return;
      const data: DailyChoreSelection[] = await res.json();
      setDailySelections(data);
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
    // Find-or-create the selection (server returns existing if already picked today)
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

    // Complete once (each pick = one completion)
    const completeRes = await fetch(`${API_URL}/api/daily-selections/${selection.id}/complete`, {
      method: 'POST',
    });
    if (!completeRes.ok) {
      const err = await completeRes.json();
      throw new Error(err.error || 'Cannot complete chore — global limit may be reached');
    }
    const { selection: completed } = await completeRes.json();
    setDailySelections(prev => {
      const without = prev.filter(s => s.id !== completed.id);
      return [...without, completed];
    });
  }, [weekOf]);

  // Undo one completion. If it was the last completion the selection is deleted.
  const uncompleteChore = useCallback(async (selectionId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/daily-selections/${selectionId}/uncomplete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to undo completion');
    }
    const data = await res.json();
    if (data.deleted) {
      setDailySelections(prev => prev.filter(s => s.id !== selectionId));
    } else {
      setDailySelections(prev => prev.map(s => s.id === selectionId ? data.selection : s));
    }
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
    uncompleteChore,
    unpickChore,
  };
}
