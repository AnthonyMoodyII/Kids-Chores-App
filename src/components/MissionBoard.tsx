import { useState, useMemo } from 'react';
import { CheckCircle2, Circle, Plus, X, Search } from 'lucide-react';
import type { Chore, ChoreTemplate, DailyChoreSelection, DayOfWeek } from '../types';
import { DAYS, btnBase, btnPress, cardSurface, fmtPts } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';

function chorePointsPerDay(baseValue: number) {
  return Math.max(10, 10 + Math.round(baseValue * 4));
}

const isIconUrl = (s: string) =>
  s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('data:');

const renderIcon = (icon: string) =>
  isIconUrl(icon)
    ? <img src={icon} className="h-7 w-7 shrink-0 object-contain" alt="" />
    : <span className="shrink-0 text-2xl leading-none">{icon}</span>;

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
  const [missionSearch, setMissionSearch] = useState('');
  const [missionSort, setMissionSort] = useState<'pts' | 'az'>('pts');

  // This kid's picks on the selected day
  const todayPicks = dailySelections.filter(
    s => s.childId === activeKidId && s.day === selectedDay,
  );

  // Points earned on the selected day (mandatory + optional)
  const dayPoints =
    mandatoryChores
      .filter(c => c.completedDays.includes(selectedDay))
      .reduce((sum, c) => sum + chorePointsPerDay(c.baseValue), 0) +
    todayPicks
      .filter(s => s.completions > 0)
      .reduce((sum, s) => sum + chorePointsPerDay(s.baseValue) * s.completions, 0);

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
    if (todayPicks.some(s => s.templateId === t.id && s.completions === 0)) return false;
    return true;
  });

  // Filtered + sorted available missions
  const filteredMissions = useMemo(() => {
    const q = missionSearch.trim().toLowerCase();
    const filtered = q ? available.filter(t => t.title.toLowerCase().includes(q)) : available;
    return [...filtered].sort((a, b) =>
      missionSort === 'pts'
        ? chorePointsPerDay(b.baseValue) - chorePointsPerDay(a.baseValue)
        : a.title.localeCompare(b.title),
    );
  }, [available, missionSearch, missionSort]);

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
            className={`${btnBase} ${btnPress} shrink-0 flex-1 rounded-xl border px-2 py-2 text-[11px] font-semibold tracking-tight transition-all ${
              selectedDay === day
                ? 'border-violet-400/40 bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                : 'border-slate-200 bg-white text-slate-400 hover:border-violet-200 hover:text-slate-600'
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-700">
              <span className="text-lg">📋</span> {activeKidName}'s Chores
            </h3>
            {dayPoints > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                ⭐ +{fmtPts(dayPoints)} pts {selectedDay.slice(0, 3)}
              </span>
            )}
          </div>

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
                    {chore.icon && renderIcon(chore.icon)}
                    <div className="min-w-0 flex-1">
                      <p className={`break-words font-bold text-sm flex flex-wrap items-center gap-1.5 ${isDone ? 'text-emerald-800 line-through opacity-60' : 'text-slate-800'}`}>
                        {chore.title}
                        {chore.isMandatory && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" /> Required
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>⭐ +{fmtPts(ptsPerDay)} pts/day</span>
                        <span>💵 ${earned.toFixed(2)} earned</span>
                      </p>
                      <div className="mt-1.5 flex gap-0.5">
                        {[...Array(7)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                              i < chore.completedDays.length
                                ? chore.isApproved ? 'bg-emerald-500' : 'bg-violet-400'
                                : 'bg-slate-100'
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
              <p className="text-xs font-semibold text-slate-400">
                📌 My picks today
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
                    {s.icon && renderIcon(s.icon)}
                    <div className="min-w-0 flex-1">
                      <p className={`break-words font-bold text-sm ${isDone ? 'text-amber-800' : 'text-slate-800'}`}>
                        {s.title}
                        {s.completions > 1 && (
                          <span className="ml-1.5 font-black text-amber-600">×{s.completions}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        ⭐ +{fmtPts(ptsPerDay)} pts · 💵 ${(s.baseValue / 5).toFixed(2)}/completion
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-700">
              <span className="text-lg">🎯</span> Available Missions
            </h3>
            {available.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500">
                {available.length}
              </span>
            )}
          </div>

          {available.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">
                All available missions are done for today!
              </p>
            </div>
          ) : (
            <>
              {/* Search + sort bar */}
              <div className="mb-3 flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-violet-400 transition-colors">
                <Search size={13} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={missionSearch}
                  onChange={e => setMissionSearch(e.target.value)}
                  placeholder="Search missions…"
                  className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                {missionSearch && (
                  <button type="button" onClick={() => setMissionSearch('')} className="shrink-0 text-slate-300 hover:text-slate-500">
                    <X size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMissionSort(s => s === 'pts' ? 'az' : 'pts')}
                  className={`${btnBase} shrink-0 rounded-xl border border-slate-200 bg-white px-2 py-1 text-[10px] font-black transition-colors hover:border-violet-300 hover:text-violet-600 ${
                    missionSort === 'pts' ? 'text-amber-600' : 'text-slate-500'
                  }`}
                >
                  {missionSort === 'pts' ? '⭐ Pts' : 'A–Z'}
                </button>
              </div>

              {/* Compact 2-column grid */}
              {filteredMissions.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No missions match &ldquo;{missionSearch}&rdquo;</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredMissions.map(t => {
                    const pts = chorePointsPerDay(t.baseValue);
                    const isPicking = pickingId === t.id;
                    const globalDone = globalCompletionsToday(t.id);
                    const globalMax = t.maxPerDay ?? 1;
                    const remaining = globalMax - globalDone;
                    return (
                      <div
                        key={t.id}
                        className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
                      >
                        {/* Icon + name */}
                        <div className="flex items-start gap-2">
                          {t.icon
                            ? renderIcon(t.icon)
                            : <span className="shrink-0 text-xl leading-none">📋</span>
                          }
                          <p className="flex-1 break-words text-xs font-bold leading-tight text-slate-800">{t.title}</p>
                        </div>
                        {/* Pts + repeat badge + Pick button */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black text-amber-600">⭐ +{fmtPts(pts)} pts</span>
                            {globalMax > 1 && (
                              <span className="text-[9px] font-bold text-violet-500">🔁 {remaining}/{globalMax} left</span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={isPicking}
                            onClick={() => handlePick(t.id)}
                            className={`${btnBase} ${btnPress} flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow disabled:pointer-events-none disabled:opacity-50`}
                          >
                            <Plus size={11} />
                            {isPicking ? '…' : 'Pick'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
