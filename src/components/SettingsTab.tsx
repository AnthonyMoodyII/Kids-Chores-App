import { useState, useEffect } from 'react';
import { KeyRound, Settings, Bell, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Check, Plus, Trash2, Send, Radio, CheckCircle2, XCircle } from 'lucide-react';
import { API_URL, btnBase, btnPress } from '../lib/constants';
import { ChangePasswordForm } from './ChangePasswordForm';
import { OAuthSettingsManager } from './OAuthSettingsManager';
import type { NotificationSettings, NotificationProvider } from '../types';

const EMPTY_NS: NotificationSettings = {
  pushoverEnabled: false, pushoverTokenSet: false,
  smtpEnabled: false, smtpPasswordSet: false,
  smtpHost: '', smtpPort: 587, smtpUser: '', smtpFrom: '',
  notifyChoreComplete: true, notifyStreakBonus: true,
  notifyRewardRequest: true, notifyRewardIdea: true,
  notifyWeeklyReset: true, notifyRewardApproved: true,
};

/** Test-result strings still use a ✅/❌ prefix internally to encode success/failure; strip it for display. */
function TestStatus({ msg }: { msg: string }) {
  const ok = msg.startsWith('✅');
  const text = msg.replace(/^[✅❌]\s*/, '');
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {text}
    </span>
  );
}

function AccordionSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`${btnBase} flex w-full items-center justify-between gap-3 px-6 py-4 text-left`}
      >
        <span className="flex items-center gap-3 font-black text-slate-800">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-6 pb-6 pt-4">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

// ── Notification Providers Panel ─────────────────────────────────────────────

