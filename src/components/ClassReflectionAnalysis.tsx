import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  BookOpen,
  Filter,
  Search,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  ArrowUpRight,
  RotateCw,
  Tag,
  BarChart3,
  Bot,
  Info,
} from 'lucide-react';
import { Reflection, ReflectionLevelNumber } from '../types';
import {
  generateClassInsightSummary,
  extractKeywordsFromText,
  analyzeReflectionDepth,
} from '../services/geminiService';
import { StudentReflectionModal } from './StudentReflectionModal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ClassReflectionAnalysisProps {
  reflections: Reflection[];
  roomCode: string;
  targetGrade?: string | null;
  apiKey?: string | null;
  onRefresh: () => Promise<void>;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

type DateFilterPreset = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';

const LEVEL_INFO: Record<
  ReflectionLevelNumber,
  {
    name: string;
    subName: string;
    color: string;
    bgClass: string;
    borderClass: string;
    badgeClass: string;
    barColor: string;
    description: string;
    example: string;
  }
> = {
  1: {
    name: '1단계',
    subName: '사실 나열 (Fact)',
    color: 'text-slate-700',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    barColor: 'bg-slate-400',
    description: '배운 사실이나 핵심 내용을 단순 나열하고 정리하는 수준',
    example: '예) "오늘은 조선의 건국 과정을 배웠다."',
  },
  2: {
    name: '2단계',
    subName: '이유 설명 (Reasoning)',
    color: 'text-blue-700',
    bgClass: 'bg-blue-50/50',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    barColor: 'bg-blue-500',
    description: '왜, 어떻게 등 원인과 결과, 이유, 또는 과정 원리를 설명하는 수준',
    example: '예) "이성계가 위화도 회군을 한 것이 건국의 중요한 계기가 되었다."',
  },
  3: {
    name: '3단계',
    subName: '개념 연결 (Concept Linking)',
    color: 'text-indigo-700',
    bgClass: 'bg-indigo-50/50',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    barColor: 'bg-indigo-600',
    description: '학습 내용을 다른 개념, 사회적 맥락 또는 일반화된 관계와 연결하는 수준',
    example: '예) "정치적 결정이 사회의 변화와 나라의 운명에 영향을 줌을 알았다."',
  },
  4: {
    name: '4단계',
    subName: '전이 및 적용 (Transfer)',
    color: 'text-emerald-700',
    bgClass: 'bg-emerald-50/50',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barColor: 'bg-emerald-500',
    description: '배운 개념과 원리를 실제 생활, 학교 경험, 또는 새로운 상황에 확장 적용하는 수준',
    example: '예) "리더의 결정 원리를 반장의 학급 운영이나 나의 생활에 적용해보았다."',
  },
};

