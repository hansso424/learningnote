import React, { useState, useEffect } from 'react';
import { AppState, UserRole } from './types';
import { Navbar } from './components/Navbar';
import { RoleSelect } from './components/RoleSelect';
import { TeacherSetup } from './components/TeacherSetup';
import { StudentJoin } from './components/StudentJoin';
import { StudentView } from './components/StudentView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AlertModal } from './components/AlertModal';
import { ensureAuth } from './lib/firebase';

const STORAGE_KEY = 'learnNoteAppState';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved state:', e);
    }
    return {
      role: 'none',
      roomCode: null,
      teacherName: null,
      targetGrade: null,
      apiKey: null,
      studentName: null,
    };
  });

  const [alertInfo, setAlertInfo] = useState<{
    isOpen: boolean;
    message: string;
    type: 'alert' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'alert',
  });

  useEffect(() => {
    ensureAuth();
  }, []);

  const updateState = (newState: Partial<AppState>) => {
    setAppState((prev) => {
      const updated = { ...prev, ...newState };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Session save failed:', e);
      }
      return updated;
    });
  };

  const handleLogout = () => {
    const resetState: AppState = {
      role: 'none',
      roomCode: null,
      teacherName: null,
      targetGrade: null,
      apiKey: null,
      studentName: null,
    };
    setAppState(resetState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  };

  const handleGoHome = () => {
    if (appState.role === 'none') return;
    // Keep user in current dashboard or room
  };

  const showAlert = (message: string, type: 'alert' | 'success' = 'alert') => {
    setAlertInfo({
      isOpen: true,
      message,
      type,
    });
  };

  const closeAlert = () => {
    setAlertInfo((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col font-sans selection:bg-sky-100 selection:text-sky-800">
      <Navbar
        appState={appState}
        onLogout={handleLogout}
        onGoHome={handleGoHome}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* 1. ROLE SELECT */}
        {appState.role === 'none' && (
          <RoleSelect
            onSelectRole={(role: UserRole) => {
              updateState({ role });
            }}
          />
        )}

        {/* 2. TEACHER SETUP */}
        {appState.role === 'teacher' && !appState.roomCode && (
          <TeacherSetup
            onBack={() => updateState({ role: 'none' })}
            onRoomCreated={(state: AppState) => {
              setAppState(state);
              try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
              } catch (_) {}
            }}
            onAlert={(msg) => showAlert(msg, 'alert')}
          />
        )}

        {/* 3. STUDENT JOIN */}
        {appState.role === 'student' && !appState.roomCode && (
          <StudentJoin
            onBack={() => updateState({ role: 'none' })}
            onJoined={(state: AppState) => {
              setAppState(state);
              try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
              } catch (_) {}
            }}
            onAlert={(msg) => showAlert(msg, 'alert')}
          />
        )}

        {/* 4. STUDENT VIEW (Authenticated to a room) */}
        {appState.role === 'student' && appState.roomCode && (
          <StudentView
            appState={appState}
            onAlert={(msg, type) => showAlert(msg, type || 'alert')}
          />
        )}

        {/* 5. TEACHER DASHBOARD (Authenticated to a room) */}
        {appState.role === 'teacher' && appState.roomCode && (
          <TeacherDashboard
            appState={appState}
            onAlert={(msg, type) => showAlert(msg, type || 'alert')}
          />
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/80 mt-auto">
        <p>생각 한 칸 더 • AI 기반 자기주도 배움 성찰 및 학급 피드백 플랫폼</p>
      </footer>

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertInfo.isOpen}
        message={alertInfo.message}
        type={alertInfo.type}
        onClose={closeAlert}
      />
    </div>
  );
}
