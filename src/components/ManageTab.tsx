import { useState } from 'react';
import { Users, Plus, Trash2, ListChecks, UserPlus, AlertCircle, Check, X, CheckSquare, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import type { User, Chore, ChoreTemplate, RewardTemplate } from '../types';
import { API_URL, btnBase, btnPress, cardSurface } from '../lib/constants';

interface ManageTabProps {
  kids: User[];
  setKids: React.Dispatch<React.SetStateAction<User[]>>;
  chores: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  choreTemplates: ChoreTemplate[];
  setChoreTemplates: React.Dispatch<React.SetStateAction<ChoreTemplate[]>>;
  setActiveKidId: (id: string) => void;
  // Rewards catalog
  rewards: RewardTemplate[];
  onUpdateReward: (id: string, patch: Partial<RewardTemplate>) => Promise<void>;
  onAddReward: (title: string, pointCost: number, icon: string, description?: string) => Promise<void>;
  onDeleteReward: (id: string) => Promise<void>;
}

export function ManageTab({
  kids,
  setKids,
  chores,
  setChores,
  choreTemplates,
  setChoreTemplates,
  setActiveKidId,
  rewards,
  onUpdateReward,
  onAddReward,
  onDeleteReward,
}: ManageTabProps) {
  const [newKidName, setNewKidName] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateValue, setNewTemplateValue] = useState('5.00');
  const [newTemplateIsMandatory, setNewTemplateIsMandatory] = useState(false);

  // Multi-select for chore templates
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  // Multi-select for kids (assignment targets)
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
  // Kid whose chores are being viewed
  const [selectedViewKidId, setSelectedViewKidId] = useState<string | null>(null);

  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  // Rewards catalog state
  const [rewardCostEdits, setRewardCostEdits] = useState<Record<string, string>>({});
  const [rewardTitleEdits, setRewardTitleEdits] = useState<Record<string, string>>({});
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('50');
  const [newRewardIcon, setNewRewardIcon] = useState('🎁');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [rewardCatalogOpen, setRewardCatalogOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<string | null>(null); // reward id or 'new'

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedKid = kids.find(k => k.id === selectedViewKidId) ?? null;
  const selectedKidChores = selectedViewKidId
    ? chores.filter(c => c.assignedTo === selectedViewKidId && !c.isArchived)
    : [];

  const selectedTemplates = choreTemplates.filter(t => selectedTemplateIds.has(t.id));

  const canAssign = selectedTemplateIds.size > 0 && selectedKidIds.size > 0;

  // For a given kid, how many of the selected templates are already assigned
  const alreadyAssignedCount = (kidId: string) =>
    selectedTemplates.filter(t =>
      chores.some(c => c.templateId === t.id && c.assignedTo === kidId && !c.isArchived),
    ).length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const toggleKid = (id: string) =>
    setSelectedKidIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const selectAllTemplates = () =>
    setSelectedTemplateIds(new Set(choreTemplates.map(t => t.id)));

  const clearTemplates = () => setSelectedTemplateIds(new Set());

  const handleAddKid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKidName.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/kids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKidName.trim() }),
      });
      if (!response.ok) throw new Error('Failed to create kid');
      const newKid = await response.json();
      setKids(prev => {
        const next = [...prev, newKid];
        if (next.length === 1) setActiveKidId(newKid.id);
        return next;
      });
      setNewKidName('');
    } catch (error) {
      console.error('handleAddKid error', error);
    }
  };

  const handleRemoveKid = async (id: string) => {
    if (!window.confirm('Removing this child will also delete all their active chores. Continue?')) return;
    try {
      const response = await fetch(`${API_URL}/api/kids/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete kid');
      setKids(prev => prev.filter(k => k.id !== id));
      setChores(prev => prev.filter(c => c.assignedTo !== id));
      setSelectedKidIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (selectedViewKidId === id) setSelectedViewKidId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTemplateTitle.trim(),
          baseValue: parseFloat(newTemplateValue) || 0,
          isMandatory: newTemplateIsMandatory,
        }),
      });
      if (!response.ok) throw new Error('Failed to create template');
      const t = await response.json();
      setChoreTemplates(prev => [...prev, t]);
      setNewTemplateTitle('');
      setNewTemplateIsMandatory(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveTemplate = async (templateId: string) => {
    const activeLinked = chores.filter(c => c.templateId === templateId && !c.isArchived);
    if (activeLinked.length > 0) {
      const linkedKids = Array.from(
        new Set(activeLinked.map(c => kids.find(k => k.id === c.assignedTo)?.name || 'Unknown child')),
      ).join(', ');
      if (!window.confirm(`This chore is currently assigned to: ${linkedKids}. Force delete anyway?`)) return;
    } else if (!window.confirm('Remove this chore from the library?')) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/templates/${templateId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete template');
      setChoreTemplates(prev => prev.filter(t => t.id !== templateId));
      setSelectedTemplateIds(prev => { const n = new Set(prev); n.delete(templateId); return n; });
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleMandatory = async (templateId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/templates/${templateId}/toggle-mandatory`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to toggle mandatory flag');
      const data = await response.json();
      setChoreTemplates(data.templates);
      setChores(data.chores);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssign) return;
    setAssigning(true);
    try {
      const kidIdsArr = Array.from(selectedKidIds);
      let allAssigned: Chore[] = [];
      for (const templateId of selectedTemplateIds) {
        const toAssign = kidIdsArr.filter(
          kidId => !chores.some(c => c.templateId === templateId && c.assignedTo === kidId && !c.isArchived),
        );
        if (toAssign.length === 0) continue;
        const res = await fetch(`${API_URL}/api/chores/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, kidIds: toAssign }),
        });
        if (!res.ok) throw new Error('Failed to assign');
        const assigned = await res.json();
        allAssigned = [...allAssigned, ...assigned];
      }
      if (allAssigned.length > 0) setChores(prev => [...prev, ...allAssigned]);
      setSelectedTemplateIds(new Set());
      setSelectedKidIds(new Set());
    } catch (error) {
      console.error('handleAssign error', error);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!canAssign) return;
    setUnassigning(true);
    try {
      const kidIdsArr = Array.from(selectedKidIds);
      let remaining = chores;
      for (const templateId of selectedTemplateIds) {
        const toUnassign = kidIdsArr.filter(kidId =>
          remaining.some(c => c.templateId === templateId && c.assignedTo === kidId && !c.isArchived),
        );
        if (toUnassign.length === 0) continue;
        const res = await fetch(`${API_URL}/api/chores/unassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId, kidIds: toUnassign }),
        });
        if (!res.ok) throw new Error('Failed to unassign');
        const result = await res.json();
        remaining = result.remaining || [];
      }
      setChores(remaining);
      setSelectedTemplateIds(new Set());
      setSelectedKidIds(new Set());
    } catch (error) {
      console.error('handleUnassign error', error);
    } finally {
      setUnassigning(false);
    }
  };

  const handleUnassignSingle = async (templateId: string, kidId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chores/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, kidIds: [kidId] }),
      });
      if (!res.ok) throw new Error('Failed to unassign chore');
      const result = await res.json();
      setChores(result.remaining || []);
    } catch (error) {
      console.error('handleUnassignSingle error', error);
    }
  };

  const EMOJI_OPTIONS = [
    '🎮','📺','🌙','🍕','🎬','🛒','🍦','🎉','🏆','⭐',
    '🎁','🎯','🎲','🎸','🎨','🚀','🦄','🌈','🍰','🎪',
    '🏄','🤿','🎠','🎡','🎢','🎭','🎵','🎤','🎧','🎻',
    '🏀','⚽','🎾','🏊','🚴','🛹','🎿','🎳','🏓','🥋',
    '🍫','🍿','🥤','🍩','🧁','🍪','🍓','🍉','🍭','🥳',
    '🛋','📚','✈️','🚢','🏰','🌊','🏔','🌺','🦋','🐶',
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Top row: Library + Assignment workspace ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Chore library (multi-select) ── */}
        <section className={`${cardSurface} p-6 md:p-8 xl:col-span-2`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black flex items-center gap-3 text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <ListChecks size={22} />
              </span>
              Chore library
            </h3>
            <div className="flex items-center gap-2">
              {selectedTemplateIds.size > 0 && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">
                  {selectedTemplateIds.size} selected
                </span>
              )}
              {choreTemplates.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-500 hover:border-violet-200 hover:text-violet-600`}
                  >
                    Select all
                  </button>
                  {selectedTemplateIds.size > 0 && (
                    <button
                      type="button"
                      onClick={clearTemplates}
                      className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-400 hover:text-rose-500`}
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Chore cards grid */}
          {choreTemplates.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-slate-400">No chores in the library yet — add one below.</p>
          ) : (
            <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
              {choreTemplates.map(t => {
                const isSelected = selectedTemplateIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTemplate(t.id)}
                    className={`group flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all select-none ${
                      isSelected
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200/60'
                        : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      isSelected
                        ? 'border-violet-500 bg-violet-600'
                        : 'border-slate-300 group-hover:border-violet-300'
                    }`}>
                      {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                    </div>

                    {/* Chore info */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-bold flex items-center gap-1.5 ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>
                        {t.isMandatory && <AlertCircle size={13} className="shrink-0 text-rose-500" />}
                        {t.title}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        ${t.baseValue.toFixed(2)} / week
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleToggleMandatory(t.id)}
                        className={`${btnBase} shrink-0 rounded-xl p-2 ${
                          t.isMandatory ? 'text-rose-500 hover:text-rose-600 bg-rose-50' : 'text-slate-300 hover:text-rose-500'
                        }`}
                        title="Toggle mandatory"
                      >
                        <AlertCircle size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplate(t.id)}
                        className={`${btnBase} shrink-0 rounded-xl p-2 text-slate-300 hover:text-red-500`}
                        aria-label={`Remove ${t.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add chore form */}
          <details className="group">
            <summary className={`${btnBase} ${btnPress} flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-100`}>
              <Plus size={16} /> Add chore to library
            </summary>
            <form
              onSubmit={handleAddTemplate}
              className="mt-3 space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4"
            >
              <input
                type="text"
                placeholder="Chore name"
                className="w-full rounded-xl border border-white bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
                value={newTemplateTitle}
                onChange={e => setNewTemplateTitle(e.target.value)}
              />
              <label className="flex w-fit cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 cursor-pointer rounded accent-emerald-600"
                  checked={newTemplateIsMandatory}
                  onChange={e => setNewTemplateIsMandatory(e.target.checked)}
                />
                <span className="flex items-center gap-1.5 text-sm font-black text-slate-700">
                  <AlertCircle size={16} className="text-rose-500" /> Mandatory chore
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  className="w-full rounded-xl border border-white bg-white px-4 py-3 font-bold outline-none ring-emerald-500/30 focus:ring-2"
                  value={newTemplateValue}
                  onChange={e => setNewTemplateValue(e.target.value)}
                />
                <button
                  type="submit"
                  className={`${btnBase} ${btnPress} shrink-0 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white shadow-lg shadow-emerald-600/25`}
                >
                  Save
                </button>
              </div>
            </form>
          </details>
        </section>

        {/* ── Assignment workspace ── */}
        <section className={`${cardSurface} p-6 md:p-8 flex flex-col gap-5`}>
          <h3 className="text-lg font-black flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <UserPlus size={22} />
            </span>
            Assign
          </h3>

          {/* Selected chores summary */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Selected chores
            </p>
            {selectedTemplates.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                <CheckSquare size={16} className="text-slate-300" />
                <span>Check chores in the library</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTemplates.map(t => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-800"
                  >
                    {t.isMandatory && <AlertCircle size={11} className="text-rose-500" />}
                    {t.title}
                    <button
                      type="button"
                      onClick={() => toggleTemplate(t.id)}
                      className={`${btnBase} ml-0.5 rounded-full p-0.5 text-violet-500 hover:bg-violet-200 hover:text-violet-800`}
                      aria-label={`Deselect ${t.title}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Kid selection */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Apply to kids
            </p>
            {kids.length === 0 ? (
              <p className="text-sm italic text-slate-400">No kids added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {kids.map(k => {
                  const isOn = selectedKidIds.has(k.id);
                  const aCount = alreadyAssignedCount(k.id);
                  const allAssigned = selectedTemplates.length > 0 && aCount === selectedTemplates.length;
                  const someAssigned = aCount > 0 && aCount < selectedTemplates.length;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKid(k.id)}
                      className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                        isOn
                          ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                          : allAssigned
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : someAssigned
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
                      }`}
                    >
                      {!isOn && allAssigned && <Check size={13} />}
                      {k.name}
                      {!isOn && selectedTemplates.length > 0 && (
                        <span className={`text-[10px] font-black ${
                          isOn ? 'text-violet-200' : allAssigned ? 'text-emerald-500' : someAssigned ? 'text-amber-500' : 'text-slate-300'
                        }`}>
                          {aCount}/{selectedTemplates.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedKidIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedKidIds(new Set())}
                className={`${btnBase} mt-2 text-xs font-bold text-slate-400 hover:text-rose-500`}
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Legend */}
          {selectedTemplates.length > 0 && kids.length > 0 && (
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> All assigned</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Partial</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> None</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-auto grid gap-3">
            <button
              type="button"
              onClick={handleAssign as unknown as React.MouseEventHandler}
              disabled={!canAssign || assigning}
              className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-black uppercase tracking-wide text-white shadow-xl shadow-violet-500/30 disabled:pointer-events-none disabled:opacity-35`}
            >
              {assigning
                ? 'Assigning…'
                : canAssign
                ? `Assign ${selectedTemplateIds.size} chore${selectedTemplateIds.size !== 1 ? 's' : ''} → ${selectedKidIds.size} kid${selectedKidIds.size !== 1 ? 's' : ''}`
                : 'Select chores & kids'}
            </button>
            <button
              type="button"
              disabled={!canAssign || unassigning}
              onClick={handleUnassign}
              className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 py-3.5 font-black uppercase tracking-wide text-white shadow-xl shadow-rose-500/30 disabled:pointer-events-none disabled:opacity-35`}
            >
              {unassigning
                ? 'Removing…'
                : canAssign
                ? `Remove ${selectedTemplateIds.size} chore${selectedTemplateIds.size !== 1 ? 's' : ''} from ${selectedKidIds.size} kid${selectedKidIds.size !== 1 ? 's' : ''}`
                : 'Remove chores'}
            </button>
          </div>
        </section>
      </div>

      {/* ── Kids management ────────────────────────────────────────────────── */}
      <section className={`${cardSurface} p-6 md:p-8`}>
        <h3 className="text-lg font-black mb-5 flex items-center gap-3 text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
            <Users size={22} />
          </span>
          Kids
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Add kid form */}
          <form onSubmit={handleAddKid} className="flex gap-2">
            <input
              type="text"
              placeholder="Child's name…"
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-violet-500/30 focus:ring-2"
              value={newKidName}
              onChange={e => setNewKidName(e.target.value)}
            />
            <button
              type="submit"
              className={`${btnBase} ${btnPress} flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20`}
              aria-label="Add child"
            >
              <Plus size={22} />
            </button>
          </form>

          {/* Kids list */}
          {kids.length === 0 ? (
            <p className="self-center text-sm italic text-slate-400">No kids added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {kids.map(kid => {
                const kidChoreCount = chores.filter(c => c.assignedTo === kid.id && !c.isArchived).length;
                const isViewing = selectedViewKidId === kid.id;
                return (
                  <div
                    key={kid.id}
                    className={`group flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 transition-all ${
                      isViewing
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300/40'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    }`}
                    onClick={() => setSelectedViewKidId(isViewing ? null : kid.id)}
                  >
                    <span className="font-bold text-slate-800">{kid.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      isViewing ? 'bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {kidChoreCount}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleRemoveKid(kid.id); }}
                      className={`${btnBase} rounded-xl p-1 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
              <p className="self-center text-xs text-slate-400">Click a name to view their chores</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Kid chores viewer ──────────────────────────────────────────────── */}
      {/* ── Rewards Catalog ───────────────────────────────────────────────── */}
      <section className={`${cardSurface} p-6 md:p-8`}>
        <button
          type="button"
          onClick={() => setRewardCatalogOpen(v => !v)}
          className={`${btnBase} flex w-full items-center justify-between gap-3`}
        >
          <h3 className="text-lg font-black flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Gift size={22} />
            </span>
            Rewards Catalog
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-700">
              {rewards.length}
            </span>
          </h3>
          {rewardCatalogOpen
            ? <ChevronUp size={18} className="text-slate-400" />
            : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {rewardCatalogOpen && (
          <div className="mt-5 space-y-4">
            {rewards.length === 0 ? (
              <p className="py-4 text-center text-sm italic text-slate-400">No rewards yet — add one below.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rewards
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((r, idx) => {
                    const editVal = rewardCostEdits[r.id] ?? String(r.pointCost);
                    return (
                      <div
                        key={r.id}
                        className={`flex flex-col gap-3 rounded-2xl border-2 p-4 transition-all ${
                          r.isActive ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white opacity-60'
                        }`}
                      >
                        {/* ── Row 1: emoji picker + editable title + move/delete ── */}
                        <div className="flex items-start gap-2">
                          {/* Emoji picker button */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setEmojiPickerOpen(emojiPickerOpen === r.id ? null : r.id)}
                              className={`${btnBase} flex h-9 w-9 items-center justify-center rounded-xl text-2xl hover:bg-amber-100`}
                              title="Change icon"
                            >
                              {r.icon || '🎁'}
                            </button>
                            {emojiPickerOpen === r.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setEmojiPickerOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-amber-100 bg-white p-3 shadow-2xl">
                                  <div className="grid grid-cols-10 gap-0.5 mb-2">
                                    {EMOJI_OPTIONS.map(e => (
                                      <button
                                        key={e}
                                        type="button"
                                        onClick={() => { onUpdateReward(r.id, { icon: e }); setEmojiPickerOpen(null); }}
                                        className={`${btnBase} rounded-lg p-0.5 text-xl hover:bg-amber-50`}
                                      >{e}</button>
                                    ))}
                                  </div>
                                  <a
                                    href="https://www.magnific.com/icons/copy-paste"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
                                    onClick={() => setEmojiPickerOpen(null)}
                                  >
                                    🔍 Browse more icons at Magnific →
                                  </a>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Editable title */}
                          <input
                            type="text"
                            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 font-bold text-slate-900 outline-none ring-amber-400/50 hover:border-amber-200 hover:bg-white focus:border-amber-300 focus:bg-white focus:ring-2"
                            value={rewardTitleEdits[r.id] ?? r.title}
                            onChange={e => setRewardTitleEdits(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onBlur={() => {
                              const newTitle = (rewardTitleEdits[r.id] ?? r.title).trim();
                              if (newTitle && newTitle !== r.title) {
                                onUpdateReward(r.id, { title: newTitle });
                              }
                              setRewardTitleEdits(prev => { const n = { ...prev }; delete n[r.id]; return n; });
                            }}
                          />

                          {/* Move up/down + delete */}
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => onUpdateReward(r.id, { sortOrder: r.sortOrder - 1 })}
                              className={`${btnBase} rounded-lg p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-30`}
                              title="Move up"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === rewards.length - 1}
                              onClick={() => onUpdateReward(r.id, { sortOrder: r.sortOrder + 1 })}
                              className={`${btnBase} rounded-lg p-1.5 text-slate-300 hover:text-slate-600 disabled:opacity-30`}
                              title="Move down"
                            >
                              <ChevronDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remove "${r.title}" from the catalog?`)) onDeleteReward(r.id);
                              }}
                              className={`${btnBase} rounded-lg p-1.5 text-slate-300 hover:text-red-500`}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* ── Row 2: cost + active toggle ── */}
                        <div className="flex items-center gap-2">
                          {/* Point cost inline edit */}
                          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <span className="text-xs font-black text-amber-600">⭐</span>
                            <input
                              type="number"
                              min="1"
                              className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                              value={editVal}
                              onChange={e => setRewardCostEdits(prev => ({ ...prev, [r.id]: e.target.value }))}
                              onBlur={() => {
                                const cost = parseInt(editVal);
                                if (cost > 0 && cost !== r.pointCost) {
                                  onUpdateReward(r.id, { pointCost: cost });
                                }
                                setRewardCostEdits(prev => { const n = { ...prev }; delete n[r.id]; return n; });
                              }}
                            />
                            <span className="text-xs text-slate-400">pts</span>
                          </div>
                          {/* Active toggle — fixed centering */}
                          <button
                            type="button"
                            onClick={() => onUpdateReward(r.id, { isActive: !r.isActive })}
                            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${r.isActive ? 'bg-amber-500' : 'bg-slate-300'}`}
                            title={r.isActive ? 'Disable reward' : 'Enable reward'}
                          >
                            <span
                              className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${r.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Add custom reward */}
            <details className="group">
              <summary className={`${btnBase} ${btnPress} flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black uppercase tracking-wide text-amber-700 hover:bg-amber-100`}>
                <Plus size={16} /> Add Custom Reward
              </summary>
              <div className="mt-3 space-y-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white p-4">
                <div className="flex gap-2">
                  {/* Emoji picker for new reward */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen(emojiPickerOpen === 'new' ? null : 'new')}
                      className={`${btnBase} flex h-12 w-14 items-center justify-center rounded-xl border border-white bg-white text-2xl hover:border-amber-300`}
                      title="Pick icon"
                    >
                      {newRewardIcon}
                    </button>
                    {emojiPickerOpen === 'new' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEmojiPickerOpen(null)} />
                        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-amber-100 bg-white p-3 shadow-2xl">
                          <div className="grid grid-cols-10 gap-0.5 mb-2">
                            {EMOJI_OPTIONS.map(e => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => { setNewRewardIcon(e); setEmojiPickerOpen(null); }}
                                className={`${btnBase} rounded-lg p-0.5 text-xl hover:bg-amber-50`}
                              >{e}</button>
                            ))}
                          </div>
                          <a
                            href="https://www.magnific.com/icons/copy-paste"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
                            onClick={() => setEmojiPickerOpen(null)}
                          >
                            🔍 Browse more icons at Magnific →
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Reward name"
                    className="flex-1 rounded-xl border border-white bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-amber-500/30 focus:ring-2"
                    value={newRewardTitle}
                    onChange={e => setNewRewardTitle(e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  className="w-full rounded-xl border border-white bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-amber-500/30 focus:ring-2"
                  value={newRewardDesc}
                  onChange={e => setNewRewardDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-white bg-white px-4 py-3">
                    <span className="text-sm font-black text-amber-600">⭐</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Points"
                      className="w-full bg-transparent font-bold text-slate-800 outline-none"
                      value={newRewardCost}
                      onChange={e => setNewRewardCost(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!newRewardTitle.trim() || !parseInt(newRewardCost)}
                    onClick={async () => {
                      if (!newRewardTitle.trim() || !parseInt(newRewardCost)) return;
                      await onAddReward(
                        newRewardTitle.trim(),
                        parseInt(newRewardCost),
                        newRewardIcon || '🎁',
                        newRewardDesc.trim() || undefined,
                      );
                      setNewRewardTitle('');
                      setNewRewardCost('50');
                      setNewRewardIcon('🎁');
                      setNewRewardDesc('');
                    }}
                    className={`${btnBase} ${btnPress} shrink-0 rounded-xl bg-amber-500 px-5 py-3 font-black text-white shadow-lg shadow-amber-500/25 disabled:pointer-events-none disabled:opacity-40`}
                  >
                    Save
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}
      </section>

      {selectedKid && (
        <section className={`${cardSurface} p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black flex items-center gap-3 text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <ListChecks size={22} />
              </span>
              {selectedKid.name}&apos;s chores
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-500">
                {selectedKidChores.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setSelectedViewKidId(null)}
              className={`${btnBase} ${btnPress} flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {selectedKidChores.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-slate-400">
              No chores assigned to {selectedKid.name} yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedKidChores.map(chore => (
                <div
                  key={chore.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-100"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-bold text-slate-900">
                      {chore.isMandatory && <AlertCircle size={13} className="shrink-0 text-rose-500" />}
                      {chore.title}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      ${chore.baseValue.toFixed(2)} / week
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (chore.templateId) handleUnassignSingle(chore.templateId, selectedKid.id);
                    }}
                    disabled={!chore.templateId}
                    className={`${btnBase} ${btnPress} shrink-0 rounded-xl border border-slate-200 p-2 text-slate-300 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:pointer-events-none disabled:opacity-30`}
                    title={`Remove ${chore.title} from ${selectedKid.name}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
