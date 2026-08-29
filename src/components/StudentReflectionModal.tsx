import React from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  Award,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Reflection, ReflectionLevelNumber } from '../types';

interface StudentReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reflection: Reflection | null;
  studentAllReflections?: Reflection[];
}

const LEVEL_CONFIG: Record<
  ReflectionLevelNumber,
  {
    name: string;
    tagClass: string;
    bgClass: string;
    borderClass: string;
    description: string;
  }
> = {
  1: {
    name: '1단계 · 사실 나열',
    tagClass: 'bg-slate-100 text-slate-700 border-slate-300',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
    description: '수업에서 배운 사실이나 주요 핵심 내용을 정리하고 기억하는 수준입니다.',
  },
  2: {
    name: '2단계 · 이유 설명',
    tagClass: 'bg-blue-50 text-blue-700 border-blue-200',
    bgClass: 'bg-blue-50/50',
    borderClass: 'border-blue-200',
    description: '배운 내용의 원인과 결과, 이유, 또는 원리를 명확하게 설명하는 수준입니다.',
  },
  3: {
    name: '3단계 · 개념 연결',
    tagClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    bgClass: 'bg-indigo-50/50',
    borderClass: 'border-indigo-200',
    description: '학습 내용을 다른 개념, 사회적 맥락, 또는 일반화된 법칙과 넓게 연결하는 수준입니다.',
  },
  4: {
    name: '4단계 · 전이 및 적용',
    tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgClass: 'bg-emerald-50/50',
    borderClass: 'border-emerald-200',
    description: '배운 개념과 원리를 실제 생활, 학교 경험, 또는 새로운 상황에 확장하여 적용하는 수준입니다.',
  },
};

export const StudentReflectionModal: React.FC<StudentReflectionModalProps> = ({
  isOpen,
  onClose,
  reflection,
  studentAllReflections = [],
}) => {
  if (!isOpen || !reflection) return null;

  const level = (reflection.reflectionLevel || 1) as ReflectionLevelNumber;
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  // Sort student's reflections by date to show growth trajectory
  const studentHistory = [...studentAllReflections]
    .filter((r) => r.studentName === reflection.studentName)
    .sort((a, b) => a.timestamp - b.timestamp);

  const formattedDate = new Date(reflection.timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id="student-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 font-bold text-lg flex items-center justify-center border border-sky-200 shadow-2xs">
              {reflection.studentName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-extrabold text-slate-900">
                  {reflection.studentName} 학생의 배움노트
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${reflection.subjectColor}`}
                >
                  {reflection.subject}
                </span>
                {reflection.topic && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    주제: {reflection.topic}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedDate}</span>
              </p>
            </div>
          </div>

          <button
            id="close-student-modal-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reflection Depth Assessment Banner */}
        <div className={`p-4.5 rounded-2xl border ${config.borderClass} ${config.bgClass} space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                AI 성찰 깊이 분석 결과
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold border ${config.tagClass}`}
            >
              {config.name}
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {reflection.reflectionReason || config.description}
          </p>

          {reflection.reflectionEvidence && (
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                판단 핵심 근거 문장
              </span>
              <p className="font-semibold italic text-slate-900 leading-relaxed">
                &ldquo;{reflection.reflectionEvidence}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>1단계: 배움 기록 (손글씨/입력 내용)</span>
            </span>
            <p className="text-slate-800 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-relaxed whitespace-pre-line">
              {reflection.step1Text}
            </p>
          </div>

          <div className="bg-sky-50/70 p-4.5 rounded-2xl border border-sky-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
              <Bot className="w-4 h-4 text-sky-600" />
              <span>AI 생각 확장 질문</span>
            </div>
            <p className="text-xs font-medium text-slate-700 bg-white/90 p-3 rounded-xl border border-sky-100">
              &ldquo;{reflection.aiQuestion}&rdquo;
            </p>

            <div>
              <span className="text-xs font-bold text-sky-900 block mt-2 mb-1">
                👉 생각 한 칸 더 (학생의 답변)
              </span>
              <p className="text-slate-900 text-sm font-semibold leading-relaxed bg-white p-3.5 rounded-xl border border-sky-200 whitespace-pre-line">
                {reflection.step2Text}
              </p>
            </div>
          </div>
        </div>

        {/* Growth Trajectory across past notes */}
        {studentHistory.length > 1 && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                <span>{reflection.studentName} 학생의 성찰 깊이 성장 흐름 (총 {studentHistory.length}회)</span>
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
              {studentHistory.map((item, idx) => {
                const itemLvl = item.reflectionLevel || 1;
                const isCurrent = item.id === reflection.id || item.timestamp === reflection.timestamp;
                return (
                  <div key={item.id || item.timestamp} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isCurrent
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs scale-105'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 font-normal">
                        {new Date(item.timestamp).toLocaleDateString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </div>
                      <div>{itemLvl}단계 ({item.subject})</div>
                    </div>
                    {idx < studentHistory.length - 1 && (
                      <span className="text-slate-300 font-bold">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Extracted Concept Keywords */}
        {reflection.reflectionKeywords && reflection.reflectionKeywords.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xs font-bold text-slate-400">주요 개념 키워드:</span>
            {reflection.reflectionKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
