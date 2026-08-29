import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  FileCheck,
  AlertCircle,
  Loader2,
  File,
  Sparkles,
} from 'lucide-react';
import { LearningMaterial } from '../types';
import {
  uploadMaterialFile,
  createLearningMaterial,
  updateLearningMaterial,
  extractTextFromFile,
} from '../services/materialService';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
  roomCode: string;
  teacherName: string;
  teacherId: string;
  editingMaterial?: LearningMaterial | null;
}

const SUBJECT_OPTIONS = ['국어', '수학', '사회', '과학', '기타'];
const GRADE_OPTIONS = ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년', '기타'];
const SEMESTER_OPTIONS = ['1학기', '2학기'];
const ALLOWED_EXTENSIONS = [
  'pdf',
  'ppt',
  'pptx',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onAlert,
  roomCode,
  teacherName,
  teacherId,
  editingMaterial,
}) => {
  const [subject, setSubject] = useState(editingMaterial?.subject || '국어');
  const [grade, setGrade] = useState(editingMaterial?.grade || '5학년');
  const [semester, setSemester] = useState(editingMaterial?.semester || '1학기');
  const [unit, setUnit] = useState(editingMaterial?.unit || '');
  const [topic, setTopic] = useState(editingMaterial?.topic || '');
  const [lesson, setLesson] = useState(editingMaterial?.lesson || '');
  const [title, setTitle] = useState(editingMaterial?.title || '');
  const [description, setDescription] = useState(editingMaterial?.description || '');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if editingMaterial changes
  React.useEffect(() => {
    if (editingMaterial) {
      setSubject(editingMaterial.subject);
      setGrade(editingMaterial.grade);
      setSemester(editingMaterial.semester);
      setUnit(editingMaterial.unit);
      setTopic(editingMaterial.topic);
      setLesson(editingMaterial.lesson);
      setTitle(editingMaterial.title);
      setDescription(editingMaterial.description);
      setSelectedFile(null);
    } else {
      setSubject('국어');
      setGrade('5학년');
      setSemester('1학기');
      setUnit('');
      setTopic('');
      setLesson('');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
    }
    setUploadProgress(0);
    setIsUploading(false);
  }, [editingMaterial, isOpen]);

  if (!isOpen) return null;

  const handleFileValidation = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      onAlert(
        `지원하지 않는 파일 형식입니다. (${ext})\n지원 형식: PDF, PPT, PPTX, DOC, DOCX, TXT, PNG, JPG, JPEG`
      );
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      onAlert('파일 크기는 최대 50MB까지 업로드 가능합니다.');
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (handleFileValidation(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (handleFileValidation(file)) {
        setSelectedFile(file);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unit.trim()) {
      onAlert('단원을 입력해주세요. (예: 2단원. 물질의 상태 변화)');
      return;
    }
    if (!topic.trim()) {
      onAlert('학습 주제를 입력해주세요. (예: 증발과 응결)');
      return;
    }
    if (!title.trim()) {
      onAlert('자료 제목을 입력해주세요.');
      return;
    }

    if (!editingMaterial && !selectedFile) {
      onAlert('학습자료 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      let fileUrl = editingMaterial?.fileUrl || '';
      let storagePath = editingMaterial?.storagePath || '';
      let fileName = editingMaterial?.fileName || '';
      let fileType = editingMaterial?.fileType || '';
      let fileSize = editingMaterial?.fileSize || 0;
      let extractedText = editingMaterial?.extractedText || '';

      const materialId =
        editingMaterial?.materialId ||
        `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // If new file is selected, upload to Storage and extract text
      if (selectedFile) {
        setUploadProgress(20);
        extractedText = await extractTextFromFile(selectedFile);

        const uploadRes = await uploadMaterialFile(
          selectedFile,
          teacherId || roomCode,
          materialId,
          (progress) => {
            // scale progress from 20% to 90%
            setUploadProgress(20 + Math.round(progress * 0.7));
          }
        );

        fileUrl = uploadRes.fileUrl;
        storagePath = uploadRes.storagePath;
        fileName = selectedFile.name;
        fileType = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        fileSize = selectedFile.size;
      }

      setUploadProgress(95);

      if (editingMaterial && editingMaterial.id) {
        // Update
        await updateLearningMaterial(editingMaterial.id, {
          title: title.trim(),
          subject,
          grade,
          semester,
          unit: unit.trim(),
          topic: topic.trim(),
          lesson: lesson.trim(),
          description: description.trim(),
          fileUrl,
          fileName,
          fileType,
          fileSize,
          storagePath,
          extractedText,
        });
        onSuccess('학습자료 정보가 성공적으로 수정되었습니다.');
      } else {
        // Create new
        await createLearningMaterial({
          materialId,
          roomCode,
          teacherId: teacherId || roomCode,
          teacherName: teacherName || '선생님',
          title: title.trim(),
          subject,
          grade,
          semester,
          unit: unit.trim(),
          topic: topic.trim(),
          lesson: lesson.trim(),
          description: description.trim(),
          fileUrl,
          fileName,
          fileType,
          fileSize,
          storagePath,
          extractedText,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        onSuccess('새 학습자료가 등록되었습니다.');
      }

      setUploadProgress(100);
      onClose();
    } catch (err: any) {
      console.error('Save learning material error:', err);
      onAlert(
        '학습자료 업로드 및 저장에 실패했습니다.\n잠시 후 다시 시도해주세요.\n' +
          (err.message || '')
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingMaterial ? '학습자료 수정' : '새 학습자료 등록'}
              </h2>
              <p className="text-xs text-slate-500">
                수업에 활용할 자료를 등록하고 성찰 활동과 연계하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Subject, Grade, Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                과목 <span className="text-rose-500">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm font-medium transition-all"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                학년 <span className="text-rose-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm font-medium transition-all"
              >
                {GRADE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                학기 <span className="text-rose-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm font-medium transition-all"
              >
                {SEMESTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Unit & Lesson */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                단원 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={isUploading}
                placeholder="예: 2단원. 물질의 상태 변화"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                차시
              </label>
              <input
                type="text"
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                disabled={isUploading}
                placeholder="예: 3차시"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              />
            </div>
          </div>

          {/* Row 3: Topic */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              학습 주제 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isUploading}
              placeholder="예: 증발과 응결 현상 이해하기"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              required
            />
          </div>

          {/* Row 4: Material Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              자료 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              placeholder="예: 물의 상태 변화 수업 활동지"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
              required
            />
          </div>

          {/* Row 5: Material Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              자료 설명
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              placeholder="물의 증발과 응결 현상을 이해하기 위한 수업자료 및 핵심 탐구 질문입니다."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm resize-none transition-all"
            />
          </div>

          {/* Row 6: File Upload Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              학습자료 파일 {!editingMaterial && <span className="text-rose-500">*</span>}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/50'
                  : 'border-slate-300 hover:border-sky-400 bg-slate-50/70 hover:bg-slate-50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {selectedFile ? '새 파일이 선택되었습니다' : '클릭하거나 파일을 이곳에 끌어다 놓으세요'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                PDF, PPT, PPTX, DOC, DOCX, TXT, 이미지 (최대 50MB)
              </p>
            </div>

            {/* Selected File / Existing File Preview */}
            {selectedFile ? (
              <div className="mt-3 bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || '문서'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  disabled={isUploading}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : editingMaterial?.fileName ? (
              <div className="mt-3 bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <File className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-700 block truncate">
                      현재 등록 파일: {editingMaterial.fileName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatFileSize(editingMaterial.fileSize || 0)} (변경하려면 위 영역을 클릭)
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-800">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    학습자료를 안전하게 업로드하고 있습니다...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sky-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 text-sm transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all text-sm flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>업로드 중...</span>
                </>
              ) : (
                <span>{editingMaterial ? '수정 완료' : '학습자료 등록'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
