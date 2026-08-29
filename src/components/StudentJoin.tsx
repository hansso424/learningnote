import React, { useState } from 'react';
import { ArrowLeft, LogIn, Loader2, User, KeyRound } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState } from '../types';

interface StudentJoinProps {
  onBack: () => void;
  onJoined: (state: AppState) => void;
  onAlert: (msg: string) => void;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({
  onBack,
  onJoined,
  onAlert,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = studentName.trim();

    if (cleanCode.length !== 5) {
      onAlert('5자리 방 코드를 정확히 입력해주세요.');
      return;
    }

    if (!cleanName) {
      onAlert('이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      await ensureAuth();

      const roomRef = doc(db, 'rooms', cleanCode);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        onAlert('해당 방을 찾을 수 없습니다.\n선생님께서 알려주신 방 코드를 다시 확인해주세요.');
        return;
      }

      const roomData = roomSnap.data();

      const newState: AppState = {
        role: 'student',
        roomCode: cleanCode,
        teacherName: roomData.teacherName || '선생님',
        targetGrade: roomData.targetGrade || '초등학교 4~6학년',
        apiKey: roomData.apiKey || null,
        studentName: cleanName,
      };

      onJoined(newState);
    } catch (err: any) {
      console.error('Join Room Error:', err);
      onAlert(
        '방 입장에 실패했습니다.\n' +
          (err.message || '인터넷 연결 및 Firebase 설정을 확인해주세요.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="student-join-screen" className="max-w-xl mx-auto py-6 space-y-6">
      <button
        id="student-back-btn"
        onClick={onBack}
        className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-medium text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>역할 선택으로 돌아가기</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">학급 방 입장하기</h2>
            <p className="text-xs text-slate-500">
              선생님께서 공유해주신 5자리 코드를 입력해주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-5 mt-6">
          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">
              방 코드 (5자리) <span className="text-rose-500">*</span>
            </label>
            <input
              id="join-room-code-input"
              type="text"
              maxLength={5}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="예: A3F9K"
              className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden text-center text-2xl font-mono font-bold tracking-widest uppercase transition-all"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800 block mb-1.5">
              학생 이름 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="join-student-name-input"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden text-sm transition-all"
                required
              />
            </div>
          </div>

          <button
            id="join-room-btn"
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>입장 확인 중...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>성찰노트 입장하기</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
