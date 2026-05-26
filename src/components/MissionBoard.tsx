import { useState } from 'react';
import { CheckCircle2, Circle, AlertCircle, Plus, X } from 'lucide-react';
import type { Chore, ChoreTemplate, DailyChoreSelection, DayOfWeek } from '../types';
import { DAYS, btnBase, btnPress, cardSurface } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';

function chorePointsPerDay(baseValue: number) {
  return 10 + Math.round(baseValue * 4);
}

interface MissionBoardProps {
  activeKidId: string;
  activeKidName: string;
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  mandatoryChores: Chore[];
  poolTemplates: ChoreTemplate[];         // isInPool=true, not mandatory-assigned to this kid
  dailySelections: DailyChoreSelection[]; // ALL kids' selections (for global limit checks)
  onToggleMandatory: (choreId: string, day: DayOfWeek) => void;
  onPickChore: (templateId: string) => Promise<void>;
  onCompleteOptional: (selectionId: string) => Promise<void>;
  onUncompleteOptional: (selectionId: string) => Promise<void>;
  onUnpickChore: (selectionId: string) => Promise<void>;
}

export function MissionBoard({
  activeKidId,
  activeKidName,
  selectedDay,
  onSelectDay,
  mandatoryChores,
  poolTemplates,
  dailySelections,
  onToggleMandatory,
  onPickChore,
  onCompleteOptional,
  onUncompleteOptional,
  onUnpickChore,
}: MissionBoardProps) {
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [unpickingId, setUnpickingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // This kid's picks on the selected day
  const todayPicks = dailySelections.filter(
    s => s.childId === activeKidId && s.day === selectedDay,
  );

  // Mandatory template IDs (exclude from Available panel)
  const mandatoryTemplateIds = new Set(mandatoryChores.map(c => c.templateId).filter(Boolean));

  // Global completions today for a template (all kids combined)
  const globalCompletionsToday = (templateId: string): number =>
    dailySelections
      .filter(s => s.templateId === templateId && s.day === selectedDay)
      .reduce((sum, s) => sum + s.completions, 0);

  // Available pool:
  //  - not mandatory-assigned to this kid
  //  - global limit not yet hit
  //  - this kid doesn't have a PENDING (completions=0) pick for it today
  //    (after they mark it done, completions>0, it reappears for repeat picks on repeatable chores)
  const available = poolTemplates.filter(t => {
    if (t.isInPool === false) return false;
    if (mandatoryTemplateIds.has(t.id)) return false;
    if (globalCompletionsToday(t.id) >= (t.maxPerDay ?? 1)) return false;
    // Hide if kid already has a pending (not-yet-done) pick
    if (todayPicks.some(s => s.templateId === t.id && s.completions === 0)) return false;
    return true;
  });

  const handlePick = async (templateId: string) => {
    setPickingId(templateId);
    setErrorMsg(null);
    try {
      await onPickChore(templateId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to pick chore');
    } finally {
      setPickingId(null);
    }
  };

  const handleToggle = async (s: DailyChoreSelection) => {
    setTogglingId(s.id);
    setErrorMsg(null);
    try {
      if (s.completions === 0) {
        await onCompleteOptional(s.id);
      } else {
        await onUncompleteOptional(s.id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update chore');
    } finally {
      setTogglingId(null);
    }
  };

  const handleUnpick = async (selectionId: string) => {
    setUnpickingId(selectionId);
    setErrorMsg(null);
    try {
      await onUnpickChore(selectionId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cannot remove chore');
    } finally {
      setUnpickingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Day tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DAYS.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => onSelectDay(day)}
            className={`${btnBase} ${btnPress} shrink-0 flex-1 rounded-2xl border-2 px-3 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${
              selectedDay === day
                ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300 hover:bg-violet-50'
            }`}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600">
          {errorMsg}
          <button type="button" onClick={() => setErrorMsg(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Two-column board */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Left: My Chores ── */}
        <div className={`${cardSurface} p-5`}>
          <h3 className="mb-4 flex items-center gap-2 text-base font-black uppercase tracking-wider text-slate-700">
            <span className="text-lg">📋</span> {activeKidName}&apos;s Chores
          </h3>

          {/* Mandatory chores */}
          {mandatoryChores.length > 0 && (
            <div className="mb-4 space-y-2">
              {mandatoryChores.map(chore => {
                const isDone = chore.completedDays.includes(selectedDay);
                const earned = getChoreEarnedAmount(chore.completedDays.length, chore.baseValue);
                const ptsPerDay = chorePointsPerDay(chore.baseValue);
                return (
                  <button
                    key={chore.id}
                    type="button"
                    onClick={() => onToggleMandatory(chore.id, selectedDay)}
                    className={`${btnBase} ${btnPress} flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                      isDone
                        ? 'border-emerald-400 bg-emerald-50'
                        : chore.isMandatory
                          ? 'border-rose-300 bg-rose-50 hover:border-rose-400'
                          : 'border-slate-200 bg-white hover:border-violet-300'
                    }`}
                  >
                    <div className={isDone ? 'text-emerald-600' : 'text-slate-400'}>
                      {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-sm flex flex-wrap items-center gap-1.5 ${isDone ? 'text-emerald-800 line-through opacity-60' : 'text-slate-800'}`}>
                        {chore.title}
                        {chore.isMandatory && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 no-underline opacity-100">
                            <AlertCircle size={10} /> Mandatory
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>⭐ +{ptsPerDay} pts/day</span>
                        <span>💵 ${earned.toFixed(2)} earned</span>
                      </p>
                      <div className="mt-1.5 flex gap-0.5">
                        {[...Array(7)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              i < chore.completedDays.length
                                ? chore.isApproved ? 'bg-emerald-500' : 'bg-violet-400'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Optional picks for today — same checkbox style as mandatory */}
          {todayPicks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                📌 My Picks Today
              </p>
              {todayPicks.map(s => {
                const isDone = s.completions > 0;
                const isToggling = togglingId === s.id;
                const isUnpicking = unpickingId === s.id;
                const globalDone = globalCompletionsToday(s.templateId);
                const globalMax = s.maxPerDay;
                const ptsPerDay = chorePointsPerDay(s.baseValue);

                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition-colors ${
                      isDone
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-amber-200'
                    }`}
                  >
                    {/* Checkbox — same visual language as mandatory chores */}
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggle(s)}
                      className={`${btnBase} ${btnPress} shrink-0 disabled:pointer-events-none disabled:opacity-50`}
                      aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                    >
                      {isDone
                        ? <CheckCircle2 size={24} className="text-amber-500" />
                        : <Circle size={24} className="text-slate-400" />
                      }
                    </button>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-sm ${isDone ? 'text-amber-800' : 'text-slate-800'}`}>
                        {s.title}
                        {s.completions > 1 && (
                          <span className="ml-1.5 font-black text-amber-600">×{s.completions}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        ⭐ +{ptsPerDay} pts · 💵 ${(s.baseValue / 5).toFixed(2)}/completion
                        {globalMax > 1 && (
                          <span className="ml-1 font-bold text-violet-500">
                            · {globalDone}/{globalMax} done today
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Remove button — only available when not yet started */}
                    {s.completions === 0 && (
                      <button
                        type="button"
                        disabled={isUnpicking}
                        onClick={() => handleUnpick(s.id)}
                        className={`${btnBase} shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-300 hover:border-red-200 hover:text-red-400 disabled:pointer-events-none disabled:opacity-40`}
                        title="Remove from my list"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {mandatoryChores.length === 0 && todayPicks.length === 0 && (
            <p className="text-sm text-slate-400">
              No chores assigned yet. Pick some missions from the right! →
            </p>
          )}
        </div>

        {/* ── Right: Available Missions ── */}
        <div className={`${cardSurface} p-5`}>
          <h3 className="mb-1 flex items-center gap-2 text-base font-black uppercase tracking-wider text-slate-700">
            <span className="text-lg">🎯</span> Available Missions
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Pick extra chores to earn more points and money today
          </p>

          {available.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">
                All available missions are done for today!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {available.map(t => {
                const pts = chorePointsPerDay(t.baseValue);
                const dollarPer = (t.baseValue / 5).toFixed(2);
                const isPicking = pickingId === t.id;
                const globalDone = globalCompletionsToday(t.id);
                const globalMax = t.maxPerDay ?? 1;
                const remaining = globalMax - globalDone;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">{t.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>⭐ +{pts} pts</span>
                        <span>💵 ${dollarPer}/completion</span>
                        {globalMax > 1 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-600">
                            🔁 {remaining} of {globalMax} left today
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isPicking}
                      onClick={() => handlePick(t.id)}
                      className={`${btnBase} ${btnPress} flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-black text-white shadow-md shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
                    >
                      <Plus size={13} />
                      {isPicking ? '…' : 'Pick'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
