import { useState } from 'react';
import { Users, Plus, Trash2, ListChecks, UserPlus, AlertCircle, Check, X } from 'lucide-react';
import type { User, Chore, ChoreTemplate } from '../types';
import { API_URL, btnBase, btnPress, cardSurface } from '../lib/constants';

interface ManageTabProps {
  kids: User[];
  setKids: React.Dispatch<React.SetStateAction<User[]>>;
  chores: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  choreTemplates: ChoreTemplate[];
  setChoreTemplates: React.Dispatch<React.SetStateAction<ChoreTemplate[]>>;
  setActiveKidId: (id: string) => void;
}

export function ManageTab({
  kids,
  setKids,
  chores,
  setChores,
  choreTemplates,
  setChoreTemplates,
  setActiveKidId,
}: ManageTabProps) {
  const [newKidName, setNewKidName] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateValue, setNewTemplateValue] = useState('5.00');
  const [newTemplateIsMandatory, setNewTemplateIsMandatory] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
  const [selectedViewKidId, setSelectedViewKidId] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedKid = kids.find(k => k.id === selectedViewKidId) ?? null;
  const selectedKidChores = selectedViewKidId
    ? chores.filter(c => c.assignedTo === selectedViewKidId && !c.isArchived)
    : [];

  // ── Handlers ─────────────────────────────────────────────────────────────
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
      if (!selectedTemplateId) setSelectedTemplateId(t.id);
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
      if (selectedTemplateId === templateId) setSelectedTemplateId(null);
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

  const toggleKidSelect = (kidId: string) => {
    setSelectedKidIds(prev => {
      const n = new Set(prev);
      if (n.has(kidId)) n.delete(kidId); else n.add(kidId);
      return n;
    });
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || selectedKidIds.size === 0) return;
    const toAssign = Array.from(selectedKidIds).filter(
      kidId => !chores.some(c => c.templateId === selectedTemplateId && c.assignedTo === kidId && !c.isArchived),
    );
    if (toAssign.length === 0) return;
    try {
      const response = await fetch(`${API_URL}/api/chores/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId, kidIds: toAssign }),
      });
      if (!response.ok) throw new Error('Failed to assign chores');
      const assigned = await response.json();
      if (assigned.length > 0) setChores(prev => [...prev, ...assigned]);
      setSelectedKidIds(new Set());
    } catch (error) {
      console.error('handleAssign error', error);
    }
  };

  const handleUnassign = async () => {
    if (!selectedTemplateId || selectedKidIds.size === 0) return;
    const toUnassign = Array.from(selectedKidIds).filter(kidId =>
      chores.some(c => c.templateId === selectedTemplateId && c.assignedTo === kidId && !c.isArchived),
    );
    if (toUnassign.length === 0) return;
    try {
      const response = await fetch(`${API_URL}/api/chores/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId, kidIds: toUnassign }),
      });
      if (!response.ok) throw new Error('Failed to unassign chores');
      const result = await response.json();
      setChores(result.remaining || []);
      setSelectedKidIds(new Set());
    } catch (error) {
      console.error('handleUnassign error', error);
    }
  };

  // Unassign a single chore from the kid chores panel
  const handleUnassignSingle = async (templateId: string, kidId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/chores/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, kidIds: [kidId] }),
      });
      if (!response.ok) throw new Error('Failed to unassign chore');
      const result = await response.json();
      setChores(result.remaining || []);
    } catch (error) {
      console.error('handleUnassignSingle error', error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── 3-column grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Kids ── */}
        <section className={`${cardSurface} p-6 md:p-8`}>
          <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <Users size={22} />
            </span>
            Kids
          </h3>
          <form onSubmit={handleAddKid} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Name…"
              className="flex-1 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-violet-500/30 focus:ring-2"
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
          <div className="space-y-2">
            {kids.length === 0 && (
              <p className="py-6 text-center text-sm italic text-slate-400">No kids added yet.</p>
            )}
            {kids.map(kid => {
              const kidChoreCount = chores.filter(c => c.assignedTo === kid.id && !c.isArchived).length;
              const isViewing = selectedViewKidId === kid.id;
              return (
                <div
                  key={kid.id}
                  onClick={() => setSelectedViewKidId(isViewing ? null : kid.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                    isViewing
                      ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300/40'
                      : 'border-slate-200 bg-white hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-slate-800">{kid.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      isViewing ? 'bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {kidChoreCount} {kidChoreCount === 1 ? 'chore' : 'chores'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRemoveKid(kid.id); }}
                    className={`${btnBase} rounded-xl p-2 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
          {kids.length > 0 && (
            <p className="mt-4 text-xs text-slate-400 text-center">
              Click a child to view their assigned chores
            </p>
          )}
        </section>

        {/* ── Chore library ── */}
        <section className={`${cardSurface} p-6 md:p-8`}>
          <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <ListChecks size={22} />
            </span>
            Chore library
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            Add chores once here. They stay in the list so you can assign the same chore to several kids.
          </p>
          <form
            onSubmit={handleAddTemplate}
            className="mb-6 space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4"
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
          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {choreTemplates.length === 0 ? (
              <p className="py-8 text-center text-sm italic text-slate-400">No chores in the library yet.</p>
            ) : (
              choreTemplates.map(t => (
                <div
                  key={t.id}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition-all ${
                    selectedTemplateId === t.id
                      ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <div className="min-w-0 text-left">
                    <p className="truncate font-bold text-slate-900 flex items-center gap-1.5">
                      {t.isMandatory && <AlertCircle size={14} className="text-rose-500" />}
                      {t.title}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      ${t.baseValue.toFixed(2)} / week
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={ev => { ev.stopPropagation(); handleToggleMandatory(t.id); }}
                      className={`${btnBase} shrink-0 rounded-xl p-2 ${
                        t.isMandatory ? 'text-rose-500 hover:text-rose-600 bg-rose-50' : 'text-slate-300 hover:text-rose-500'
                      }`}
                      title="Toggle mandatory"
                    >
                      <AlertCircle size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={ev => { ev.stopPropagation(); handleRemoveTemplate(t.id); }}
                      className={`${btnBase} shrink-0 rounded-xl p-2 text-slate-300 hover:text-red-500`}
                      aria-label={`Remove ${t.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Assign to kids ── */}
        <section className={`${cardSurface} p-6 md:p-8`}>
          <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <UserPlus size={22} />
            </span>
            Assign to kids
          </h3>
          {kids.length === 0 ? (
            <p className="py-10 text-center italic text-slate-400">Add a child first.</p>
          ) : choreTemplates.length === 0 ? (
            <p className="py-10 text-center italic text-slate-400">Add at least one chore to the library.</p>
          ) : (
            <form onSubmit={handleAssign} className="space-y-5">
              <div>
                <label
                  htmlFor="assign-chore"
                  className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400"
                >
                  Assigned chore
                </label>
                <select
                  id="assign-chore"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                  value={selectedTemplateId ?? ''}
                  onChange={e => setSelectedTemplateId(e.target.value || null)}
                >
                  <option value="" disabled>Select chore to assign</option>
                  {choreTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} (${t.baseValue.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  Assign to
                </p>
                <div className="flex flex-wrap gap-2">
                  {kids.map(k => {
                    const on = selectedKidIds.has(k.id);
                    const alreadyAssigned = !!selectedTemplateId && chores.some(
                      c => c.templateId === selectedTemplateId && c.assignedTo === k.id && !c.isArchived,
                    );
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => toggleKidSelect(k.id)}
                        className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                          on
                            ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                            : alreadyAssigned
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200'
                        }`}
                        title={alreadyAssigned ? `${k.name} already has this chore` : undefined}
                      >
                        {alreadyAssigned && !on && <Check size={13} />}
                        {k.name}
                      </button>
                    );
                  })}
                </div>
                {selectedTemplateId && kids.some(k =>
                  chores.some(c => c.templateId === selectedTemplateId && c.assignedTo === k.id && !c.isArchived)
                ) && (
                  <p className="mt-2 text-xs text-emerald-600 font-bold">
                    ✓ Green = already assigned this week
                  </p>
                )}
              </div>
              <div className="grid gap-3">
                <button
                  type="submit"
                  disabled={!selectedTemplateId || selectedKidIds.size === 0}
                  className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-black uppercase tracking-wide text-white shadow-xl shadow-violet-500/30 disabled:pointer-events-none disabled:opacity-35`}
                >
                  Assign weekly chore
                </button>
                <button
                  type="button"
                  disabled={!selectedTemplateId || selectedKidIds.size === 0}
                  onClick={handleUnassign}
                  className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 py-4 font-black uppercase tracking-wide text-white shadow-xl shadow-rose-500/30 disabled:pointer-events-none disabled:opacity-35`}
                >
                  Unassign selected chore
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* ── Kid chores panel (shown when a kid is selected) ─────────────── */}
      {selectedKid && (
        <section className={`${cardSurface} p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black flex items-center gap-3 text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <ListChecks size={22} />
              </span>
              {selectedKid.name}&apos;s assigned chores
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
              No chores assigned to {selectedKid.name} yet. Use the Assign panel above to add some.
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
