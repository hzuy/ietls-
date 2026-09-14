import { useRef } from 'react'
import { validateImageFile } from '../../utils/fileValidation'
import { useToast } from '../../context/ToastContext'
import { Trash2, FileText, Save } from 'lucide-react'
import Modal from '../common/Modal'

/**
 * UI page-level dùng chung cho các trang admin content-creation:
 *   ReadingPractice · ListeningPractice · SampleManager (Writing/Speaking Samples)
 *
 * Chỉ là các mảnh chrome (modal xoá, draft banner, header list, ô upload ảnh bìa).
 * KHÔNG chứa logic riêng của trang — mọi hành vi (callback, validate downstream,
 * isDirty, cập nhật state) do trang tự truyền vào qua props → hành vi từng trang
 * giữ nguyên. Không liên quan tới leaf-editor câu hỏi hay ReadingTab/ListeningTab.
 */

// ─── Modal xác nhận xoá ──────────────────────────────────────────────────────
// role=dialog + aria-modal + Escape + overlay-click để đóng; nút Xóa màu
// #dc2626 / hover #b91c1c (đã chuẩn hoá ở đợt polish trước).
export function ConfirmDeleteModal({ open, title, message = 'Hành động này không thể hoàn tác.', onCancel, onConfirm }) {
  if (!open) return null

  return (
    <Modal onClose={onCancel} title={title} size="sm" className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <h3 id="del-confirm-title" className="font-bold text-zinc-900 dark:text-slate-100 text-sm sm:text-base">{title}</h3>
      </div>
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-slate-400 mb-5 leading-relaxed">{message}</p>
      <div className="flex gap-2.5 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs sm:text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-9 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
        >
          Xóa
        </button>
      </div>
    </Modal>
  )
}

// ─── Draft banner + hint "đã lưu nháp" ───────────────────────────────────────
export function DraftBanner({ draft, onRestore, onDismiss }) {
  if (!draft) return null
  return (
    <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3 mb-4 flex items-center justify-between">
      <span className="text-sm text-zinc-800 flex items-center gap-2">
        <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
        <span>Bạn có bản nháp chưa lưu. Khôi phục không?</span>
      </span>
      <div className="flex gap-2">
        <button onClick={onRestore}
          className="text-xs font-medium px-4 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition shadow-xs cursor-pointer">Khôi phục</button>
        <button onClick={onDismiss}
          className="text-xs font-medium px-4 py-1.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition shadow-2xs cursor-pointer">Bỏ qua</button>
      </div>
    </div>
  )
}

export function DraftSavedHint({ at }) {
  if (!at) return null
  return (
    <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
      <Save className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      <span>Đã lưu nháp lúc {at}</span>
    </div>
  )
}

// ─── Header danh sách (h1 + mô tả + nút "+ Thêm mới") ────────────────────────
export function AdminListHeader({ title, subtitle, onAdd, addLabel = '+ Thêm mới', children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-slate-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {(onAdd || children) && (
        <div className="flex items-center gap-3 flex-wrap">
          {children}
          {onAdd && (
            <button onClick={onAdd}
              className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 text-xs sm:text-sm font-medium inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
              {addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Ô upload ảnh bìa (dropzone + input hidden + hint tuỳ chọn) ──────────────
// Component sở hữu file input + validateImageFile + alert lỗi; trang quyết định
// làm gì với file hợp lệ (onSelect) và cách xoá (onClear).
export function ThumbnailPicker({ preview, onSelect, onClear, hint }) {
  const { showToast } = useToast()
  const inputRef = useRef()

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const v = validateImageFile(file)
    if (!v.ok) { showToast(v.error, 'error'); e.target.value = ''; return }
    onSelect(file)
  }

  return (
    <>
      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Ảnh bìa</label>
      {preview ? (
        <div className="relative mb-2">
          <img src={preview} alt="Xem trước ảnh bìa" className="w-full rounded-lg object-cover" style={{ aspectRatio: '16/9' }} />
          <button onClick={onClear} aria-label="Xóa ảnh bìa"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 text-white text-sm font-bold flex items-center justify-center border-2 border-white shadow-xs">×</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current.click()}
          className="w-full border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50 transition flex flex-col items-center justify-center gap-2 text-zinc-500 text-sm cursor-pointer"
          style={{ aspectRatio: '16/9' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Chọn ảnh bìa
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      {hint && <p className="text-xs text-zinc-400 mt-1.5">{hint}</p>}
    </>
  )
}
