import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Circle, Wallet, PiggyBank, Star, Sparkles, PartyPopper, Target, Gift } from 'lucide-react';
import { DollarSign, ArrowRightLeft } from 'lucide-react';
import type { User, DayOfWeek, ChoreTemplate, DailyChoreSelection, RewardTemplate, RewardRedemption, PointLedgerEntry, PayoutRecord, CashPayment } from '../types';
import type { KidStats } from '../hooks/useChores';
import { btnBase, btnPress, cardSurface, fmtPts } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';


import { PointsDailyChart } from '../components/PointsDailyChart';
import { RewardsCatalog } from '../components/RewardsCatalog';
import { SuggestRewardForm } from '../components/SuggestRewardForm';
import { MissionBoard } from '../components/MissionBoard';
import { Leaderboard } from '../components/Leaderboard';

import { RewardInventory } from '../components/RewardInventory';

interface ChildViewProps {
  kids: User[];
  activeKidId: string;
  setActiveKidId: (id: string) => void;
  pointBalances: Record<string, number>;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  weekLabel: string;
  activeKidStats: KidStats;
  onToggleDay: (choreId: string, day: DayOfWeek) => void;
  // Mission Board (optional pool)
  poolTemplates: ChoreTemplate[];
  dailySelections: DailyChoreSelection[];     // ALL kids' selections (for global limit checks)
  onPickChore: (templateId: string) => Promise<void>;
  onCompleteOptional: (selectionId: string) => Promise<void>;
  onUncompleteOptional: (selectionId: string) => Promise<void>;
  onUnpickChore: (selectionId: string) => Promise<void>;
  // Points & Rewards
  kidBalance: number;
  ledger: PointLedgerEntry[];
  rewards: RewardTemplate[];
  redemptions: RewardRedemption[];
  onBuyReward: (childId: string, rewardTemplateId: string) => Promise<void>;
  onRequestRedemptionUse: (id: string) => Promise<void>;
  onSubmitRewardIdea: (childId: string, childName: string, title: string, description?: string) => Promise<void>;
  // Cash → Points
  payouts: PayoutRecord[];
  cashPayments: CashPayment[];
  onCashToPoints: (childId: string, childName: string, dollarAmount: number) => Promise<void>;
}

function useGoalRewardIds(kidId: string) {
  const storageKey = `goal_rewards_${kidId}`;
  const [goalRewardIds, setGoalRewardIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(goalRewardIds));
    } catch { /* ignore */ }
  }, [goalRewardIds, storageKey]);

  const toggleGoal = (id: string) => {
    setGoalRewardIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id],
    );
  };

  return { goalRewardIds, toggleGoal };
}

