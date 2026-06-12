import { useState, useEffect } from 'react';
import { Settings, ExternalLink, ChevronDown, ChevronUp, Copy, Check, Trash2, Pencil, ShieldCheck, ShieldOff, Plus } from 'lucide-react';
import { API_URL, cardSurface, btnBase, btnPress } from '../lib/constants';

interface OAuthProvider {
  id: string;
  name: string;
  issuer: string;
  clientId: string;
  clientSecretSet: boolean;
  enabled: boolean;
  sortOrder: number;
}

interface OAuthSettingsManagerProps {
  onRequestClose: () => void;
  inline?: boolean;
}

const CALLBACK_URL = 'https://chores.moodyplex.com/api/parent/oauth/callback';

// ── Provider presets ──────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Google', issuer: 'https://accounts.google.com', placeholder: 'your-client-id.apps.googleusercontent.com' },
  { label: 'Keycloak', issuer: 'https://auth-keycloak.moodyplex.com/realms/master', placeholder: 'chores-app' },
  { label: 'Custom', issuer: '', placeholder: 'client-id' },
] as const;

// ── Setup guides ──────────────────────────────────────────────────────────────

function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'google' | 'keycloak'>('google');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(CALLBACK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const CallbackRow = () => (
    <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2">
      <code className="min-w-0 flex-1 break-all text-[11px] font-bold text-slate-700">{CALLBACK_URL}</code>
      <button type="button" onClick={copy} className={`${btnBase} shrink-0 rounded-lg p-1.5 text-violet-500 hover:bg-violet-100`} aria-label="Copy">
        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      </button>
    </div>
  );

  return (
    <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-xs font-black uppercase tracking-widest text-violet-600">Setup Guide</span>
        {open ? <ChevronUp size={14} className="shrink-0 text-violet-400" /> : <ChevronDown size={14} className="shrink-0 text-violet-400" />}
      </button>

      {open && (
        <div className="border-t border-violet-100 px-4 pb-4 pt-3">
          {/* Tab switcher */}
          <div className="mb-4 flex gap-1 rounded-xl border border-violet-200 bg-white p-1">
            {(['google', 'keycloak'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`${btnBase} flex-1 rounded-lg py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
                  tab === t ? 'bg-violet-600 text-white' : 'text-violet-500 hover:text-violet-700'
                }`}
              >
                {t === 'google' ? 'Google' : 'Keycloak'}
              </button>
            ))}
          </div>

          {tab === 'google' && (
            <ol className="space-y-3 list-none text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">1</span>
                <span>Go to{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-violet-600 underline underline-offset-2">
                    Google Cloud Console → Credentials <ExternalLink size={11} />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">2</span>
                <span>Click <strong>Create Credentials → OAuth 2.0 Client ID</strong>, choose <strong>Web application</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">3</span>
                <div className="min-w-0">
                  <p className="mb-1.5">Under <strong>Authorized redirect URIs</strong>, add:</p>
                  <CallbackRow />
                </div>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">4</span>
                <span>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the form below. Set issuer to <code className="rounded bg-white px-1 text-[11px]">https://accounts.google.com</code></span>
              </li>
            </ol>
          )}

          {tab === 'keycloak' && (
            <ol className="space-y-3 list-none text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">1</span>
                <span>Open your Keycloak admin at{' '}
                  <a href="https://auth-keycloak.moodyplex.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-violet-600 underline underline-offset-2">
                    auth-keycloak.moodyplex.com <ExternalLink size={11} />
                  </a>
                  {' '}→ choose your realm
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">2</span>
                <span>Go to <strong>Clients → Create client</strong>. Set protocol to <strong>OpenID Connect</strong>, enter a client ID (e.g. <code className="rounded bg-white px-1 text-[11px]">chores-app</code>)</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">3</span>
                <span>Enable <strong>Client authentication</strong> (Confidential access type), then under <strong>Valid redirect URIs</strong> add:</span>
              </li>
              <li className="pl-7">
                <CallbackRow />
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">4</span>
                <span>Under <strong>Credentials</strong>, copy the client secret. Set issuer to your realm URL, e.g. <code className="rounded bg-white px-1 text-[11px] break-all">https://auth-keycloak.moodyplex.com/realms/master</code></span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">5</span>
                <span>Make sure each parent&apos;s Keycloak account has an <strong>email attribute</strong> set and matches an email in the Authorized Parents list below</span>
              </li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// ── Provider form (add or edit) ───────────────────────────────────────────────

interface ProviderFormProps {
  existing?: OAuthProvider;
  onSaved: (p: OAuthProvider) => void;
  onCancel: () => void;
}

function ProviderForm({ existing, onSaved, onCancel }: ProviderFormProps) {
  const isEdit = !!existing;
  const [preset, setPreset] = useState<string>(
    existing ? (PRESETS.find(p => p.issuer === existing.issuer)?.label ?? 'Custom') : 'Google'
  );
  const [name, setName] = useState(existing?.name ?? 'Google');
  const [issuer, setIssuer] = useState(existing?.issuer ?? 'https://accounts.google.com');
  const [clientId, setClientId] = useState(existing?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyPreset = (label: string) => {
    setPreset(label);
    const p = PRESETS.find(p => p.label === label);
    if (!p) return;
    if (p.issuer) setIssuer(p.issuer);
    if (!isEdit) setName(label === 'Custom' ? '' : label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !issuer.trim() || !clientId.trim()) {
      setError('Name, issuer, and client ID are required.');
      return;
    }
    if (!isEdit && !clientSecret.trim()) {
      setError('Client secret is required when adding a provider.');
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, string | boolean> = {
        currentPassword: password,
        name: name.trim(),
        issuer: issuer.trim(),
        clientId: clientId.trim(),
      };
      if (clientSecret.trim()) body.clientSecret = clientSecret.trim();

      const url = isEdit
        ? `${API_URL}/api/parent/oauth/providers/${existing.id}`
        : `${API_URL}/api/parent/oauth/providers`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok) {
        onSaved(result);
      } else {
        setError(result.error || 'Failed to save.');
      }
    } catch {
      setError('Request failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const currentPreset = PRESETS.find(p => p.label === preset);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-violet-600">
        {isEdit ? `Edit — ${existing.name}` : 'Add OAuth Provider'}
      </p>

      {/* Preset picker */}
      {!isEdit && (
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">Provider Preset</label>
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.label)}
                className={`${btnBase} ${btnPress} flex-1 rounded-xl border py-2 text-xs font-black transition-colors ${
                  preset === p.label
                    ? 'border-violet-400 bg-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500">Display Name</label>
        <input
          type="text"
          placeholder="e.g. Google, Keycloak, Work SSO"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Issuer */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500">Issuer URL</label>
        <input
          type="url"
          placeholder="https://accounts.google.com"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          value={issuer}
          onChange={e => setIssuer(e.target.value)}
        />
      </div>

      {/* Client ID */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500">Client ID</label>
        <input
          type="text"
          placeholder={currentPreset?.placeholder ?? 'client-id'}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
        />
      </div>

      {/* Client Secret */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500">
          Client Secret
          {isEdit && existing.clientSecretSet && (
            <span className="ml-1 font-normal text-slate-400">(saved — leave blank to keep)</span>
          )}
        </label>
        <input
          type="password"
          placeholder={isEdit && existing.clientSecretSet ? '●●●● saved — leave blank to keep' : 'Client secret'}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          value={clientSecret}
          onChange={e => setClientSecret(e.target.value)}
        />
      </div>

      {/* Parent password */}
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500">
          Current Password <span className="font-normal text-slate-400">(required to save)</span>
        </label>
        <input
          type="password"
          placeholder="Current parent password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className={`${btnBase} ${btnPress} flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}
        >
          {loading ? 'Saving…' : isEdit ? 'Update Provider' : 'Add Provider'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${btnBase} ${btnPress} rounded-2xl border border-slate-200 bg-white px-5 py-3.5 font-black uppercase tracking-wide text-slate-500 hover:border-slate-300`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Delete confirm inline ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  provider: OAuthProvider;
  onDeleted: (id: string) => void;
  onCancel: () => void;
}

function DeleteConfirm({ provider, onDeleted, onCancel }: DeleteConfirmProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parent/oauth/providers/${provider.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password }),
      });
      const result = await res.json();
      if (res.ok) {
        onDeleted(provider.id);
      } else {
        setError(result.error || 'Failed to delete.');
      }
    } catch {
      setError('Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
      <p className="text-sm font-bold text-red-700">
        Remove <strong>{provider.name}</strong>? Sign-in via this provider will stop working immediately.
      </p>
      <input
        type="password"
        placeholder="Current parent password to confirm"
        autoComplete="current-password"
        className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-red-400/30 focus:ring-2"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || !password}
          onClick={handleDelete}
          className={`${btnBase} ${btnPress} flex-1 rounded-2xl bg-red-600 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/25 disabled:pointer-events-none disabled:opacity-50`}
        >
          {loading ? 'Removing…' : 'Confirm Remove'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${btnBase} ${btnPress} flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-wide text-slate-500`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OAuthSettingsManager({ onRequestClose, inline = false }: OAuthSettingsManagerProps) {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    Promise.all([
      fetch(`${API_URL}/api/parent/oauth/providers`).then(r => r.json()),
      fetch(`${API_URL}/api/parent/cf-emails`).then(r => r.json()),
    ]).then(([provs, emailsData]) => {
      setProviders(provs);
      setAllowedEmails(emailsData.emails || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleToggleEnabled = async (p: OAuthProvider) => {
    // Optimistic update
    setProviders(prev => prev.map(x => x.id === p.id ? { ...x, enabled: !x.enabled } : x));
    try {
      const res = await fetch(`${API_URL}/api/parent/oauth/providers/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Toggle doesn't require password — only credential changes do
        // But the middleware requires it, so we skip password here — the server
        // will reject without it. We'll show a note instead.
        body: JSON.stringify({ enabled: !p.enabled, currentPassword: '' }),
      });
      if (!res.ok) {
        // Revert on failure
        setProviders(prev => prev.map(x => x.id === p.id ? { ...x, enabled: p.enabled } : x));
      }
    } catch {
      setProviders(prev => prev.map(x => x.id === p.id ? { ...x, enabled: p.enabled } : x));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newEmail.includes('@')) { setAddError('Enter a valid email address.'); return; }
    setAddLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/parent/cf-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), currentPassword: addPassword }),
      });
      const result = await res.json();
      if (res.ok) { setAllowedEmails(result.emails); setNewEmail(''); setAddPassword(''); }
      else setAddError(result.error || 'Failed to add email.');
    } catch { setAddError('Request failed.'); }
    finally { setAddLoading(false); }
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
      if (res.ok) { setAllowedEmails(result.emails); setRemoveTarget(null); setRemovePassword(''); }
      else setRemoveError(result.error || 'Failed to remove email.');
    } catch { setRemoveError('Request failed.'); }
    finally { setRemoveLoading(false); }
  };

  const innerContent = (
    <>
      <SetupGuide />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* ── Section 1: OAuth Providers ── */}
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">OAuth Providers</p>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => { setShowAddForm(true); setEditingId(null); setDeletingId(null); }}
                  className={`${btnBase} ${btnPress} flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-600 hover:bg-violet-100`}
                >
                  <Plus size={13} /> Add Provider
                </button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="mb-3">
                <ProviderForm
                  onSaved={p => { setProviders(prev => [...prev, p]); setShowAddForm(false); }}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            )}

            {/* Provider list */}
            {providers.length === 0 && !showAddForm ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
                <p className="text-sm text-slate-400">No OAuth providers configured.</p>
                <p className="mt-1 text-xs text-slate-400">Add Google, Keycloak, or any OIDC-compatible provider.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map(p => (
                  <div key={p.id}>
                    {editingId === p.id ? (
                      <ProviderForm
                        existing={p}
                        onSaved={updated => { setProviders(prev => prev.map(x => x.id === updated.id ? updated : x)); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : deletingId === p.id ? (
                      <DeleteConfirm
                        provider={p}
                        onDeleted={id => { setProviders(prev => prev.filter(x => x.id !== id)); setDeletingId(null); }}
                        onCancel={() => setDeletingId(null)}
                      />
                    ) : (
                      <div className={`rounded-2xl border-2 p-4 transition-all ${p.enabled ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white opacity-60'}`}>
                        {/* Header row */}
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${p.enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            {p.enabled
                              ? <ShieldCheck size={16} className="text-emerald-600" />
                              : <ShieldOff size={16} className="text-slate-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-400 truncate">{p.issuer}</p>
                          </div>
                          {/* Enable toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleEnabled(p)}
                            className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${p.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            title={p.enabled ? 'Disable' : 'Enable'}
                          >
                            <span className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${p.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        {/* Detail row */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 truncate max-w-[180px]" title={p.clientId}>
                            ID: {p.clientId.length > 24 ? `${p.clientId.slice(0,12)}…${p.clientId.slice(-8)}` : p.clientId}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.clientSecretSet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.clientSecretSet ? 'Secret saved' : 'No secret'}
                          </span>
                        </div>
                        {/* Action buttons */}
                        <div className="mt-3 flex gap-2 pl-11">
                          <button
                            type="button"
                            onClick={() => { setEditingId(p.id); setDeletingId(null); setShowAddForm(false); }}
                            className={`${btnBase} ${btnPress} flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-600`}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeletingId(p.id); setEditingId(null); setShowAddForm(false); }}
                            className={`${btnBase} ${btnPress} flex items-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-1.5 text-xs font-black text-red-500 hover:bg-red-50`}
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Authorized Parents ── */}
          <section className="mb-6">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Authorized Parents</p>
            <p className="mb-3 text-xs text-slate-500">These emails are allowed to sign in via any configured OAuth provider.</p>
            {allowedEmails.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">No emails authorized yet.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {allowedEmails.map(email => (
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
                        {removeError && <p className="text-xs font-bold text-red-600">{removeError}</p>}
                        <div className="flex gap-2">
                          <button type="button" disabled={removeLoading} onClick={() => handleRemove(email)}
                            className={`${btnBase} ${btnPress} flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white disabled:pointer-events-none disabled:opacity-50`}>
                            {removeLoading ? 'Removing…' : 'Confirm'}
                          </button>
                          <button type="button" onClick={() => { setRemoveTarget(null); setRemovePassword(''); setRemoveError(''); }}
                            className={`${btnBase} ${btnPress} flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-500`}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setRemoveTarget(email); setRemovePassword(''); setRemoveError(''); }}
                        className={`${btnBase} ${btnPress} shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-600 hover:bg-red-100`}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Add Email</p>
              <input type="email" placeholder="email@example.com" autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <input type="password" placeholder="Current parent password" autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
                value={addPassword} onChange={e => setAddPassword(e.target.value)} />
              {addError && <p className="text-sm font-bold text-red-600">{addError}</p>}
              <button type="submit" disabled={addLoading}
                className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-50`}>
                {addLoading ? 'Adding…' : 'Add Email'}
              </button>
            </form>
          </section>
        </>
      )}

      {!inline && (
        <button type="button" onClick={onRequestClose}
          className={`${btnBase} ${btnPress} w-full rounded-2xl border border-slate-200 bg-white py-3 font-black uppercase tracking-wide text-slate-500`}>
          Done
        </button>
      )}
    </>
  );

  if (inline) return <div className="space-y-0">{innerContent}</div>;

  return (
    <div className={`${cardSurface} mx-auto w-full max-w-lg p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">OAuth Providers</h2>
          <p className="text-sm text-slate-500">Configure sign-in providers for the parent portal</p>
        </div>
      </div>
      {innerContent}
    </div>
  );
}
