import { useState, useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { API_URL, DEFAULT_PARENT_USERNAME, DEFAULT_PARENT_PASSWORD, cardSurface, btnBase, btnPress } from '../lib/constants';
import { writeParentSession } from '../lib/session';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ParentLoginFormProps {
  onSuccess: (hasChanged: boolean) => void;
}

function CloudflareIcon() {
  return (
    <svg viewBox="0 0 512 512" width="20" height="20" aria-hidden="true">
      <path fill="#F6821F" d="M322.6 193.2c-4.4 0-8.8.3-13.1.8-6.4-44.5-44.4-78.7-90.5-78.7-50.3 0-91.1 40.8-91.1 91.1 0 1.6.1 3.2.2 4.8C97.7 215.9 72 244.2 72 278.5c0 36.7 29.8 66.5 66.5 66.5h184c36.7 0 66.5-29.8 66.5-66.5 0-36.6-29.7-85.3-66.4-85.3z"/>
    </svg>
  );
}

export function ParentLoginForm({ onSuccess }: ParentLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [hasChanged, setHasChanged] = useState<boolean | null>(null);
  const [showEmergencyReset, setShowEmergencyReset] = useState(false);

  // Check whether the default password has been changed yet
  useEffect(() => {
    fetch(`${API_URL}/api/parent/status`)
      .then(r => r.json())
      .then(d => setHasChanged(d.hasChanged ?? false))
      .catch(() => setHasChanged(false));
  }, []);

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

  const handleCloudflareLogin = async () => {
    setCfLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/parent/cloudflare-auth`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        writeParentSession(true);
        onSuccess(result.hasChanged ?? true);
      } else {
        setError(result.error || 'Cloudflare Access sign-in failed.');
      }
    } catch {
      setError('Cloudflare Access sign-in failed. Are you on the tunnel URL?');
    } finally {
      setCfLoading(false);
    }
  };

  // Show emergency reset form instead of login form
  if (showEmergencyReset) {
    return (
      <ChangePasswordForm
        emergencyMode
        onSuccess={() => {
          setShowEmergencyReset(false);
          setError('');
          setPassword('');
        }}
        onCancel={() => setShowEmergencyReset(false)}
      />
    );
  }

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
          <label
            htmlFor="parent-user"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
          >
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
          <label
            htmlFor="parent-pass"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
          >
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

      {/* OR divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Cloudflare Access sign-in */}
      <button
        type="button"
        onClick={handleCloudflareLogin}
        disabled={cfLoading}
        className={`${btnBase} ${btnPress} inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 font-black text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:pointer-events-none disabled:opacity-50`}
      >
        <CloudflareIcon />
        {cfLoading ? 'Signing in…' : 'Log in with Cloudflare Access'}
      </button>

      <div className="mt-6 space-y-2 text-center">
        {/* Only show default credentials hint before password has been changed */}
        {hasChanged === false && (
          <p className="text-xs text-slate-400">
            Default credentials: username{' '}
            <code className="rounded bg-slate-100 px-1">{DEFAULT_PARENT_USERNAME}</code>, password{' '}
            <code className="rounded bg-slate-100 px-1">{DEFAULT_PARENT_PASSWORD}</code>
          </p>
        )}
        <button
          type="button"
          onClick={() => setShowEmergencyReset(true)}
          className={`${btnBase} text-xs font-bold text-violet-500 hover:text-violet-700 underline underline-offset-2`}
        >
          Forgot password? Use emergency reset
        </button>
      </div>
    </div>
  );
}
