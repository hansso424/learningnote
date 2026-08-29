import React from 'react';
import { GraduationCap, Sparkles, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';

interface RoleSelectProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({ onSelectRole }) => {
  return (
    <div id="role-select-screen" className="max-w-xl mx-auto py-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI 배움 성찰 도우미</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          생각 한 칸 더
        </h1>
        <p className="text-slate-600 mt-2 text-base">
          오늘의 배움을 기록하고, AI 질문을 통해 생각을 한 단계 더 넓혀보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          id="select-teacher-btn"
          onClick={() => onSelectRole('teacher')}
          className="group relative bg-white border-2 border-slate-200 hover:border-sky-500 hover:shadow-lg rounded-2xl p-7 text-left transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-105 group-hover:bg-sky-500 group-hover:text-white transition-all duration-200">
              <span className="font-bold text-xl">👩‍🏫</span>
            </div>
            <h2 className="font-bold text-xl text-slate-900 group-hover:text-sky-600 transition-colors">
              선생님이에요
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              새로운 학급 방을 개설하고, 학생들의 성찰 기록과 통계를 실시간으로 확인해요.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
            <span>방 개설 및 관리</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>

        <button
          id="select-student-btn"
          onClick={() => onSelectRole('student')}
          className="group relative bg-white border-2 border-slate-200 hover:border-emerald-500 hover:shadow-lg rounded-2xl p-7 text-left transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
              <span className="font-bold text-xl">🌱</span>
            </div>
            <h2 className="font-bold text-xl text-slate-900 group-hover:text-emerald-600 transition-colors">
              학생이에요
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              선생님이 알려주신 방 코드로 입장하여 배움을 기록하고 성장 배지를 모아요.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
            <span>방 코드로 입장하기</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>
      </div>
    </div>
  );
};
