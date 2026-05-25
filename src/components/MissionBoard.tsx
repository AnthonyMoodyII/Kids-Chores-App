import { useState } from 'react';
import { CheckCircle2, Circle, AlertCircle, Plus, RotateCcw, X } from 'lucide-react';
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
  poolTemplates: ChoreTemplate[];    // isInPool=true, not already mandatory-assigned to this kid
  dailySelections: DailyChoreSelection[];
  onToggleMandatory: (choreId: string, day: DayOfWeek) => void;
  onPickChore: (templateId: string) => Promise<void>;
  onCompleteOptional: (selectionId: string) => Promise<void>;
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
  onUnpickChore,
}: MissionBoardProps) {
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [unpickingId, setUnpickingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Today's optional picks for this kid on selectedDay
  const todayPicks = dailySelections.filter(
    s => s.childId === activeKidId && s.day === selectedDay,
  );

  // Template IDs already picked today (exclude from Available panel)
  const pickedTemplateIds = new Set(todayPicks.map(s => s.templateId));

  // Template IDs that are mandatory-assigned (exclude from Available panel)
  const mandatoryTemplateIds = new Set(mandatoryChores.map(c => c.templateId).filter(Boolean));

  // Available pool = isInPool, not mandatory-assigned, not already picked today
  const available = poolTemplates.filter(
    t => t.isInPool !== false && !mandatoryTemplateIds.has(t.id) && !pickedTemplateIds.has(t.id),
  );

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

  const handleComplete = async (selectionId: string) => {
    setCompletingId(selectionId);
    setErrorMsg(null);
    try {
      await onCompleteOptional(selectionId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to complete chore');
    } finally {
      setCompletingId(null);
    }
  };

  const handleUnpick = async (selectionId: string) => {
    setUnpickingId(selectionId);
    setErrorMsg(null);
    try {
      await onUnpickChore(selectionId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cannot remove a started chore');
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
                      <p className={`font-bold ${isDone ? 'text-emerald-800 line-through opacity-60' : 'text-slate-800'} flex flex-wrap items-center gap-1.5 text-sm`}>
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
                      {/* Progress bar */}
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

          {/* Optional picks for today */}
          {todayPicks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                📌 My Picks Today
              </p>
              {todayPicks.map(s => {
                const atMax = s.completions >= s.maxPerDay;
                const isCompleting = completingId === s.id;
                const isUnpicking = unpickingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border-2 p-4 ${
                      s.completions > 0
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          {s.title}
                          {s.completions > 0 && (
                            <span className="ml-1.5 text-amber-600">×{s.completions}</span>
                          )}
                          {atMax && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                              <CheckCircle2 size={10} /> Max done!
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          ⭐ +{chorePointsPerDay(s.baseValue)} pts · 💵 ${(s.baseValue / 5).toFixed(2)}/completion
                          {s.maxPerDay > 1 && <span className="ml-1">🔁 ×{s.maxPerDay} max/day</span>}
                        </p>
                      </div>
                      {/* Remove (only if not started) */}
                      {s.completions === 0 && (
                        <button
                          type="button"
                          disabled={isUnpicking}
                          onClick={() => handleUnpick(s.id)}
                          className={`${btnBase} rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-500`}
                          title="Remove this chore"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    {!atMax && (
                      <button
                        type="button"
                        disabled={isCompleting}
                        onClick={() => handleComplete(s.id)}
                        className={`${btnBase} ${btnPress} mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-2 text-xs font-black uppercase tracking-wide text-white shadow-md shadow-amber-400/30 disabled:pointer-events-none disabled:opacity-50`}
                      >
                        <RotateCcw size={13} />
                        {isCompleting ? 'Marking…' : s.completions === 0 ? '✅ Mark Done' : 'Do it again'}
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
                You&apos;ve picked all available missions today!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {available.map(t => {
                const pts = chorePointsPerDay(t.baseValue);
                const dollarPer = (t.baseValue / 5).toFixed(2);
                const isPicking = pickingId === t.id;
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
                        {(t.maxPerDay ?? 1) > 1 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-600">
                            🔁 ×{t.maxPerDay}/day
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
