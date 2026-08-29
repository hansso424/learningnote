import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Edit,
  Trash2,
  Download,
  FolderOpen,
  Bookmark,
  Layers,
  RotateCw,
  School,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { LearningMaterial, AppState } from '../types';
import {
  getLearningMaterials,
  removeLearningMaterial,
} from '../services/materialService';
import { MaterialModal } from './MaterialModal';
import { MaterialDetailModal } from './MaterialDetailModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface LearningMaterialsManagerProps {
  appState: AppState;
  onAlert: (msg: string, type?: 'alert' | 'success') => void;
}

export const LearningMaterialsManager: React.FC<LearningMaterialsManagerProps> = ({
  appState,
  onAlert,
}) => {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<LearningMaterial | null>(null);
  const [detailMaterial, setDetailMaterial] = useState<LearningMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<LearningMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, [appState.roomCode]);

  const loadMaterials = async () => {
    if (!appState.roomCode) return;
    setLoading(true);
    try {
      const list = await getLearningMaterials(appState.roomCode);
      setMaterials(list);
    } catch (err: any) {
      console.error('Load materials error:', err);
      onAlert('학습자료를 불러오지 못했습니다.\n' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (material: LearningMaterial) => {
    setEditingMaterial(material);
    setIsAddModalOpen(true);
  };

  const handleOpenDetail = (material: LearningMaterial) => {
    setDetailMaterial(material);
  };

  const handleOpenDelete = (material: LearningMaterial) => {
    setDeletingMaterial(material);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMaterial || !deletingMaterial.id) return;
    setIsDeleting(true);
    try {
      await removeLearningMaterial(deletingMaterial.id, deletingMaterial.storagePath);
      onAlert('학습자료가 삭제되었습니다.', 'success');
      setDeletingMaterial(null);
      await loadMaterials();
    } catch (err: any) {
      console.error('Delete material error:', err);
      onAlert('삭제 중 오류가 발생했습니다.\n' + (err.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter materials
  const filteredMaterials = materials.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.unit.toLowerCase().includes(q) ||
      m.topic.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.fileName && m.fileName.toLowerCase().includes(q));

    const matchSubject = filterSubject === 'all' || m.subject === filterSubject;
    const matchGrade = filterGrade === 'all' || m.grade === filterGrade;

    return matchSearch && matchSubject && matchGrade;
  });

  const subjectBadges: Record<string, { bg: string; text: string }> = {
    국어: { bg: 'bg-rose-500', text: 'text-white' },
    수학: { bg: 'bg-blue-500', text: 'text-white' },
    사회: { bg: 'bg-orange-500', text: 'text-white' },
    과학: { bg: 'bg-emerald-500', text: 'text-white' },
    기타: { bg: 'bg-slate-600', text: 'text-white' },
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div id="learning-materials-manager" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-linear-to-r from-teal-700 via-sky-800 to-indigo-900 rounded-3xl shadow-md p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-teal-200 text-xs font-semibold mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>수업 자료 및 성찰 연계</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            학습자료 관리
          </h2>
          <p className="text-teal-100/90 text-xs sm:text-sm mt-1.5">
            내 수업 자료를 등록하고 관리하여 향후 학생 배움노트 성찰과 연계할 수 있어요.
          </p>
        </div>

        <button
          id="btn-add-new-material"
          onClick={handleOpenAdd}
          className="bg-white hover:bg-teal-50 text-teal-900 font-extrabold px-5 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-5 h-5 text-teal-700" />
          <span>+ 새 학습자료 등록</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="material-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="단원, 학습 주제, 자료 제목으로 검색..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden text-sm transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Filter */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">전체 과목</option>
              <option value="국어">국어</option>
              <option value="수학">수학</option>
              <option value="사회">사회</option>
              <option value="과학">과학</option>
              <option value="기타">기타</option>
            </select>

            {/* Grade Filter */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">전체 학년</option>
              <option value="1학년">1학년</option>
              <option value="2학년">2학년</option>
              <option value="3학년">3학년</option>
              <option value="4학년">4학년</option>
              <option value="5학년">5학년</option>
              <option value="6학년">6학년</option>
              <option value="기타">기타</option>
            </select>

            {/* Refresh */}
            <button
              onClick={loadMaterials}
              className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              title="새로고침"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Materials List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>등록된 학습자료 목록</span>
            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-extrabold">
              {filteredMaterials.length}개
            </span>
          </h3>
          <span className="text-xs text-slate-400">
            총 {materials.length}개 자료
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">학습자료를 불러오는 중입니다...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 sm:p-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-2xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">
                {materials.length === 0
                  ? '아직 등록된 학습자료가 없습니다.'
                  : '조건에 일치하는 학습자료가 없습니다.'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {materials.length === 0
                  ? '수업 활동지, PPT, PDF 교재 등 수업 자료를 등록하여 학생들의 배움 기록과 연계해보세요.'
                  : '검색어 또는 필터 조건을 변경해보세요.'}
              </p>
            </div>
            {materials.length === 0 && (
              <button
                onClick={handleOpenAdd}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>첫 학습자료 등록하기</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMaterials.map((mat) => {
              const badge = subjectBadges[mat.subject] || {
                bg: 'bg-slate-600',
                text: 'text-white',
              };

              return (
                <div
                  key={mat.id || mat.materialId}
                  className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-2xs ${badge.bg} ${badge.text}`}
                        >
                          {mat.subject}
                        </span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {mat.grade} {mat.semester}
                        </span>
                      </div>
                      {mat.lesson && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
                          {mat.lesson}
                        </span>
                      )}
                    </div>

                    {/* Unit & Topic */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">
                        {mat.unit}
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 line-clamp-1">
                        {mat.title}
                      </h4>
                    </div>

                    {/* Topic Pill */}
                    <div className="flex items-center gap-1.5 text-xs text-sky-800 bg-sky-50/80 px-3 py-2 rounded-xl border border-sky-100">
                      <Bookmark className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="font-bold truncate">주제: {mat.topic}</span>
                    </div>

                    {/* Description preview */}
                    {mat.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {mat.description}
                      </p>
                    )}

                    {/* File info pill */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                          {mat.fileType || 'FILE'}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {mat.fileName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatFileSize(mat.fileSize)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(mat)}
                      className="text-sky-700 hover:text-sky-800 hover:bg-sky-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>보기</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(mat)}
                        className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>수정</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(mat)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Material Modal */}
      <MaterialModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(msg) => {
          onAlert(msg, 'success');
          loadMaterials();
        }}
        onAlert={onAlert}
        roomCode={appState.roomCode || ''}
        teacherName={appState.teacherName || '선생님'}
        teacherId={appState.roomCode || ''}
        editingMaterial={editingMaterial}
      />

      {/* Material Detail Modal */}
      <MaterialDetailModal
        material={detailMaterial}
        isOpen={!!detailMaterial}
        onClose={() => setDetailMaterial(null)}
        onEdit={(mat) => {
          setDetailMaterial(null);
          handleOpenEdit(mat);
        }}
        onDelete={(mat) => {
          setDetailMaterial(null);
          handleOpenDelete(mat);
        }}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingMaterial}
        title={deletingMaterial?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingMaterial(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
};
