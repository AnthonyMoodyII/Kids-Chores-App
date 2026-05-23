import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { API_URL, cardSurface, btnBase, btnPress } from '../lib/constants';

export function OAuthIcon({ size = 20 }: { size?: number }) {
  return <Settings size={size} />;
}

interface OAuthSettings {
  oauthIssuer: string;
  oauthClientId: string;
  oauthClientSecretSet: boolean;
  allowedEmails: string[];
}

interface OAuthSettingsManagerProps {
  onRequestClose: () => void;
}

export function OAuthSettingsManager({ onRequestClose }: OAuthSettingsManagerProps) {
  const [settings, setSettings] = useState<OAuthSettings>({
    oauthIssuer: '',
    oauthClientId: '',
    oauthClientSecretSet: false,
    allowedEmails: [],
  });
  const [loading, setLoading] = useState(true);

  // OAuth provider form state
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savePassword, setSavePassword] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Email management state
  const [newEmail, setNewEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/parent/oauth/settings`)
      .then(r => r.json())
      .then((d: OAuthSettings) => {
        setSettings(d);
        setIssuer(d.oauthIssuer || 'https://accounts.google.com');
        setClientId(d.oauthClientId || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaveLoading(true);
    try {
      const body: Record<string, string> = {
        currentPassword: savePassword,
        oauthIssuer: issuer,
        oauthClientId: clientId,
      };
      if (clientSecret.trim()) body.oauthClientSecret = clientSecret.trim();
      const res = await fetch(`${API_URL}/api/parent/oauth/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok) {
        setSaveSuccess('Settings saved.');
        setSavePassword('');
        setClientSecret('');
        setSettings(prev => ({ ...prev, oauthIssuer: issuer, oauthClientId: clientId, oauthClientSecretSet: !!(clientSecret.trim() || prev.oauthClientSecretSet) }));
      } else {
        setSaveError(result.error || 'Failed to save settings.');
      }
    } catch {
      setSaveError('Request failed. Check your connection.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newEmail.includes('@')) {
      setAddError('Enter a valid email address.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parent/cf-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), currentPassword: addPassword }),
      });
      const result = await res.json();
      if (res.ok) {
        setSettings(prev => ({ ...prev, allowedEmails: result.emails }));
        setNewEmail('');
        setAddPassword('');
      } else {
        setAddError(result.error || 'Failed to add email.');
      }
    } catch {
      setAddError('Request failed. Check your connection.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (email: string) => {
    setRemoveError('');
    setRemoveLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parent/cf-emails/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: removePassword }),
      });
      const result = await res.json();
      if (res.ok) {
        setSettings(prev => ({ ...prev, allowedEmails: result.emails }));
        setRemoveTarget(null);
        setRemovePassword('');
      } else {
        setRemoveError(result.error || 'Failed to remove email.');
      }
    } catch {
      setRemoveError('Request failed. Check your connection.');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className={`${cardSurface} mx-auto w-full max-w-lg p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">OAuth Settings</h2>
          <p className="text-sm text-slate-500">Configure Google sign-in for the parent portal</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Section 1 — OAuth Provider */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
              OAuth Provider
            </p>
            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">
                  Issuer URL
                  <span className="ml-1 font-normal text-slate-400">(default: https://accounts.google.com)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://accounts.google.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                  value={issuer}
                  onChange={e => setIssuer(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Client ID</label>
                <input
                  type="text"
                  placeholder="your-client-id.apps.googleusercontent.com"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">
                  Client Secret
                  {settings.oauthClientSecretSet && (
                    <span className="ml-1 font-normal text-slate-400">(currently set — leave blank to keep)</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={settings.oauthClientSecretSet ? '●●●● saved' : 'Enter client secret'}
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">
                  Current Password <span className="font-normal text-slate-400">(required to save)</span>
                </label>
                <input
                  type="password"
                  placeholder="Current parent password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                  value={savePassword}
                  onChange={e => setSavePassword(e.target.value)}
                />
              </div>
              {saveError ? <p className="text-sm font-bold text-red-600">{saveError}</p> : null}
              {saveSuccess ? <p className="text-sm font-bold text-emerald-600">{saveSuccess}</p> : null}
              <button
                type="submit"
                disabled={saveLoading}
                className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
              >
                {saveLoading ? 'Saving…' : 'Save Settings'}
              </button>
            </form>
          </section>

          {/* Section 2 — Authorized Parents */}
          <section className="mb-6">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
              Authorized Parents
            </p>
            {settings.allowedEmails.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">No emails authorized yet.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {settings.allowedEmails.map(email => (
                  <li key={email} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <span className="break-all text-sm font-bold text-slate-700">{email}</span>
                    {removeTarget === email ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="password"
                          placeholder="Current password"
                          autoComplete="current-password"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                          value={removePassword}
                          onChange={e => setRemovePassword(e.target.value)}
                        />
                        {removeError ? <p className="text-xs font-bold text-red-600">{removeError}</p> : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={removeLoading}
                            onClick={() => handleRemove(email)}
                            className={`${btnBase} ${btnPress} flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white disabled:pointer-events-none disabled:opacity-50`}
                          >
                            {removeLoading ? 'Removing…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRemoveTarget(null); setRemovePassword(''); setRemoveError(''); }}
                            className={`${btnBase} ${btnPress} flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-500`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setRemoveTarget(email); setRemovePassword(''); setRemoveError(''); }}
                        className={`${btnBase} ${btnPress} shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-600 hover:bg-red-100`}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Add Email</p>
              <input
                type="email"
                placeholder="email@example.com"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Current parent password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
              />
              {addError ? <p className="text-sm font-bold text-red-600">{addError}</p> : null}
              <button
                type="submit"
                disabled={addLoading}
                className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
              >
                {addLoading ? 'Adding…' : 'Add Email'}
              </button>
            </form>
          </section>
        </>
      )}

      <button
        type="button"
        onClick={onRequestClose}
        className={`${btnBase} ${btnPress} w-full rounded-2xl border border-slate-200 bg-white py-3 font-black uppercase tracking-wide text-slate-500`}
      >
        Done
      </button>
    </div>
  );
}
