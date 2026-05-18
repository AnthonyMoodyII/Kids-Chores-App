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