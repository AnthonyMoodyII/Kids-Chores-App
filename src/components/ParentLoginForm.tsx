import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { API_URL, DEFAULT_PARENT_USERNAME, DEFAULT_PARENT_PASSWORD, cardSurface, btnBase, btnPress } from '../lib/constants';
import { writeParentSession } from '../lib/session';

interface ParentLoginFormProps {
  onSuccess: (hasChanged: boolean) => void;
}

export function ParentLoginForm({ onSuccess }: ParentLoginFormProps) {
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
      <p className="mt-6 text-center text-xs text-slate-400">
        Default credentials: username{' '}
        <code className="rounded bg-slate-100 px-1">{DEFAULT_PARENT_USERNAME}</code>, password{' '}
        <code className="rounded bg-slate-100 px-1">{DEFAULT_PARENT_PASSWORD}</code>
      </p>
    </div>
  );
}
