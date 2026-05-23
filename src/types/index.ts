export type UserRole = 'parent' | 'child';
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface ChoreTemplate {
  id: string;
  title: string;
  baseValue: number;
  isMandatory?: boolean;
}

export interface Chore {
  id: string;
  title: string;
  baseValue: number;
  isMandatory?: boolean;
  templateId?: string;
  assignedTo: string;
  completedDays: DayOfWeek[];
  isApproved: boolean;
  isArchived: boolean;
}

export interface PayoutRecord {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  timestamp: number;
  choresPaid: string[];
}

export interface CashPayment {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  note?: string;
  timestamp: string;
}

/** Derived per-child stats computed from active chores. */
export interface KidStats {
  active: Chore[];
  approved: number;
  pending: number;
  canPayout: boolean;
}

// ── Rewards & Points ──────────────────────────────────────────────────────────

export interface RewardTemplate {
  id: string;
  title: string;
  description?: string;
  pointCost: number;
  icon?: string;
  isActive: boolean;
  isCustom: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PointLedgerEntry {
  id: string;
  childId: string;
  amount: number;
  reason: string;
  choreId?: string;
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  childId: string;
  childName: string;
  rewardTemplateId: string;
  rewardTitle: string;
  pointCost: number;
  timestamp: string;
}

export interface RewardRequest {
  id: string;
  childId: string;
  childName: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  pointCost?: number;
  createdAt: string;
}

export interface RedemptionRequest {
  id: string;
  childId: string;
  childName: string;
  rewardTemplateId: string;
  rewardTitle: string;
  pointCost: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  timestamp: string;
}

export interface NotificationSettings {
  pushoverEnabled: boolean;
  pushoverTokenSet: boolean;
  smtpEnabled: boolean;
  smtpPasswordSet: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
  notifyChoreComplete: boolean;
  notifyStreakBonus: boolean;
  notifyRewardRequest: boolean;
  notifyRewardIdea: boolean;
  notifyWeeklyReset: boolean;
  notifyRewardApproved: boolean;
}
