import { useState } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import { btnBase, btnPress } from '../lib/constants';

interface SuggestRewardFormProps {
  kidId: string;
  kidName: string;
  onSubmit: (title: string, description?: string) => Promise<void>;
}

export function SuggestRewardForm({ kidId: _kidId, kidName: _kidName, onSubmit }: SuggestRewardFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit(title.trim(), description.trim() || undefined);
      setSent(true);
      setTitle('');
      setDescription('');
      setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black uppercase tracking-wide text-violet-600 hover:bg-violet-100`}
      >
        <Lightbulb size={16} /> Suggest a Reward Idea
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb size={18} className="text-violet-600" />
        <p className="font-black text-violet-800">Suggest a new reward</p>
      </div>
      {sent ? (
        <p className="py-4 text-center text-sm font-bold text-emerald-600">
          ✅ Idea sent to your parents!
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="What reward would you like? (e.g. Extra recess time)"
            className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none ring-violet-500/30 focus:ring-2"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Why do you want this? (optional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-violet-500/30 focus:ring-2"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className={`${btnBase} ${btnPress} flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-black text-white disabled:pointer-events-none disabled:opacity-40`}
            >
              <Send size={14} /> {loading ? 'Sending…' : 'Send to Parent'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
