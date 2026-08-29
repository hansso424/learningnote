import React, { useState } from 'react';
import { ArrowLeft, DoorOpen, Key, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState } from '../types';

interface TeacherSetupProps {
  onBack: () => void;
  onRoomCreated: (state: AppState) => void;
  onAlert: (msg: string) => void;
}

export const TeacherSetup: React.FC<TeacherSetupProps> = ({
  onBack,
  onRoomCreated,
  onAlert,
}) => {
  const [teacherName, setTeacherName] = useState('');
  const [targetGrade, setTargetGrade] = useState('초등학교 4~6학년');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous chars like I, 1, O, 0
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherName.trim()) {
      onAlert('선생님 성함 또는 학급명을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      await ensureAuth();

      const roomCode = generateRoomCode();
      const roomRef = doc(db, 'rooms', roomCode);

      const roomData = {
        teacherName: teacherName.trim(),
        targetGrade,
        apiKey: apiKey.trim() || '',
        createdAt: Date.now(),
      };

      await setDoc(roomRef, roomData);

      const newState: AppState = {
        role: 'teacher',
        roomCode,
        teacherName: teacherName.trim(),
        targetGrade,
        apiKey: apiKey.trim() || null,
        studentName: null,
      };

      onRoomCreated(newState);
    } catch (err: any) {
      console.error('Create Room Error:', err);
      onAlert(
        '방 생성에 실패했습니다.\n' +
          (err.message || 'Firebase 연결 상태를 확인해주세요.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="teacher-setup-screen" className="max-w-xl mx-auto py-6 space-y-6">
      <button
        id="teacher-back-btn"
        onClick={onBack}
        className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-medium text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>역할 선택으로 돌아가기</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">새 학급 방 만들기</h2>
            <p className="text-xs text-slate-500">
              방을 만들면 고유한 5자리 방 코드가 생성되어 학생들과 공유할 수 있습니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateRoom} className="space-y-5 mt-6">
          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">
              선생님 성함 / 학급명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="teacher-name-input"
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="예: 6학년 2반 김선생님"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">
              대상 학년 <span className="text-rose-500">*</span>
            </label>
            <select
              id="teacher-grade-select"
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
            >
              <option value="초등학교 1~3학년">초등학교 1~3학년 (저학년 맞춤 눈높이)</option>
              <option value="초등학교 4~6학년">초등학교 4~6학년 (고학년 맞춤 성찰)</option>
              <option value="중학생">중학생 (심화 사고 확장)</option>
              <option value="고등학생">고등학생 (자기주도 학습 성찰)</option>
            </select>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Gemini API 키 (선택 사항)</span>
              </label>
              <span className="text-[11px] text-slate-400">자체 키 사용 가능</span>
            </div>
            <input
              id="teacher-apikey-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (입력하지 않아도 기본 AI 질문이 제공됩니다)"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
            />
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>
                Gemini API 키를 입력하시면 학생들의 손글씨 공책 인식(OCR)과 맞춤형 AI 질문이 더 정교하게 작동합니다.{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline font-medium hover:text-sky-700"
                >
                  Google AI Studio에서 발급받기
                </a>
              </span>
            </p>
          </div>

          <button
            id="create-room-btn"
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>학급 방 생성 중...</span>
              </>
            ) : (
              <>
                <DoorOpen className="w-5 h-5" />
                <span>방 만들기 및 입장하기</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
