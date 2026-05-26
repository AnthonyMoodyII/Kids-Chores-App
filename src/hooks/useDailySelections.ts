import { useState, useCallback, useRef, useEffect } from 'react';
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
  completeChore: (selectionId: string) => Promise<void>;
  uncompleteChore: (selectionId: string) => Promise<void>;
  unpickChore: (selectionId: string) => Promise<void>;
}

export function useDailySelections(): UseDailySelectionsReturn {
  const [dailySelections, setDailySelections] = useState<DailyChoreSelection[]>([]);
  const weekOf = getWeekOf();

  // Keep a ref so pickChore can read current state without stale closure
  const selectionsRef = useRef(dailySelections);
  useEffect(() => { selectionsRef.current = dailySelections; }, [dailySelections]);

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
    // Find-or-create the selection
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

    // Check if the kid already had this selection with completions > 0 (i.e. this is
    // a repeat pick on a chore they've already done today). In that case auto-complete
    // so picking again = recording another completion. First picks stay at 0 so the
    // kid manually marks done via the checkbox (just like mandatory chores).
    const existing = selectionsRef.current.find(
      s => s.childId === childId && s.templateId === templateId && s.day === day,
    );
    const isRepeatPick = existing && existing.completions > 0;

    if (isRepeatPick) {
      const completeRes = await fetch(`${API_URL}/api/daily-selections/${selection.id}/complete`, {
        method: 'POST',
      });
      if (!completeRes.ok) {
        const err = await completeRes.json();
        throw new Error(err.error || 'Cannot add another completion — global limit may be reached');
      }
      const { selection: completed } = await completeRes.json();
      setDailySelections(prev => prev.map(s => s.id === completed.id ? completed : s));
    } else {
      // First pick: add as pending (completions=0), kid will tap checkbox to mark done
      setDailySelections(prev => {
        const without = prev.filter(s => s.id !== selection.id);
        return [...without, selection];
      });
    }
  }, [weekOf]);

  const completeChore = useCallback(async (selectionId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/daily-selections/${selectionId}/complete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark complete');
    }
    const { selection } = await res.json();
    setDailySelections(prev => prev.map(s => s.id === selectionId ? selection : s));
  }, []);

  const uncompleteChore = useCallback(async (selectionId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/daily-selections/${selectionId}/uncomplete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to undo completion');
    }
    const { selection } = await res.json();
    setDailySelections(prev => prev.map(s => s.id === selectionId ? selection : s));
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
    uncompleteChore,
    unpickChore,
  };
}
