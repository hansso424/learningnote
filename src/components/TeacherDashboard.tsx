import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RotateCw,
  Search,
  Filter,
  Users,
  BookOpen,
  PieChart,
  Calendar,
  Sparkles,
  School,
  FileDown,
  ChevronRight,
  User,
  Bookmark,
  FolderOpen,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState, Reflection, Room } from '../types';
import { LearningMaterialsManager } from './LearningMaterialsManager';

interface TeacherDashboardProps {
  appState: AppState;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

type TeacherTab = 'dashboard' | 'reflections' | 'materials' | 'settings';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  appState,
  onAlert,
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('dashboard');
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  // Room details for settings tab
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [newRoomCodeCopied, setNewRoomCodeCopied] = useState(false);

  useEffect(() => {
    loadReflections();
    loadRoomDetails();
  }, [appState.roomCode]);

  const loadRoomDetails = async () => {
    if (!appState.roomCode) return;
    try {
      await ensureAuth();
      const snap = await getDocs(
        query(collection(db, 'rooms'), where('roomCode', '==', appState.roomCode))
      );
      if (!snap.empty) {
        setRoomData(snap.docs[0].data() as Room);
      }
    } catch (e) {
      console.warn('Load room details notice:', e);
    }
  };

  const loadReflections = async () => {
    if (!appState.roomCode) return;
    setLoading(true);
    try {
      await ensureAuth();
      const refCol = collection(db, 'reflections');
      const q = query(
        refCol,
        where('roomCode', '==', appState.roomCode)
      );

      const snap = await getDocs(q);
      const list: Reflection[] = [];
      snap.forEach((d) => {
        list.push({
          id: d.id,
          ...(d.data() as Omit<Reflection, 'id'>),
        });
      });

      list.sort((a, b) => b.timestamp - a.timestamp);
      setReflections(list);
    } catch (err: any) {
      console.error('Load teacher reflections error:', err);
      onAlert('성찰 기록을 불러오지 못했습니다.\n' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRoomCode = async (codeToCopy?: string) => {
    const targetCode = codeToCopy || appState.roomCode;
    if (!targetCode) return;
    try {
      await navigator.clipboard.writeText(targetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onAlert(`방 입장 코드 [${targetCode}]가 복사되었습니다.`, 'success');
    } catch {
      onAlert(`방 입장 코드: ${targetCode}`);
    }
  };

  // Compute Statistics
  const totalReflections = reflections.length;
  const uniqueStudents = Array.from(new Set(reflections.map((r) => r.studentName)));

  // Subject counts
  const subjectCounts: Record<string, number> = {};
  reflections.forEach((r) => {
    subjectCounts[r.subject] = (subjectCounts[r.subject] || 0) + 1;
  });

  const subjectList = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
  const topSubject = subjectList[0] ? subjectList[0][0] : '-';

  // Recent students
  const studentStats: Record<string, { count: number; latest: number }> = {};
  reflections.forEach((r) => {
    if (!studentStats[r.studentName]) {
      studentStats[r.studentName] = { count: 0, latest: r.timestamp };
    }
    studentStats[r.studentName].count += 1;
    if (r.timestamp > studentStats[r.studentName].latest) {
      studentStats[r.studentName].latest = r.timestamp;
    }
  });

  const topActiveStudents = Object.entries(studentStats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.latest - a.latest)
    .slice(0, 5);

  // Filtered Reflections
  const filteredReflections = reflections.filter((r) => {
    const matchSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.step1Text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.step2Text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSub = filterSubject === 'all' || r.subject === filterSubject;
    return matchSearch && matchSub;
  });

  const handleExportCSV = () => {
    if (reflections.length === 0) {
      onAlert('내보낼 기록이 없습니다.');
      return;
    }
    const headers = [
      '날짜',
      '시간',
      '학생이름',
      '과목',
      '학습주제',
      '연계_학습자료',
      '생각다듬기_수정횟수',
      '1단계_기록',
      'AI_피드백',
      'AI_질문',
      '2단계_생각한칸더',
    ];
    const rows = reflections.map((r) => {
      const d = new Date(r.timestamp);
      return [
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString()}"`,
        `"${r.studentName}"`,
        `"${r.subject}"`,
        `"${(r.topic || '').replace(/"/g, '""')}"`,
        `"${(r.matchedMaterialTitle || '-').replace(/"/g, '""')}"`,
        `"${r.revisionCount || 0}"`,
        `"${r.step1Text.replace(/"/g, '""')}"`,
        `"${(r.analysisResult?.feedback || '').replace(/"/g, '""')}"`,
        `"${r.aiQuestion.replace(/"/g, '""')}"`,
        `"${r.step2Text.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `생각한칸더_성찰기록_${appState.roomCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const subjectColorsMap: Record<string, string> = {
    국어: '#f43f5e',
    수학: '#3b82f6',
    사회: '#f97316',
    과학: '#10b981',
    기타: '#64748b',
  };

  const displayName = appState.roomName || `${appState.teacherName} 선생님 학급`;

  return (
    <div id="teacher-dashboard" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-sky-700 via-sky-800 to-indigo-900 rounded-3xl shadow-md p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sky-200 text-xs font-semibold mb-1">
            <School className="w-4 h-4" />
            <span>{appState.targetGrade || '학급 관리'}</span>
          </div>
          <h2 id="dash-teacher-name" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {displayName}
          </h2>
          <p className="text-sky-100 text-xs sm:text-sm mt-1.5 opacity-90">
            {appState.teacherName} 선생님 • 학생들에게 아래 방 코드를 공유하여 성찰을 수집하세요.
          </p>
        </div>

        {/* Room Code Box */}
        <div
          id="copy-room-code-btn"
          onClick={() => handleCopyRoomCode()}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center cursor-pointer transition-all w-full sm:w-auto select-none"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-200 flex items-center justify-center gap-1">
            <span>방 입장 코드</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
          </div>
          <div
            id="dash-room-code"
            className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white mt-1"
          >
            {appState.roomCode}
          </div>
          <div className="text-[10px] text-sky-200/80 mt-1">
            {copied ? '복사되었습니다!' : '클릭하여 코드 복사'}
          </div>
        </div>
      </div>

      {/* Teacher Navigation Menu Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-3 overflow-x-auto">
        <button
          id="tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>대시보드</span>
        </button>

        <button
          id="tab-reflections"
          onClick={() => setActiveTab('reflections')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reflections'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>배움노트 기록 ({totalReflections})</span>
        </button>

        <button
          id="tab-materials"
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'materials'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-white text-teal-800 hover:bg-teal-50 border border-teal-200'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-teal-600" />
          <span>학습자료 관리</span>
          <span className="bg-teal-100 text-teal-800 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold">
            NEW
          </span>
        </button>

        <button
          id="tab-settings"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>방 정보 및 설정</span>
        </button>
      </div>

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-1">총 성찰 기록</span>
                <span className="text-2xl font-extrabold text-slate-800">{totalReflections}</span>
                <span className="text-xs text-slate-500 ml-1">건</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-1">참여 학생 수</span>
                <span className="text-2xl font-extrabold text-slate-800">{uniqueStudents.length}</span>
                <span className="text-xs text-slate-500 ml-1">명</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-2xs border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-1">가장 많은 성찰 과목</span>
                <span className="text-2xl font-extrabold text-slate-800">{topSubject}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <PieChart className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Subject Distribution & Recent Students */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Ratio */}
            <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-sky-600" />
                  <span>과목별 성찰 현황</span>
                </h3>
                <span className="text-xs text-slate-400">총 {totalReflections}건 기준</span>
              </div>

              {subjectList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  아직 기록된 성찰이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectList.map(([sub, count]) => {
                    const percent = Math.round((count / totalReflections) * 100);
                    return (
                      <div key={sub} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: subjectColorsMap[sub] || '#64748b' }}
                            />
                            {sub}
                          </span>
                          <span className="text-slate-500">
                            {count}건 ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: subjectColorsMap[sub] || '#64748b',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Active Students */}
            <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>최근 성찰 작성 학생</span>
                </h3>
                <span className="text-xs text-slate-400">활동 순위</span>
              </div>

              {topActiveStudents.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  활동한 학생이 없습니다.
                </div>
              ) : (
                <div id="dash-recent-students" className="space-y-2.5">
                  {topActiveStudents.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm border border-sky-200">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">{s.name} 학생</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(s.latest).toLocaleDateString('ko-KR', {
                              month: 'numeric',
                              day: 'numeric',
                            })}{' '}
                            {new Date(s.latest).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                        총 {s.count}회 기록
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REFLECTIONS STREAM */}
      {activeTab === 'reflections' && (
        <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                <span>전체 학생 성찰 기록</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                학급 학생들이 제출한 배움 기록과 AI 질문 답변을 실시간으로 확인합니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="export-csv-btn"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>CSV 다운로드</span>
              </button>
              <button
                id="btn-refresh-dash"
                onClick={loadReflections}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl border border-sky-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>새로고침</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="teacher-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="학생 이름이나 주제, 배움 내용 검색..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterSubject('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterSubject === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                전체
              </button>
              {Object.keys(subjectCounts).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setFilterSubject(sub)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterSubject === sub
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sub} ({subjectCounts[sub]})
                </button>
              ))}
            </div>
          </div>

          {/* Reflections List */}
          <div id="dash-all-reflections" className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-sky-500" />
                <span>기록을 불러오는 중...</span>
              </div>
            ) : filteredReflections.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                일치하는 성찰 기록이 없습니다.
              </div>
            ) : (
              filteredReflections.map((ref) => {
                const date = new Date(ref.timestamp).toLocaleString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={ref.id || ref.timestamp}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            <Bookmark className="w-3 h-3 text-sky-600" />
                            <span>{ref.topic}</span>
                          </span>
                        )}
                        {ref.matchedMaterialTitle && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            <FolderOpen className="w-3 h-3 text-teal-600" />
                            <span>자료연계: {ref.matchedMaterialTitle}</span>
                          </span>
                        )}
                        {ref.revisionCount && ref.revisionCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <RotateCw className="w-2.5 h-2.5" />
                            <span>수정 {ref.revisionCount}회</span>
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-slate-400">{date}</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                          1단계 배움 기록
                        </span>
                        <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-line">
                          {ref.step1Text}
                        </p>
                      </div>

                      <div className="bg-sky-50/70 p-3.5 rounded-xl border border-sky-100 space-y-1.5">
                        <span className="font-bold text-sky-800 text-[11px] block">
                          AI 생각 확장 질문: &ldquo;{ref.aiQuestion}&rdquo;
                        </span>
                        <p className="text-slate-900 font-medium leading-relaxed whitespace-pre-line pt-1">
                          👉 <strong>생각 한 칸 더:</strong> {ref.step2Text}
                        </p>
                      </div>

                      {/* AI Analysis Details */}
                      {ref.analysisResult && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-sky-600" />
                              <span>AI 배움 분석 결과</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
                              {ref.analysisResult.status === 'ready_for_question'
                                ? '핵심 개념 파악 완료'
                                : ref.analysisResult.status === 'needs_revision'
                                ? '개념 점검 수정'
                                : '내용 보완 완료'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                            {ref.analysisResult.feedback}
                          </p>

                          {ref.analysisResult.learningSummary && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {ref.analysisResult.learningSummary.coveredConcepts?.map((c, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-medium"
                                >
                                  ✓ {c}
                                </span>
                              ))}
                            </div>
                          )}

                          {ref.revisionHistory && ref.revisionHistory.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-500">
                              <span className="font-bold text-slate-600 block mb-1">
                                📝 이전 초안 수정 이력 ({ref.revisionHistory.length}건):
                              </span>
                              <div className="space-y-1">
                                {ref.revisionHistory.map((rh, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-white rounded-md border border-slate-200 text-[10px] text-slate-600"
                                  >
                                    <span className="font-bold text-slate-700 mr-2">
                                      #{rh.revisionNumber}차 작성:
                                    </span>
                                    <span className="italic">&ldquo;{rh.content}&rdquo;</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LEARNING MATERIALS MANAGER */}
      {activeTab === 'materials' && (
        <LearningMaterialsManager
          appState={appState}
          onAlert={onAlert}
        />
      )}

      {/* TAB 4: ROOM SETTINGS & INFORMATION */}
      {activeTab === 'settings' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-700" />
                <span>학급 방 정보 및 설정</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                현재 수업 방의 고유 정보와 학생 공유 코드를 확인하고 관리합니다.
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>활성 상태 (Active)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                방 / 학급 이름
              </span>
              <span className="text-base font-extrabold text-slate-900 block">
                {displayName}
              </span>
            </div>

            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                담당 교사
              </span>
              <span className="text-base font-extrabold text-slate-900 block">
                {appState.teacherName} 선생님
              </span>
            </div>

            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                대상 학년
              </span>
              <span className="text-base font-extrabold text-slate-900 block">
                {appState.targetGrade || '초등학교 5학년'}
              </span>
            </div>

            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                생성 일자
              </span>
              <span className="text-base font-extrabold text-slate-900 block">
                {roomData?.createdAt
                  ? new Date(roomData.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '등록 완료'}
              </span>
            </div>
          </div>

          {/* Room Code Card */}
          <div className="p-6 rounded-3xl bg-linear-to-r from-sky-50 to-indigo-50/60 border border-sky-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                  현재 학생 참여용 방 코드
                </div>
                <div className="text-3xl sm:text-4xl font-mono font-black text-sky-700 tracking-widest mt-1">
                  #{appState.roomCode}
                </div>
              </div>

              <button
                id="settings-copy-code-btn"
                onClick={() => handleCopyRoomCode()}
                className="bg-white hover:bg-sky-50 text-sky-700 font-bold px-5 py-3 rounded-2xl border border-sky-200 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '복사 완료' : '방 코드 복사'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-600 flex items-start gap-2 bg-white/70 p-3.5 rounded-2xl border border-sky-100">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                방 코드를 학생들에게 전달하면 학생들은 별도의 회원가입 없이 코드와 본인 이름만으로 즉시 수업에 참여할 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
