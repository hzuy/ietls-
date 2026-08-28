import { useState, useRef, useEffect } from 'react'
import api from '../../utils/axios'
import { SERVER_BASE } from './adminConstants'

// ─── CAMBRIDGE BOOK MODAL — Cover upload ──────────────────────────────────────

function CoverTab({ bookNumber, seriesId, coverUrl, onCoverUploaded }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const upload = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await api.post(`/admin/exam-series/${seriesId}/covers/${bookNumber}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onCoverUploaded(res.data.coverImageUrl)
    } catch { alert('Lỗi upload ảnh bìa') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <div
        className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
        onClick={() => inputRef.current?.click()}
      >
        {coverUrl
          ? <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="h-36 mx-auto object-contain rounded-lg mb-3 shadow" />
          : <div className="text-5xl mb-3">📚</div>}
        <p className="text-sm font-semibold text-slate-600">{coverUrl ? 'Click để đổi ảnh bìa' : 'Click để upload ảnh bìa'}</p>
        <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP — tối đa 20MB</p>
        {uploading && <p className="text-xs text-slate-500 mt-2 font-medium">Đang upload...</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

function BookModal({ bookNumber, seriesId, seriesName, coverUrl, onClose, onCoverUploaded }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {coverUrl && <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="w-8 h-10 rounded object-cover shadow" />}
            <h2 className="font-extrabold text-slate-800">{seriesName} {bookNumber} — Ảnh bìa</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 font-bold transition">✕</button>
        </div>

        <div className="p-5">
          <CoverTab bookNumber={bookNumber} seriesId={seriesId} coverUrl={coverUrl} onCoverUploaded={onCoverUploaded} />
        </div>
      </div>
    </div>
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
        <button onClick={() => onManage(s)} className="flex-1 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-bold hover:bg-[#1D4ED8] transition">Xem</button>
        <button onClick={() => onEdit(s)} className="py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">Sửa tên</button>
        <button onClick={() => setConfirmDelete(true)} className="py-1.5 px-3 rounded-lg border border-blue-200 text-red-500 text-xs font-semibold hover:bg-blue-50 transition">Xóa</button>
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-2">Xóa bộ đề?</h3>
            <p className="text-sm text-slate-500 mb-4">Tất cả thông tin trong bộ đề <strong>{s.name}</strong> sẽ bị xóa.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(s.id) }} className="flex-1 py-2 rounded-lg bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SeriesDetailView({ series, books, onBack, onBooksChanged }) {
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
    } catch { alert('Lỗi thêm cuốn') }
    finally { setAddingBook(false) }
  }

  const handleDeleteBook = async (bookNumber) => {
    try {
      await api.delete(`/admin/exam-series/${series.id}/books/${bookNumber}`)
      onBooksChanged()
    } catch { alert('Lỗi xóa cuốn') }
    setDeleteBook(null)
  }

  const startEdit = (bookNumber, e) => {
    e.stopPropagation()
    setEditingBook(bookNumber)
    setEditValue(String(bookNumber))
  }

  const commitEdit = async () => {
    const newNumber = parseInt(editValue)
    if (!newNumber || newNumber < 1) { setEditingBook(null); return }
    if (newNumber !== editingBook) {
      try {
        await api.put(`/admin/exam-series/${series.id}/books/${editingBook}`, { bookNumber: newNumber })
        onBooksChanged()
      } catch { alert('Lỗi sửa số cuốn') }
    }
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
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition text-sm font-bold">←</button>
          <div>
            <h3 className="font-bold text-slate-800">{series.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{books.length} cuốn · click vào cuốn để upload ảnh bìa</p>
          </div>
        </div>
        <button
          onClick={handleAddBook}
          disabled={addingBook}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-bold hover:bg-[#1D4ED8] transition disabled:opacity-50"
        >
          + Thêm cuốn
        </button>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
        {books.map(b => (
          <div key={b.bookNumber} className="flex flex-col items-center gap-1.5">
            <div className="relative group">
              <div
                className="w-12 h-16 rounded-lg overflow-hidden border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-400 transition"
                onClick={() => setOpenModal(b.bookNumber)}
                title={`${series.name} ${b.bookNumber} — click để quản lý`}
              >
                {coverMap[b.bookNumber]
                  ? <img src={`${SERVER_BASE}${coverMap[b.bookNumber]}`} alt={`${series.name} ${b.bookNumber}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-lg">📚</div>}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg">
                  <span className="text-white text-lg">⚙</span>
                </div>
              </div>
              <button
                onClick={(e) => startEdit(b.bookNumber, e)}
                className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center leading-none"
                title="Sửa số cuốn"
              >✏</button>
              <button
                onClick={() => setDeleteBook(b.bookNumber)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center leading-none"
                title="Xóa cuốn"
              >✕</button>
            </div>
            {editingBook === b.bookNumber ? (
              <input
                ref={editInputRef}
                type="number"
                min="1"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                className="w-12 text-xs text-center border border-[#1D4ED8] rounded px-1 py-0.5 outline-none font-medium"
              />
            ) : (
              <span className="text-xs text-slate-500 font-medium">{b.bookNumber}</span>
            )}
          </div>
        ))}
      </div>

      {openModal && (
        <BookModal
          bookNumber={openModal}
          seriesId={series.id}
          seriesName={series.name}
          coverUrl={coverMap[openModal]}
          onClose={() => setOpenModal(null)}
          onCoverUploaded={url => setCoverMap(c => ({ ...c, [openModal]: url }))}
        />
      )}

      {deleteBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteBook(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-2">Xóa cuốn {deleteBook}?</h3>
            <p className="text-sm text-slate-500 mb-4">Tất cả đề thi (Reading, Listening, Writing, Speaking) trong cuốn này sẽ bị xóa vĩnh viễn.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteBook(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => handleDeleteBook(deleteBook)} className="flex-1 py-2 rounded-lg bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { SeriesCard, SeriesDetailView, BookModal }
