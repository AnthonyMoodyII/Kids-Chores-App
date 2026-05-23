import { useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { API_URL, cardSurface, btnBase, btnPress } from '../lib/constants';

interface ChangePasswordFormProps {
  /** When true the form shows the emergency reset flow (uses reset code, no current password). */
  emergencyMode?: boolean;
  /** When true renders without the card wrapper / header — for embedding in a Settings accordion. */
  inline?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function ChangePasswordForm({ emergencyMode = false, inline = false, onSuccess, onCancel }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
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
      if (emergencyMode) {
        // Emergency reset — sends reset code, no current password needed
        const response = await fetch(`${API_URL}/api/parent/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetCode, username: newUsername.trim(), password: newPassword }),
        });
        const result = await response.json();
        if (result.success) {
          onSuccess();
        } else {
          setError(result.error || 'Reset failed. Check your reset code.');
        }
      } else {
        // Normal change — requires current password
        const response = await fetch(`${API_URL}/api/parent/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: newUsername.trim(),
            password: newPassword,
            currentPassword,
          }),
        });
        const result = await response.json();
        if (result.success) {
          onSuccess();
        } else {
          setError(result.error || 'Failed to update credentials.');
        }
      }
    } catch {
      setError('Request failed. Check your connection.');
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
        {emergencyMode ? (
          <div>
            <label
              htmlFor="reset-code"
              className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
            >
              Reset Code
            </label>
            <input
              id="reset-code"
              type="password"
              autoComplete="off"
              placeholder="Enter your server reset code"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
              value={resetCode}
              onChange={e => setResetCode(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Set as <code className="rounded bg-slate-100 px-1">PARENT_RESET_CODE</code> in your docker-compose.yml
            </p>
          </div>
        ) : (
          <div>
            <label
              htmlFor="current-pass"
              className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400"
            >
              Current Password
            </label>
            <input
              id="current-pass"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
          </div>
        )}

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
            Confirm New Password
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
          {emergencyMode ? 'Reset Credentials' : 'Save New Credentials'}
        </button>

        {onCancel && !inline && (
          <button
            type="button"
            onClick={onCancel}
            className={`${btnBase} ${btnPress} w-full rounded-2xl border border-slate-200 bg-white py-3 font-black uppercase tracking-wide text-slate-500`}
          >
            Cancel
          </button>
        )}
    </form>
  );

  if (inline) return formContent;

  return (
    <div className={`${cardSurface} mx-auto max-w-md p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          {emergencyMode ? <KeyRound size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">
            {emergencyMode ? 'Emergency Reset' : 'Change Credentials'}
          </h2>
          <p className="text-sm text-slate-500">
            {emergencyMode
              ? 'Enter your server reset code to regain access'
              : 'Update your parent login details'}
          </p>
        </div>
      </div>
      {formContent}
    </div>
  );
}
