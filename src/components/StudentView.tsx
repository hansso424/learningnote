import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  Camera,
  Wand2,
  Lightbulb,
  Bot,
  BookOpen,
  Sparkles,
  Loader2,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
  Bookmark,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState, Reflection, SubjectOption } from '../types';
import { recognizeHandwriting, generateReflectionQuestion } from '../services/geminiService';

interface StudentViewProps {
  appState: AppState;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

const SUBJECT_OPTIONS: SubjectOption[] = [
  { name: '국어', color: '#f43f5e', bgClass: 'bg-rose-500', borderClass: 'border-rose-300', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: '수학', color: '#3b82f6', bgClass: 'bg-blue-500', borderClass: 'border-blue-300', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: '사회', color: '#f97316', bgClass: 'bg-orange-500', borderClass: 'border-orange-300', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: '과학', color: '#10b981', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-300', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: '기타', color: '#64748b', bgClass: 'bg-slate-600', borderClass: 'border-slate-300', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const BADGES = [
  { threshold: 1, name: '첫 걸음', icon: '🌱', desc: '첫 성찰 기록' },
  { threshold: 3, name: '성장하는 잎', icon: '🌿', desc: '3회 기록 달성' },
  { threshold: 5, name: '호기심 쑥쑥', icon: '🔍', desc: '5회 기록 달성' },
  { threshold: 10, name: '배움 탐험가', icon: '🧭', desc: '10회 기록 달성' },
  { threshold: 20, name: '지혜의 나무', icon: '🌳', desc: '20회 기록 달성' },
  { threshold: 30, name: '생각 한 칸 더', icon: '⭐', desc: '30회 기록 달성' },
];

export const StudentView: React.FC<StudentViewProps> = ({ appState, onAlert }) => {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Draft state
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [topic, setTopic] = useState('');
  const [step1Text, setStep1Text] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiHint, setAiHint] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [step2Text, setStep2Text] = useState('');

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);

  // AI loading state
  const [aiLoading, setAiLoading] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  useEffect(() => {
    fetchReflections();
  }, [appState.roomCode, appState.studentName]);

