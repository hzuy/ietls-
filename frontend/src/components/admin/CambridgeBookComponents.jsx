import { useState, useRef } from 'react'
import api from '../../utils/axios'
import { SERVER_BASE, inputCls, labelCls, btnPrimary, btnSecondary } from './adminConstants'

// ─── CAMBRIDGE BOOK MODAL — Cover + PDF Import ────────────────────────────────

const SKILL_COLOR_CLASS = {
  reading:   'bg-[#1a56db] border-[#1a56db] text-white',
  listening: 'bg-[#1a56db] border-[#1a56db] text-white',
  writing:   'bg-[#1a56db] border-[#1a56db] text-white',
  speaking:  'bg-[#1a56db] border-[#1a56db] text-white',
}
const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }

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
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
        onClick={() => inputRef.current?.click()}
      >
        {coverUrl
          ? <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="h-36 mx-auto object-contain rounded-lg mb-3 shadow" />
          : <div className="text-5xl mb-3">📚</div>}
        <p className="text-sm font-semibold text-gray-600">{coverUrl ? 'Click để đổi ảnh bìa' : 'Click để upload ảnh bìa'}</p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — tối đa 20MB</p>
        {uploading && <p className="text-xs text-red-500 mt-2 font-medium">Đang upload...</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

function PDFImportTab({ bookNumber, seriesId, onRefresh }) {
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfMeta, setPdfMeta] = useState(null)   // { dataFile, originalName, pageCount }
  const [uploading, setUploading] = useState(false)
  const [selectedTest, setSelectedTest] = useState(1)
  const [selectedSkill, setSelectedSkill] = useState('reading')
  const [pageRange, setPageRange] = useState({ start: 0, end: 0 })
  const [answerRange, setAnswerRange] = useState({ start: 0, end: 0 })
  const [extracting, setExtracting] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const pdfRef = useRef(null)

  // Heuristic page-range suggestion based on Cambridge IELTS structure
  const suggestRange = useCallback((pageCount, testNum, skill) => {
    const front = 8
    const answerLen = Math.max(20, Math.floor(pageCount * 0.13))
    const contentEnd = pageCount - answerLen
    const perTest = Math.floor((contentEnd - front) / 4)
    const ts = front + (testNum - 1) * perTest
    const offsets = { listening: [0, 12], reading: [13, 36], writing: [37, 41], speaking: [42, 46] }
    const [ds, de] = offsets[skill] || [0, perTest - 1]
    return {
      content: { start: Math.min(ts + ds + 1, pageCount), end: Math.min(ts + de, pageCount) },
      answer:  { start: contentEnd + 1, end: pageCount }
    }
  }, [])

  useEffect(() => {
    if (!pdfMeta) return
    const { content, answer } = suggestRange(pdfMeta.pageCount, selectedTest, selectedSkill)
    setPageRange(content)
    if (selectedSkill === 'reading' || selectedSkill === 'listening') setAnswerRange(answer)
  }, [selectedTest, selectedSkill, pdfMeta, suggestRange])

  const handleUpload = async () => {
    if (!pdfFile) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('pdf', pdfFile)
      const res = await api.post('/admin/cambridge/upload-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      })
      setPdfMeta(res.data)
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi đọc PDF')
    } finally { setUploading(false) }
  }

  const handleExtract = async () => {
    setExtracting(true); setError('')
    try {
      const res = await api.post('/admin/cambridge/extract-save', {
        dataFile: pdfMeta.dataFile,
        bookNumber,
        seriesId,
        testNumber: selectedTest,
        skill: selectedSkill,
        startPage: pageRange.start,
        endPage: pageRange.end,
        answerStart: (selectedSkill === 'reading' || selectedSkill === 'listening') ? answerRange.start : 0,
        answerEnd:   (selectedSkill === 'reading' || selectedSkill === 'listening') ? answerRange.end   : 0,
      }, { timeout: 180000 })
      setResults(r => [...r, res.data])
      onRefresh?.()
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi trích xuất')
    } finally { setExtracting(false) }
  }

  return (
    <div className="space-y-4">
      {!pdfMeta ? (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${pdfFile ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
            onClick={() => pdfRef.current?.click()}
          >
            <div className="text-4xl mb-2">{pdfFile ? '📄' : '📁'}</div>
            {pdfFile
              ? <><p className="font-semibold text-gray-800 text-sm">{pdfFile.name}</p><p className="text-xs text-gray-400 mt-1">{(pdfFile.size/1024/1024).toFixed(1)} MB</p></>
              : <><p className="font-semibold text-gray-600 text-sm">Kéo thả hoặc click để chọn file PDF</p><p className="text-xs text-gray-400 mt-1">Tối đa 300MB</p></>}
          </div>
          <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { if (e.target.files[0]) setPdfFile(e.target.files[0]); e.target.value = '' }} />
          {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <button onClick={handleUpload} disabled={!pdfFile || uploading} className={btnPrimary + ' w-full'}>
            {uploading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Đang đọc PDF... (1–2 phút)</span>
              : 'Đọc PDF →'}
          </button>
        </>
      ) : (
        <>
          {/* File info bar */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{pdfMeta.originalName}</p>
                <p className="text-xs text-gray-400">{pdfMeta.pageCount} trang</p>
              </div>
            </div>
            <button onClick={() => { setPdfMeta(null); setPdfFile(null); setResults([]) }} className={btnSecondary + ' text-xs py-1'}>Đổi file</button>
          </div>

          {/* Already extracted */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Đã trích xuất</p>
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${r.questionCount > 0 ? 'bg-[#eff6ff] border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className={`text-sm font-semibold truncate ${r.questionCount > 0 ? 'text-[#1a56db]' : 'text-amber-700'}`}>{r.title}</span>
                  <span className={`text-xs shrink-0 ml-2 font-bold ${r.questionCount > 0 ? 'text-[#1a56db]' : 'text-amber-600'}`}>
                    {r.questionCount > 0 ? `${r.questionCount} câu ✓` : '⚠ 0 câu — kiểm tra lại'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">{error}</div>}

          {/* Select Test */}
          <div>
            <label className={labelCls}>Chọn Test</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(n => (
                <button key={n} type="button" onClick={() => setSelectedTest(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${selectedTest === n ? 'bg-[#1a56db] text-white border-[#1a56db]' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                  Test {n}
                </button>
              ))}
            </div>
          </div>

          {/* Select Skill */}
          <div>
            <label className={labelCls}>Chọn Kỹ năng</label>
            <div className="grid grid-cols-4 gap-2">
              {['reading','listening','writing','speaking'].map(sk => (
                <button key={sk} type="button" onClick={() => setSelectedSkill(sk)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition ${selectedSkill === sk ? SKILL_COLOR_CLASS[sk] : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                  {SKILL_LABEL[sk]}
                </button>
              ))}
            </div>
          </div>

          {/* Page ranges */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Phạm vi trang — AI tự gợi ý, có thể chỉnh</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Trang bắt đầu ({SKILL_LABEL[selectedSkill]})</label>
                <input type="text" inputMode="numeric" className={inputCls}
                  value={pageRange.start || ''}
                  placeholder="0"
                  onChange={e => { const v = e.target.value.replace(/\D/g,''); setPageRange(p => ({ ...p, start: v === '' ? 0 : parseInt(v) })) }} />
              </div>
              <div>
                <label className={labelCls}>Trang kết thúc</label>
                <input type="text" inputMode="numeric" className={inputCls}
                  value={pageRange.end || ''}
                  placeholder="0"
                  onChange={e => { const v = e.target.value.replace(/\D/g,''); setPageRange(p => ({ ...p, end: v === '' ? 0 : parseInt(v) })) }} />
              </div>
            </div>
            {(selectedSkill === 'reading' || selectedSkill === 'listening') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Trang đáp án — từ</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={answerRange.start || ''}
                    placeholder="0"
                    onChange={e => { const v = e.target.value.replace(/\D/g,''); setAnswerRange(a => ({ ...a, start: v === '' ? 0 : parseInt(v) })) }} />
                </div>
                <div>
                  <label className={labelCls}>Trang đáp án — đến</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={answerRange.end || ''}
                    placeholder="0"
                    onChange={e => { const v = e.target.value.replace(/\D/g,''); setAnswerRange(a => ({ ...a, end: v === '' ? 0 : parseInt(v) })) }} />
                </div>
              </div>
            )}
          </div>

          {/* Extract button */}
          <button onClick={handleExtract} disabled={extracting} className={btnPrimary + ' w-full'}>
            {extracting
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>AI đang trích xuất... (30–90 giây)</span>
              : `Trích xuất Test ${selectedTest} · ${SKILL_LABEL[selectedSkill]}`}
          </button>
          <p className="text-xs text-center text-gray-400">Có thể trích xuất nhiều lần với các tổ hợp Test + Kỹ năng khác nhau từ cùng 1 PDF</p>
        </>
      )}
    </div>
  )
}

function BookModal({ bookNumber, seriesId, seriesName, coverUrl, onClose, onCoverUploaded, onRefresh }) {
  const [tab, setTab] = useState('cover')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {coverUrl && <img src={`${SERVER_BASE}${coverUrl}`} alt="" className="w-8 h-10 rounded object-cover shadow" />}
            <h2 className="font-extrabold text-gray-800">{seriesName} {bookNumber}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 font-bold transition">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {[{k:'cover',l:'🖼️ Ảnh bìa'},{k:'pdf',l:'📄 Import đề từ PDF'}].map(({k,l}) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${tab === k ? 'border-[#1a56db] text-[#1a56db]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === 'cover' && <CoverTab bookNumber={bookNumber} seriesId={seriesId} coverUrl={coverUrl} onCoverUploaded={onCoverUploaded} />}
          {tab === 'pdf'   && <PDFImportTab bookNumber={bookNumber} seriesId={seriesId} onRefresh={onRefresh} />}
        </div>
      </div>
    </div>
  )
}

// ─── SERIES CARD ───────────────────────────────────────────────────────────────
function SeriesCard({ s, onManage, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-800 text-sm">{s.name}</h4>
          <p className="text-xs text-gray-400 mt-0.5">{s._count?.bookCovers ?? 0} cuốn</p>
        </div>
        <span className="text-2xl">📚</span>
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={() => onManage(s)} className="flex-1 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition">Xem</button>
        <button onClick={() => onEdit(s)} className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition">Sửa tên</button>
        <button onClick={() => setConfirmDelete(true)} className="py-1.5 px-3 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition">Xóa</button>
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-2">Xóa bộ đề?</h3>
            <p className="text-sm text-gray-500 mb-4">Tất cả thông tin trong bộ đề <strong>{s.name}</strong> sẽ bị xóa.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => { setConfirmDelete(false); onDelete(s.id) }} className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SeriesDetailView({ series, books, onBack, onBooksChanged, onRefresh }) {
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
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition text-sm font-bold">←</button>
          <div>
            <h3 className="font-bold text-gray-800">{series.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{books.length} cuốn · click vào cuốn để upload ảnh bìa hoặc import đề từ PDF</p>
          </div>
        </div>
        <button
          onClick={handleAddBook}
          disabled={addingBook}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold hover:bg-[#1d4ed8] transition disabled:opacity-50"
        >
          + Thêm cuốn
        </button>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
        {books.map(b => (
          <div key={b.bookNumber} className="flex flex-col items-center gap-1.5">
            <div className="relative group">
              <div
                className="w-12 h-16 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer hover:border-blue-400 transition"
                onClick={() => setOpenModal(b.bookNumber)}
                title={`${series.name} ${b.bookNumber} — click để quản lý`}
              >
                {coverMap[b.bookNumber]
                  ? <img src={`${SERVER_BASE}${coverMap[b.bookNumber]}`} alt={`${series.name} ${b.bookNumber}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300 text-lg">📚</div>}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
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
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center leading-none"
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
                className="w-12 text-xs text-center border border-[#1a56db] rounded px-1 py-0.5 outline-none font-medium"
              />
            ) : (
              <span className="text-xs text-gray-500 font-medium">{b.bookNumber}</span>
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
          onRefresh={onRefresh}
        />
      )}

      {deleteBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteBook(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-2">Xóa cuốn {deleteBook}?</h3>
            <p className="text-sm text-gray-500 mb-4">Tất cả đề thi (Reading, Listening, Writing, Speaking) trong cuốn này sẽ bị xóa vĩnh viễn.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteBook(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">Hủy</button>
              <button onClick={() => handleDeleteBook(deleteBook)} className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-sm font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { SeriesCard, SeriesDetailView, BookModal }
