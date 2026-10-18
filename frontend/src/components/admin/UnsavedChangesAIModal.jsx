import React from 'react'
import { AlertTriangle, Save, Play, X } from 'lucide-react'

/**
 * Modal shown when teacher triggers AI explanation generation on an exam with unsaved form edits.
 * Conforms to Requirement 3.2 (Phương án A):
 * Gives teacher explicit control to either save first or keep in-flight draft edits untouched.
 */
export default function UnsavedChangesAIModal({
  isOpen,
  onClose,
  onSaveAndGenerate,
  onContinueWithoutSaving,
  isSaving = false
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div className="flex items-center gap-2 text-zinc-900 font-semibold">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span id="unsaved-changes-title">Đề thi có thay đổi chưa lưu</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-600 leading-relaxed">
            Bạn đang có chỉnh sửa chưa lưu trên form (bài đọc / bài nghe / câu hỏi).
            Hệ thống AI sẽ phân tích dựa trên dữ liệu <strong className="text-zinc-900 font-medium">đã lưu trên cơ sở dữ liệu</strong>.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onSaveAndGenerate}
              disabled={isSaving}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-zinc-900 bg-zinc-900 hover:bg-zinc-800 text-white text-left transition cursor-pointer disabled:opacity-60"
            >
              <Save className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">
                  {isSaving ? 'Đang lưu đề thi...' : 'Lưu đề rồi sinh AI (Khuyến nghị)'}
                </div>
                <div className="text-xs text-zinc-300 mt-0.5">
                  Cập nhật các chỉnh sửa lên máy chủ trước khi AI phân tích
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onContinueWithoutSaving}
              disabled={isSaving}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 text-left transition cursor-pointer disabled:opacity-60"
            >
              <Play className="w-5 h-5 shrink-0 mt-0.5 text-zinc-600" />
              <div>
                <div className="text-sm font-semibold">Tiếp tục sinh AI theo CSDL hiện tại</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Giữ nguyên 100% chỉnh sửa dở trên form; chỉ đồng bộ lời giải khi xong
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 transition cursor-pointer disabled:opacity-50"
          >
            Hủy và quay lại sửa
          </button>
        </div>
      </div>
    </div>
  )
}
