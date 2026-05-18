import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { API_URL, cardSurface, btnBase, btnPress } from '../lib/constants';

interface ChangePasswordFormProps {
  onSuccess: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
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
          <label
            htmlFor="new-parent-user"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
          >
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
          <label
            htmlFor="new-parent-pass"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
          >
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
          <label
            htmlFor="confirm-parent-pass"
            className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
          >
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
