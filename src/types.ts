export type UserRole = 'none' | 'teacher' | 'student';

export type ReflectionLevelNumber = 1 | 2 | 3 | 4;
export type ReflectionLevelName = '사실 나열' | '이유 설명' | '개념 연결' | '전이 및 적용';

export interface ReflectionAnalysis {
  reflectionLevel: ReflectionLevelNumber;
  levelName: ReflectionLevelName;
  confidence: number;
  reason: string;
  evidence: string;
  keywords?: string[];
}

export interface Room {
  id?: string;
  roomId?: string;
  roomCode: string;
  roomName?: string;
  teacherId?: string;
  teacherName: string;
  teacherPasscode?: string;
  targetGrade: string;
  apiKey?: string;
  createdAt: number;
  updatedAt?: number;
  isActive?: boolean;
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
  // Reflection Depth Analysis Fields
  reflectionLevel?: ReflectionLevelNumber;
  reflectionLevelName?: ReflectionLevelName;
  reflectionConfidence?: number;
  reflectionReason?: string;
  reflectionEvidence?: string;
  reflectionKeywords?: string[];
  reflectionAnalyzedAt?: number;
}

export interface LearningMaterial {
  id?: string;
  materialId: string;
  roomCode: string;
  teacherId: string;
  teacherName: string;
  title: string;
  subject: string;
  grade: string;
  semester: string;
  unit: string;
  topic: string;
  lesson: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath?: string;
  extractedText?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  role: UserRole;
  roomCode: string | null;
  roomName?: string | null;
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
