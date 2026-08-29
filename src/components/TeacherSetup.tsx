import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  DoorOpen,
  Key,
  Loader2,
  Sparkles,
  UserCheck,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  School,
  Lock,
  History,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { AppState, Room } from '../types';

interface TeacherSetupProps {
  onBack: () => void;
  onRoomCreated: (state: AppState) => void;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

const STORAGE_MY_ROOMS_KEY = 'my_teacher_rooms';

interface SavedTeacherRoom {
  roomCode: string;
  roomName: string;
  teacherName: string;
  targetGrade: string;
  lastVisited: number;
}

export const TeacherSetup: React.FC<TeacherSetupProps> = ({
  onBack,
  onRoomCreated,
  onAlert,
}) => {
  // Mode: 'select' (choose new room or enter code) | 'create' (form) | 'created_success' (celebration) | 'enter' (input room code)
  const [mode, setMode] = useState<'select' | 'create' | 'created_success' | 'enter'>('select');

  // Create Form states
  const [teacherName, setTeacherName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [targetGrade, setTargetGrade] = useState('초등학교 5학년');
  const [teacherPasscode, setTeacherPasscode] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Newly created room state for celebration screen
  const [createdRoom, setCreatedRoom] = useState<{
    roomCode: string;
    roomName: string;
    teacherName: string;
    targetGrade: string;
    apiKey: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Enter Existing Room states
  const [enterCode, setEnterCode] = useState('');
  const [enterPasscode, setEnterPasscode] = useState('');
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<Room | null>(null);
  const [enterError, setEnterError] = useState<string | null>(null);

  // Saved rooms on this browser
  const [savedRooms, setSavedRooms] = useState<SavedTeacherRoom[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MY_ROOMS_KEY);
      if (raw) {
        const parsed: SavedTeacherRoom[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedRooms(parsed.sort((a, b) => b.lastVisited - a.lastVisited));
        }
      }
    } catch (e) {
      console.warn('Failed to load saved teacher rooms:', e);
    }
  }, []);

