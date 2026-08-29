import React from 'react';
import { Sprout, LogOut, User as UserIcon, School } from 'lucide-react';
import { AppState } from '../types';

interface NavbarProps {
  appState: AppState;
  onLogout: () => void;
  onGoHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ appState, onLogout, onGoHome }) => {
  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-xs border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div
          id="nav-logo"
          onClick={onGoHome}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform duration-200">
            <Sprout className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-slate-800 flex items-center gap-1.5">
              배움성찰노트
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-md">
                AI
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {appState.role === 'student' && appState.roomCode && (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                <School className="w-3.5 h-3.5 text-slate-500" />
                <span>방 코드:</span>
                <span className="font-mono font-bold text-sky-600 tracking-wider">
                  {appState.roomCode}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-1">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm border border-sky-200 shadow-xs">
                  {appState.studentName ? appState.studentName.charAt(0) : <UserIcon className="w-4 h-4" />}
                </div>
                <span className="font-medium text-sm text-slate-700 hidden md:inline">
                  {appState.studentName} 학생
                </span>
              </div>
              <button
                id="student-logout-btn"
                onClick={onLogout}
                title="나가기"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {appState.role === 'teacher' && appState.roomCode && (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-800">
                <School className="w-3.5 h-3.5 text-sky-600" />
                <span>{appState.teacherName} 선생님</span>
                <span className="mx-1 text-sky-300">|</span>
                <span className="font-mono font-bold tracking-wider">{appState.roomCode}</span>
              </div>
              <button
                id="teacher-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>방 나가기</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
