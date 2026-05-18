import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CashPayment, PayoutRecord } from '../types';
import { btnBase, btnPress } from '../lib/constants';

interface CashLedgerProps {
  kidId: string;
  kidName: string;
  kidPayouts: PayoutRecord[];
  kidCashPayments: CashPayment[];
  onAddPayment: (kidId: string, kidName: string, amount: string, note: string) => Promise<void>;
  onDeletePayment: (paymentId: string) => void | Promise<void>;
}

export function CashLedger({
  kidId,
  kidName,
  kidPayouts,
  kidCashPayments,
  onAddPayment,
  onDeletePayment,
}: CashLedgerProps) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const totalEarned = kidPayouts.reduce((sum, p) => sum + p.amount, 0);
  const totalCashPaid = kidCashPayments.reduce((sum, p) => sum + p.amount, 0);
  const balanceOwed = Math.round((totalEarned - totalCashPaid) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddPayment(kidId, kidName, amount, note);
    setShowForm(false);
    setAmount('');
    setNote('');
  };

  return (
    <div className="mt-6 rounded-[2rem] border border-emerald-100 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">Cash Ledger</p>
          <p className="text-sm text-slate-500">Track actual cash given to {kidName}.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(prev => !prev);
            setAmount('');
            setNote('');
          }}
          className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25`}
        >
          <Plus size={14} /> Mark Payment
        </button>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Earned</p>
          <p className="text-lg font-black text-slate-800">${totalEarned.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paid Out</p>
          <p className="text-lg font-black text-emerald-700">${totalCashPaid.toFixed(2)}</p>
        </div>
        <div
          className={`rounded-2xl border p-3 ${
            balanceOwed > 0 ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owed</p>
          <p
            className={`text-lg font-black ${balanceOwed > 0 ? 'text-red-600' : 'text-emerald-700'}`}
          >
            ${balanceOwed.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Add payment form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="w-full rounded-xl border border-white bg-white px-3 py-2.5 font-bold text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Sunday allowance"
                className="w-full rounded-xl border border-white bg-white px-3 py-2.5 font-bold text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className={`${btnBase} ${btnPress} flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md shadow-emerald-500/20`}
            >
              Save Payment
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-500`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Payment history */}
      {kidCashPayments.length === 0 ? (
        <p className="text-sm text-slate-500">No cash payments recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {kidCashPayments.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="font-bold text-emerald-700">${p.amount.toFixed(2)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(p.timestamp).toLocaleDateString()}
                  {p.note ? ` — ${p.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDeletePayment(p.id)}
                className={`${btnBase} ${btnPress} rounded-xl p-2 text-slate-300 hover:text-red-500`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
