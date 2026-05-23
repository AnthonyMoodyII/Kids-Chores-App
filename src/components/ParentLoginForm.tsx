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
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
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