export function ChildView({
  kids,
  activeKidId,
  setActiveKidId,
  pointBalances,
  selectedDay,
  setSelectedDay,
  weekLabel,
  activeKidStats,
  onToggleDay,
  poolTemplates,
  dailySelections,
  onPickChore,
  onCompleteOptional,
  onUncompleteOptional,
  onUnpickChore,
  kidBalance,
  ledger: _ledger,
  rewards,
  redemptions,
  onBuyReward,
  onRequestRedemptionUse,
  onSubmitRewardIdea,
  payouts,
  cashPayments,
  onCashToPoints,
}: ChildViewProps) {
  const { goalRewardIds, toggleGoal } = useGoalRewardIds(activeKidId);
  const activeKid = kids.find(k => k.id === activeKidId);

  // Independent day filter for the weekly progress section (null = show all week)
  const [progressDay, setProgressDay] = useState<DayOfWeek | null>(null);
  // Reset when switching kids
  useEffect(() => { setProgressDay(null); }, [activeKidId]);

  const activeRewards = rewards.filter(r => r.isActive);
  const cheapestAffordable = activeRewards
    .filter(r => kidBalance >= r.pointCost)
    .sort((a, b) => a.pointCost - b.pointCost)[0];

  // Weekly money & pts (hoisted so they're available in both header and summary tile)
  // Helper for progress section day view
  const ptsPerDay = (baseValue: number) => Math.max(10, 10 + Math.round(baseValue * 4));
  const kidSelections = useMemo(
    () => dailySelections.filter(s => s.childId === activeKidId),
    [dailySelections, activeKidId],
  );

  // Hoisted weekly money totals (available in header chips + summary tile)
  const weekMandatoryMoney = useMemo(
    () => activeKidStats.active.reduce((s, c) => s + getChoreEarnedAmount(c.completedDays.length, c.baseValue), 0),
    [activeKidStats.active],
  );
  const weekOptionalMoney = useMemo(
    () => kidSelections.filter(s => s.completions > 0).reduce((s, sel) => s + sel.completions * (sel.baseValue / 5), 0),
    [kidSelections],
  );
  // Chores/picks for the selected progress day
  const dayMandatoryDone = useMemo(
    () => progressDay ? activeKidStats.active.filter(c => c.completedDays.includes(progressDay)) : [],
    [progressDay, activeKidStats.active],
  );
  const dayMandatoryMissed = useMemo(
    () => progressDay ? activeKidStats.active.filter(c => !c.completedDays.includes(progressDay)) : [],
    [progressDay, activeKidStats.active],
  );
  const dayOptionalPicks = useMemo(
    () => progressDay ? kidSelections.filter(s => s.day === progressDay) : [],
    [progressDay, kidSelections],
  );
  const dayTotalPts = useMemo(() => {
    if (!progressDay) return 0;
    const mPts = dayMandatoryDone.reduce((s, c) => s + ptsPerDay(c.baseValue), 0);
    const oPts = dayOptionalPicks
      .filter(s => s.completions > 0)
      .reduce((s, sel) => s + ptsPerDay(sel.baseValue) * sel.completions, 0);
    return mPts + oPts;
  }, [progressDay, dayMandatoryDone, dayOptionalPicks]);

  // Money owed to this kid (PayoutRecords - CashPayments)
  const totalEarned = payouts
    .filter(p => p.childId === activeKidId)
    .reduce((s, p) => s + p.amount, 0);
  const totalPaid = cashPayments
    .filter(p => p.childId === activeKidId)
    .reduce((s, p) => s + p.amount, 0);
  const moneyOwed = Math.max(0, Math.round((totalEarned - totalPaid) * 100) / 100);

  // Cash → Points conversion state
  const [convertAmount, setConvertAmount] = useState(0.5);
  const [converting, setConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState(false);
  const convertPoints = Math.round(convertAmount * 100);
  // Build $0.50 increment steps up to owed amount
  const maxSteps = Math.floor(moneyOwed / 0.5);
  const convertSteps = Array.from({ length: maxSteps }, (_, i) => Math.round((i + 1) * 0.5 * 100) / 100);

  const handleConvert = async () => {
    if (!activeKid || converting || convertAmount > moneyOwed) return;
    setConverting(true);
    try {
      await onCashToPoints(activeKidId, activeKid.name, convertAmount);
      setConvertSuccess(true);
      setTimeout(() => setConvertSuccess(false), 3000);
    } catch (err) {
      console.error('Cash to points error:', err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 mx-auto max-w-6xl space-y-6 duration-500">
      <p className="text-center text-xs font-medium text-slate-400">
        {weekLabel}
      </p>

      {/* Kid selector */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {kids.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setActiveKidId(k.id)}
            className={`${btnBase} ${btnPress} shrink-0 rounded-full border px-6 py-2 text-sm font-semibold ${
              activeKidId === k.id
                ? 'border-violet-400/50 bg-violet-600 text-white shadow-md shadow-violet-500/25'
                : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-slate-700'
            }`}
          >
            {k.name}
          </button>
        ))}
      </div>

      {/* Leaderboard + progress overview — same row, 1/4 + 3/4 split on large screens */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* Leaderboard — points ranking across all kids */}
      {kids.length > 1 && (
        <div className="lg:col-span-1">
          <Leaderboard
            entries={kids.map(k => ({ id: k.id, name: k.name, points: pointBalances[k.id] ?? 0 }))}
            highlightId={activeKidId}
            compact
          />
        </div>
      )}

      {/* Progress overview card — weekly summary / day drill-down */}
      {activeKidId && activeKidStats.active.length > 0 && (
        <div className={`${cardSurface} p-5 ${kids.length > 1 ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-black text-black">
              {activeKid?.name ?? 'My'}&apos;s {progressDay ? `${progressDay} progress` : 'weekly progress'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {/* Money balance chips — always visible */}
              {weekMandatoryMoney + weekOptionalMoney > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  <Wallet size={13} /> ${(weekMandatoryMoney + weekOptionalMoney).toFixed(2)} this week
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
                    = {fmtPts((weekMandatoryMoney + weekOptionalMoney) * 100)} pts
                  </span>
                </span>
              )}
              {moneyOwed > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('cash-to-points');
                    el ? el.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null;
                  }}
                  className={`${btnBase} ${btnPress} inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-sm hover:bg-emerald-700`}
                  title="Tap to convert to points"
                >
                  <PiggyBank size={13} /> ${moneyOwed.toFixed(2)} banked
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold">
                    = {fmtPts(moneyOwed * 100)} pts
                  </span>
                </button>
              )}
              {/* Day drill-down controls */}
              {progressDay && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                    <Star size={12} fill="currentColor" /> {fmtPts(dayTotalPts)} pts {progressDay}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProgressDay(null)}
                    className={`${btnBase} ${btnPress} rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 hover:border-violet-300 hover:text-violet-600`}
                  >
                    ← Full week
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Interactive chart */}
          <PointsDailyChart
            chores={activeKidStats.active}
            dailySelections={kidSelections}
            selectedDay={progressDay}
            onSelectDay={setProgressDay}
          />

          {/* Day drill-down view */}
          {progressDay ? (
            <div className="mt-5 space-y-4">
              {dayMandatoryDone.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-600">
                    <CheckCircle2 size={13} /> Completed ({dayMandatoryDone.length})
                  </p>
                  <div className="space-y-2">
                    {dayMandatoryDone.map(c => (
                      <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                        <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                        <span className="flex-1 text-sm font-bold text-emerald-800">{c.title}</span>
                        <span className="text-xs font-black text-amber-600">+{fmtPts(ptsPerDay(c.baseValue))} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dayOptionalPicks.some(s => s.completions > 0) && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-violet-600">
                    <Target size={13} /> Bonus Picks
                  </p>
                  <div className="space-y-2">
                    {dayOptionalPicks.filter(s => s.completions > 0).map(s => (
                      <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5">
                        <CheckCircle2 size={18} className="shrink-0 text-violet-500" />
                        <span className="flex-1 text-sm font-bold text-violet-800">
                          {s.title}
                          {s.completions > 1 && <span className="ml-1 text-violet-500">×{s.completions}</span>}
                        </span>
                        <span className="text-xs font-black text-amber-600">+{fmtPts(ptsPerDay(s.baseValue) * s.completions)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dayMandatoryMissed.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">
                    ⭕ Not Done ({dayMandatoryMissed.length})
                  </p>
                  <div className="space-y-2">
                    {dayMandatoryMissed.map(c => (
                      <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 opacity-50">
                        <Circle size={18} className="shrink-0 text-slate-400" />
                        <span className="flex-1 text-sm font-bold text-slate-500">{c.title}</span>
                        <span className="text-xs font-bold text-slate-400">+{fmtPts(ptsPerDay(c.baseValue))} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dayMandatoryDone.length === 0 && dayOptionalPicks.every(s => s.completions === 0) && (
                <p className="text-center text-sm italic text-slate-400">No chores completed on {progressDay} yet.</p>
              )}
            </div>
          ) : (
            /* Full-week summary — stats tiles only */
            <div className="mt-4">
              {(() => {
                // Include streak bonus (server adds 25% of ptsPerDay at 7/7 days)
                const weekMandatoryPts = activeKidStats.active.reduce((s, c) => {
                  const ppd = ptsPerDay(c.baseValue);
                  const base = ppd * c.completedDays.length;
                  const streak = c.completedDays.length === 7 ? Math.round(ppd * 0.25) : 0;
                  return s + base + streak;
                }, 0);
                const weekOptionalPts = kidSelections
                  .filter(s => s.completions > 0)
                  .reduce((s, sel) => s + ptsPerDay(sel.baseValue) * sel.completions, 0);
                const weekTotalPts = weekMandatoryPts + weekOptionalPts;
                const weekTotalMoney = weekMandatoryMoney + weekOptionalMoney;
                return (
                  <div className="flex gap-3">
                    {/* Points tile — authoritative server balance, resets each week */}
                    <div className="flex-1 rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200/70">
                      <p className="text-[10px] font-semibold tracking-wide text-amber-500">Points</p>
                      <p className="mt-1 text-4xl font-black tabular-nums text-amber-700">{kidBalance.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] font-medium text-amber-400">
                        {weekTotalPts > 0 ? `${fmtPts(weekTotalPts)} this week` : 'Start doing chores!'}
                      </p>
                    </div>
                    <div className="flex-1 rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200/70">
                      <p className="text-[10px] font-semibold tracking-wide text-emerald-500">$ Earned</p>
                      <p className="mt-1 text-4xl font-black tabular-nums text-emerald-700">${weekTotalMoney.toFixed(2)}</p>
                      {weekTotalMoney === 0 ? (
                        <p className="mt-1 text-[10px] font-medium text-emerald-400">4+ days unlocks pay</p>
                      ) : moneyOwed > 0 && (
                        <p className="mt-1 text-[10px] font-medium text-emerald-500">${moneyOwed.toFixed(2)} banked</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Mission Board — day tabs + two-column chore board */}
      <MissionBoard
        activeKidId={activeKidId}
        activeKidName={activeKid?.name ?? ''}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        mandatoryChores={activeKidStats.active}
        poolTemplates={poolTemplates}
        dailySelections={dailySelections}
        onToggleMandatory={onToggleDay}
        onPickChore={onPickChore}
        onCompleteOptional={onCompleteOptional}
        onUncompleteOptional={onUncompleteOptional}
        onUnpickChore={onUnpickChore}
      />

      {/* Reward inventory — purchased rewards not yet used */}
      {activeKidId && (
        <RewardInventory
          childId={activeKidId}
          redemptions={redemptions}
          onRequestUse={onRequestRedemptionUse}
        />
      )}

      {/* Rewards catalog — right under chores so kids see what they're working toward */}
      {activeKidId && activeRewards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-500/30">
              <Gift size={19} strokeWidth={2.25} />
            </span>
            <div>
              <h3 className="text-xl font-black text-slate-900">Rewards</h3>
              <p className="flex items-center gap-1 text-sm text-slate-500">
                Tap <Sparkles size={13} className="text-violet-400" /> to save a goal. Tap <strong>Buy Now</strong> to spend your points!
              </p>
            </div>
          </div>
          <RewardsCatalog
            rewards={rewards}
            balance={kidBalance}
            kidId={activeKidId}
            kidName={activeKid?.name ?? ''}
            goalRewardIds={goalRewardIds}
            onToggleGoal={toggleGoal}
            onBuyReward={rewardId =>
              onBuyReward(activeKidId, rewardId)
            }
          />
        </div>
      )}

      {/* Suggest a reward */}
      {activeKidId && (
        <div className="flex justify-center">
          <SuggestRewardForm
            kidId={activeKidId}
            kidName={activeKid?.name ?? ''}
            onSubmit={(title, description) =>
              onSubmitRewardIdea(activeKidId, activeKid?.name ?? '', title, description)
            }
          />
        </div>
      )}

      {/* Nudge banner when they can afford something */}
      {cheapestAffordable && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-bold text-emerald-700">
          <PartyPopper size={16} className="shrink-0" />
          You have enough for <strong>{cheapestAffordable.title}</strong>! Tap Buy Now to get it!
        </div>
      )}

      {/* Cash → Points conversion card */}
      {activeKidId && moneyOwed >= 0.5 && (
        <div id="cash-to-points" className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-black text-emerald-800">
                <Wallet size={14} /> ${moneyOwed.toFixed(2)} owed to you
              </p>
              <p className="text-xs text-emerald-600">Convert your cash into points to spend on rewards!</p>
            </div>
          </div>

          {/* Amount selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {convertSteps.slice(0, 8).map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setConvertAmount(amt)}
                className={`${btnBase} ${btnPress} rounded-xl border-2 px-3 py-1.5 text-sm font-black transition-all ${
                  convertAmount === amt
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'
                }`}
              >
                ${amt.toFixed(2)}
              </button>
            ))}
            {convertSteps.length > 8 && (
              <select
                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-1.5 text-sm font-black text-emerald-700 outline-none"
                value={convertAmount}
                onChange={e => setConvertAmount(parseFloat(e.target.value))}
              >
                {convertSteps.map(amt => (
                  <option key={amt} value={amt}>${amt.toFixed(2)}</option>
                ))}
              </select>
            )}
          </div>

          {/* Conversion summary + confirm */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <DollarSign size={16} className="text-emerald-500" />
              <span>${convertAmount.toFixed(2)}</span>
              <ArrowRightLeft size={14} className="text-emerald-500" />
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Star size={12} fill="currentColor" /> {convertPoints} pts
              </span>
              <span className="text-xs font-bold text-emerald-500">($0.50 = 50 pts)</span>
            </div>
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting || convertSuccess}
              className={`${btnBase} ${btnPress} rounded-2xl px-6 py-2.5 font-black text-white shadow-lg transition-all disabled:pointer-events-none disabled:opacity-60 ${
                convertSuccess
                  ? 'bg-emerald-500 shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30'
              }`}
            >
              {convertSuccess ? (
                <span className="flex items-center gap-1.5"><CheckCircle2 size={15} /> Converted!</span>
              ) : converting ? 'Converting…' : `Convert to ${convertPoints} pts`}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