  const saveToLocalRooms = (room: {
    roomCode: string;
    roomName?: string;
    teacherName: string;
    targetGrade: string;
  }) => {
    try {
      const currentList: SavedTeacherRoom[] = savedRooms.filter(
        (r) => r.roomCode.toUpperCase() !== room.roomCode.toUpperCase()
      );
      const updatedList: SavedTeacherRoom[] = [
        {
          roomCode: room.roomCode.toUpperCase(),
          roomName: room.roomName || `${room.teacherName} 선생님 학급`,
          teacherName: room.teacherName,
          targetGrade: room.targetGrade,
          lastVisited: Date.now(),
        },
        ...currentList,
      ].slice(0, 10);

      setSavedRooms(updatedList);
      localStorage.setItem(STORAGE_MY_ROOMS_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Failed to save to local rooms:', e);
    }
  };

  /**
   * Generates a clean, unambiguous 6-character room code (e.g. 7K4M9P)
   * Avoids easily confused characters: 0, O, 1, I, l
   */
  const generateRoomCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 1. Create Room Handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherName.trim()) {
      onAlert('선생님 성함을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      await ensureAuth();

      // Generate unique 6-character room code
      let roomCode = generateRoomCode();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        attempts++;
        const checkDoc = await getDoc(doc(db, 'rooms', roomCode));
        if (!checkDoc.exists()) {
          isUnique = true;
        } else {
          roomCode = generateRoomCode();
        }
      }

      const finalRoomName = roomName.trim() || `${teacherName.trim()} 선생님 학급`;
      const cleanTeacherName = teacherName.trim();
      const cleanPasscode = teacherPasscode.trim();

      const newRoom: Room = {
        roomId: roomCode,
        roomCode,
        roomName: finalRoomName,
        teacherName: cleanTeacherName,
        teacherPasscode: cleanPasscode || '',
        targetGrade,
        apiKey: apiKey.trim() || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      };

      // Save to Firestore rooms collection
      await setDoc(doc(db, 'rooms', roomCode), newRoom);

      // Save to local device memory for quick access
      saveToLocalRooms({
        roomCode,
        roomName: finalRoomName,
        teacherName: cleanTeacherName,
        targetGrade,
      });

      // Prepare state for celebration screen
      setCreatedRoom({
        roomCode,
        roomName: finalRoomName,
        teacherName: cleanTeacherName,
        targetGrade,
        apiKey: apiKey.trim() || null,
      });

      setMode('created_success');
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

  // Proceed to dashboard after creation celebration
  const handleProceedToDashboard = () => {
    if (!createdRoom) return;

    const newState: AppState = {
      role: 'teacher',
      roomCode: createdRoom.roomCode,
      roomName: createdRoom.roomName,
      teacherName: createdRoom.teacherName,
      targetGrade: createdRoom.targetGrade,
      apiKey: createdRoom.apiKey,
      studentName: null,
    };

    onRoomCreated(newState);
  };

  // Copy created room code
  const handleCopyCreatedCode = async () => {
    if (!createdRoom) return;
    try {
      await navigator.clipboard.writeText(createdRoom.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onAlert(`방 코드 [${createdRoom.roomCode}]가 복사되었습니다.`, 'success');
    } catch {
      onAlert(`방 코드: ${createdRoom.roomCode}`);
    }
  };

  // 2. Lookup and enter room by code
  const handleLookupAndEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnterError(null);

    const cleanCode = enterCode.trim().toUpperCase();

    if (cleanCode.length < 4) {
      setEnterError('올바른 방 코드를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      await ensureAuth();

      // Check Firestore doc by ID or roomCode field
      let roomData: Room | null = null;
      const roomDocRef = doc(db, 'rooms', cleanCode);
      const roomDocSnap = await getDoc(roomDocRef);

      if (roomDocSnap.exists()) {
        roomData = roomDocSnap.data() as Room;
      } else {
        // Query by roomCode field as fallback
        const q = query(collection(db, 'rooms'), where('roomCode', '==', cleanCode));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          roomData = qSnap.docs[0].data() as Room;
        }
      }

      if (!roomData) {
        setEnterError('방 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.');
        setIsLoading(false);
        return;
      }

      // Check if room has teacher passcode verification
      if (roomData.teacherPasscode && roomData.teacherPasscode.trim() !== '') {
        // If passcode was not yet provided or doesn't match
        if (!needsPasscode) {
          // Check if this browser already saved this room recently
          const isKnownOnDevice = savedRooms.some(
            (r) => r.roomCode.toUpperCase() === cleanCode
          );

          if (!isKnownOnDevice) {
            // Require passcode prompt
            setPendingRoomData(roomData);
            setNeedsPasscode(true);
            setIsLoading(false);
            return;
          }
        } else {
          // Passcode was submitted
          if (enterPasscode.trim() !== roomData.teacherPasscode.trim()) {
            setEnterError('교사 확인 비밀번호가 일치하지 않습니다.');
            setIsLoading(false);
            return;
          }
        }
      }

      // Enter the room successfully!
      saveToLocalRooms({
        roomCode: cleanCode,
        roomName: roomData.roomName || `${roomData.teacherName} 선생님 학급`,
        teacherName: roomData.teacherName,
        targetGrade: roomData.targetGrade,
      });

      const newState: AppState = {
        role: 'teacher',
        roomCode: cleanCode,
        roomName: roomData.roomName || `${roomData.teacherName} 선생님 학급`,
        teacherName: roomData.teacherName || '선생님',
        targetGrade: roomData.targetGrade || '초등학교 5학년',
        apiKey: roomData.apiKey || null,
        studentName: null,
      };

      onRoomCreated(newState);
    } catch (err: any) {
      console.error('Enter Room Error:', err);
      setEnterError(
        '방 조회 중 오류가 발생했습니다.\n' +
          (err.message || '인터넷 연결 상태를 확인해주세요.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Quick enter from saved list
  const handleQuickEnter = (saved: SavedTeacherRoom) => {
    setEnterCode(saved.roomCode);
    setMode('enter');
    setEnterError(null);
    setNeedsPasscode(false);
  };

  // -------------------------------------------------------------
  // VIEW 1: SELECTION MENU (새 방 만들기 vs 방 코드로 입장)
  // -------------------------------------------------------------
  if (mode === 'select') {
    return (
      <div id="teacher-start-screen" className="max-w-2xl mx-auto py-6 space-y-6">
        <button
          id="teacher-back-btn"
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>역할 선택으로 돌아가기</span>
        </button>

        {/* Title Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-full text-xs font-bold">
            <School className="w-3.5 h-3.5" />
            <span>선생님 전용 공간</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            교사로 시작하기
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            새로운 학급 수업 방을 개설하거나, 이전에 발급받은 방 코드로 내 수업에 다시 입장하세요.
          </p>
        </div>

        {/* Main 2 Action Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Action 1: Create New Room */}
          <button
            id="btn-choice-create-room"
            onClick={() => setMode('create')}
            className="group relative bg-white border-2 border-slate-200 hover:border-sky-500 hover:shadow-md rounded-3xl p-6 sm:p-7 text-left transition-all duration-200 flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="w-13 h-13 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl mb-4 group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all">
                <PlusCircle className="w-7 h-7" />
              </div>
              <h2 className="font-extrabold text-lg sm:text-xl text-slate-900 group-hover:text-sky-600 transition-colors">
                새 방 만들기
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                선생님 이름과 학급명을 설정하고 고유한 방 코드를 새로 발급받습니다.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
              <span>새 학급 개설하기</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </button>

          {/* Action 2: Enter with Room Code */}
          <button
            id="btn-choice-enter-room"
            onClick={() => {
              setMode('enter');
              setEnterError(null);
              setNeedsPasscode(false);
            }}
            className="group relative bg-white border-2 border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-3xl p-6 sm:p-7 text-left transition-all duration-200 flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl mb-4 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <LogIn className="w-7 h-7" />
              </div>
              <h2 className="font-extrabold text-lg sm:text-xl text-slate-900 group-hover:text-indigo-600 transition-colors">
                이미 만든 방이 있나요?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                발급받은 방 코드를 입력하여 선생님의 학급 대시보드로 즉시 재입장합니다.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
              <span>방 코드로 바로 입장</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </button>
        </div>

        {/* Recently Managed Rooms on this device */}
        {savedRooms.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-800">이 브라우저에서 관리한 내 방 목록</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">클릭 시 빠른 재입장</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedRooms.map((room) => (
                <div
                  key={room.roomCode}
                  onClick={() => handleQuickEnter(room)}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-sky-300 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors">
                      {room.roomName}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{room.teacherName} 선생님</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-sky-600">{room.roomCode}</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-sky-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs group-hover:bg-sky-600 group-hover:text-white transition-all">
                    입장
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: CREATE NEW ROOM FORM
  // -------------------------------------------------------------
  if (mode === 'create') {
    return (
      <div id="teacher-create-screen" className="max-w-xl mx-auto py-6 space-y-6">
        <button
          onClick={() => setMode('select')}
          className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>교사 메뉴로 돌아가기</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/90 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">새 학급 방 만들기</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                선생님 정보를 입력하면 학생들이 입장할 고유 방 코드가 발급됩니다.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-4.5 mt-5">
            {/* Teacher Name */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                선생님 성함 <span className="text-rose-500">*</span>
              </label>
              <input
                id="create-teacher-name-input"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
                required
              />
            </div>

            {/* Room Name */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                학급 / 방 이름 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <input
                id="create-room-name-input"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="예: 5학년 과학 2반"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              />
            </div>

            {/* Target Grade */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                대상 학년 <span className="text-rose-500">*</span>
              </label>
              <select
                id="create-target-grade-select"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              >
                <option value="초등학교 1학년">초등학교 1학년</option>
                <option value="초등학교 2학년">초등학교 2학년</option>
                <option value="초등학교 3학년">초등학교 3학년</option>
                <option value="초등학교 4학년">초등학교 4학년</option>
                <option value="초등학교 5학년">초등학교 5학년</option>
                <option value="초등학교 6학년">초등학교 6학년</option>
                <option value="초등학교 4~6학년">초등학교 4~6학년 (고학년 종합)</option>
                <option value="중학생">중학생 (심화 사고 확장)</option>
                <option value="고등학생">고등학생 (자기주도 성찰)</option>
              </select>
            </div>

            {/* Teacher Passcode (Security protection against student unauthorized takeover) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>교사 확인 비밀번호</span>
                </label>
                <span className="text-[11px] text-slate-400">학생 무단 접근 방지 (선택/권장)</span>
              </div>
              <input
                id="create-passcode-input"
                type="password"
                value={teacherPasscode}
                onChange={(e) => setTeacherPasscode(e.target.value)}
                placeholder="4~6자리 숫자 또는 문자 (예: 1234)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>방 코드를 아는 학생이 교사 관리자 페이지에 함부로 들어오는 것을 방지합니다.</span>
              </p>
            </div>

            {/* Gemini API Key (Optional) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Gemini API 키 (선택 사항)</span>
                </label>
                <span className="text-[11px] text-slate-400">자체 키 사용 가능</span>
              </div>
              <input
                id="create-apikey-input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (입력하지 않아도 기본 AI 성찰 질문이 제공됩니다)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              />
            </div>

            <button
              id="submit-create-room-btn"
              type="submit"
              disabled={isLoading}
              className="mt-5 w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>방 생성 및 코드 발급 중...</span>
                </>
              ) : (
                <>
                  <DoorOpen className="w-5 h-5" />
                  <span>방 만들기 및 코드 발급</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: CELEBRATION / ROOM CREATED SCREEN
  // -------------------------------------------------------------
  if (mode === 'created_success' && createdRoom) {
    return (
      <div id="room-created-success-screen" className="max-w-lg mx-auto py-6 space-y-6">
        <div className="bg-white rounded-3xl shadow-md border border-slate-200/90 p-7 sm:p-9 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-3xl mx-auto shadow-2xs animate-bounce">
            🎉
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              방이 만들어졌어요!
            </h2>
            <p className="text-base font-bold text-sky-700">
              {createdRoom.roomName}
            </p>
            <p className="text-xs text-slate-500">
              {createdRoom.teacherName} 선생님 • {createdRoom.targetGrade}
            </p>
          </div>

          {/* Prominent Room Code Box */}
          <div className="bg-linear-to-b from-sky-50 to-indigo-50/40 p-6 rounded-3xl border-2 border-sky-200/80 space-y-2">
            <div className="text-xs font-bold text-sky-800 uppercase tracking-wider">
              학생 입장용 방 코드
            </div>
            <div
              id="celebration-room-code"
              className="text-4xl sm:text-5xl font-mono font-black text-sky-700 tracking-widest py-1 select-all"
            >
              #{createdRoom.roomCode}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto pt-1">
              이 코드를 학생들에게 알려주세요.
              <br />
              학생들은 이 코드를 입력해서 선생님의 수업에 참여할 수 있어요.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              id="celebration-copy-code-btn"
              onClick={handleCopyCreatedCode}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">코드가 복사되었습니다!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>방 코드 복사하기</span>
                </>
              )}
            </button>

            <button
              id="celebration-enter-dash-btn"
              onClick={handleProceedToDashboard}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>교사 페이지로 이동</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 4: ENTER ROOM BY CODE (RE-ENTRY)
  // -------------------------------------------------------------
  return (
    <div id="teacher-enter-screen" className="max-w-xl mx-auto py-6 space-y-6">
      <button
        onClick={() => {
          setMode('select');
          setEnterError(null);
          setNeedsPasscode(false);
        }}
        className="text-slate-500 hover:text-slate-800 flex items-center gap-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>교사 메뉴로 돌아가기</span>
      </button>

      <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/90 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">방 코드로 입장</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              이전에 생성한 방 코드를 입력하면 교사 이름 및 설정이 자동으로 불러와집니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleLookupAndEnter} className="space-y-4.5 mt-5">
          {/* Room Code Input */}
          <div>
            <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
              방 코드 <span className="text-rose-500">*</span>
            </label>
            <input
              id="teacher-enter-room-code-input"
              type="text"
              maxLength={8}
              value={enterCode}
              onChange={(e) => {
                setEnterCode(e.target.value.toUpperCase());
                setEnterError(null);
              }}
              placeholder="예: 7K4M9P"
              className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden text-center text-2xl font-mono font-black tracking-widest uppercase transition-all"
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 text-center mt-1.5">
              대소문자 구분 없이 5~6자리 영문/숫자를 입력하세요.
            </p>
          </div>

          {/* Passcode field if protected */}
          {needsPasscode && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>교사 확인 비밀번호 입력</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                방 생성 시 등록한 교사 확인 비밀번호를 입력해주세요.
              </p>
              <input
                id="teacher-enter-passcode-input"
                type="password"
                value={enterPasscode}
                onChange={(e) => {
                  setEnterPasscode(e.target.value);
                  setEnterError(null);
                }}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-sm"
                required
                autoFocus
              />
            </div>
          )}

          {/* Error notice */}
          {enterError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{enterError}</span>
            </div>
          )}

          <button
            id="btn-teacher-enter-submit"
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>방 조회 및 확인 중...</span>
              </>
            ) : (
              <>
                <DoorOpen className="w-5 h-5" />
                <span>방 입장하기</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
