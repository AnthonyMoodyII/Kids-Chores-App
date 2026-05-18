import { useState, useEffect, useMemo } from 'react';
import { Home, LogIn } from 'lucide-react';
import type { User, DayOfWeek } from './types';
import { API_URL, IMG_HOME, IMG_KIDS, btnBase, btnPress } from './lib/constants';
import { readParentSession, writeParentSession } from './lib/session';
import { useChores } from './hooks/useChores';
import { usePayouts } from './hooks/usePayouts';
import { useToast } from './hooks/useToast';
import { MilestoneModal } from './components/MilestoneModal';
import { ChildView } from './views/ChildView';
import { ParentView } from './views/ParentView';

type AppView = 'child' | 'parent';

export default function ChoreApp() {
  // ── Global app state ──────────────────────────────────────────────────────
  const [kids, setKids] = useState<User[]>([]);
  const [view, setView] = useState<AppView>('child');
  const [parentAuthed, setParentAuthed] = useState(readParentSession);
  const [parentTab, setParentTab] = useState<'dashboard' | 'manage'>('dashboard');
  const [activeKidId, setActiveKidId] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [kidsImageBroken, setKidsImageBroken] = useState(false);
  const [milestone, setMilestone] = useState<{
    show: boolean;
    title: string;
    isMilestone: boolean;
  }>({ show: false, title: '', isMilestone: false });

  // ── Domain hooks ──────────────────────────────────────────────────────────
  const {
    chores,
    setChores,
    choreTemplates,
    setChoreTemplates,
    getKidStats,
    handleToggleDay,
    handleApproveChore,
    handleApproveAll,
    handleWeeklyReset,
  } = useChores();

  const {
    payouts,
    setPayouts,
    cashPayments,
    setCashPayments,
    processPayout,
    handleDeletePayout,
    handleClearPayoutHistory,
    handleClearAllPayouts,
    handleAddCashPayment,
    handleDeleteCashPayment,
  } = usePayouts();

  const { toastMsg, showToast } = useToast();

  // ── Bootstrap data from API ───────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [kidsRes, templatesRes, choresRes, payoutsRes, cashRes] = await Promise.all([
          fetch(`${API_URL}/api/kids`),
          fetch(`${API_URL}/api/templates`),
          fetch(`${API_URL}/api/chores`),
          fetch(`${API_URL}/api/payouts`),
          fetch(`${API_URL}/api/cash-payments`),
        ]);

        if (kidsRes.ok) {
          const data: User[] = await kidsRes.json();
          setKids(data);
          if (data.length > 0) setActiveKidId(data[0].id);
        }
        if (templatesRes.ok) setChoreTemplates(await templatesRes.json());
        if (choresRes.ok) setChores(await choresRes.json());
        if (payoutsRes.ok) setPayouts(await payoutsRes.json());
        if (cashRes.ok) setCashPayments(await cashRes.json());
      } catch (error) {
        console.error('Failed to load from backend API', error);
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const leaderboard = useMemo(
    () =>
      kids
        .map(k => ({ ...k, ...getKidStats(k.id) }))
        .sort((a, b) => b.approved - a.approved),
    [kids, getKidStats],
  );

  const topEarner = useMemo(() => {
    const totals = payouts.reduce<Record<string, number>>((acc, payout) => {
      acc[payout.childId] = (acc[payout.childId] || 0) + payout.amount;
      return acc;
    }, {});

    let winnerId: string | null = null;
    let winnerTotal = 0;
    kids.forEach(kid => {
      const total = totals[kid.id] ?? 0;
      if (total > winnerTotal) {
        winnerTotal = total;
        winnerId = kid.id;
      }
    });

    return {
      name: winnerId ? kids.find(k => k.id === winnerId)?.name || '—' : '—',
      amount: winnerTotal,
    };
  }, [kids, payouts]);

  const activeKidStats = useMemo(
    () => getKidStats(activeKidId),
    [activeKidId, getKidStats],
  );

  const weekLabel = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goHome = () => {
    setView('child');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parentSignOut = () => {
    writeParentSession(false);
    setParentAuthed(false);
    setView('child');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navBtn = (active: boolean) =>
    `${btnBase} ${btnPress} px-8 py-3 rounded-[1.75rem] font-black uppercase text-[11px] tracking-wider ${
      active
        ? 'bg-white text-violet-600 shadow-lg shadow-slate-900/10'
        : 'text-slate-500 hover:text-slate-800'
    }`;

  // ── Milestone helper ──────────────────────────────────────────────────────
  const triggerMilestone = (title: string, isMilestone: boolean) => {
    setMilestone({ show: true, title, isMilestone });
    setTimeout(() => setMilestone({ show: false, title: '', isMilestone: false }), 2000);
  };

  // ── Bound handlers that thread in shared dependencies ─────────────────────
  const handleToggle = (choreId: string, day: DayOfWeek) =>
    handleToggleDay(choreId, day, triggerMilestone);

  const handleProcessPayout = (kidId: string) => processPayout(kidId, showToast);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-violet-50/30 to-slate-100 p-4 pb-16 font-sans text-slate-900 md:p-10">
      {/* Milestone popup */}
      {milestone.show && (
        <MilestoneModal title={milestone.title} isMilestone={milestone.isMilestone} />
      )}

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-2xl">
          {toastMsg}
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        {/* ── Header ── */}
        <header className="mb-10 grid gap-8 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="text-left">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                goHome();
              }}
              className={`${btnBase} ${btnPress} mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 text-violet-300 shadow-sm hover:border-violet-400 hover:text-violet-200`}
              aria-label="Home"
            >
              <Home size={22} strokeWidth={2.25} />
            </a>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
              Moody Family Chore App
            </h1>
            <p className="mt-2 text-sm font-medium tracking-wide text-violet-200/70 uppercase">
              Chores and Rewards
            </p>
          </div>
          <div className="flex gap-3 lg:justify-end">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                goHome();
              }}
              className={`${btnBase} ${btnPress} group relative block h-28 w-40 overflow-hidden rounded-3xl shadow-lg shadow-slate-900/15 ring-1 ring-white/50 md:h-32 md:w-44`}
              aria-label="Home — back to kids' view"
            >
              <img
                src={IMG_HOME}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-sm">
                <Home size={12} /> Home
              </span>
            </a>
            <a
              href="#parent"
              onClick={e => {
                e.preventDefault();
                setView('parent');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`${btnBase} ${btnPress} group relative block h-28 w-40 overflow-hidden rounded-3xl shadow-lg shadow-slate-900/15 ring-1 ring-white/50 md:h-32 md:w-44`}
              aria-label="Open parent portal"
            >
              {!kidsImageBroken ? (
                <img
                  src={IMG_KIDS}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={() => setKidsImageBroken(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-violet-100 to-indigo-100 transition-transform duration-300 group-hover:scale-105">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-violet-600 shadow-inner">
                    <LogIn size={28} strokeWidth={2} />
                  </div>
                </div>
              )}
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-sm">
                <LogIn size={12} /> Parent
              </span>
            </a>
          </div>
        </header>

        {/* ── Nav ── */}
        <nav className="mb-10 flex justify-center">
          <div className="flex gap-2 rounded-[2rem] border border-white/60 bg-slate-200/40 p-1.5 shadow-inner backdrop-blur-sm">
            <button type="button" onClick={() => setView('child')} className={navBtn(view === 'child')}>
              KIDS
            </button>
            <button type="button" onClick={() => setView('parent')} className={navBtn(view === 'parent')}>
              Parent
            </button>
          </div>
        </nav>

        {/* ── Views ── */}
        {view === 'parent' ? (
          <ParentView
            parentAuthed={parentAuthed}
            showChangePassword={showChangePassword}
            onLoginSuccess={hasChanged => {
              setParentAuthed(true);
              if (!hasChanged) setShowChangePassword(true);
            }}
            onSignOut={parentSignOut}
            onOpenChangePassword={() => setShowChangePassword(true)}
            onPasswordChanged={() => setShowChangePassword(false)}
            kids={kids}
            setKids={setKids}
            chores={chores}
            setChores={setChores}
            choreTemplates={choreTemplates}
            setChoreTemplates={setChoreTemplates}
            payouts={payouts}
            cashPayments={cashPayments}
            leaderboard={leaderboard}
            topEarner={topEarner}
            getKidStats={getKidStats}
            setActiveKidId={setActiveKidId}
            onApproveChore={handleApproveChore}
            onApproveAll={handleApproveAll}
            onProcessPayout={handleProcessPayout}
            onDeletePayout={handleDeletePayout}
            onClearPayoutHistory={handleClearPayoutHistory}
            onClearAllPayouts={handleClearAllPayouts}
            onAddCashPayment={handleAddCashPayment}
            onDeleteCashPayment={handleDeleteCashPayment}
            onWeeklyReset={handleWeeklyReset}
            onGoToKids={goHome}
            parentTab={parentTab}
            setParentTab={setParentTab}
          />
        ) : (
          <ChildView
            kids={kids}
            activeKidId={activeKidId}
            setActiveKidId={setActiveKidId}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            weekLabel={weekLabel}
            activeKidStats={activeKidStats}
            onToggleDay={handleToggle}
          />
        )}
      </div>
    </div>
  );
}
