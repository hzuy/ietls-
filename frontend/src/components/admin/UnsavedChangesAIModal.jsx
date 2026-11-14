import { X } from 'lucide-react'

export default function UnsavedChangesAIModal({ isOpen, onClose, onSaveAndGenerate, isSaving = false }) {
  if (!isOpen) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title"
      className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <h3 id="unsaved-changes-title" className="m-0 text-base font-semibold text-zinc-900">Đề thi có thay đổi chưa lưu</h3>
        <button type="button" aria-label="Đóng" onClick={onClose} disabled={isSaving}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 disabled:opacity-50 cursor-pointer"><X aria-hidden="true" className="h-4 w-4" /></button>
      </div>
      <p className="mt-3 mb-5 text-sm leading-relaxed text-zinc-600">Lưu nội dung đang chỉnh sửa trước khi tạo lời giải, để AI sử dụng đúng bài đọc, transcript và đáp án bạn đang xem.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={isSaving}
          className="min-h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 disabled:opacity-50 cursor-pointer">Quay lại sửa</button>
        <button type="button" onClick={onSaveAndGenerate} disabled={isSaving}
          className="min-h-10 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer">
          {isSaving ? 'Đang lưu đề…' : 'Lưu đề & tạo lời giải'}
        </button>
      </div>
    </div>
  </div>
}