function NotificationProvidersPanel({ currentPassword }: { currentPassword: string }) {
  const [providers, setProviders] = useState<NotificationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [addType] = useState<'gotify'>('gotify');
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addToken, setAddToken] = useState('');
  const [addPriority, setAddPriority] = useState(5);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Per-provider state
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/notification-providers`)
      .then(r => r.ok ? r.json() : [])
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { setAddError('Enter your current password above first.'); return; }
    if (!addName.trim() || !addUrl.trim() || !addToken.trim()) {
      setAddError('Name, URL, and token are all required.'); return;
    }
    setAddSaving(true); setAddError('');
    try {
      const res = await fetch(`${API_URL}/api/notification-providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          type: addType,
          name: addName.trim(),
          config: { url: addUrl.trim(), token: addToken.trim(), priority: addPriority },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add.'); return; }
      setProviders(prev => [...prev, data]);
      setAddName(''); setAddUrl(''); setAddToken(''); setAddPriority(5);
      setShowAddForm(false);
    } catch { setAddError('Request failed.'); }
    finally { setAddSaving(false); }
  };

  const handleToggleEnabled = async (provider: NotificationProvider) => {
    if (!currentPassword) return;
    setToggling(provider.id);
    try {
      const res = await fetch(`${API_URL}/api/notification-providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, enabled: !provider.enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProviders(prev => prev.map(p => p.id === provider.id ? updated : p));
      }
    } finally { setToggling(null); }
  };

  const handleDelete = async (id: string) => {
    if (!currentPassword) { alert('Enter your current password above first.'); return; }
    if (!window.confirm('Remove this notification provider?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/notification-providers/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword }),
      });
      if (res.ok) setProviders(prev => prev.filter(p => p.id !== id));
    } finally { setDeleting(null); }
  };

  const handleTest = async (id: string) => {
    if (!currentPassword) { setTestResults(r => ({ ...r, [id]: '❌ Enter your password above first.' })); return; }
    setTesting(id); setTestResults(r => ({ ...r, [id]: '' }));
    try {
      const res = await fetch(`${API_URL}/api/notification-providers/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword }),
      });
      const d = await res.json();
      setTestResults(r => ({ ...r, [id]: res.ok ? '✅ Test sent!' : `❌ ${d.error}` }));
    } catch { setTestResults(r => ({ ...r, [id]: '❌ Request failed' })); }
    finally { setTesting(null); }
  };

  const PROVIDER_LABELS: Record<string, string> = { gotify: 'Gotify' };

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {/* Provider list */}
      {providers.length === 0 && !loading && (
        <p className="text-sm italic text-slate-400">No providers configured yet. Add one below.</p>
      )}
      {providers.map(p => (
        <div
          key={p.id}
          className={`rounded-2xl border-2 p-4 transition-colors ${p.enabled ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-800">{p.name}</span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-600">
                  {PROVIDER_LABELS[p.type] ?? p.type}
                </span>
                {p.config.tokenSet && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    Token saved
                  </span>
                )}
              </div>
              {p.config.url && (
                <p className="mt-0.5 truncate text-xs text-slate-500">{p.config.url}</p>
              )}
              {p.config.priority !== undefined && (
                <p className="text-xs text-slate-400">Priority: {p.config.priority}</p>
              )}
            </div>

            {/* Enabled toggle */}
            <button
              type="button"
              disabled={toggling === p.id || !currentPassword}
              onClick={() => handleToggleEnabled(p)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${p.enabled ? 'bg-teal-500' : 'bg-slate-300'}`}
              title={p.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
            >
              <span className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform ${p.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={testing === p.id}
              onClick={() => handleTest(p.id)}
              className={`${btnBase} ${btnPress} flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:opacity-40`}
            >
              <Send size={12} /> {testing === p.id ? 'Sending…' : 'Test'}
            </button>
            <button
              type="button"
              disabled={deleting === p.id}
              onClick={() => handleDelete(p.id)}
              className={`${btnBase} ${btnPress} flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-400 hover:border-red-200 hover:text-red-600 disabled:opacity-40`}
            >
              <Trash2 size={12} /> {deleting === p.id ? 'Removing…' : 'Remove'}
            </button>
            {testResults[p.id] && <TestStatus msg={testResults[p.id]} />}
          </div>
        </div>
      ))}

      {/* Add provider form */}
      {showAddForm ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-600">Add Gotify Provider</p>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Display Name</label>
            <input
              type="text"
              placeholder="e.g. Home Gotify"
              className="w-full rounded-xl border border-white bg-white px-4 py-2.5 font-bold text-slate-800 outline-none ring-indigo-400/30 focus:ring-2"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
              Server URL{' '}
              <a href="https://github.com/gotify/server" target="_blank" rel="noopener noreferrer" className="ml-1 normal-case text-violet-500 hover:underline">
                gotify/server <ExternalLink size={9} className="inline" />
              </a>
            </label>
            <input
              type="url"
              placeholder="https://gotify.example.com"
              className="w-full rounded-xl border border-white bg-white px-4 py-2.5 font-bold text-slate-800 outline-none ring-indigo-400/30 focus:ring-2"
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">App Token</label>
            <input
              type="password"
              placeholder="Gotify app token"
              className="w-full rounded-xl border border-white bg-white px-4 py-2.5 font-bold text-slate-800 outline-none ring-indigo-400/30 focus:ring-2"
              value={addToken}
              onChange={e => setAddToken(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-400">Create an app in your Gotify server and paste its token here.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Priority (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-24 rounded-xl border border-white bg-white px-4 py-2.5 font-bold outline-none ring-indigo-400/30 focus:ring-2"
              value={addPriority}
              onChange={e => setAddPriority(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
            />
          </div>
          {addError && <p className="text-sm font-bold text-red-600">{addError}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={addSaving}
              className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-black text-white shadow-md shadow-indigo-500/25 disabled:opacity-50`}
            >
              {addSaving ? 'Saving…' : <><Check size={14} /> Add Provider</>}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddError(''); }}
              className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-500`}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={`${btnBase} ${btnPress} flex items-center gap-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50 px-4 py-3 text-sm font-black uppercase tracking-wide text-teal-700 hover:bg-teal-100`}
        >
          <Plus size={15} /> Add Notification Provider
        </button>
      )}
    </div>
  );
}

// ── Main SettingsTab ──────────────────────────────────────────────────────────

export function SettingsTab({
  onPasswordChanged,
  onClearAllPayouts,
}: {
  onPasswordChanged: () => void;
  onClearAllPayouts?: () => void;
}) {
  const [ns, setNs] = useState<NotificationSettings>(EMPTY_NS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Pushover fields
  const [poAppToken, setPoAppToken] = useState('');
  const [poUserKey, setPoUserKey] = useState('');
  const [poTesting, setPoTesting] = useState(false);
  const [poTestMsg, setPoTestMsg] = useState('');

  // SMTP fields
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestMsg, setSmtpTestMsg] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/notifications/settings`)
      .then(r => r.json())
      .then(d => setNs(prev => ({ ...prev, ...d })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(''); setSaveSuccess(''); setSaving(true);
    try {
      const body: Record<string, unknown> = {
        currentPassword,
        pushoverEnabled: ns.pushoverEnabled,
        smtpEnabled: ns.smtpEnabled,
        smtpHost: ns.smtpHost,
        smtpPort: ns.smtpPort,
        smtpUser: ns.smtpUser,
        smtpFrom: ns.smtpFrom,
        notifyChoreComplete: ns.notifyChoreComplete,
        notifyStreakBonus: ns.notifyStreakBonus,
        notifyRewardRequest: ns.notifyRewardRequest,
        notifyRewardIdea: ns.notifyRewardIdea,
        notifyWeeklyReset: ns.notifyWeeklyReset,
        notifyRewardApproved: ns.notifyRewardApproved,
      };
      if (poAppToken.trim()) body.pushoverAppToken = poAppToken.trim();
      if (poUserKey.trim()) body.pushoverUserKey = poUserKey.trim();
      if (smtpPassword.trim()) body.smtpPassword = smtpPassword.trim();

      const res = await fetch(`${API_URL}/api/notifications/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) { setSaveError(result.error || 'Failed to save.'); return; }
      setSaveSuccess('Settings saved.');
      setCurrentPassword(''); setPoAppToken(''); setPoUserKey(''); setSmtpPassword('');
      if (poAppToken.trim()) setNs(prev => ({ ...prev, pushoverTokenSet: true }));
      if (smtpPassword.trim()) setNs(prev => ({ ...prev, smtpPasswordSet: true }));
    } catch { setSaveError('Request failed.'); }
    finally { setSaving(false); }
  };

  const testPushover = async () => {
    setPoTesting(true); setPoTestMsg('');
    try {
      const res = await fetch(`${API_URL}/api/notifications/test-pushover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword }),
      });
      const d = await res.json();
      setPoTestMsg(res.ok ? '✅ Test sent!' : `❌ ${d.error}`);
    } catch { setPoTestMsg('❌ Request failed'); }
    finally { setPoTesting(false); }
  };

  const testEmail = async () => {
    setSmtpTesting(true); setSmtpTestMsg('');
    try {
      const res = await fetch(`${API_URL}/api/notifications/test-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword }),
      });
      const d = await res.json();
      setSmtpTestMsg(res.ok ? '✅ Test email sent!' : `❌ ${d.error}`);
    } catch { setSmtpTestMsg('❌ Request failed'); }
    finally { setSmtpTesting(false); }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2';
  const labelCls = 'mb-1 block text-xs font-black uppercase tracking-widest text-slate-400';

  if (loading) return <p className="py-8 text-center text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* Account */}
      <AccordionSection title="Account — Change Password" icon={<KeyRound size={18} className="text-violet-600" />}>
        <ChangePasswordForm onSuccess={onPasswordChanged} onCancel={() => {}} inline />
      </AccordionSection>

      {/* OAuth */}
      <AccordionSection title="Google Sign-In (OAuth)" icon={<Settings size={18} className="text-violet-600" />}>
        <OAuthSettingsManager onRequestClose={() => {}} inline />
      </AccordionSection>

      {/* Notification Providers */}
      <AccordionSection title="Notification Providers" icon={<Radio size={18} className="text-teal-600" />} defaultOpen>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Add multiple push notification services. Each provider delivers alerts independently — disable or remove any time.
          </p>
          {/* Password required for provider management */}
          <div>
            <label className={labelCls}>Current Password (required to manage providers)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputCls}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className={`${btnBase} absolute right-3 top-1/2 -translate-y-1/2 text-slate-400`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <NotificationProvidersPanel currentPassword={currentPassword} />
        </div>
      </AccordionSection>

      {/* Legacy Notifications (Pushover + SMTP) */}
      <AccordionSection title="Legacy Notifications (Pushover / Email)" icon={<Bell size={18} className="text-violet-600" />}>
        <form onSubmit={handleSave} className="space-y-6">

          {/* Current password required for all saves */}
          <div>
            <label className={labelCls}>Current Password (required to save)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputCls}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className={`${btnBase} absolute right-3 top-1/2 -translate-y-1/2 text-slate-400`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Pushover */}
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-800">Pushover</p>
                <a
                  href="https://pushover.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-500 hover:underline"
                >
                  pushover.net <ExternalLink size={10} />
                </a>
              </div>
              <Toggle checked={ns.pushoverEnabled} onChange={v => setNs(prev => ({ ...prev, pushoverEnabled: v }))} label="" />
            </div>
            <div>
              <label className={labelCls}>
                App Token {ns.pushoverTokenSet && <span className="text-emerald-600">(saved)</span>}
              </label>
              <input
                type="password"
                className={inputCls}
                placeholder={ns.pushoverTokenSet ? '●●●● saved — leave blank to keep' : 'Your Pushover App Token'}
                value={poAppToken}
                onChange={e => setPoAppToken(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls}>User Key</label>
              <input
                type="password"
                className={inputCls}
                placeholder="Your Pushover User Key"
                value={poUserKey}
                onChange={e => setPoUserKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              disabled={poTesting || !currentPassword}
              onClick={testPushover}
              className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-violet-200 hover:text-violet-600 disabled:opacity-40`}
            >
              {poTesting ? 'Sending…' : 'Send Test Notification'}
            </button>
            {poTestMsg && <p className="text-sm"><TestStatus msg={poTestMsg} /></p>}
          </div>

          {/* SMTP */}
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-800">Email (SMTP)</p>
                <p className="text-xs text-slate-400">Works with Gmail, SendGrid, etc.</p>
              </div>
              <Toggle checked={ns.smtpEnabled} onChange={v => setNs(prev => ({ ...prev, smtpEnabled: v }))} label="" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>SMTP Host</label>
                <input type="text" className={inputCls} placeholder="smtp.gmail.com" value={ns.smtpHost} onChange={e => setNs(prev => ({ ...prev, smtpHost: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input type="number" className={inputCls} placeholder="587" value={ns.smtpPort} onChange={e => setNs(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))} />
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input type="text" className={inputCls} placeholder="you@gmail.com" value={ns.smtpUser} onChange={e => setNs(prev => ({ ...prev, smtpUser: e.target.value }))} autoComplete="off" />
              </div>
              <div>
                <label className={labelCls}>
                  App Password {ns.smtpPasswordSet && <span className="text-emerald-600">(saved)</span>}
                </label>
                <input type="password" className={inputCls} placeholder={ns.smtpPasswordSet ? '●●●● saved' : 'App password'} value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} autoComplete="off" />
              </div>
            </div>
            <div>
              <label className={labelCls}>From Address</label>
              <input type="email" className={inputCls} placeholder="Chore App <you@gmail.com>" value={ns.smtpFrom} onChange={e => setNs(prev => ({ ...prev, smtpFrom: e.target.value }))} />
            </div>
            <button
              type="button"
              disabled={smtpTesting || !currentPassword}
              onClick={testEmail}
              className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-violet-200 hover:text-violet-600 disabled:opacity-40`}
            >
              {smtpTesting ? 'Sending…' : 'Send Test Email'}
            </button>
            {smtpTestMsg && <p className="text-sm"><TestStatus msg={smtpTestMsg} /></p>}
          </div>

          {/* Event toggles */}
          <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Which events send notifications</p>
            <Toggle checked={ns.notifyChoreComplete} onChange={v => setNs(p => ({ ...p, notifyChoreComplete: v }))} label="Chore day completed" />
            <Toggle checked={ns.notifyStreakBonus} onChange={v => setNs(p => ({ ...p, notifyStreakBonus: v }))} label="7-day streak achieved" />
            <Toggle checked={ns.notifyRewardRequest} onChange={v => setNs(p => ({ ...p, notifyRewardRequest: v }))} label="Kid requests a reward" />
            <Toggle checked={ns.notifyRewardIdea} onChange={v => setNs(p => ({ ...p, notifyRewardIdea: v }))} label="Kid suggests a reward idea" />
            <Toggle checked={ns.notifyWeeklyReset} onChange={v => setNs(p => ({ ...p, notifyWeeklyReset: v }))} label="Weekly close-out summary" />
            <Toggle checked={ns.notifyRewardApproved} onChange={v => setNs(p => ({ ...p, notifyRewardApproved: v }))} label="Reward redeemed by parent" />
          </div>

          {saveError && <p className="text-sm font-bold text-red-600">{saveError}</p>}
          {saveSuccess && (
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-600">
              <Check size={14} /> {saveSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !currentPassword}
            className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
          >
            {saving ? 'Saving…' : 'Save Notification Settings'}
          </button>
        </form>
      </AccordionSection>

      {/* Danger zone — clear payout history */}
      {onClearAllPayouts && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-rose-500">Clear payout history</p>
            <p className="text-[11px] text-slate-400">Permanently removes all payout records. Irreversible.</p>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-rose-600">Are you sure?</span>
              <button
                type="button"
                onClick={() => { onClearAllPayouts(); setConfirmClear(false); }}
                className={`${btnBase} ${btnPress} rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white`}
              >
                Yes, clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className={`${btnBase} ${btnPress} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className={`${btnBase} ${btnPress} shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-black text-rose-500 hover:border-rose-400 hover:bg-rose-50`}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
