import React, { useState } from 'react';
import { ArrowLeft, LogIn, Loader2, User, KeyRound, AlertCircle, School } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState, Room } from '../types';

interface StudentJoinProps {
  onBack: () => void;
  onJoined: (state: AppState) => void;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({
  onBack,
  onJoined,
  onAlert,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = studentName.trim();

    if (cleanCode.length < 4) {
      setJoinError('선생님께 전달받은 방 코드를 입력해주세요.');
      return;
    }

    if (!cleanName) {
      setJoinError('학생 이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      await ensureAuth();

      // Check Firestore room by ID or roomCode
      let roomData: Room | null = null;
      const roomDocRef = doc(db, 'rooms', cleanCode);
      const roomDocSnap = await getDoc(roomDocRef);

      if (roomDocSnap.exists()) {
        roomData = roomDocSnap.data() as Room;
      } else {
        const q = query(collection(db, 'rooms'), where('roomCode', '==', cleanCode));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          roomData = qSnap.docs[0].data() as Room;
        }
      }

      if (!roomData) {
        setJoinError('해당 방 코드를 찾을 수 없어요. 선생님께 코드를 다시 확인해 주세요.');
        setIsLoading(false);
        return;
      }

      const newState: AppState = {
        role: 'student',
        roomCode: cleanCode,
        roomName: roomData.roomName || `${roomData.teacherName} 선생님 학급`,
        teacherName: roomData.teacherName || '선생님',
        targetGrade: roomData.targetGrade || '초등학교 4~6학년',
        apiKey: roomData.apiKey || null,
        studentName: cleanName,
      };

      onJoined(newState);
    } catch (err: any) {
      console.error('Join Room Error:', err);
      setJoinError(
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
        className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>역할 선택으로 돌아가기</span>
      </button>

      <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/90 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">학급 방 입장하기</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              선생님께서 공유해주신 방 코드와 내 이름을 입력해주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4.5 mt-5">
          {/* Room Code Input */}
          <div>
            <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
              방 코드 <span className="text-rose-500">*</span>
            </label>
            <input
              id="join-room-code-input"
              type="text"
              maxLength={8}
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              placeholder="예: 7K4M9P"
              className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden text-center text-2xl font-mono font-black tracking-widest uppercase transition-all"
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 text-center mt-1.5">
              대소문자 구분 없이 입력하셔도 됩니다.
            </p>
          </div>

          {/* Student Name */}
          <div>
            <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
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
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setJoinError(null);
                }}
                placeholder="예: 김민우"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Error notice */}
          {joinError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{joinError}</span>
            </div>
          )}

          <button
            id="join-room-btn"
            type="submit"
            disabled={isLoading}
            className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>입장 확인 중...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>생각 한 칸 더 입장하기</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
