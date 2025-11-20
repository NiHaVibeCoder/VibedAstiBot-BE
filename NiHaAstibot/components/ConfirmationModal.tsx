import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  hideCancelButton?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-blue-600 hover:bg-blue-700',
  hideCancelButton = false,
}: ConfirmationModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-[#1E293B] rounded-lg border border-slate-700 shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-2xl leading-none" aria-label="Close">&times;</button>
        </header>
        <main className="p-6 text-slate-300">
          <div className="text-sm space-y-2">{message}</div>
        </main>
        <footer className="flex justify-end items-center gap-4 p-4 bg-slate-800/50 rounded-b-lg">
          {!hideCancelButton && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-sm font-semibold transition"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
}
