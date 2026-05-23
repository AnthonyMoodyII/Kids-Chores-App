import { DollarSign, ShieldCheck, Trophy, RotateCcw, LogOut, KeyRound, Settings } from 'lucide-react';
import type { User, Chore, ChoreTemplate, PayoutRecord, CashPayment } from '../types';
import type { KidStats } from '../hooks/useChores';
import { btnBase, btnPress, cardSurface } from '../lib/constants';
import { StatCard } from '../components/StatCard';
import { ChoreProgressRows } from '../components/ChoreProgressRows';
import { CashLedger } from '../components/CashLedger';
import { ManageTab } from '../components/ManageTab';
import { ParentLoginForm } from '../components/ParentLoginForm';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { OAuthSettingsManager } from '../components/OAuthSettingsManager';

interface Leaderboard extends User, KidStats {}

interface ParentViewProps {
  // auth
  parentAuthed: boolean;
  showChangePassword: boolean;
  showOAuthSettings: boolean;
  onLoginSuccess: (hasChanged: boolean) => void;
  onSignOut: () => void;
  onOpenChangePassword: () => void;
  onPasswordChanged: () => void;
  onOpenOAuthSettings: () => void;
  onCloseOAuthSettings: () => void;
  oauthError?: string | null;
  // data
  kids: User[];
  chores: Chore[];
  setKids: React.Dispatch<React.SetStateAction<User[]>>;
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  choreTemplates: ChoreTemplate[];
  setChoreTemplates: React.Dispatch<React.SetStateAction<ChoreTemplate[]>>;
  payouts: PayoutRecord[];
  cashPayments: CashPayment[];
  leaderboard: Leaderboard[];
  topEarner: { name: string; amount: number };
  getKidStats: (kidId: string) => KidStats;
  setActiveKidId: (id: string) => void;
  // handlers
  onApproveChore: (choreId: string) => void;
  onApproveAll: () => void;
  onProcessPayout: (kidId: string) => void;
  onDeletePayout: (id: string) => void;
  onClearPayoutHistory: (kidId: string) => void;
  onClearAllPayouts: () => void;
  onAddCashPayment: (kidId: string, kidName: string, amount: string, note: string) => Promise<void>;
  onDeleteCashPayment: (id: string) => void;
  onWeeklyReset: () => void;
  onGoToKids: () => void;
  // tabs
  parentTab: 'dashboard' | 'manage';
  setParentTab: (tab: 'dashboard' | 'manage') => void;
}

