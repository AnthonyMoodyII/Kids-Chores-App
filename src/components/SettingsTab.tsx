import { useState, useEffect } from 'react';
import { KeyRound, Settings, Bell, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Check } from 'lucide-react';
import { API_URL, btnBase, btnPress } from '../lib/constants';
import { ChangePasswordForm } from './ChangePasswordForm';
import { OAuthSettingsManager } from './OAuthSettingsManager';
import type { NotificationSettings } from '../types';

const EMPTY_NS: NotificationSettings = {
  pushoverEnabled: false, pushoverTokenSet: false,
  smtpEnabled: false, smtpPasswordSet: false,
  smtpHost: '', smtpPort: 587, smtpUser: '', smtpFrom: '',
  notifyChoreComplete: true, notifyStreakBonus: true,
  notifyRewardRequest: true, notifyRewardIdea: true,
  notifyWeeklyReset: true, notifyRewardApproved: true,
};

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
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export function SettingsTab({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const [ns, setNs] = useState<NotificationSettings>(EMPTY_NS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

      {/* Notifications */}
      <AccordionSection title="Notifications" icon={<Bell size={18} className="text-violet-600" />} defaultOpen>
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
            {poTestMsg && <p className={`text-sm font-bold ${poTestMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{poTestMsg}</p>}
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
            {smtpTestMsg && <p className={`text-sm font-bold ${smtpTestMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{smtpTestMsg}</p>}
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
    </div>
  );
}
