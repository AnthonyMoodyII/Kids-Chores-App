import { useState, useEffect, useMemo } from 'react';
import { Home, LogIn } from 'lucide-react';
import type { User, DayOfWeek } from './types';
import { API_URL, IMG_HOME, btnBase, btnPress } from './lib/constants';
import { readParentSession, writeParentSession } from './lib/session';
import { useChores } from './hooks/useChores';
import { usePayouts } from './hooks/usePayouts';
import { usePoints } from './hooks/usePoints';
import { useRewards } from './hooks/useRewards';
import { useToast } from './hooks/useToast';
import { useDailySelections, getWeekOf } from './hooks/useDailySelections';
import { MilestoneModal } from './components/MilestoneModal';
import { ChildView } from './views/ChildView';
import { ParentView } from './views/ParentView';

type AppView = 'child' | 'parent';

export default function ChoreApp() {
  // ── Global app state ──────────────────────────────────────────────────────
  const [kids, setKids] = useState<User[]>([]);
  const [view, setView] = useState<AppView>('child');
  const [parentAuthed, setParentAuthed] = useState(readParentSession);
  const [parentTab, setParentTab] = useState<'dashboard' | 'manage' | 'settings'>('dashboard');
  const [activeKidId, setActiveKidId] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showOAuthSettings, setShowOAuthSettings] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
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

  const {
    pointBalances,
    setPointBalances,
    redemptions,
    setRedemptions,
    redemptionRequests,
    setRedemptionRequests,
    refreshBalances,
    approveRedemptionRequest,
    rejectRedemptionRequest,
    redeemReward,
    deleteRedemption,
    markRedemptionUsed,
    markRedemptionUnused,
    requestRedemptionUse,
    approveRedemptionUse,
    denyRedemptionUse,
  } = usePoints();

  const {
    rewards,
    setRewards,
    rewardRequests,
    setRewardRequests,
    updateReward,
    addReward,
    deleteReward,
    submitRewardIdea,
    approveRewardRequest,
    rejectRewardRequest,
  } = useRewards();

  // Per-kid point ledger (used in ChildView for daily chart)
  const [ledger, setLedger] = useState<import('./types').PointLedgerEntry[]>([]);

  // ── Daily selections (optional chore pool) ────────────────────────────────
  const {
    dailySelections,
    refreshSelections,
    pickChore,
    completeChore,
    uncompleteChore,
    unpickChore,
  } = useDailySelections();

  const { toastMsg, showToast } = useToast();

  // ── Handle OAuth redirect params ─────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('parent_authed') === '1') {
      writeParentSession(true);
      setParentAuthed(true);
      setView('parent');
      window.history.replaceState({}, '', '/');
    }
    const err = params.get('oauth_error');
    if (err) {
      setOauthError(decodeURIComponent(err));
      setView('parent');
      window.history.replaceState({}, '', '/');
    }
    const approval = params.get('reward_approval');
    if (approval === 'approved') {
      const kid = params.get('kid') || 'Kid';
      const reward = params.get('reward') || 'reward';
      showToast(`✅ Approved! ${kid}'s "${reward}" is now in their stash.`);
      window.history.replaceState({}, '', '/');
    } else if (approval === 'denied') {
      const kid = params.get('kid') || 'Kid';
      const reward = params.get('reward') || 'reward';
      showToast(`❌ Denied. ${kid}'s request for "${reward}" was declined.`);
      window.history.replaceState({}, '', '/');
    } else if (approval === 'already_approved') {
      showToast('This reward was already approved.');
      window.history.replaceState({}, '', '/');
    } else if (approval === 'already_handled') {
      showToast('This reward request was already handled.');
      window.history.replaceState({}, '', '/');
    }
    const rewardUse = params.get('reward_use');
    if (rewardUse === 'approved') {
      const kid = params.get('kid') || 'Kid';
      const reward = params.get('reward') || 'reward';
      showToast(`✅ Approved! ${kid} can now use "${reward}"!`);
      window.history.replaceState({}, '', '/');
    } else if (rewardUse === 'denied') {
      const kid = params.get('kid') || 'Kid';
      const reward = params.get('reward') || 'reward';
      showToast(`❌ Denied. ${kid}'s request to use "${reward}" was declined.`);
      window.history.replaceState({}, '', '/');
    } else if (rewardUse === 'already_handled') {
      showToast('This reward use request was already handled.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // ── Bootstrap data from API ───────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [
          kidsRes, templatesRes, choresRes, payoutsRes, cashRes,
          rewardsRes, balancesRes, redemptionsRes, redemptionReqsRes, rewardReqsRes,
        ] = await Promise.all([
          fetch(`${API_URL}/api/kids`),
          fetch(`${API_URL}/api/templates`),
          fetch(`${API_URL}/api/chores`),
          fetch(`${API_URL}/api/payouts`),
          fetch(`${API_URL}/api/cash-payments`),
          fetch(`${API_URL}/api/rewards`),
          fetch(`${API_URL}/api/points/balance`),
          fetch(`${API_URL}/api/points/redemptions`),
          fetch(`${API_URL}/api/redemption-requests`),
          fetch(`${API_URL}/api/reward-requests`),
        ]);

        if (kidsRes.ok) {
          const data: User[] = await kidsRes.json();
          setKids(data);
          if (data.length > 0) {
            setActiveKidId(data[0].id);
            // Fetch all kids' daily selections in one request
            refreshSelections();
          }
        }
        if (templatesRes.ok) setChoreTemplates(await templatesRes.json());
        if (choresRes.ok) setChores(await choresRes.json());
        if (payoutsRes.ok) setPayouts(await payoutsRes.json());
        if (cashRes.ok) setCashPayments(await cashRes.json());
        if (rewardsRes.ok) setRewards(await rewardsRes.json());
        if (balancesRes.ok) setPointBalances(await balancesRes.json());
        if (redemptionsRes.ok) setRedemptions(await redemptionsRes.json());
        if (redemptionReqsRes.ok) setRedemptionRequests(await redemptionReqsRes.json());
        if (rewardReqsRes.ok) setRewardRequests(await rewardReqsRes.json());
      } catch (error) {
        console.error('Failed to load from backend API', error);
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ledger for active kid when switching kids (lazy)
  useEffect(() => {
    if (!activeKidId) return;
    fetch(`${API_URL}/api/points/ledger/${activeKidId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setLedger(prev => {
        // Merge: replace entries for this kid
        const others = prev.filter(e => e.childId !== activeKidId);
        return [...others, ...data];
      }))
      .catch(() => {});
  }, [activeKidId]);

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
    `${btnBase} ${btnPress} px-7 py-2.5 rounded-[1.5rem] font-semibold text-sm tracking-tight ${
      active
        ? 'bg-white text-violet-600 shadow-md shadow-slate-900/10'
        : 'text-slate-500 hover:text-slate-700'
    }`;

  // ── Milestone helper ──────────────────────────────────────────────────────
  const triggerMilestone = (title: string, isMilestone: boolean) => {
    setMilestone({ show: true, title, isMilestone });
    setTimeout(() => setMilestone({ show: false, title: '', isMilestone: false }), 2000);
  };

  // ── Void-returning wrappers for hook functions that return values ─────────
  const handleRedeemReward = async (childId: string, rewardTemplateId: string): Promise<void> => {
    await redeemReward(childId, rewardTemplateId);
  };
  const handleUpdateReward = async (id: string, patch: Partial<import('./types').RewardTemplate>): Promise<void> => {
    await updateReward(id, patch);
  };
  const handleAddReward = async (title: string, pointCost: number, icon: string, description?: string): Promise<void> => {
    await addReward(title, pointCost, icon, description);
  };
  const handleSubmitRewardIdea = async (childId: string, childName: string, title: string, description?: string): Promise<void> => {
    await submitRewardIdea(childId, childName, title, description);
  };
  const handleCashToPoints = async (childId: string, childName: string, dollarAmount: number): Promise<void> => {
    const res = await fetch(`${API_URL}/api/cash-to-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, childName, dollarAmount }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Conversion failed');
    }
    const { cashPayment } = await res.json();
    // Update local cash payments + refresh point balance
    setCashPayments(prev => [cashPayment, ...prev]);
    await refreshBalances();
    // Refresh ledger for this kid
    const ledgerData = await fetch(`${API_URL}/api/points/ledger/${childId}`).then(r => r.ok ? r.json() : null);
    if (ledgerData) setLedger(prev => [...prev.filter(e => e.childId !== childId), ...ledgerData]);
  };

  // ── Pool templates (isInPool, not false) ──────────────────────────────────
  const poolTemplates = useMemo(
    () => choreTemplates.filter(t => t.isInPool !== false),
    [choreTemplates],
  );

  // Mandatory template IDs assigned to the active kid (to exclude from pool)
  const activeKidMandatoryTemplateIds = useMemo(() => {
    const assigned = chores
      .filter(c => c.assignedTo === activeKidId && !c.isArchived && c.templateId)
      .map(c => c.templateId as string);
    return new Set(assigned);
  }, [chores, activeKidId]);

  // Pool shown to kids = isInPool, not mandatory-assigned to this kid
  const kidPoolTemplates = useMemo(
    () => poolTemplates.filter(t => !activeKidMandatoryTemplateIds.has(t.id)),
    [poolTemplates, activeKidMandatoryTemplateIds],
  );

  // ── Optional chore handlers ───────────────────────────────────────────────
  const handlePickChore = async (templateId: string): Promise<void> => {
    const activeKid = kids.find(k => k.id === activeKidId);
    if (!activeKid) return;
    await pickChore(activeKidId, activeKid.name, templateId, selectedDay);
    await refreshBalances();
  };

  const handleCompleteOptional = async (selectionId: string): Promise<void> => {
    await completeChore(selectionId);
    await refreshBalances();
    // Refresh ledger so "+today" counter updates immediately
    if (activeKidId) {
      const data = await fetch(`${API_URL}/api/points/ledger/${activeKidId}`).then(r => r.ok ? r.json() : null);
      if (data) setLedger(prev => [...prev.filter(e => e.childId !== activeKidId), ...data]);
    }
  };

  const handleUncompleteOptional = async (selectionId: string): Promise<void> => {
    await uncompleteChore(selectionId);
    await refreshBalances();
    // Refresh ledger so "+today" counter updates immediately
    if (activeKidId) {
      const data = await fetch(`${API_URL}/api/points/ledger/${activeKidId}`).then(r => r.ok ? r.json() : null);
      if (data) setLedger(prev => [...prev.filter(e => e.childId !== activeKidId), ...data]);
    }
  };

  const handleUnpickChore = async (selectionId: string): Promise<void> => {
    await unpickChore(selectionId);
  };

  // ── Bound handlers that thread in shared dependencies ─────────────────────
  const handleToggle = async (choreId: string, day: DayOfWeek) => {
    // ── Optimistic points update (immediate, before server round-trip) ──
    const chore = chores.find(c => c.id === choreId);
    if (chore) {
      const ptsPerDay = Math.max(10, 10 + Math.round(chore.baseValue * 4));
      const isCurrentlyDone = chore.completedDays.includes(day);
      const delta = isCurrentlyDone ? -ptsPerDay : ptsPerDay;

      setPointBalances(prev => ({
        ...prev,
        [chore.assignedTo]: Math.max(0, (prev[chore.assignedTo] ?? 0) + delta),
      }));

      if (!isCurrentlyDone) {
        const optimisticEntry: import('./types').PointLedgerEntry = {
          id: `opt-${Date.now()}`,
          childId: chore.assignedTo,
          amount: ptsPerDay,
          reason: `Completed: ${chore.title} (${day})`,
          choreId: chore.id,
          createdAt: new Date().toISOString(),
        };
        setLedger(prev => [optimisticEntry, ...prev]);
      } else {
        // Remove matching optimistic/real entry for this chore+day
        setLedger(prev =>
          prev.filter(
            e => !(e.choreId === chore.id && e.reason.includes(`(${day})`) && e.amount > 0),
          ),
        );
      }
    }

    // ── Server-confirmed update ──
    await handleToggleDay(choreId, day, triggerMilestone);

    // Authoritative refresh — replace optimistic data with real server state
    const [, ledgerData] = await Promise.all([
      refreshBalances(),
      activeKidId
        ? fetch(`${API_URL}/api/points/ledger/${activeKidId}`).then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
    ]);
    if (ledgerData) {
      setLedger(prev => [
        ...prev.filter(e => e.childId !== activeKidId),
        ...ledgerData,
      ]);
    }
  };

  const handleProcessPayout = (kidId: string, customAmount?: number) => processPayout(kidId, showToast, customAmount);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f6f3] p-4 pb-16 font-sans text-slate-900 md:p-10">
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
        <header className="mb-10 grid gap-8 rounded-[2rem] bg-[#0d0b1a] p-8 shadow-2xl shadow-slate-900/40 lg:grid-cols-[1fr_auto] lg:items-center">
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
            <p className="mt-2 text-sm font-medium text-violet-200/60">
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
              className={`${btnBase} ${btnPress} group relative flex h-28 w-40 flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-violet-800 to-indigo-900 shadow-lg shadow-slate-900/40 ring-1 ring-violet-500/40 md:h-32 md:w-44`}
              aria-label="Open parent portal"
            >
              {/* Generic parent "P" logo */}
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-violet-400/40 bg-white/10 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                <span className="text-3xl font-black text-white" style={{ fontFamily: 'serif' }}>P</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-200">Parent</span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-violet-200">
                <LogIn size={10} /> Login
              </span>
              <span className="absolute top-2 left-2 rounded-full bg-black/30 px-1.5 py-0.5 text-[8px] font-bold text-violet-300/70 tabular-nums">
                v{__APP_VERSION__}
              </span>
            </a>
          </div>
        </header>

        {/* ── Nav ── */}
        <nav className="mb-10 flex justify-center">
          <div className="flex gap-1.5 rounded-[2rem] border border-slate-200/60 bg-white p-1.5 shadow-sm">
            <button type="button" onClick={() => setView('child')} className={navBtn(view === 'child')}>
              Kids
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
            showOAuthSettings={showOAuthSettings}
            onLoginSuccess={hasChanged => {
              setParentAuthed(true);
              setOauthError(null);
              if (!hasChanged) setShowChangePassword(true);
            }}
            onSignOut={parentSignOut}
            onOpenChangePassword={() => setShowChangePassword(true)}
            onPasswordChanged={() => setShowChangePassword(false)}
            onOpenOAuthSettings={() => setShowOAuthSettings(true)}
            onCloseOAuthSettings={() => setShowOAuthSettings(false)}
            oauthError={oauthError}
            onClearOauthError={() => setOauthError(null)}
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
            pointBalances={pointBalances}
            ledger={ledger}
            rewards={rewards}
            redemptions={redemptions}
            redemptionRequests={redemptionRequests}
            rewardRequests={rewardRequests}
            onApproveRedemptionRequest={approveRedemptionRequest}
            onRejectRedemptionRequest={rejectRedemptionRequest}
            onDeleteRedemption={deleteRedemption}
            onMarkRedemptionUsed={markRedemptionUsed}
            onMarkRedemptionUnused={markRedemptionUnused}
            onApproveRedemptionUse={approveRedemptionUse}
            onDenyRedemptionUse={denyRedemptionUse}
            onRedeemReward={handleRedeemReward}
            onUpdateReward={handleUpdateReward}
            onAddReward={handleAddReward}
            onDeleteReward={deleteReward}
            onApproveRewardRequest={approveRewardRequest}
            onRejectRewardRequest={rejectRewardRequest}
          />
        ) : (
          <ChildView
            kids={kids}
            activeKidId={activeKidId}
            pointBalances={pointBalances}
            setActiveKidId={id => {
              setActiveKidId(id);
              refreshSelections();
            }}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            weekLabel={weekLabel}
            activeKidStats={activeKidStats}
            onToggleDay={handleToggle}
            poolTemplates={kidPoolTemplates}
            dailySelections={dailySelections.filter(s => s.weekOf === getWeekOf())}
            onPickChore={handlePickChore}
            onCompleteOptional={handleCompleteOptional}
            onUncompleteOptional={handleUncompleteOptional}
            onUnpickChore={handleUnpickChore}
            kidBalance={pointBalances[activeKidId] ?? 0}
            ledger={ledger}
            rewards={rewards}
            redemptions={redemptions}
            onBuyReward={handleRedeemReward}
            onRequestRedemptionUse={requestRedemptionUse}
            onSubmitRewardIdea={handleSubmitRewardIdea}
            payouts={payouts}
            cashPayments={cashPayments}
            onCashToPoints={handleCashToPoints}
          />
        )}
      </div>
    </div>
  );
}
