import { useState, useRef, useEffect } from 'react'
import api from '../../utils/axios'
import { SERVER_BASE, handleImgError } from './adminConstants'
import Modal from '../common/Modal'

// ─── CAMBRIDGE BOOK MODAL — Cover upload ──────────────────────────────────────

function CoverTab({ bookNumber, seriesId, coverUrl, onCoverUploaded, showToast }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const upload = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await api.post(`/admin/exam-series/${seriesId}/covers/${bookNumber}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onCoverUploaded(res.data.coverImageUrl)
      showToast('✅ Đã cập nhật ảnh bìa')
    } catch { showToast('Lỗi upload ảnh bìa — kiểm tra định dạng (JPG/PNG/WebP) và dung lượng (≤ 20MB)') }
    finally { setUploading(false) }
  }

  const pick = () => inputRef.current?.click()

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={coverUrl ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
        className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition"
        onClick={pick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
      >
        {coverUrl
          ? <img src={`${SERVER_BASE}${coverUrl}`} alt="" onError={handleImgError} className="h-36 mx-auto object-contain rounded-lg mb-3 shadow" />
          : <div className="text-5xl mb-3">📚</div>}
        <p className="text-sm font-semibold text-slate-600">{coverUrl ? 'Click để đổi ảnh bìa' : 'Click để chọn ảnh bìa'}</p>
        <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP — tối đa 20MB</p>
        {uploading && <p className="text-xs text-slate-500 mt-2 font-medium">Đang upload...</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

function BookModal({ bookNumber, seriesId, seriesName, coverUrl, onClose, onCoverUploaded, showToast }) {
  return (
    <Modal onClose={onClose} title={`${seriesName} ${bookNumber} — Ảnh bìa`} size="lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          {coverUrl && <img src={`${SERVER_BASE}${coverUrl}`} alt="" onError={handleImgError} className="w-8 h-10 rounded object-cover shadow" />}
          <h2 className="font-extrabold text-slate-800">{seriesName} {bookNumber} — Ảnh bìa</h2>
        </div>
        <button onClick={onClose} aria-label="Đóng"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 font-bold transition">✕</button>
      </div>
      <div className="p-5">
        <CoverTab bookNumber={bookNumber} seriesId={seriesId} coverUrl={coverUrl} onCoverUploaded={onCoverUploaded} showToast={showToast} />
      </div>
    </Modal>
  )
}

// ─── SERIES CARD ───────────────────────────────────────────────────────────────
function SeriesCard({ s, onManage, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{s._count?.bookCovers ?? 0} cuốn</p>
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={() => onManage(s)} className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">Xem</button>
        <button onClick={() => onEdit(s)} className="py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition">Sửa tên</button>
        <button onClick={() => setConfirmDelete(true)} className="py-1.5 px-3 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition">Xóa</button>
      </div>
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} title="Xóa bộ đề" size="xs">
          <div className="p-6">
            <h3 className="font-bold text-slate-800 mb-2">Xóa bộ đề?</h3>
            <p className="text-sm text-slate-500 mb-4">Tất cả thông tin trong bộ đề <strong>{s.name}</strong> sẽ bị xóa.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Hủy</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(s.id) }} className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition">Xóa</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SeriesDetailView({ series, books, booksError, onBack, onBooksChanged, showToast }) {
  const [openModal, setOpenModal] = useState(null) // bookNumber
  const [addingBook, setAddingBook] = useState(false)
  const [deleteBook, setDeleteBook] = useState(null) // bookNumber
  const [coverMap, setCoverMap] = useState({})
  const [editingBook, setEditingBook] = useState(null) // bookNumber being edited
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)

  useEffect(() => {
    const map = {}
    for (const b of books) if (b.coverImageUrl) map[b.bookNumber] = b.coverImageUrl
    setCoverMap(map)
  }, [books])

  useEffect(() => {
    if (editingBook !== null) editInputRef.current?.select()
  }, [editingBook])

  const handleAddBook = async () => {
    setAddingBook(true)
    try {
      await api.post(`/admin/exam-series/${series.id}/books`)
      onBooksChanged()
      showToast('✅ Đã thêm cuốn')
    } catch { showToast('Lỗi thêm cuốn') }
    finally { setAddingBook(false) }
  }

  const handleDeleteBook = async (bookNumber) => {
    try {
      await api.delete(`/admin/exam-series/${series.id}/books/${bookNumber}`)
      onBooksChanged()
      showToast(`✅ Đã chuyển cuốn ${bookNumber} vào Thùng rác`)
    } catch { showToast('Lỗi xóa cuốn') }
    setDeleteBook(null)
  }

  const startEdit = (bookNumber, e) => {
    e.stopPropagation()
    setEditingBook(bookNumber)
    setEditValue(String(bookNumber))
  }

  const commitEdit = async () => {
    const newNumber = parseInt(editValue)
    if (!newNumber || newNumber < 1 || newNumber === editingBook) { setEditingBook(null); return }
    if (books.some(b => b.bookNumber === newNumber)) {
      showToast(`Cuốn ${newNumber} đã tồn tại trong bộ đề này`)
      return // keep the field open so the admin can pick another number
    }
    try {
      await api.put(`/admin/exam-series/${series.id}/books/${editingBook}`, { bookNumber: newNumber })
      onBooksChanged()
      showToast(`✅ Đã đổi cuốn ${editingBook} → ${newNumber}`)
    } catch { showToast('Lỗi sửa số cuốn') }
    setEditingBook(null)
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingBook(null)
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label="Quay lại danh sách bộ đề"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-sm font-bold">←</button>
          <div>
            <h3 className="font-bold text-slate-800">{series.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{books.length} cuốn · click vào cuốn để upload ảnh bìa</p>
          </div>
        </div>
        <button
          onClick={handleAddBook}
          disabled={addingBook}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          + Thêm cuốn
        </button>
      </div>

      {booksError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg mb-4 text-sm">{booksError}</div>
      )}

      {books.length === 0 && !booksError ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-slate-500 mb-4">Chưa có cuốn nào trong bộ đề này</p>
          <button onClick={handleAddBook} disabled={addingBook}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            + Thêm cuốn đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
          {books.map(b => (
            <div key={b.bookNumber} className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpenModal(b.bookNumber)}
                title={`${series.name} ${b.bookNumber} — quản lý ảnh bìa`}
                aria-label={`Quản lý ảnh bìa cuốn ${b.bookNumber}`}
                className="w-12 h-16 rounded-lg overflow-hidden border-2 border-dashed border-slate-200 hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition block"
              >
                {coverMap[b.bookNumber]
                  ? <img src={`${SERVER_BASE}${coverMap[b.bookNumber]}`} alt="" onError={handleImgError} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-lg">📚</div>}
              </button>
              {editingBook === b.bookNumber ? (
                <input
                  ref={editInputRef}
                  type="number"
                  min="1"
                  aria-label={`Số cuốn mới cho cuốn ${b.bookNumber}`}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  className="w-14 text-xs text-center border border-blue-600 rounded px-1 py-0.5 outline-none font-medium"
                />
              ) : (
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-slate-500 font-medium tabular-nums w-4 text-right">{b.bookNumber}</span>
                  <button type="button" onClick={(e) => startEdit(b.bookNumber, e)}
                    aria-label={`Sửa số cuốn ${b.bookNumber}`} title="Sửa số cuốn"
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition text-[11px]">✏</button>
                  <button type="button" onClick={() => setDeleteBook(b.bookNumber)}
                    aria-label={`Xóa cuốn ${b.bookNumber}`} title="Xóa cuốn"
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 transition text-[11px]">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {openModal && (
        <BookModal
          bookNumber={openModal}
          seriesId={series.id}
          seriesName={series.name}
          coverUrl={coverMap[openModal]}
          onClose={() => setOpenModal(null)}
          onCoverUploaded={url => setCoverMap(c => ({ ...c, [openModal]: url }))}
          showToast={showToast}
        />
      )}

      {deleteBook && (
        <Modal onClose={() => setDeleteBook(null)} title={`Xóa cuốn ${deleteBook}`} size="xs">
          <div className="p-6">
            <h3 className="font-bold text-slate-800 mb-2">Xóa cuốn {deleteBook}?</h3>
            <p className="text-sm text-slate-500 mb-4">Tất cả đề thi (Reading, Listening, Writing, Speaking) trong cuốn này sẽ được chuyển vào Thùng rác và có thể khôi phục.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteBook(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Hủy</button>
              <button onClick={() => handleDeleteBook(deleteBook)} className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition">Xóa</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export { SeriesCard, SeriesDetailView, BookModal }
