export type UserRole = 'none' | 'teacher' | 'student';

export interface Room {
  roomCode: string;
  teacherName: string;
  targetGrade: string;
  apiKey?: string;
  createdAt: number;
}

export interface Reflection {
  id?: string;
  roomCode: string;
  studentName: string;
  subject: string;
  topic?: string;
  subjectColor: string;
  step1Text: string;
  aiQuestion: string;
  aiHint: string;
  step2Text: string;
  timestamp: number;
}

export interface AppState {
  role: UserRole;
  roomCode: string | null;
  teacherName: string | null;
  targetGrade: string | null;
  apiKey: string | null;
  studentName: string | null;
}

export interface SubjectOption {
  name: string;
  color: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
}

export interface BadgeInfo {
  threshold: number;
  name: string;
  iconName: string;
  description: string;
}
