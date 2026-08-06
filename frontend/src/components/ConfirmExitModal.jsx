import React from 'react';

/**
 * ConfirmExitModal — Shared exit confirmation modal for all 4 skills
 * (Reading, Listening, Writing, Speaking).
 * 
 * Centered horizontally & vertically across the entire viewport.
 * - "Tiếp tục làm" button: Primary action (blue / btn-primary)
 * - "Thoát" button: Danger action (RED bg-red-600 hover:bg-red-700)
 */
export default function ConfirmExitModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Thoát bài làm?",
  message = "Tiến trình bài làm sẽ không được lưu nếu bạn thoát lúc này.",
  cancelText = "Tiếp tục làm",
  confirmText = "Thoát",
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[24px] border border-slate-200 p-8 shadow-xl max-w-sm w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-slate-900 text-lg font-bold mb-2 tracking-tight">
          {title}
        </h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm border-none cursor-pointer transition shadow-xs"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
