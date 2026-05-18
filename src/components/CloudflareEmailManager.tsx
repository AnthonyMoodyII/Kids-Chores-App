import { useState, useEffect } from 'react';
import { API_URL, cardSurface, btnBase, btnPress } from '../lib/constants';

export function CloudflareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <path fill="#F6821F" d="M322.6 193.2c-4.4 0-8.8.3-13.1.8-6.4-44.5-44.4-78.7-90.5-78.7-50.3 0-91.1 40.8-91.1 91.1 0 1.6.1 3.2.2 4.8C97.7 215.9 72 244.2 72 278.5c0 36.7 29.8 66.5 66.5 66.5h184c36.7 0 66.5-29.8 66.5-66.5 0-36.6-29.7-85.3-66.4-85.3z"/>
    </svg>
  );
}

interface CloudflareEmailManagerProps {
  onRequestClose: () => void;
}

export function CloudflareEmailManager({ onRequestClose }: CloudflareEmailManagerProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/parent/cf-emails`)
      .then(r => r.json())
      .then(d => setEmails(d.emails || []))
      .catch(() => setEmails([]))
      .finally(() => setLoading(false));
  }, []);

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
        setEmails(result.emails);
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
        setEmails(result.emails);
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
    <div className={`${cardSurface} mx-auto w-full max-w-md p-8 md:p-10`}>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
          <CloudflareIcon size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black">Cloudflare Access</h2>
          <p className="text-sm text-slate-500">Manage who can log in via Cloudflare Access</p>
        </div>
      </div>

      {/* Current allowed emails */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
          Authorized emails
        </p>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-slate-400">No emails authorized yet.</p>
        ) : (
          <ul className="space-y-2">
            {emails.map(email => (
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
      </div>

      {/* Add email form */}
      <form onSubmit={handleAdd} className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Add email</p>
        <div>
          <input
            type="email"
            placeholder="email@example.com"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Current parent password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none ring-violet-500/30 focus:ring-2"
            value={addPassword}
            onChange={e => setAddPassword(e.target.value)}
          />
        </div>
        {addError ? <p className="text-sm font-bold text-red-600">{addError}</p> : null}
        <button
          type="submit"
          disabled={addLoading}
          className={`${btnBase} ${btnPress} w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 font-black uppercase tracking-wide text-white shadow-lg shadow-orange-500/25 disabled:pointer-events-none disabled:opacity-50`}
        >
          {addLoading ? 'Adding…' : 'Add Email'}
        </button>
      </form>

      <button
        type="button"
        onClick={onRequestClose}
        className={`${btnBase} ${btnPress} mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 font-black uppercase tracking-wide text-slate-500`}
      >
        Done
      </button>
    </div>
  );
}
