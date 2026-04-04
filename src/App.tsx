import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, Circle, Trophy, Star,
  Users, Plus, Trash2, ShieldCheck, AlertCircle, DollarSign,
  RotateCcw, ListChecks, UserPlus, Home, LogIn, LogOut
} from 'lucide-react';

export type UserRole = 'parent' | 'child';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface User { id: string; name: string; role: UserRole; }

export interface ChoreTemplate {
  id: string;
  title: string;
  baseValue: number;
}

export interface Chore {
  id: string;
  title: string;
  baseValue: number;
  templateId?: string;
  assignedTo: string;
  completedDays: DayOfWeek[];
  isApproved: boolean;
  isArchived: boolean;
}

export interface PayoutRecord {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  timestamp: number;
  choresPaid: string[];
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PARENT_SESSION_KEY = 'chore_parent_auth_v1';

function readParentSession(): boolean {
  try {
    return sessionStorage.getItem(PARENT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeParentSession(authed: boolean) {
  try {
    if (authed) sessionStorage.setItem(PARENT_SESSION_KEY, '1');
    else sessionStorage.removeItem(PARENT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Payout for one chore from days completed (of 7): 4→80%, 5–6→100%, 7→100% + $1; under 4 → $0. */
function getChoreEarnedAmount(daysCompleted: number, baseValue: number): number {
  const n = Math.min(7, Math.max(0, daysCompleted));
  if (n < 4) return 0;
  if (n === 4) return Math.round(baseValue * 0.8 * 100) / 100;
  if (n <= 6) return Math.round(baseValue * 100) / 100;
  return Math.round((baseValue + 1) * 100) / 100;
}

const IMG_HOME =
  '/kids.jpg';
/** Add your photo as `public/kids.jpg` (export/download from your album; goo.gl links are not image URLs). */
const IMG_KIDS = '/parents.jpg';
const btnBase =
  'transition-all duration-200 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2';
const btnPress =
  'active:scale-[0.97] active:brightness-[0.97] active:shadow-inner hover:brightness-[1.02]';
const cardSurface =
  'rounded-[1.75rem] border border-white/60 bg-white/80 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm';

function ParentLoginForm({ onSuccess }: { onSuccess: (hasChanged: boolean) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/parent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (result.success) {
        writeParentSession(true);
        onSuccess(result.hasChanged);
      } else {
        setError('Invalid username or password.');
      }
    } catch {
      setError('Login failed.');
    }
  };

  return (
    <div className={`${cardSurface} mx-auto max-w-md p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <LogIn size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">Parent sign-in</h2>
          <p className="text-sm text-slate-500">Authorized adults only</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="parent-user" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
            Username
          </label>
          <input
            id="parent-user"
            autoComplete="username"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="parent-pass" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
            Password
          </label>
          <input
            id="parent-pass"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
        <button
          type="submit"
          className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-black uppercase tracking-wide text-white shadow-xl shadow-violet-500/30`}
        >
          Sign in
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-400">
        Default credentials: username <code className="rounded bg-slate-100 px-1">{import.meta.env.VITE_PARENT_USERNAME || 'parent'}</code>, password <code className="rounded bg-slate-100 px-1">{import.meta.env.VITE_PARENT_PASSWORD || 'changeme'}</code>
      </p>
    </div>
  );
}

function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newUsername.trim() || !newPassword.trim()) {
      setError('Username and password are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/parent/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
      });
      const result = await response.json();
      if (result.success) {
        onSuccess();
      } else {
        setError('Failed to update credentials.');
      }
    } catch {
      setError('Update failed.');
    }
  };

  return (
    <div className={`${cardSurface} mx-auto max-w-md p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">Set New Credentials</h2>
          <p className="text-sm text-slate-500">Change your parent login details</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-parent-user" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
            New Username
          </label>
          <input
            id="new-parent-user"
            autoComplete="username"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-parent-pass" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
            New Password
          </label>
          <input
            id="new-parent-pass"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-parent-pass" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
            Confirm Password
          </label>
          <input
            id="confirm-parent-pass"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
        <button
          type="submit"
          className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 font-black uppercase tracking-wide text-white shadow-xl shadow-violet-500/30`}
        >
          Save New Credentials
        </button>
      </form>
    </div>
  );
}

function ChoreProgressRows({
  choreList,
  setChores,
  showParentApprove,
}: {
  choreList: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  showParentApprove: boolean;
}) {
  const handleApprove = async (choreId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/chores/${choreId}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to toggle approval');
      const updated = await response.json();
      setChores(prev => prev.map(c => (c.id === choreId ? updated : c)));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {choreList.map(chore => (
        <div key={chore.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800">{chore.title}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {chore.completedDays.length}/7 days
                {chore.completedDays.length >= 4 && chore.completedDays.length < 5 && (
                  <span className="ml-1 normal-case text-violet-600">· 80%</span>
                )}
                {chore.completedDays.length >= 5 && chore.completedDays.length < 7 && (
                  <span className="ml-1 normal-case text-emerald-600">· 100%</span>
                )}
                {chore.completedDays.length >= 7 && (
                  <span className="ml-1 normal-case text-emerald-600">· 100% + $1</span>
                )}
              </p>
              {!showParentApprove && chore.completedDays.length >= 4 && (
                <p className="mt-1 text-[10px] font-bold normal-case text-slate-500">
                  {chore.isApproved
                    ? 'Parent approved'
                    : 'Waiting for parent approval'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-slate-900">
                $
                {getChoreEarnedAmount(chore.completedDays.length, chore.baseValue).toFixed(2)}
              </span>
              {showParentApprove && chore.completedDays.length >= 4 && (
                <button
                  type="button"
                  onClick={() => handleApprove(chore.id)}
                  className={`${btnBase} ${btnPress} rounded-xl p-2.5 ${chore.isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                >
                  {chore.isApproved ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                </button>
              )}
            </div>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="absolute left-[57%] top-0 z-10 h-full w-px bg-slate-300" />
            <div
              className={`h-full transition-all duration-1000 ${chore.isApproved ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{
                width: `${(chore.completedDays.length / 7) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type PersistedState = {
  kids: User[];
  chores: Chore[];
  payouts: PayoutRecord[];
  choreTemplates: ChoreTemplate[];
};

let _initialPersisted: PersistedState | null = null;

function loadPersistedState(): PersistedState {
  if (_initialPersisted) return _initialPersisted;
  _initialPersisted = { kids: [], chores: [], payouts: [], choreTemplates: [] };
  return _initialPersisted;
}

const ManageTab = ({
  kids,
  setKids,
  chores,
  setChores,
  choreTemplates,
  setChoreTemplates,
  setActiveKidId,
}: {
  kids: User[];
  setKids: React.Dispatch<React.SetStateAction<User[]>>;
  chores: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  choreTemplates: ChoreTemplate[];
  setChoreTemplates: React.Dispatch<React.SetStateAction<ChoreTemplate[]>>;
  setActiveKidId: (id: string) => void;
}) => {
  const [newKidName, setNewKidName] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateValue, setNewTemplateValue] = useState('5.00');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());

  const handleAddKid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKidName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/kids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKidName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create kid');
      }

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
    if (!window.confirm('Removing this child will also delete all their active chores. Continue?'))
      return;

    try {
      const response = await fetch(`${API_URL}/api/kids/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete kid');
      setKids(prev => prev.filter(k => k.id !== id));
      setChores(prev => prev.filter(c => c.assignedTo !== id));
      setSelectedKidIds(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
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
        body: JSON.stringify({ title: newTemplateTitle.trim(), baseValue: parseFloat(newTemplateValue) || 0 }),
      });
      if (!response.ok) throw new Error('Failed to create template');
      const t = await response.json();
      setChoreTemplates(prev => [...prev, t]);
      setNewTemplateTitle('');
      if (!selectedTemplateId) setSelectedTemplateId(t.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveTemplate = async (templateId: string) => {
    const activeLinked = chores.filter(c => c.templateId === templateId && !c.isArchived);
    if (activeLinked.length > 0) {
      const linkedKids = Array.from(
        new Set(
          activeLinked.map(c => kids.find(k => k.id === c.assignedTo)?.name || 'Unknown child')
        )
      ).join(', ');
      const shouldForceDelete = window.confirm(
        `This chore is currently assigned to: ${linkedKids}. Deleting it from the library will not remove existing assigned chores, but you will not be able to assign it again unless you re-create it. Force delete anyway?`
      );
      if (!shouldForceDelete) return;
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

  const toggleKidSelect = (kidId: string) => {
    setSelectedKidIds(prev => {
      const n = new Set(prev);
      if (n.has(kidId)) n.delete(kidId);
      else n.add(kidId);
      return n;
    });
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || selectedKidIds.size === 0) return;

    const toAssign = Array.from(selectedKidIds).filter(kidId =>
      !chores.some(c => c.templateId === selectedTemplateId && c.assignedTo === kidId && !c.isArchived)
    );

    if (toAssign.length === 0) {
      console.warn('No unassigned kids selected for this task');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/chores/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId, kidIds: toAssign }),
      });
      if (!response.ok) throw new Error('Failed to assign chores');
      const assigned = await response.json();
      if (assigned.length > 0) {
        setChores(prev => [...prev, ...assigned]);
      }
      setSelectedKidIds(new Set());
    } catch (error) {
      console.error('handleAssign error', error);
    }
  };

  const handleUnassign = async () => {
    if (!selectedTemplateId || selectedKidIds.size === 0) return;

    const toUnassign = Array.from(selectedKidIds).filter(kidId =>
      chores.some(c => c.templateId === selectedTemplateId && c.assignedTo === kidId && !c.isArchived)
    );

    if (toUnassign.length === 0) {
      console.warn('No assigned kids selected for this task');
      return;
    }

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          {kids.map(kid => (
            <div
              key={kid.id}
              className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:border-violet-200"
            >
              <span className="font-bold text-slate-800">{kid.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveKid(kid.id)}
                className={`${btnBase} rounded-xl p-2 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100`}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardSurface} p-6 md:p-8`}>
        <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <ListChecks size={22} />
          </span>
          Chore library
        </h3>
        <p className="mb-4 text-sm leading-relaxed text-slate-500">
          Add chores once here. They stay in the list so you can assign the same chore to several
          kids.
        </p>
        <form onSubmit={handleAddTemplate} className="mb-6 space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4">
          <input
            type="text"
            placeholder="Chore name"
            className="w-full rounded-xl border border-white bg-white px-4 py-3 font-bold text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
            value={newTemplateTitle}
            onChange={e => setNewTemplateTitle(e.target.value)}
          />
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
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition-all ${selectedTemplateId === t.id
                  ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300/50'
                  : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                <div className="min-w-0 text-left">
                  <p className="truncate font-bold text-slate-900">{t.title}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    ${t.baseValue.toFixed(2)} / week
                  </p>
                </div>
                <button
                  type="button"
                  onClick={ev => {
                    ev.stopPropagation();
                    handleRemoveTemplate(t.id);
                  }}
                  className={`${btnBase} shrink-0 rounded-xl p-2 text-slate-300 hover:text-red-500`}
                  aria-label={`Remove ${t.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

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
              <label htmlFor="assign-chore" className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">
                Assigned chore
              </label>
              <select
                id="assign-chore"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
                value={selectedTemplateId ?? ''}
                onChange={e => setSelectedTemplateId(e.target.value || null)}
              >
                <option value="" disabled>
                  Select chore to assign
                </option>
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
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKidSelect(k.id)}
                      className={`${btnBase} ${btnPress} rounded-full border-2 px-4 py-2 text-sm font-bold ${on
                        ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200'
                        }`}
                    >
                      {k.name}
                    </button>
                  );
                })}
              </div>
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
  );
};

export default function ChoreApp() {
  const initial = loadPersistedState();
  const [kids, setKids] = useState<User[]>(() => initial.kids);
  const [chores, setChores] = useState<Chore[]>(() => initial.chores);
  const [choreTemplates, setChoreTemplates] = useState<ChoreTemplate[]>(() => initial.choreTemplates);
  const [payouts, setPayouts] = useState<PayoutRecord[]>(() => initial.payouts);
  const [view, setView] = useState<UserRole>('child');
  const [parentAuthed, setParentAuthed] = useState(readParentSession);
  const [parentTab, setParentTab] = useState<'dashboard' | 'manage' | 'history'>('dashboard');
  const [activeKidId, setActiveKidId] = useState<string>(kids[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [showModal, setShowModal] = useState({ show: false, milestone: false, title: '' });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [kidsImageBroken, setKidsImageBroken] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [kidsRes, templatesRes, choresRes, payoutsRes] = await Promise.all([
          fetch(`${API_URL}/api/kids`),
          fetch(`${API_URL}/api/templates`),
          fetch(`${API_URL}/api/chores`),
          fetch(`${API_URL}/api/payouts`),
        ]);

        if (kidsRes.ok) setKids(await kidsRes.json());
        if (templatesRes.ok) setChoreTemplates(await templatesRes.json());
        if (choresRes.ok) setChores(await choresRes.json());
        if (payoutsRes.ok) setPayouts(await payoutsRes.json());
      } catch (error) {
        console.error('Failed to load from backend API', error);
      }
    };
    fetchInitialData();
  }, []);

  const getKidStats = (kidId: string) => {
    const active = chores.filter(c => c.assignedTo === kidId && !c.isArchived);
    const approved = active
      .filter(c => c.isApproved)
      .reduce((s, c) => s + getChoreEarnedAmount(c.completedDays.length, c.baseValue), 0);
    const pending = active.filter(c => c.completedDays.length >= 4 && !c.isApproved).length;
    return { active, approved, pending, canPayout: approved > 0 };
  };

  const leaderboard = useMemo(() => {
    return kids
      .map(k => ({ ...k, ...getKidStats(k.id) }))
      .sort((a, b) => b.approved - a.approved);
  }, [kids, chores]);

  const handleToggleDay = async (choreId: string, day: DayOfWeek) => {
    try {
      const response = await fetch(`${API_URL}/api/chores/${choreId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day }),
      });
      if (!response.ok) throw new Error('Failed to toggle chore day');
      const updated = await response.json();
      setChores(prev => prev.map(c => (c.id === choreId ? updated : c)));
      if (!updated.completedDays.includes(day)) return;
      const n = updated.completedDays.length;
      if (n === 4 || n === 7) {
        setShowModal({ show: true, milestone: n === 4 || n === 7, title: updated.title });
        setTimeout(() => setShowModal({ show: false, milestone: false, title: '' }), 2000);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const processPayout = async (kidId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/payouts/${kidId}`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to process payout');
      const { payout, updatedChores } = await response.json();
      setPayouts(prev => [payout, ...prev]);
      setChores(updatedChores);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePayout = async (payoutId: string) => {
    if (!window.confirm('Delete this payout entry?')) return;

    try {
      const response = await fetch(`${API_URL}/api/payouts/${payoutId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete payout entry');
      setPayouts(prev => prev.filter(p => p.id !== payoutId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearPayoutHistory = async (kidId: string) => {
    if (!window.confirm('Clear all payout history for this child?')) return;

    try {
      const response = await fetch(`${API_URL}/api/payouts?childId=${kidId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear payout history');
      setPayouts(prev => prev.filter(p => p.childId !== kidId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearAllPayouts = async () => {
    if (!window.confirm('Clear all payout history for all children?')) return;

    try {
      const response = await fetch(`${API_URL}/api/payouts`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear all payout history');
      setPayouts([]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleWeeklyReset = async () => {
    if (
      !window.confirm(
        'Reset the week for all active chores? This clears every day’s checkmarks and approval state (paid-out / archived chores stay as they are). Use this at the end of the week, typically Sunday.'
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
  };

  const navBtn = (active: boolean) =>
    `${btnBase} ${btnPress} px-8 py-3 rounded-[1.75rem] font-black uppercase text-[11px] tracking-wider ${active
      ? 'bg-white text-violet-600 shadow-lg shadow-slate-900/10'
      : 'text-slate-500 hover:text-slate-800'
    }`;

  const tabBtn = (active: boolean) =>
    `${btnBase} ${btnPress} px-4 py-2 rounded-xl text-xs font-black ${active ? 'bg-violet-100 text-violet-700 shadow-inner' : 'text-slate-400 hover:text-slate-700'
    }`;

  const goHome = () => {
    setView('child');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parentSignOut = () => {
    writeParentSession(false);
    setParentAuthed(false);
    setView('child');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-violet-50/30 to-slate-100 p-4 pb-16 font-sans text-slate-900 md:p-10">
      {showModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-md">
          <div
            className={`${cardSurface} max-w-sm animate-in zoom-in p-10 text-center duration-300`}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              {showModal.milestone ? <Trophy /> : <Star />}
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {showModal.milestone ? 'Milestone!' : 'Good job!'}
            </h2>
            <p className="mt-2 text-slate-500">
              You checked off “{showModal.title}”!
            </p>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-md">
          <ChangePasswordForm onSuccess={() => setShowChangePassword(false)} />
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <header className="mb-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="text-left">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                goHome();
              }}
              className={`${btnBase} ${btnPress} mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200/80 bg-white/90 text-violet-600 shadow-sm hover:text-violet-700`}
              aria-label="Home"
            >
              <Home size={22} strokeWidth={2.25} />
            </a>
            <h1 className="text-4xl font-black tracking-tight text-black md:text-5xl">
            Moody Family Chore App
            </h1>
            <p className="mt-2 max-w-lg text-slate-600">
              Chores and Rewards
            </p>
          </div>
          <div className="flex gap-3 lg:justify-end">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                goHome();
              }}
              className={`${btnBase} ${btnPress} group relative block h-28 w-40 overflow-hidden rounded-3xl shadow-lg shadow-slate-900/15 ring-1 ring-white/50 md:h-32 md:w-44`}
              aria-label="Home — back to kids’ view"
            >
              <img
                src={IMG_HOME}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-sm">
                <Home size={12} /> Home
              </span>
            </a>
            <a
              href="#parent"
              onClick={e => {
                e.preventDefault();
                setView('parent');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`${btnBase} ${btnPress} group relative block h-28 w-40 overflow-hidden rounded-3xl shadow-lg shadow-slate-900/15 ring-1 ring-white/50 md:h-32 md:w-44`}
              aria-label="Open parent portal"
            >
              {!kidsImageBroken ? (
                <img
                  src={IMG_KIDS}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={() => setKidsImageBroken(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-violet-100 to-indigo-100 transition-transform duration-300 group-hover:scale-105">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-violet-600 shadow-inner">
                    <LogIn size={28} strokeWidth={2} />
                  </div>
                </div>
              )}
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-sm">
                <LogIn size={12} /> Parent
              </span>
            </a>
          </div>
        </header>

        <nav className="mb-10 flex justify-center">
          <div className="flex gap-2 rounded-[2rem] border border-white/60 bg-slate-200/40 p-1.5 shadow-inner backdrop-blur-sm">
            <button type="button" onClick={() => setView('child')} className={navBtn(view === 'child')}>
              KIDS
            </button>
            <button type="button" onClick={() => setView('parent')} className={navBtn(view === 'parent')}>
              Parent
            </button>
          </div>
        </nav>

        {view === 'parent' && !parentAuthed ? (
          <div className="animate-in fade-in space-y-4 duration-500">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setView('child')}
                className={`${btnBase} ${btnPress} text-sm font-bold text-violet-600 hover:text-violet-800`}
              >
                ← Back to kids
              </button>
            </div>
            <ParentLoginForm onSuccess={(hasChanged) => { setParentAuthed(true); if (!hasChanged) setShowChangePassword(true); }} />
          </div>
        ) : view === 'parent' ? (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-2xl font-black text-black">Household Hub</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-2xl border border-white/60 bg-white/70 p-1 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setParentTab('dashboard')}
                    className={tabBtn(parentTab === 'dashboard')}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentTab('manage')}
                    className={tabBtn(parentTab === 'manage')}
                  >
                    Manage
                  </button>
                </div>
                <button
                  type="button"
                  onClick={parentSignOut}
                  className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-red-200 hover:text-red-600`}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>

            {parentTab === 'dashboard' ? (
              <div className="animate-in fade-in space-y-8 duration-500">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <StatCard
                    icon={<DollarSign />}
                    label="Total approved"
                    val={`$${leaderboard.reduce((s, k) => s + k.approved, 0).toFixed(2)}`}
                    accent="from-emerald-500 to-teal-600"
                  />
                  <StatCard
                    icon={<ShieldCheck />}
                    label="Awaiting review"
                    val={`${leaderboard.reduce((s, k) => s + k.pending, 0)} tasks`}
                    accent="from-amber-500 to-orange-600"
                  />
                  <StatCard
                    icon={<Trophy />}
                    label="Top earner"
                    val={leaderboard[0]?.name || '—'}
                    accent="from-violet-500 to-indigo-600"
                  />
                </div>

                <div className="space-y-6">
                  {kids.map(kid => {
                    const stats = getKidStats(kid.id);
                    return (
                      <div key={kid.id} className={`${cardSurface} p-6 md:p-8`}>
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-xl font-black text-slate-900">{kid.name}&apos;s progress</h3>
                          <button
                            type="button"
                            onClick={() => processPayout(kid.id)}
                            disabled={!stats.canPayout}
                            className={`${btnBase} ${btnPress} rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-25`}
                          >
                            Payout
                          </button>
                        </div>
                        <ChoreProgressRows
                          choreList={stats.active}
                          setChores={setChores}
                          showParentApprove
                        />
                        <div className="mt-8 rounded-[2rem] border border-slate-100 bg-slate-50/80 p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-widest text-slate-400">Payout history</p>
                              <p className="text-sm text-slate-500">Track how much has been paid out to {kid.name}.</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">
                                ${payouts.filter(p => p.childId === kid.id).reduce((sum, p) => sum + p.amount, 0).toFixed(2)} paid
                              </span>
                              <button
                                type="button"
                                onClick={() => handleClearPayoutHistory(kid.id)}
                                className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-rose-600`}
                              >
                                Clear history
                              </button>
                            </div>
                          </div>
                          {payouts.filter(p => p.childId === kid.id).length === 0 ? (
                            <p className="text-sm text-slate-500">No payouts recorded yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {payouts
                                .filter(p => p.childId === kid.id)
                                .map(payout => (
                                  <div key={payout.id} className="rounded-3xl bg-white p-4 shadow-sm shadow-slate-200/60">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="font-bold text-slate-900">${payout.amount.toFixed(2)}</p>
                                        <p className="text-xs uppercase tracking-widest text-slate-400">
                                          {new Date(payout.timestamp).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePayout(payout.id)}
                                        className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-rose-600`}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-500">
                                      {payout.choresPaid.length > 0 ? payout.choresPaid.join(', ') : 'Paid out for completed chores.'}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <section className={`${cardSurface} p-6 md:p-8`}>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Clear all payout history</h3>
                      <p className="text-sm text-slate-500">
                        Remove every payout record from the system. Use this when you want to reset payout history completely.
                      </p>
                      <p className="text-sm font-bold text-rose-600">
                        This action is irreversible.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllPayouts}
                      className={`${btnBase} ${btnPress} rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-rose-500/20`}
                    >
                      Clear all payouts
                    </button>
                  </div>
                </section>

                <section
                  className={`${cardSurface} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8`}
                >
                  <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                      <RotateCcw className="text-violet-600" size={22} /> End of week reset
                    </h3>
                    <p className="max-w-xl text-sm text-slate-500">
                      Start a fresh week for everyone. Clears progress on active chores (not archived).
                      Typical use: Sunday evening.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleWeeklyReset}
                    className={`${btnBase} ${btnPress} shrink-0 rounded-2xl border border-slate-200 bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-slate-900/25`}
                  >
                    Reset week
                  </button>
                </section>
              </div>
            ) : (
              <ManageTab
                kids={kids}
                setKids={setKids}
                chores={chores}
                setChores={setChores}
                choreTemplates={choreTemplates}
                setChoreTemplates={setChoreTemplates}
                setActiveKidId={setActiveKidId}
              />
            )}
          </div>
        ) : (
          <div className="animate-in slide-in-from-right-4 mx-auto max-w-6xl space-y-6 duration-500">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {kids.map(k => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setActiveKidId(k.id)}
                  className={`${btnBase} ${btnPress} shrink-0 rounded-full border-2 px-6 py-2 font-bold ${activeKidId === k.id
                    ? 'border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'border-slate-200/80 bg-white text-slate-500 hover:border-violet-200'
                    }`}
                >
                  {k.name}
                </button>
              ))}
            </div>

            {activeKidId && getKidStats(activeKidId).active.length > 0 && (
              <div className={`${cardSurface} p-6 md:p-8`}>
                <h3 className="mb-6 text-xl font-black text-black">
                  {kids.find(k => k.id === activeKidId)?.name ?? 'My'}&apos;s progress
                </h3>
                <ChoreProgressRows
                  choreList={getKidStats(activeKidId).active}
                  setChores={setChores}
                  showParentApprove={false}
                />
              </div>
            )}

            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex w-full gap-2 overflow-x-auto md:w-44 md:flex-col">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`${btnBase} ${btnPress} flex-1 rounded-2xl border-2 p-4 font-bold md:flex-none ${selectedDay === day
                      ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                      : 'border-transparent bg-white/80 text-slate-400 hover:border-violet-100'
                      }`}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
              <div className={`${cardSurface} flex-1 p-6 md:p-10`}>
                <h2 className="mb-10 text-4xl font-black tracking-tight text-slate-900">
                  {selectedDay}
                </h2>
                <div className="space-y-4">
                  {getKidStats(activeKidId).active.map(chore => {
                    const isDone = chore.completedDays.includes(selectedDay);
                    const earned = getChoreEarnedAmount(
                      chore.completedDays.length,
                      chore.baseValue
                    );
                    return (
                      <button
                        key={chore.id}
                        type="button"
                        onClick={() => handleToggleDay(chore.id, selectedDay)}
                        className={`${btnBase} ${btnPress} flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.75rem] border-2 p-6 text-left transition-colors ${isDone
                          ? 'border-emerald-400 bg-emerald-50/90'
                          : 'border-slate-100 bg-slate-50/80 hover:border-violet-200'
                          }`}
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className={isDone ? 'text-emerald-600' : 'text-slate-200'}>
                            {isDone ? <CheckCircle2 size={32} /> : <Circle size={32} />}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-xl font-bold ${isDone ? 'text-emerald-900 line-through opacity-50' : 'text-slate-800'
                                }`}
                            >
                              {chore.title}
                            </p>
                            <div className="mt-2 flex gap-1">
                              {[...Array(7)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-1 w-3 rounded-full ${i < chore.completedDays.length
                                    ? chore.isApproved
                                      ? 'bg-emerald-500'
                                      : 'bg-violet-400'
                                    : 'bg-slate-200'
                                    }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-xl font-black ${chore.isApproved ? 'text-emerald-600' : 'text-slate-300'
                            }`}
                        >
                          ${earned.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const StatCard = ({
  icon,
  label,
  val,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  val: string;
  accent: string;
}) => (
  <div className={`${cardSurface} flex items-center gap-4 p-6`}>
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}
    >
      {icon}
    </div>
    <div className="min-w-0 text-left">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="truncate text-2xl font-black text-slate-900">{val}</p>
    </div>
  </div>
);
