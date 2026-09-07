import React from 'react';
import Modal from './common/Modal';

/**
 * ConfirmExitModal — Shared exit confirmation modal for all skills
 * (Reading, Listening, Writing, Speaking, Practice).
 *
 * Centered horizontally & vertically across the entire viewport.
 * - "Tiếp tục làm" button: Primary action (blue / btn-primary)
 * - "Thoát" button: luôn btn-danger (đỏ) — thoát bài là hành động phá huỷ,
 *   dù có autosave thì vẫn là rời khỏi bài đang làm. Skill nào cần cảnh báo
 *   riêng (Speaking — mất bản ghi âm) thì truyền `message` của nó.
 */
export default function ConfirmExitModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Thoát bài làm?",
  message = "Tiến trình sẽ được lưu tự động — bạn có thể quay lại làm tiếp sau.",
  cancelText = "Tiếp tục làm",
  confirmText = "Thoát",
}) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title={title} size="sm">
      <div className="p-8">
        <h2 className="text-zinc-900 text-lg font-semibold mb-2 tracking-tight">
          {title}
        </h2>
        <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-primary flex-1 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-xs"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger flex-1 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
