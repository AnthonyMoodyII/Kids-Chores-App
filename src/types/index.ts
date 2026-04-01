export type UserRole = 'parent' | 'child';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface Chore {
  id: string;
  title: string;
  baseValue: number;
  assignedTo: string;
  // Tracks which specific days this chore was finished
  completedDays: DayOfWeek[]; 
}

export interface PayoutRecord {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  timestamp: number;
}