export const ClassReflectionAnalysis: React.FC<ClassReflectionAnalysisProps> = ({
  reflections,
  roomCode,
  targetGrade,
  apiKey,
  onRefresh,
  onAlert,
}) => {
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalReflection, setModalReflection] = useState<Reflection | null>(null);
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [showLevelGuide, setShowLevelGuide] = useState(true);

  // Check unanalyzed reflections count
  const unanalyzedCount = useMemo(() => {
    return reflections.filter((r) => !r.reflectionLevel).length;
  }, [reflections]);

  // Batch analyze unanalyzed reflections
  const handleBatchAnalyze = async () => {
    if (unanalyzedCount === 0) {
      onAlert('모든 성찰 기록이 이미 분석되었습니다.', 'success');
      return;
    }

    setIsAnalyzingBatch(true);
    let successCount = 0;

    try {
      for (const ref of reflections) {
        if (!ref.reflectionLevel && ref.id) {
          const res = await analyzeReflectionDepth(
            ref.subject,
            ref.topic,
            ref.step1Text,
            ref.step2Text,
            targetGrade || undefined,
            apiKey || undefined
          );

          await updateDoc(doc(db, 'reflections', ref.id), {
            reflectionLevel: res.reflectionLevel,
            reflectionLevelName: res.levelName,
            reflectionConfidence: res.confidence,
            reflectionReason: res.reason,
            reflectionEvidence: res.evidence,
            reflectionKeywords: res.keywords || [],
            reflectionAnalyzedAt: Date.now(),
          });
          successCount++;
        }
      }

      await onRefresh();
      onAlert(`성찰 기록 ${successCount}건의 AI 깊이 분석이 완료되었습니다! 🎉`, 'success');
    } catch (err: any) {
      console.error('Batch analyze error:', err);
      onAlert('일괄 분석 중 오류가 발생했습니다.\n' + (err.message || ''));
    } finally {
      setIsAnalyzingBatch(false);
    }
  };

  // Filter reflections based on Date Selection
  const dateFilteredReflections = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;

    return reflections.filter((r) => {
      const t = r.timestamp;
      if (datePreset === 'all') return true;
      if (datePreset === 'today') return t >= startOfToday;
      if (datePreset === 'yesterday') return t >= startOfYesterday && t < startOfToday;
      if (datePreset === '7days') return t >= sevenDaysAgo;
      if (datePreset === '30days') return t >= thirtyDaysAgo;
      if (datePreset === 'custom' && customDate) {
        const targetDayStart = new Date(customDate).setHours(0, 0, 0, 0);
        const targetDayEnd = targetDayStart + 24 * 60 * 60 * 1000;
        return t >= targetDayStart && t < targetDayEnd;
      }
      return true;
    });
  }, [reflections, datePreset, customDate]);

  // Compute 4-level Distribution
  const distribution = useMemo(() => {
    const counts: Record<ReflectionLevelNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const total = dateFilteredReflections.length;

    dateFilteredReflections.forEach((r) => {
      const lvl = (r.reflectionLevel || 1) as ReflectionLevelNumber;
      counts[lvl] = (counts[lvl] || 0) + 1;
    });

    return ([1, 2, 3, 4] as ReflectionLevelNumber[]).map((level) => {
      const count = counts[level];
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return { level, count, percent };
    });
  }, [dateFilteredReflections]);

  // Compute Subject Averages
  const subjectAverages = useMemo(() => {
    const subjectMap: Record<string, { sum: number; count: number }> = {};

    dateFilteredReflections.forEach((r) => {
      if (!subjectMap[r.subject]) {
        subjectMap[r.subject] = { sum: 0, count: 0 };
      }
      const lvl = r.reflectionLevel || 1;
      subjectMap[r.subject].sum += lvl;
      subjectMap[r.subject].count += 1;
    });

    return Object.entries(subjectMap)
      .map(([subject, data]) => ({
        subject,
        average: data.count > 0 ? Number((data.sum / data.count).toFixed(1)) : 1.0,
        count: data.count,
      }))
      .sort((a, b) => b.average - a.average);
  }, [dateFilteredReflections]);

  // Compute Class Average Depth
  const classAverageDepth = useMemo(() => {
    if (dateFilteredReflections.length === 0) return '0.0';
    const sum = dateFilteredReflections.reduce((acc, r) => acc + (r.reflectionLevel || 1), 0);
    return (sum / dateFilteredReflections.length).toFixed(1);
  }, [dateFilteredReflections]);

  // High Depth Ratio (Levels 3 & 4)
  const highDepthPercent = useMemo(() => {
    if (dateFilteredReflections.length === 0) return 0;
    const highCount = dateFilteredReflections.filter((r) => (r.reflectionLevel || 1) >= 3).length;
    return Math.round((highCount / dateFilteredReflections.length) * 100);
  }, [dateFilteredReflections]);

  // Frequent Concept Keywords across filtered reflections
  const topKeywords = useMemo(() => {
    const freq: Record<string, number> = {};

    dateFilteredReflections.forEach((r) => {
      if (r.reflectionKeywords && r.reflectionKeywords.length > 0) {
        r.reflectionKeywords.forEach((kw) => {
          freq[kw] = (freq[kw] || 0) + 1;
        });
      } else {
        const textKws = extractKeywordsFromText(`${r.step1Text} ${r.step2Text} ${r.topic || ''}`);
        textKws.forEach((kw) => {
          freq[kw] = (freq[kw] || 0) + 1;
        });
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [dateFilteredReflections]);

  // Class AI Pedagogical Insights
  const classInsight = useMemo(() => {
    return generateClassInsightSummary(
      distribution,
      topKeywords.map(([k]) => k),
      subjectAverages
    );
  }, [distribution, topKeywords, subjectAverages]);

  // Final filtered list for the student table
  const tableReflections = useMemo(() => {
    return dateFilteredReflections.filter((r) => {
      const matchSubject = selectedSubject === 'all' || r.subject === selectedSubject;
      const matchLevel = selectedLevel === 'all' || (r.reflectionLevel || 1) === selectedLevel;
      const matchKeyword =
        !selectedKeyword ||
        r.step1Text.includes(selectedKeyword) ||
        r.step2Text.includes(selectedKeyword) ||
        (r.topic && r.topic.includes(selectedKeyword)) ||
        (r.reflectionKeywords && r.reflectionKeywords.includes(selectedKeyword));
      const matchSearch =
        !searchQuery ||
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.step1Text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.step2Text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSubject && matchLevel && matchKeyword && matchSearch;
    });
  }, [dateFilteredReflections, selectedSubject, selectedLevel, selectedKeyword, searchQuery]);

  return (
    <div id="class-reflection-analysis" className="space-y-6">
      {/* Top Banner: Period Filter & Quick Actions */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-2xs border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-600" />
              <span>학급 성찰 깊이 4단계 분석</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              학생들이 작성한 배움노트를 4단계(사실 나열 → 이유 설명 → 개념 연결 → 전이 및 적용)로 심층 분석합니다.
            </p>
          </div>

          {/* Unanalyzed Batch Button */}
          {unanalyzedCount > 0 && (
            <button
              id="btn-batch-analyze"
              onClick={handleBatchAnalyze}
              disabled={isAnalyzingBatch}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-2xl border border-amber-300 transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-amber-600 ${isAnalyzingBatch ? 'animate-spin' : ''}`} />
              <span>미분석 기록 AI 분석 ({unanalyzedCount}건)</span>
            </button>
          )}
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>기간 선택:</span>
            </span>

            {(
              [
                { id: 'all', label: '전체 기간' },
                { id: 'today', label: '오늘' },
                { id: 'yesterday', label: '어제' },
                { id: '7days', label: '최근 7일' },
                { id: '30days', label: '최근 30일' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setDatePreset(p.id);
                  setCustomDate('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1">
              <input
                id="custom-date-picker"
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) setDatePreset('custom');
                }}
                className={`px-2.5 py-1 text-xs rounded-xl border transition-colors outline-hidden ${
                  datePreset === 'custom'
                    ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              />
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium self-end sm:self-center">
            조회 대상 성찰: <strong className="text-slate-800">{dateFilteredReflections.length}건</strong>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
            선택 기간 성찰 수
          </span>
          <div className="text-2xl font-black text-slate-900">
            {dateFilteredReflections.length}
            <span className="text-xs text-slate-500 font-normal ml-1">건</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
            평균 성찰 깊이
          </span>
          <div className="text-2xl font-black text-sky-600 flex items-center gap-1.5">
            {classAverageDepth}
            <span className="text-xs text-slate-500 font-normal">/ 4.0 단계</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
            심화 성찰 비율 (3·4단계)
          </span>
          <div className="text-2xl font-black text-indigo-600">
            {highDepthPercent}%
            <span className="text-xs text-slate-500 font-normal ml-1">
              ({dateFilteredReflections.filter((r) => (r.reflectionLevel || 1) >= 3).length}명)
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
            추출된 핵심 개념 키워드
          </span>
          <div className="text-2xl font-black text-emerald-600">
            {topKeywords.length}
            <span className="text-xs text-slate-500 font-normal ml-1">개</span>
          </div>
        </div>
      </div>

      {/* 4-Level Reflection Depth Distribution & Guide */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-2xs border border-slate-200 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              <span>전체 성찰 깊이 분포 (4단계 체계)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              학급 전체 학생들의 성찰 사고가 어떤 단계에 가장 많이 도달했는지 확인합니다.
            </p>
          </div>

          <button
            onClick={() => setShowLevelGuide(!showLevelGuide)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>{showLevelGuide ? '단계 설명 접기' : '단계 설명 보기'}</span>
          </button>
        </div>

        {/* Level Distribution Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {distribution.map(({ level, count, percent }) => {
            const config = LEVEL_INFO[level];
            const isFilterActive = selectedLevel === level;
            return (
              <div
                key={level}
                onClick={() => setSelectedLevel(isFilterActive ? 'all' : level)}
                className={`p-4.5 rounded-2xl border transition-all cursor-pointer ${
                  isFilterActive
                    ? 'ring-2 ring-sky-500 border-sky-500 shadow-xs'
                    : `${config.borderClass} ${config.bgClass} hover:border-slate-300`
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${config.badgeClass}`}>
                    {config.name}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{count}건</span>
                </div>

                <div className="font-extrabold text-slate-900 text-sm">{config.subName}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{percent}%</div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${config.barColor}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-500 mt-2 font-medium">
                  {config.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pedagogical 4-Level Guide Accordion Card */}
        {showLevelGuide && (
          <div className="p-5 rounded-2xl bg-linear-to-r from-slate-50 to-sky-50/50 border border-slate-200/90 space-y-3 text-xs text-slate-700">
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <Info className="w-4 h-4 text-sky-600" />
              <span>「생각 한 칸 더」 성찰 깊이 4단계 평가 루브릭 안내</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-800 block">
                  1단계: 사실 나열 (Fact)
                </span>
                <p className="text-slate-600">배운 사실/내용을 단순 정리. 원인이나 관계 설명 거의 없음.</p>
                <p className="text-slate-400 italic">예) 조선은 이성계가 세웠다.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-1">
                <span className="font-bold text-blue-900 block">
                  2단계: 이유 설명 (Reasoning)
                </span>
                <p className="text-slate-600">&apos;왜&apos;, &apos;어떻게&apos; 등 원인과 결과, 발생 과정 및 원리를 설명.</p>
                <p className="text-slate-400 italic">예) 위화도 회군이 조선 건국의 중요한 계기가 되었다.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 block">
                  3단계: 개념 연결 (Concept Linking)
                </span>
                <p className="text-slate-600">학습 개념을 다른 개념/사회적 맥락과 연결하여 일반화된 관계 도출.</p>
                <p className="text-slate-400 italic">예) 지도자의 결정이 사회 변화에 큰 영향을 줌을 알았다.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-100 space-y-1">
                <span className="font-bold text-emerald-900 block">
                  4단계: 전이 및 적용 (Transfer)
                </span>
                <p className="text-slate-600">배운 개념을 실제 생활, 학교 경험, 새로운 상황에 확장 적용.</p>
                <p className="text-slate-400 italic">예) 반장의 결정이 학급 분위기를 바꿀 수 있다는 생각이 들었다.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Columns: Subject Averages & Keyword Cloud */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject Average Reflection Depths */}
        <div className="bg-white p-6 rounded-3xl shadow-2xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-600" />
              <span>과목별 평균 성찰 깊이</span>
            </h4>
            <span className="text-xs text-slate-400">1.0 ~ 4.0 단계 척도</span>
          </div>

          {subjectAverages.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              조회된 과목 데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-3.5">
              {subjectAverages.map(({ subject, average, count }) => {
                const percent = (average / 4) * 100;
                return (
                  <div key={subject} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">{subject}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-normal">{count}건 기록</span>
                        <span className="text-sky-700 font-extrabold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                          {average.toFixed(1)}단계
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-linear-to-r from-sky-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Frequent Concept Keywords */}
        <div className="bg-white p-6 rounded-3xl shadow-2xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
              <span>빈출 핵심 개념 키워드</span>
            </h4>
            {selectedKeyword && (
              <button
                onClick={() => setSelectedKeyword(null)}
                className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
              >
                키워드 필터 해제
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            학생들의 성찰 글에서 자주 등장한 핵심 학습 개념입니다. 키워드를 클릭하면 해당 기록만 모아볼 수 있습니다.
          </p>

          {topKeywords.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              분석된 키워드가 없습니다.
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {topKeywords.map(([kw, count]) => {
                const isSelected = selectedKeyword === kw;
                return (
                  <button
                    key={kw}
                    onClick={() => setSelectedKeyword(isSelected ? null : kw)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs scale-105'
                        : 'bg-amber-50/70 hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    #{kw} <span className="text-[11px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Teacher AI Pedagogical Insights & Suggestions */}
      <div className="bg-linear-to-br from-indigo-50/80 via-white to-sky-50/70 p-6 sm:p-7 rounded-3xl shadow-2xs border border-indigo-100 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">
              교사용 AI 학급 성찰 인사이트 & 수업 제안
            </h4>
            <span className="text-xs text-slate-500">
              현재 선택된 기간의 데이터를 바탕으로 도출된 교육적 총평입니다.
            </span>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-800 leading-relaxed bg-white/90 p-4 rounded-2xl border border-indigo-100">
          {classInsight.overviewText}
        </p>

        <div className="space-y-2">
          {classInsight.bulletPoints.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
              <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">💡 다음 수업 실천 팁: </strong>
            <span>{classInsight.pedagogicalSuggestion}</span>
          </div>
        </div>
      </div>

      {/* Student Reflection List & Table */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-2xs border border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600" />
              <span>학생별 성찰 수준 및 상세 기록</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              각 학생의 배움 기록과 AI 판단 사유를 확인하고 학생을 클릭하여 상세 분석을 엽니다.
            </p>
          </div>

          {/* Level Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedLevel === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 단계
            </button>
            {([1, 2, 3, 4] as ReflectionLevelNumber[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedLevel === lvl
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lvl}단계
              </button>
            ))}
          </div>
        </div>

        {/* Search & Subject Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="student-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="학생 이름, 주제, 배움 내용 검색..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 outline-hidden"
            >
              <option value="all">모든 과목</option>
              {Array.from(new Set(reflections.map((r) => r.subject))).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Reflection Cards */}
        {tableReflections.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            조건에 일치하는 성찰 기록이 없습니다.
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {tableReflections.map((ref) => {
              const lvl = (ref.reflectionLevel || 1) as ReflectionLevelNumber;
              const config = LEVEL_INFO[lvl];
              const formattedDate = new Date(ref.timestamp).toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={ref.id || ref.timestamp}
                  onClick={() => setModalReflection(ref)}
                  className="p-4.5 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all bg-white cursor-pointer space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs">
                        {ref.studentName.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-slate-900">
                        {ref.studentName} 학생
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white ${ref.subjectColor}`}
                      >
                        {ref.subject}
                      </span>
                      {ref.topic && (
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {ref.topic}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold border ${config.badgeClass}`}
                      >
                        {config.name} · {config.subName}
                      </span>
                      <span className="text-xs text-slate-400">{formattedDate}</span>
                    </div>
                  </div>

                  {/* Snippet */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        1단계 배움 기록
                      </span>
                      <p className="text-slate-800 line-clamp-2">{ref.step1Text}</p>
                    </div>

                    <div className="bg-sky-50/60 p-2.5 rounded-xl border border-sky-100">
                      <span className="text-[10px] font-bold text-sky-700 block mb-0.5">
                        생각 한 칸 더 (학생 답변)
                      </span>
                      <p className="text-slate-900 font-medium line-clamp-2">{ref.step2Text}</p>
                    </div>
                  </div>

                  {/* AI Reason Preview & Action */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 line-clamp-1 italic">
                      💡 {ref.reflectionReason || config.description}
                    </span>
                    <span className="text-sky-600 font-bold flex items-center gap-0.5 shrink-0 ml-2">
                      <span>상세보기</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Reflection Detail Modal */}
      <StudentReflectionModal
        isOpen={!!modalReflection}
        onClose={() => setModalReflection(null)}
        reflection={modalReflection}
        studentAllReflections={reflections}
      />
    </div>
  );
};
