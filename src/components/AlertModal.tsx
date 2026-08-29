import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  type?: 'alert' | 'success';
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  message,
  type = 'alert',
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="custom-alert-modal"
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-slate-100 transform transition-all">
        <div className="flex justify-end -mt-2 -mr-2">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {type === 'success' ? (
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-7 h-7" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-7 h-7" />
            </div>
          )}
        </div>

        <p className="text-slate-800 font-medium text-base mb-6 whitespace-pre-line leading-relaxed">
          {message}
        </p>

        <button
          id="alert-confirm-btn"
          onClick={onClose}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-medium transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  );
};