  const fetchReflections = async () => {
    if (!appState.roomCode || !appState.studentName) return;
    setLoadingHistory(true);
    try {
      await ensureAuth();
      const reflectionsRef = collection(db, 'reflections');
      const q = query(
        reflectionsRef,
        where('roomCode', '==', appState.roomCode),
        where('studentName', '==', appState.studentName)
      );

      const snapshot = await getDocs(q);
      const list: Reflection[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Reflection, 'id'>),
        });
      });

      list.sort((a, b) => b.timestamp - a.timestamp);
      setReflections(list);
    } catch (err) {
      console.error('Fetch student reflections error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStartNew = () => {
    setSelectedSubject(null);
    setTopic('');
    setStep1Text('');
    setAiQuestion('');
    setAiHint('');
    setStep2Text('');
    setShowHint(false);
    setOcrStatus(null);
    setCurrentStep(1);
    setIsFlowActive(true);
  };

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrStatus('AI가 손글씨 공책을 읽고 있습니다...');

    try {
      const text = await recognizeHandwriting(file, appState.apiKey || undefined);
      setStep1Text((prev) => (prev ? `${prev}\n${text}` : text));
      setOcrStatus('공책 손글씨를 성공적으로 읽었습니다.');
    } catch (err: any) {
      setOcrStatus(err.message || '인식에 실패했습니다. 직접 입력해주세요.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleStep1Next = async () => {
    if (!selectedSubject) {
      onAlert('성찰할 과목을 선택해주세요.');
      return;
    }
    if (!topic.trim()) {
      onAlert('오늘 배운 학습 주제(단원)를 입력해주세요.');
      return;
    }
    if (!step1Text.trim()) {
      onAlert('오늘 배운 내용을 기록해주세요.');
      return;
    }

    setAiLoading(true);

    try {
      const { question, hint } = await generateReflectionQuestion(
        selectedSubject.name,
        step1Text.trim(),
        topic.trim(),
        appState.targetGrade || undefined,
        appState.apiKey || undefined
      );

      setAiQuestion(question);
      setAiHint(hint);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('AI question generation error:', err);
      setAiQuestion('오늘 배운 내용 중 가장 기억에 남는 부분과 그 이유는 무엇인가요?');
      setAiHint('가장 흥미로웠던 장면이나 새롭게 알게 된 사실을 떠올려보세요.');
      setCurrentStep(2);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveReflection = async () => {
    if (!step2Text.trim()) {
      onAlert('AI 선생님의 질문에 대한 나의 생각(생각 한 칸 더)을 적어주세요.');
      return;
    }

    if (!selectedSubject || !appState.roomCode || !appState.studentName) return;

    setSavingReflection(true);

    try {
      await ensureAuth();

      const newRecord: Omit<Reflection, 'id'> = {
        roomCode: appState.roomCode,
        studentName: appState.studentName,
        subject: selectedSubject.name,
        topic: topic.trim(),
        subjectColor: selectedSubject.bgClass,
        step1Text: step1Text.trim(),
        aiQuestion,
        aiHint,
        step2Text: step2Text.trim(),
        timestamp: Date.now(),
      };

      await addDoc(collection(db, 'reflections'), newRecord);

      // Trigger Confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}

      await fetchReflections();
      setIsFlowActive(false);
      onAlert('훌륭해요! 「생각 한 칸 더」 성찰이 성공적으로 기록되었습니다. 🎉', 'success');
    } catch (err: any) {
      console.error('Save reflection error:', err);
      onAlert('저장에 실패했습니다.\n' + (err.message || '다시 시도해주세요.'));
    } finally {
      setSavingReflection(false);
    }
  };

  return (
    <div id="student-view" className="space-y-6">
      {/* Badges Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">나의 성장 배지</h2>
              <p className="text-xs text-slate-500">배움을 꾸준히 기록하며 &lsquo;생각 한 칸 더&rsquo; 성장해보세요!</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">총 기록 횟수</span>
            <div className="text-xl font-extrabold text-sky-600">
              {reflections.length}
              <span className="text-xs font-medium text-slate-500 ml-1">번</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {BADGES.map((b) => {
            const isUnlocked = reflections.length >= b.threshold;
            return (
              <div
                key={b.threshold}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  isUnlocked
                    ? 'bg-amber-50/50 border-amber-200 text-amber-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                }`}
              >
                <div className="text-2xl mb-1">{b.icon}</div>
                <span className="text-xs font-bold text-center line-clamp-1">{b.name}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{b.threshold}회 달성</span>
              </div>
            );
          })}
        </div>
      </div>

      {!isFlowActive ? (
        /* Home Screen with History */
        <div className="space-y-5">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">오늘의 배움 기록</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                수업 시간에 배운 내용을 정리하고 AI 질문으로 생각을 한 칸 더 넓혀보세요.
              </p>
            </div>
            <button
              id="start-new-reflection-btn"
              onClick={handleStartNew}
              className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-5 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>새 배움 기록하기</span>
            </button>
          </div>

          <div id="reflections-list" className="space-y-4">
            {loadingHistory ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-sm font-medium">성찰 기록을 불러오는 중...</span>
              </div>
            ) : reflections.length === 0 ? (
              <div
                id="empty-reflections"
                className="text-center py-14 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-white text-slate-400 flex items-center justify-center mb-3 shadow-xs border border-slate-200">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-700">아직 기록된 배움이 없습니다.</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  위의 &lsquo;새 배움 기록하기&rsquo; 버튼을 눌러 오늘 배운 과목과 주제, 성찰을
                  기록해보세요!
                </p>
              </div>
            ) : (
              reflections.map((ref) => {
                const dateStr = new Date(ref.timestamp).toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                });
                const timeStr = new Date(ref.timestamp).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ref.id || ref.timestamp}
                    className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs ${ref.subjectColor}`}
                        >
                          {ref.subject}
                        </span>
                        {ref.topic && (
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                            <Bookmark className="w-3 h-3 text-sky-600" />
                            <span>{ref.topic}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{dateStr}</span>
                        <span className="mx-1">•</span>
                        <span>{timeStr}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                          1단계 : 나의 배움 기록
                        </span>
                        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-normal">
                          {ref.step1Text}
                        </p>
                      </div>

                      <div className="bg-sky-50/70 rounded-xl p-4 border border-sky-100 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                          <Bot className="w-4 h-4" />
                          <span>AI 생각 확장 질문 & 나만의 &lsquo;생각 한 칸 더&rsquo;</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium italic bg-white/90 p-2.5 rounded-lg border border-sky-100">
                          Q. {ref.aiQuestion}
                        </p>
                        <p className="text-slate-900 text-sm font-medium leading-relaxed whitespace-pre-line pt-1">
                          {ref.step2Text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Multi-step Reflection Flow */
        <div id="reflection-flow" className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              id="back-to-list-btn"
              onClick={() => setIsFlowActive(false)}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>목록으로 돌아가기</span>
            </button>

            {/* Stepper Progress */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 1
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                1
              </div>
              <div
                className={`w-10 h-1 rounded-full ${
                  currentStep === 2 ? 'bg-sky-600' : 'bg-slate-200'
                }`}
              />
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 2
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </div>
            </div>
          </div>

          {/* STEP 1 */}
          {currentStep === 1 && !aiLoading && (
            <div
              id="step-1"
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7 space-y-6"
            >
              {/* 1. 과목 선택 */}
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  1. 어떤 과목을 배웠나요? <span className="text-rose-500">*</span>
                </h3>
                <div id="subject-container" className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((sub) => {
                    const isSelected = selectedSubject?.name === sub.name;
                    return (
                      <button
                        key={sub.name}
                        type="button"
                        onClick={() => setSelectedSubject(sub)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? `${sub.bgClass} text-white shadow-xs border-transparent scale-105`
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 학습 주제 입력 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900">
                    2. 학습 주제 입력하기 <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs text-slate-400">오늘 배운 단원이나 핵심 주제</span>
                </div>
                <input
                  id="topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 분수의 덧셈과 뺄셈, 우리나라의 사계절, 비유적 표현 등"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
                  required
                />
              </div>

              {/* 3. 배움 내용 기록하기 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900">
                    3. 배움 내용 기록하기 <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs text-slate-400">오늘 무엇을 배웠는지 적어보세요</span>
                </div>
                <textarea
                  id="reflection-1"
                  rows={4}
                  value={step1Text}
                  onChange={(e) => setStep1Text(e.target.value)}
                  placeholder="오늘 이 과목에서 어떤 내용을 배웠나요? 중요했던 개념이나 인상 깊었던 부분을 자유롭게 적어보세요."
                  className="w-full p-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm leading-relaxed transition-all resize-none"
                />
              </div>

              {/* OCR Section */}
              <div className="bg-sky-50/50 rounded-xl border border-sky-200 p-4 sm:p-5">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>공책 사진으로 기록하기 (AI 필기인식)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  수업 시간에 공책에 필기한 사진을 올리면 AI가 손글씨를 텍스트로 자동 변환해줍니다.
                </p>

                <div className="mt-3 flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    id="handwriting-image"
                    accept="image/*"
                    onChange={handleOcr}
                    disabled={ocrLoading}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 cursor-pointer"
                  />
                </div>

                {ocrLoading && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-sky-700 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>AI가 손글씨를 읽고 있습니다...</span>
                  </div>
                )}

                {ocrStatus && !ocrLoading && (
                  <p className="text-xs font-medium mt-2.5 text-center text-slate-700 bg-white p-2 rounded-md border border-sky-100">
                    {ocrStatus}
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  id="step1-next-btn"
                  onClick={handleStep1Next}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>다음 단계로 (AI 생각 확장 질문 받기)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* AI Loading State */}
          {aiLoading && (
            <div
              id="loading-state"
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 animate-pulse">
                  <Bot className="w-8 h-8" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-bounce" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  AI 선생님이 &lsquo;생각 한 칸 더&rsquo; 질문을 준비하고 있어요...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  작성해주신 학습 주제와 배움 기록을 바탕으로 생각을 한 단계 더 넓힐 수 있는 맞춤 질문을 생성합니다.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && !aiLoading && (
            <div id="step-2" className="space-y-5">
              {/* Review Step 1 */}
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${selectedSubject?.bgClass}`}>
                    {selectedSubject?.name}
                  </span>
                  {topic && (
                    <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                      주제: {topic}
                    </span>
                  )}
                </div>
                <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-line pt-1">
                  {step1Text}
                </p>
              </div>

              {/* AI Teacher Question Card */}
              <div className="bg-linear-to-br from-sky-50 to-sky-100/60 rounded-2xl p-5 sm:p-6 border border-sky-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-800 tracking-tight block">
                      AI 선생님의 &lsquo;생각 한 칸 더&rsquo; 질문
                    </span>
                    <span className="text-[11px] text-sky-600">
                      정답이 정해진 것이 아니니 자유롭게 나의 생각을 적어보세요!
                    </span>
                  </div>
                </div>

                <p className="text-slate-900 font-bold text-base leading-relaxed bg-white/90 p-4 rounded-xl border border-sky-200/70 shadow-2xs">
                  {aiQuestion}
                </p>

                {/* Hint Accordion */}
                {aiHint && (
                  <div className="pt-1">
                    <button
                      id="toggle-hint-btn"
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span>{showHint ? '생각 힌트 닫기' : '생각하기 어렵다면? 힌트 보기'}</span>
                      {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showHint && (
                      <div className="mt-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">힌트: </strong>
                          <span>{aiHint}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2 Input */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    생각 한 칸 더 나아가기 <span className="text-rose-500">*</span>
                  </h3>
                  <span className="text-xs text-slate-400">나만의 생각을 적어보세요</span>
                </div>

                <textarea
                  id="reflection-2"
                  rows={4}
                  value={step2Text}
                  onChange={(e) => setStep2Text(e.target.value)}
                  placeholder="선생님의 질문에 대한 나의 생각, 느낀 점, 앞으로 실천하고 싶은 점을 자유롭게 적어보세요."
                  className="w-full p-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm leading-relaxed transition-all resize-none"
                />

                <div className="pt-2 flex items-center justify-between">
                  <button
                    id="step2-prev-btn"
                    onClick={() => setCurrentStep(1)}
                    className="text-slate-500 hover:text-slate-800 text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>이전 단계 수정</span>
                  </button>

                  <button
                    id="submit-step2-btn"
                    onClick={handleSaveReflection}
                    disabled={savingReflection}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {savingReflection ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>성찰 저장 중...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>성찰 완료하기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

