import React from 'react';
import { Undo2, Check, X } from 'lucide-react';
import { sound } from '../utils/audio';

export interface ToastMessage {
  id: string;
  type: 'success' | 'undo' | 'info' | 'error';
  message: string;
  undoAction?: () => void;
  undoLabel?: string;
}

interface ToastUndoProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastUndo: React.FC<ToastUndoProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
      role="region"
      aria-label="الإشعارات والتأكيدات"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#243B35] text-[#F6F3EE] shadow-xl border border-[#D8C3A5]/30 animate-in fade-in slide-in-from-bottom-3 duration-200"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'success' && (
              <span className="w-5 h-5 rounded-full bg-[#6F8F78] flex items-center justify-center text-white shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
            {toast.type === 'error' && (
              <span className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0">
                <X className="w-3 h-3 stroke-[3]" />
              </span>
            )}
            <p className="text-xs sm:text-sm font-medium truncate">{toast.message}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  sound.playPop();
                  toast.undoAction?.();
                  onDismiss(toast.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#D8C3A5] text-[#243B35] text-xs font-bold hover:bg-[#ebdcc8] transition-colors flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-white outline-none"
                aria-label="تراجع عن العملية"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{toast.undoLabel || 'تراجع'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-[#F6F3EE]/60 hover:text-[#F6F3EE] hover:bg-white/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white outline-none"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
