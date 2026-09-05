import { useEffect, useRef } from 'react'
import { validateImageFile } from '../../utils/fileValidation'
import { useToast } from '../../context/ToastContext'

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
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="del-confirm-title" className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-xl">🗑️</div>
          <h3 id="del-confirm-title" className="font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium">Hủy</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-[#dc2626] text-white text-sm font-bold hover:bg-[#b91c1c] transition">Xóa</button>
        </div>
      </div>
    </div>
  )
}

// ─── Draft banner + hint "đã lưu nháp" ───────────────────────────────────────
export function DraftBanner({ draft, onRestore, onDismiss }) {
  if (!draft) return null
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-center justify-between">
      <span className="text-sm text-yellow-700">📋 Bạn có bản nháp chưa lưu. Khôi phục không?</span>
      <div className="flex gap-2">
        <button onClick={onRestore}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 transition">Khôi phục</button>
        <button onClick={onDismiss}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition">Bỏ qua</button>
      </div>
    </div>
  )
}

export function DraftSavedHint({ at }) {
  if (!at) return null
  return <div className="text-xs text-slate-400 mb-2">💾 Đã lưu nháp lúc {at}</div>
}

// ─── Header danh sách (h1 + mô tả + nút "+ Thêm mới") ────────────────────────
export function AdminListHeader({ title, subtitle, onAdd, addLabel = '+ Thêm mới' }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1e40af] transition">
        {addLabel}
      </button>
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
      <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh bìa</label>
      {preview ? (
        <div className="relative mb-2">
          <img src={preview} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '16/9' }} />
          <button onClick={onClear} aria-label="Xóa ảnh bìa"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center border-2 border-white">×</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current.click()}
          className="w-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-2 text-slate-400 text-sm cursor-pointer"
          style={{ aspectRatio: '16/9' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Chọn ảnh bìa
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </>
  )
}
