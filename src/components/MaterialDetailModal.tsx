import React from 'react';
import {
  X,
  FileText,
  Download,
  ExternalLink,
  Calendar,
  Layers,
  Edit,
  Trash2,
  Bookmark,
  Sparkles,
  School,
  FileCode,
} from 'lucide-react';
import { LearningMaterial } from '../types';

interface MaterialDetailModalProps {
  material: LearningMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (material: LearningMaterial) => void;
  onDelete: (material: LearningMaterial) => void;
}

export const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({
  material,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !material) return null;

  const subjectBadgeColors: Record<string, string> = {
    국어: 'bg-rose-500 text-white',
    수학: 'bg-blue-500 text-white',
    사회: 'bg-orange-500 text-white',
    과학: 'bg-emerald-500 text-white',
    기타: 'bg-slate-600 text-white',
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const createdDateStr = material.createdAt
    ? new Date(material.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-2xs ${
                subjectBadgeColors[material.subject] || 'bg-slate-600 text-white'
              }`}
            >
              {material.subject}
            </span>
            <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              {material.grade} {material.semester}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Title & Unit */}
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
              {material.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
              <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                {material.unit}
              </span>
              {material.lesson && (
                <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-medium">
                  {material.lesson}
                </span>
              )}
            </div>
          </div>

          {/* Learning Topic Card */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
              <Bookmark className="w-4 h-4 text-sky-600" />
              <span>학습 주제</span>
            </div>
            <p className="text-sm font-bold text-slate-900 pl-5">
              {material.topic}
            </p>
          </div>

          {/* Description */}
          {material.description && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                자료 설명
              </span>
              <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80 whitespace-pre-line leading-relaxed">
                {material.description}
              </p>
            </div>
          )}

          {/* File Card */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
              첨부 파일
            </span>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {material.fileType || 'FILE'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {material.fileName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(material.fileSize)} • 등록일: {createdDateStr}
                  </p>
                </div>
              </div>

              {material.fileUrl && (
                <a
                  href={material.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all w-full sm:w-auto justify-center cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>자료 열기 / 다운로드</span>
                </a>
              )}
            </div>
          </div>

          {/* AI Extracted Text Preview (for RAG inspection) */}
          {material.extractedText && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI 분석용 추출 텍스트 미리보기</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {material.extractedText.length}자
                </span>
              </div>
              <div className="bg-slate-900 text-slate-200 text-xs p-3.5 rounded-xl font-mono max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
                {material.extractedText}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>자료 식별자: {material.materialId}</span>
            <span>작성 교사: {material.teacherName}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(material);
            }}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>삭제하기</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(material);
              }}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>수정</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
