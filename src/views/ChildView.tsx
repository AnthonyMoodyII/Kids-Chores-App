import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, AlertCircle, Star } from 'lucide-react';
import type { User, DayOfWeek, RewardTemplate, PointLedgerEntry, RedemptionRequest } from '../types';
import type { KidStats } from '../hooks/useChores';
import { DAYS, btnBase, btnPress, cardSurface } from '../lib/constants';
import { getChoreEarnedAmount } from '../lib/earnings';
import { ChoreProgressRows } from '../components/ChoreProgressRows';
import { PointsBadge } from '../components/PointsBadge';
import { PointsDailyChart } from '../components/PointsDailyChart';
import { RewardsCatalog } from '../components/RewardsCatalog';
import { SuggestRewardForm } from '../components/SuggestRewardForm';

interface ChildViewProps {
  kids: User[];
  activeKidId: string;
  setActiveKidId: (id: string) => void;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  weekLabel: string;
  activeKidStats: KidStats;
  onToggleDay: (choreId: string, day: DayOfWeek) => void;
  // Points & Rewards
  kidBalance: number;
  ledger: PointLedgerEntry[];
  rewards: RewardTemplate[];
  redemptionRequests: RedemptionRequest[];
  onRequestRedemption: (childId: string, childName: string, rewardTemplateId: string) => Promise<void>;
  onSubmitRewardIdea: (childId: string, childName: string, title: string, description?: string) => Promise<void>;
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
  selectedDay,
  setSelectedDay,
  weekLabel,
  activeKidStats,
  onToggleDay,
  kidBalance,
  ledger,
  rewards,
  redemptionRequests,
  onRequestRedemption,
  onSubmitRewardIdea,
}: ChildViewProps) {
  const { goalRewardIds, toggleGoal } = useGoalRewardIds(activeKidId);
  const activeKid = kids.find(k => k.id === activeKidId);

  const activeRewards = rewards.filter(r => r.isActive);
  const cheapestAffordable = activeRewards
    .filter(r => kidBalance >= r.pointCost)
    .sort((a, b) => a.pointCost - b.pointCost)[0];

  // Points earned today (for the +today indicator)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const todayPoints = ledger
    .filter(e => e.childId === activeKidId && e.amount > 0 && new Date(e.createdAt) >= today && new Date(e.createdAt) < tomorrow)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="animate-in slide-in-from-right-4 mx-auto max-w-6xl space-y-6 duration-500">
      <p className="text-center text-xs font-black uppercase tracking-widest text-slate-700">
        {weekLabel}
      </p>

      {/* Kid selector */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {kids.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setActiveKidId(k.id)}
            className={`${btnBase} ${btnPress} shrink-0 rounded-full border-2 px-6 py-2 font-bold ${
              activeKidId === k.id
                ? 'border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                : 'border-slate-200/80 bg-white text-slate-500 hover:border-violet-200'
            }`}
          >
            {k.name}
          </button>
        ))}
      </div>

      {/* Points balance banner */}
      {activeKidId && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <Star size={22} className="text-amber-500" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                {activeKid?.name}&apos;s Points
              </p>
              <p className="text-xs text-amber-600">Earn points every time you complete a chore!</p>
            </div>
          </div>
          <PointsBadge points={kidBalance} todayPoints={todayPoints} size="lg" />
        </div>
      )}

      {/* Nudge banner when they can afford something */}
      {cheapestAffordable && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-bold text-emerald-700">
          🎉 You have enough for <strong>{cheapestAffordable.title}</strong>! Ask a parent to redeem it.
        </div>
      )}

      {/* Progress overview card */}
      {activeKidId && activeKidStats.active.length > 0 && (
        <div className={`${cardSurface} p-6 md:p-8`}>
          <h3 className="mb-6 text-xl font-black text-black">
            {activeKid?.name ?? 'My'}&apos;s progress
          </h3>
          <ChoreProgressRows
            choreList={activeKidStats.active}
            showParentApprove={false}
          />
          {/* Daily points chart */}
          {activeKidId && (
            <div className="mt-6">
              <PointsDailyChart chores={activeKidStats.active} />
            </div>
          )}
        </div>
      )}

      {/* Day selector + chore list */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex w-full gap-2 overflow-x-auto md:w-44 md:flex-col">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`${btnBase} ${btnPress} flex-1 rounded-2xl border-2 p-4 font-bold md:flex-none ${
                selectedDay === day
                  ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/30'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50'
              }`}
            >
              {day.substring(0, 3)}
            </button>
          ))}
        </div>

        <div className={`${cardSurface} flex-1 p-6 md:p-10`}>
          <h2 className="mb-10 text-4xl font-black tracking-tight text-slate-900">
            {selectedDay}
          </h2>
          <div className="space-y-4">
            {activeKidStats.active.map(chore => {
              const isDone = chore.completedDays.includes(selectedDay);
              const earned = getChoreEarnedAmount(chore.completedDays.length, chore.baseValue);
              const ptsPerDay = 10 + Math.round(chore.baseValue * 4);
              return (
                <button
                  key={chore.id}
                  type="button"
                  onClick={() => onToggleDay(chore.id, selectedDay)}
                  className={`${btnBase} ${btnPress} flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.75rem] border-2 p-6 text-left transition-colors ${
                    isDone
                      ? 'border-emerald-400 bg-emerald-50/90'
                      : chore.isMandatory
                        ? 'border-rose-400 bg-rose-50 hover:border-rose-500'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={isDone ? 'text-emerald-600' : 'text-slate-400'}>
                      {isDone ? <CheckCircle2 size={32} /> : <Circle size={32} />}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xl font-bold flex flex-wrap items-center gap-2 ${
                          isDone ? 'text-emerald-900 line-through opacity-50' : 'text-slate-800'
                        }`}
                      >
                        <span>{chore.title}</span>
                        {chore.isMandatory && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 no-underline opacity-100">
                            <AlertCircle size={12} /> Mandatory
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>Value: ${chore.baseValue.toFixed(2)}</span>
                        <span>Current: ${earned.toFixed(2)}</span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <span>⭐</span>
                          <span>+{ptsPerDay} pts/day</span>
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {[...Array(7)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 w-3 rounded-full ${
                              i < chore.completedDays.length
                                ? chore.isApproved
                                  ? 'bg-emerald-500'
                                  : 'bg-violet-400'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xl font-black ${
                      chore.isApproved ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    ${earned.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rewards catalog */}
      {activeKidId && activeRewards.length > 0 && (
        <div className={`${cardSurface} p-6 md:p-8`}>
          <div className="mb-5 flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <div>
              <h3 className="text-xl font-black text-slate-900">Rewards</h3>
              <p className="text-sm text-slate-500">Tap ✨ to save a goal. Tap <strong>Ask Parent</strong> to request.</p>
            </div>
          </div>
          <RewardsCatalog
            rewards={rewards}
            balance={kidBalance}
            kidId={activeKidId}
            kidName={activeKid?.name ?? ''}
            redemptionRequests={redemptionRequests}
            goalRewardIds={goalRewardIds}
            onToggleGoal={toggleGoal}
            onRequestRedemption={rewardId =>
              onRequestRedemption(activeKidId, activeKid?.name ?? '', rewardId)
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
    </div>
  );
}