export function ParentView({
  parentAuthed,
  showChangePassword,
  showOAuthSettings,
  onLoginSuccess,
  onSignOut,
  onOpenChangePassword,
  onPasswordChanged,
  onOpenOAuthSettings,
  onCloseOAuthSettings,
  oauthError,
  kids,
  chores,
  setKids,
  setChores,
  choreTemplates,
  setChoreTemplates,
  payouts,
  cashPayments,
  leaderboard,
  topEarner,
  getKidStats,
  setActiveKidId,
  onApproveChore,
  onApproveAll,
  onProcessPayout,
  onDeletePayout,
  onClearPayoutHistory,
  onClearAllPayouts,
  onAddCashPayment,
  onDeleteCashPayment,
  onWeeklyReset,
  onGoToKids,
  parentTab,
  setParentTab,
}: ParentViewProps) {
  const tabBtn = (active: boolean) =>
    `${btnBase} ${btnPress} px-4 py-2 rounded-xl text-xs font-black ${
      active ? 'bg-violet-100 text-violet-700 shadow-inner' : 'text-slate-400 hover:text-slate-700'
    }`;

  /* ── Not authed ── */
  if (!parentAuthed) {
    return (
      <div className="animate-in fade-in space-y-4 duration-500">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onGoToKids}
            className={`${btnBase} ${btnPress} text-sm font-bold text-violet-600 hover:text-violet-800`}
          >
            ← Back to kids
          </button>
        </div>
        <ParentLoginForm onSuccess={onLoginSuccess} oauthError={oauthError} />
      </div>
    );
  }

  /* ── Change password overlay (shown after first login or via button) ── */
  if (showChangePassword) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-md">
        <div className="flex min-h-full items-center justify-center py-8">
          <ChangePasswordForm
            onSuccess={onPasswordChanged}
            onCancel={onPasswordChanged}
          />
        </div>
      </div>
    );
  }

  /* ── OAuth Settings overlay ── */
  if (showOAuthSettings) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-md">
        <div className="flex min-h-full items-start justify-center py-8">
          <OAuthSettingsManager onRequestClose={onCloseOAuthSettings} />
        </div>
      </div>
    );
  }

  /* ── Authed dashboard ── */
  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl !font-black !text-slate-900 [text-shadow:0_1px_3px_rgba(15,23,42,0.25)]">Household Hub</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-2xl border border-white/60 bg-white/70 p-1 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setParentTab('dashboard')}
              className={tabBtn(parentTab === 'dashboard')}
            >
              Status
            </button>
            <button
              type="button"
              onClick={() => setParentTab('manage')}
              className={tabBtn(parentTab === 'manage')}
            >
              Manage
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenOAuthSettings}
            className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-violet-200 hover:text-violet-600`}
          >
            <Settings size={16} /> OAuth Settings
          </button>
          <button
            type="button"
            onClick={onOpenChangePassword}
            className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-violet-200 hover:text-violet-600`}
          >
            <KeyRound size={16} /> Change Password
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 hover:border-red-200 hover:text-red-600`}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {parentTab === 'dashboard' ? (
        <div className="animate-in fade-in space-y-8 duration-500">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={<DollarSign />}
              label="Total approved"
              val={`$${leaderboard.reduce((s, k) => s + k.approved, 0).toFixed(2)}`}
              accent="from-emerald-500 to-teal-600"
            />
            <StatCard
              icon={<ShieldCheck />}
              label="Awaiting review"
              val={`${leaderboard.reduce((s, k) => s + k.pending, 0)} tasks`}
              accent="from-amber-500 to-orange-600"
            />
            <StatCard
              icon={<Trophy />}
              label="Top earner"
              val={topEarner.name}
              accent="from-violet-500 to-indigo-600"
            />
          </div>

          {/* Bulk actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Individual payout buttons appear on each child&apos;s card below.
            </p>
            <button
              type="button"
              onClick={onApproveAll}
              disabled={
                !chores.some(c => !c.isArchived && !c.isApproved && c.completedDays.length >= 4)
              }
              className={`${btnBase} ${btnPress} inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-amber-500/25 disabled:pointer-events-none disabled:opacity-30`}
            >
              <ShieldCheck size={16} /> Approve All Eligible
            </button>
          </div>

          {/* Per-kid cards */}
          <div className="space-y-6">
            {kids.map(kid => {
              const stats = getKidStats(kid.id);
              const kidPayouts = payouts.filter(p => p.childId === kid.id);
              const kidCashPayments = cashPayments.filter(p => p.childId === kid.id);
              const totalEarned = kidPayouts.reduce((sum, p) => sum + p.amount, 0);

              return (
                <div key={kid.id} className={`${cardSurface} p-6 md:p-8`}>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-black text-slate-900">{kid.name}&apos;s progress</h3>
                    <button
                      type="button"
                      onClick={() => onProcessPayout(kid.id)}
                      disabled={!stats.canPayout}
                      className={`${btnBase} ${btnPress} rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-500/25 disabled:pointer-events-none disabled:opacity-25`}
                    >
                      Payout
                    </button>
                  </div>

                  <ChoreProgressRows
                    choreList={stats.active}
                    showParentApprove
                    onApprove={onApproveChore}
                  />

                  {/* Payout history */}
                  <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                          Payout history
                        </p>
                        <p className="text-sm text-slate-500">
                          Chores approved and paid out to {kid.name}.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">
                          ${totalEarned.toFixed(2)} total
                        </span>
                        <button
                          type="button"
                          onClick={() => onClearPayoutHistory(kid.id)}
                          className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-rose-600`}
                        >
                          Clear history
                        </button>
                      </div>
                    </div>
                    {kidPayouts.length === 0 ? (
                      <p className="text-sm text-slate-500">No payouts recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {kidPayouts.map(payout => (
                          <div
                            key={payout.id}
                            className="rounded-3xl bg-white p-4 shadow-sm shadow-slate-200/60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-bold text-slate-900">
                                  ${payout.amount.toFixed(2)}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-500">
                                  {new Date(payout.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onDeletePayout(payout.id)}
                                className={`${btnBase} ${btnPress} rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-rose-600`}
                              >
                                Delete
                              </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              {payout.choresPaid.length > 0
                                ? payout.choresPaid.join(', ')
                                : 'Paid out for completed chores.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cash ledger */}
                  <CashLedger
                    kidId={kid.id}
                    kidName={kid.name}
                    kidPayouts={kidPayouts}
                    kidCashPayments={kidCashPayments}
                    onAddPayment={onAddCashPayment}
                    onDeletePayment={onDeleteCashPayment}
                  />
                </div>
              );
            })}
          </div>

          {/* Weekly reset */}
          <section
            className={`${cardSurface} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8`}
          >
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <RotateCcw className="text-violet-600" size={22} /> End of week reset
              </h3>
              <p className="max-w-xl text-sm text-slate-500">
                Start a fresh week for everyone. Clears progress on active chores (not archived).
                Typical use: Sunday evening.
              </p>
            </div>
            <button
              type="button"
              onClick={onWeeklyReset}
              className={`${btnBase} ${btnPress} shrink-0 rounded-2xl border border-slate-200 bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-slate-900/25`}
            >
              Reset week
            </button>
          </section>

          {/* Clear all payouts */}
          <section className={`${cardSurface} p-6 md:p-8`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Clear all payout history</h3>
                <p className="text-sm text-slate-500">
                  Remove every payout record from the system. Use this when you want to reset
                  payout history completely.
                </p>
                <p className="text-sm font-bold text-rose-600">This action is irreversible.</p>
              </div>
              <button
                type="button"
                onClick={onClearAllPayouts}
                className={`${btnBase} ${btnPress} rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-rose-500/20`}
              >
                Clear all payouts
              </button>
            </div>
          </section>
        </div>
      ) : (
        <ManageTab
          kids={kids}
          setKids={setKids}
          chores={chores}
          setChores={setChores}
          choreTemplates={choreTemplates}
          setChoreTemplates={setChoreTemplates}
          setActiveKidId={setActiveKidId}
        />
      )}
    </div>
  );
}
