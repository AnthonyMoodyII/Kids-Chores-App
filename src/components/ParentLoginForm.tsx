import { useState, useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { API_URL, DEFAULT_PARENT_USERNAME, DEFAULT_PARENT_PASSWORD, cardSurface, btnBase, btnPress } from '../lib/constants';
import { writeParentSession } from '../lib/session';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ParentLoginFormProps {
  onSuccess: (hasChanged: boolean) => void;
  oauthError?: string | null;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export function ParentLoginForm({ onSuccess, oauthError }: ParentLoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

      {/* OAuth error message */}
      {oauthError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {oauthError}
        </p>
      ) : null}

      {/* Google sign-in */}
      <button
        type="button"
        onClick={() => { window.location.href = '/api/parent/oauth/login'; }}
        className={`${btnBase} ${btnPress} inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 font-black text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700`}
      >
        <GoogleIcon />
        Log in with Google
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
