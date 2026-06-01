import { useState, useRef } from 'react';
import { Users, Plus, Trash2, ListChecks, UserPlus, AlertCircle, Check, X, CheckSquare, Gift, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
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
  const [newTemplateMaxPerDay, setNewTemplateMaxPerDay] = useState('1');
  const [newTemplateIsInPool, setNewTemplateIsInPool] = useState(true);
  const [newChoreIcon, setNewChoreIcon] = useState('');

  // Inline editing of existing templates
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editMaxPerDay, setEditMaxPerDay] = useState('1');
  const [editIsInPool, setEditIsInPool] = useState(true);
  const [editChoreIcon, setEditChoreIcon] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [choreIconPickerOpen, setChoreIconPickerOpen] = useState<string | null>(null); // 'new' or template id

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
  const [urlIconInput, setUrlIconInput] = useState('');
  const [urlIconError, setUrlIconError] = useState('');

  // Custom icon URLs saved by user (persisted in localStorage)
  const [customIcons, setCustomIcons] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('customRewardIcons') || '[]'); } catch { return []; }
  });
  const saveCustomIcon = (url: string) => {
    setCustomIcons(prev => {
      const next = [url, ...prev.filter(u => u !== url)].slice(0, 20);
      localStorage.setItem('customRewardIcons', JSON.stringify(next));
      return next;
    });
  };
  const removeCustomIcon = (url: string) => {
    setCustomIcons(prev => {
      const next = prev.filter(u => u !== url);
      localStorage.setItem('customRewardIcons', JSON.stringify(next));
      return next;
    });
  };

  // Shared file input ref — one element, works for whichever picker is open
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Resize to 64×64 so the data URL stays small enough for localStorage
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/png');
        saveCustomIcon(dataUrl);
        const target = emojiPickerOpen; // capture before closing
        if (target === 'new') {
          setNewRewardIcon(dataUrl);
        } else if (target) {
          onUpdateReward(target, { icon: dataUrl });
        }
        setEmojiPickerOpen(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file next time
  };

  // Separate file input for chore icons
  const choreFileInputRef = useRef<HTMLInputElement>(null);

  const handleChoreIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/png');
        saveCustomIcon(dataUrl);
        const target = choreIconPickerOpen;
        if (target === 'new') {
          setNewChoreIcon(dataUrl);
        } else if (target) {
          setEditChoreIcon(dataUrl);
        }
        setChoreIconPickerOpen(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper: render either a URL / data-URL image or an emoji string
  const isIconUrl = (s: string) =>
    s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('data:');
  const renderIcon = (icon: string, className = 'text-2xl') =>
    isIconUrl(icon)
      ? <img src={icon} className="h-6 w-6 object-contain" alt="icon" />
      : <span className={className}>{icon}</span>;

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
          maxPerDay: Math.min(10, Math.max(1, parseInt(newTemplateMaxPerDay) || 1)),
          isInPool: newTemplateIsInPool,
          icon: newChoreIcon || undefined,
        }),
      });
      if (!response.ok) throw new Error('Failed to create template');
      const t = await response.json();
      setChoreTemplates(prev => [...prev, t]);
      setNewTemplateTitle('');
      setNewTemplateIsMandatory(false);
      setNewTemplateMaxPerDay('1');
      setNewTemplateIsInPool(true);
      setNewChoreIcon('');
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

  const startEditTemplate = (t: ChoreTemplate) => {
    setEditingTemplateId(t.id);
    setEditTitle(t.title);
    setEditValue(t.baseValue.toFixed(2));
    setEditMaxPerDay(String(t.maxPerDay ?? 1));
    setEditIsInPool(t.isInPool !== false);
    setEditChoreIcon(t.icon || '');
  };

  const cancelEditTemplate = () => {
    setEditingTemplateId(null);
  };

  const handleSaveTemplate = async (templateId: string) => {
    setEditSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          baseValue: parseFloat(editValue) || 0,
          maxPerDay: Math.min(10, Math.max(1, parseInt(editMaxPerDay) || 1)),
          isInPool: editIsInPool,
          icon: editChoreIcon || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      const updated: ChoreTemplate = await res.json();
      setChoreTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
      setEditingTemplateId(null);
    } catch (error) {
      console.error('handleSaveTemplate error', error);
    } finally {
      setEditSaving(false);
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
      {/* Hidden file input for reward icon pickers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIconFileUpload}
      />
      {/* Hidden file input for chore icon pickers */}
      <input
        ref={choreFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChoreIconFileUpload}
      />

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
                const isEditing = editingTemplateId === t.id;

                if (isEditing) {
                  return (
                    <div
                      key={t.id}
                      className="col-span-full rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4 sm:col-span-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="mb-3 text-xs font-black uppercase tracking-wider text-indigo-600">
                        ✏️ Editing: {t.title}
                      </p>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {/* Chore icon picker — edit */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => { setUrlIconInput(''); setUrlIconError(''); setChoreIconPickerOpen(choreIconPickerOpen === t.id ? null : t.id); }}
                              className={`${btnBase} flex h-10 w-12 items-center justify-center rounded-xl border border-white bg-white hover:border-indigo-300`}
                              title="Pick icon"
                            >
                              {renderIcon(editChoreIcon || '📋', 'text-2xl')}
                            </button>
                            {choreIconPickerOpen === t.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setChoreIconPickerOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-indigo-100 bg-white p-3 shadow-2xl">
                                  {customIcons.length > 0 && (
                                    <div className="mb-2">
                                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Imported icons</p>
                                      <div className="flex flex-wrap gap-1">
                                        {customIcons.map(url => (
                                          <div key={url} className="group relative">
                                            <button
                                              type="button"
                                              onClick={() => { setEditChoreIcon(url); setChoreIconPickerOpen(null); }}
                                              className={`${btnBase} flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50`}
                                              title={url}
                                            >
                                              <img src={url} className="h-6 w-6 object-contain" alt="icon" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={ev => { ev.stopPropagation(); removeCustomIcon(url); }}
                                              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                                              title="Remove"
                                            >×</button>
                                          </div>
                                        ))}
                                      </div>
                                      <hr className="my-2 border-slate-100" />
                                    </div>
                                  )}
                                  <div className="grid grid-cols-10 gap-0.5 mb-2">
                                    {EMOJI_OPTIONS.map(em => (
                                      <button
                                        key={em}
                                        type="button"
                                        onClick={() => { setEditChoreIcon(em); setChoreIconPickerOpen(null); }}
                                        className={`${btnBase} rounded-lg p-0.5 text-xl hover:bg-indigo-50`}
                                      >{em}</button>
                                    ))}
                                  </div>
                                  <div className="border-t border-slate-100 pt-2">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Import icon from URL</p>
                                    <div className="flex gap-1">
                                      <input
                                        type="url"
                                        placeholder="https://..."
                                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none ring-indigo-400/30 focus:border-indigo-300 focus:ring-2"
                                        value={urlIconInput}
                                        onChange={ev => { setUrlIconInput(ev.target.value); setUrlIconError(''); }}
                                        onClick={ev => ev.stopPropagation()}
                                      />
                                      <button
                                        type="button"
                                        onClick={ev => {
                                          ev.stopPropagation();
                                          const url = urlIconInput.trim();
                                          if (!url.startsWith('http')) { setUrlIconError('Must start with http'); return; }
                                          saveCustomIcon(url);
                                          setEditChoreIcon(url);
                                          setUrlIconInput('');
                                          setChoreIconPickerOpen(null);
                                        }}
                                        className={`${btnBase} ${btnPress} shrink-0 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-black text-white`}
                                      >Use</button>
                                    </div>
                                    {urlIconError && <p className="mt-1 text-[10px] text-red-500">{urlIconError}</p>}
                                  </div>
                                  <div className="border-t border-slate-100 pt-2">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Or upload an image file</p>
                                    <button
                                      type="button"
                                      onClick={ev => { ev.stopPropagation(); choreFileInputRef.current?.click(); }}
                                      className={`${btnBase} ${btnPress} flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`}
                                    >
                                      📁 Upload PNG / image file
                                    </button>
                                  </div>
                                  <a
                                    href="https://www.magnific.com/icons/copy-paste"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                    onClick={() => setChoreIconPickerOpen(null)}
                                  >
                                    🔍 Browse more icons at Magnific →
                                  </a>
                                </div>
                              </>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Chore name"
                            className="flex-1 rounded-xl border border-white bg-white px-4 py-2.5 font-bold text-slate-800 outline-none ring-indigo-400/30 focus:ring-2"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-black uppercase tracking-wide text-slate-500">$ Value</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="w-24 rounded-xl border border-white bg-white px-3 py-2 font-bold outline-none ring-indigo-400/30 focus:ring-2"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Max/day</label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              className="w-20 rounded-xl border border-white bg-white px-3 py-2 font-bold outline-none ring-indigo-400/30 focus:ring-2"
                              value={editMaxPerDay}
                              onChange={e => setEditMaxPerDay(e.target.value)}
                            />
                            <span className="text-xs text-slate-400">
                              {(parseInt(editMaxPerDay) || 1) <= 1 ? 'once/day' : `×${parseInt(editMaxPerDay)}/day`}
                            </span>
                          </div>
                        </div>
                        <label className="flex w-fit cursor-pointer select-none items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer rounded accent-teal-600"
                            checked={editIsInPool}
                            onChange={e => setEditIsInPool(e.target.checked)}
                          />
                          <span className="text-sm font-black text-slate-700">🏊 Show in optional pool</span>
                        </label>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={editSaving || !editTitle.trim()}
                            onClick={() => handleSaveTemplate(t.id)}
                            className={`${btnBase} ${btnPress} rounded-xl bg-indigo-600 px-5 py-2 text-sm font-black text-white shadow-md shadow-indigo-500/25 disabled:pointer-events-none disabled:opacity-50`}
                          >
                            {editSaving ? 'Saving…' : '✓ Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditTemplate}
                            className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-500 hover:text-slate-700`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

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

                    {/* Chore icon */}
                    {t.icon && (
                      <div className="shrink-0">
                        {renderIcon(t.icon, 'text-lg leading-none')}
                      </div>
                    )}

                    {/* Chore info */}
                    <div className="min-w-0 flex-1">
                      <p className={`break-words font-bold flex flex-wrap items-center gap-1.5 ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>
                        {t.isMandatory && <AlertCircle size={13} className="shrink-0 text-rose-500" />}
                        {t.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          ${t.baseValue.toFixed(2)} / week
                        </p>
                        {(t.maxPerDay ?? 1) > 1 && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-black text-violet-600">
                            🔁 ×{t.maxPerDay}/day
                          </span>
                        )}
                        {t.isInPool === false ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                            🔒 Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-black text-teal-600">
                            🏊 Pool
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => startEditTemplate(t)}
                        className={`${btnBase} shrink-0 rounded-xl p-2 text-slate-300 hover:text-indigo-500`}
                        title="Edit chore"
                      >
                        <Pencil size={14} />
                      </button>
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
              <div className="flex gap-2">
                {/* Chore icon picker — new */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => { setUrlIconInput(''); setUrlIconError(''); setChoreIconPickerOpen(choreIconPickerOpen === 'new' ? null : 'new'); }}
                    className={`${btnBase} flex h-12 w-14 items-center justify-center rounded-xl border border-white bg-white hover:border-emerald-300`}
                    title="Pick icon"
                  >
                    {renderIcon(newChoreIcon || '📋', 'text-2xl')}
                  </button>
                  {choreIconPickerOpen === 'new' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setChoreIconPickerOpen(null)} />
                      <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xl">
                        {customIcons.length > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Imported icons</p>
                            <div className="flex flex-wrap gap-1">
                              {customIcons.map(url => (
                                <div key={url} className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => { setNewChoreIcon(url); setChoreIconPickerOpen(null); }}
                                    className={`${btnBase} flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50`}
                                    title={url}
                                  >
                                    <img src={url} className="h-6 w-6 object-contain" alt="icon" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={ev => { ev.stopPropagation(); removeCustomIcon(url); }}
                                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                                    title="Remove"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                            <hr className="my-2 border-slate-100" />
                          </div>
                        )}
                        <div className="grid grid-cols-10 gap-0.5 mb-2">
                          {EMOJI_OPTIONS.map(em => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => { setNewChoreIcon(em); setChoreIconPickerOpen(null); }}
                              className={`${btnBase} rounded-lg p-0.5 text-xl hover:bg-emerald-50`}
                            >{em}</button>
                          ))}
                        </div>
                        <div className="border-t border-slate-100 pt-2">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Import icon from URL</p>
                          <div className="flex gap-1">
                            <input
                              type="url"
                              placeholder="https://..."
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none ring-emerald-400/30 focus:border-emerald-300 focus:ring-2"
                              value={urlIconInput}
                              onChange={ev => { setUrlIconInput(ev.target.value); setUrlIconError(''); }}
                              onClick={ev => ev.stopPropagation()}
                            />
                            <button
                              type="button"
                              onClick={ev => {
                                ev.stopPropagation();
                                const url = urlIconInput.trim();
                                if (!url.startsWith('http')) { setUrlIconError('Must start with http'); return; }
                                saveCustomIcon(url);
                                setNewChoreIcon(url);
                                setUrlIconInput('');
                                setChoreIconPickerOpen(null);
                              }}
                              className={`${btnBase} ${btnPress} shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black text-white`}
                            >Use</button>
                          </div>
                          {urlIconError && <p className="mt-1 text-[10px] text-red-500">{urlIconError}</p>}
                        </div>
                        <div className="border-t border-slate-100 pt-2">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Or upload an image file</p>
                          <button
                            type="button"
                            onClick={ev => { ev.stopPropagation(); choreFileInputRef.current?.click(); }}
                            className={`${btnBase} ${btnPress} flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700`}
                          >
                            📁 Upload PNG / image file
                          </button>
                        </div>
                        <a
                          href="https://www.magnific.com/icons/copy-paste"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          onClick={() => setChoreIconPickerOpen(null)}
                        >
                          🔍 Browse more icons at Magnific →
                        </a>
                      </div>
                    </>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Chore name"
                  className="flex-1 rounded-xl border border-white bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
                  value={newTemplateTitle}
                  onChange={e => setNewTemplateTitle(e.target.value)}
                />
              </div>
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
              <label className="flex w-fit cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 cursor-pointer rounded accent-teal-600"
                  checked={newTemplateIsInPool}
                  onChange={e => setNewTemplateIsInPool(e.target.checked)}
                />
                <span className="text-sm font-black text-slate-700">🏊 Show in optional pool</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Max per day</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-20 rounded-xl border border-white bg-white px-3 py-2 font-bold outline-none ring-emerald-500/30 focus:ring-2"
                  value={newTemplateMaxPerDay}
                  onChange={e => setNewTemplateMaxPerDay(e.target.value)}
                />
                <span className="text-xs text-slate-400">
                  {(parseInt(newTemplateMaxPerDay) || 1) <= 1 ? 'once/day' : `up to ×${parseInt(newTemplateMaxPerDay)}/day`}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  placeholder="Base value ($)"
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Apply to kids
              </p>
              {selectedKidIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedKidIds(new Set())}
                  className={`${btnBase} text-[11px] font-bold text-slate-400 hover:text-rose-500`}
                >
                  Deselect all
                </button>
              )}
            </div>
            {kids.length === 0 ? (
              <p className="text-sm italic text-slate-400">No kids added yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
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
                      className={`${btnBase} ${btnPress} flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                        isOn
                          ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200/60'
                          : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'
                      }`}
                    >
                      {/* Checkbox indicator — matches chore library style */}
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        isOn
                          ? 'border-violet-500 bg-violet-600'
                          : 'border-slate-300'
                      }`}>
                        {isOn && <Check size={12} strokeWidth={3} className="text-white" />}
                      </div>

                      {/* Name + status */}
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold ${isOn ? 'text-violet-900' : 'text-slate-800'}`}>
                          {k.name}
                        </p>
                        {selectedTemplates.length > 0 && (
                          <p className={`text-[11px] font-bold ${
                            allAssigned ? 'text-emerald-600' : someAssigned ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {allAssigned
                              ? '✓ All selected chores already assigned'
                              : someAssigned
                              ? `${aCount} of ${selectedTemplates.length} chores already assigned`
                              : 'None of the selected chores assigned yet'}
                          </p>
                        )}
                      </div>

                      {/* Selected / not selected pill */}
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                        isOn
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {isOn ? 'Selected' : 'Select'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
                    <p className="flex flex-wrap items-center gap-1.5 break-words font-bold text-slate-900">
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
                              onClick={() => { setUrlIconInput(''); setUrlIconError(''); setEmojiPickerOpen(emojiPickerOpen === r.id ? null : r.id); }}
                              className={`${btnBase} flex h-9 w-9 items-center justify-center rounded-xl hover:bg-amber-100`}
                              title="Change icon"
                            >
                              {renderIcon(r.icon || '🎁')}
                            </button>
                            {emojiPickerOpen === r.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setEmojiPickerOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-amber-100 bg-white p-3 shadow-2xl">
                                  {/* Custom URL icons row */}
                                  {customIcons.length > 0 && (
                                    <div className="mb-2">
                                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Imported icons</p>
                                      <div className="flex flex-wrap gap-1">
                                        {customIcons.map(url => (
                                          <div key={url} className="group relative">
                                            <button
                                              type="button"
                                              onClick={() => { onUpdateReward(r.id, { icon: url }); setEmojiPickerOpen(null); }}
                                              className={`${btnBase} flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50`}
                                              title={url}
                                            >
                                              <img src={url} className="h-6 w-6 object-contain" alt="icon" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={e => { e.stopPropagation(); removeCustomIcon(url); }}
                                              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                                              title="Remove"
                                            >×</button>
                                          </div>
                                        ))}
                                      </div>
                                      <hr className="my-2 border-slate-100" />
                                    </div>
                                  )}
                                  {/* Emoji grid */}
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
                                  {/* URL import section */}
                                  <div className="border-t border-slate-100 pt-2">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Import icon from URL</p>
                                    <div className="flex gap-1">
                                      <input
                                        type="url"
                                        placeholder="https://..."
                                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none ring-amber-400/30 focus:border-amber-300 focus:ring-2"
                                        value={urlIconInput}
                                        onChange={e => { setUrlIconInput(e.target.value); setUrlIconError(''); }}
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          const url = urlIconInput.trim();
                                          if (!url.startsWith('http')) { setUrlIconError('Must start with http'); return; }
                                          saveCustomIcon(url);
                                          onUpdateReward(r.id, { icon: url });
                                          setUrlIconInput('');
                                          setEmojiPickerOpen(null);
                                        }}
                                        className={`${btnBase} ${btnPress} shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-black text-white`}
                                      >Use</button>
                                    </div>
                                    {urlIconError && <p className="mt-1 text-[10px] text-red-500">{urlIconError}</p>}
                                  </div>
                                  {/* Upload from file */}
                                  <div className="border-t border-slate-100 pt-2">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Or upload an image file</p>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                      className={`${btnBase} ${btnPress} flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700`}
                                    >
                                      📁 Upload PNG / image file
                                    </button>
                                  </div>
                                  {/* Magnific link */}
                                  <a
                                    href="https://www.magnific.com/icons/copy-paste"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
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
                      onClick={() => { setUrlIconInput(''); setUrlIconError(''); setEmojiPickerOpen(emojiPickerOpen === 'new' ? null : 'new'); }}
                      className={`${btnBase} flex h-12 w-14 items-center justify-center rounded-xl border border-white bg-white hover:border-amber-300`}
                      title="Pick icon"
                    >
                      {renderIcon(newRewardIcon, 'text-2xl')}
                    </button>
                    {emojiPickerOpen === 'new' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEmojiPickerOpen(null)} />
                        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-amber-100 bg-white p-3 shadow-2xl">
                          {/* Custom URL icons row */}
                          {customIcons.length > 0 && (
                            <div className="mb-2">
                              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Imported icons</p>
                              <div className="flex flex-wrap gap-1">
                                {customIcons.map(url => (
                                  <div key={url} className="group relative">
                                    <button
                                      type="button"
                                      onClick={() => { setNewRewardIcon(url); setEmojiPickerOpen(null); }}
                                      className={`${btnBase} flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50`}
                                      title={url}
                                    >
                                      <img src={url} className="h-6 w-6 object-contain" alt="icon" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); removeCustomIcon(url); }}
                                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                                      title="Remove"
                                    >×</button>
                                  </div>
                                ))}
                              </div>
                              <hr className="my-2 border-slate-100" />
                            </div>
                          )}
                          {/* Emoji grid */}
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
                          {/* URL import section */}
                          <div className="border-t border-slate-100 pt-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Import icon from URL</p>
                            <div className="flex gap-1">
                              <input
                                type="url"
                                placeholder="https://..."
                                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none ring-amber-400/30 focus:border-amber-300 focus:ring-2"
                                value={urlIconInput}
                                onChange={e => { setUrlIconInput(e.target.value); setUrlIconError(''); }}
                                onClick={e => e.stopPropagation()}
                              />
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  const url = urlIconInput.trim();
                                  if (!url.startsWith('http')) { setUrlIconError('Must start with http'); return; }
                                  saveCustomIcon(url);
                                  setNewRewardIcon(url);
                                  setUrlIconInput('');
                                  setEmojiPickerOpen(null);
                                }}
                                className={`${btnBase} ${btnPress} shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-black text-white`}
                              >Use</button>
                            </div>
                            {urlIconError && <p className="mt-1 text-[10px] text-red-500">{urlIconError}</p>}
                          </div>
                          {/* Upload from file */}
                          <div className="border-t border-slate-100 pt-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Or upload an image file</p>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                              className={`${btnBase} ${btnPress} flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700`}
                            >
                              📁 Upload PNG / image file
                            </button>
                          </div>
                          {/* Magnific link */}
                          <a
                            href="https://www.magnific.com/icons/copy-paste"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
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

    </div>
  );
}
