import React from 'react';

/**
 * ConfirmExitModal — Shared exit confirmation modal for all skills
 * (Reading, Listening, Writing, Speaking, Practice).
 *
 * Centered horizontally & vertically across the entire viewport.
 * - "Tiếp tục làm" button: Primary action (blue / btn-primary)
 * - "Thoát" button: tone theo `confirmTone`:
 *     'neutral' (mặc định) → btn-secondary — dùng cho bài có autosave, thoát không mất gì
 *     'danger'             → btn-danger    — dùng cho Speaking: thoát là mất bản ghi đang ghi âm
 */
export default function ConfirmExitModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Thoát bài làm?",
  message = "Tiến trình sẽ được lưu tự động — bạn có thể quay lại làm tiếp sau.",
  cancelText = "Tiếp tục làm",
  confirmText = "Thoát",
  confirmTone = "neutral",
}) {
  if (!isOpen) return null;

  const confirmClass = confirmTone === "danger" ? "btn-danger" : "btn-secondary";

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
            className={`${confirmClass} flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
