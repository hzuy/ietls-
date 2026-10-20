import { useState, useRef, useEffect, useCallback } from 'react'
import { queryClient } from '../../lib/queryClient'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { notifyTrashChanged } from '../../services/adminService'
import { emptyWritingForm, inputCls, labelCls, btnPrimary, btnSecondary, toImgSrc, useExamSeriesList, useSeriesBooks } from './adminConstants'
import Select from './Select'
import ExamList from './ExamList'
import ExamAuditHistory from './ExamAuditHistory'
import InlinePreviewPanel from '../common/InlinePreviewPanel'
import { Upload, Trash2, Eye } from 'lucide-react'

// ─── PREVIEW: WRITING ─────────────────────────────────────────────────────────

function WritingFormPreview({ form }) {
  const [activeTask, setActiveTask] = useState(1)
  const [lightbox, setLightbox] = useState(null)
  const [leftPct, setLeftPct] = useState(45)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const tasks = [
    { num: 1, data: form.task1, minWords: 150, timeHint: '20 phút' },
    { num: 2, data: form.task2, minWords: 250, timeHint: '40 phút' },
  ]
  const task = tasks.find(t => t.num === activeTask)

  // Resizable divider drag handler
  const onDividerPointerDown = useCallback((e) => {
    e.preventDefault()
    const container = containerRef.current
    const divider = e.currentTarget
    if (!container) return

    try { divider.setPointerCapture(e.pointerId) } catch { /* unsupported */ }
    setDragging(true)

    const onPointerMove = (ev) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(75, Math.max(25, pct)))
    }
    const stop = () => {
      setDragging(false)
      try { divider.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      divider.removeEventListener('pointermove', onPointerMove)
      divider.removeEventListener('pointerup', stop)
      divider.removeEventListener('pointercancel', stop)
      window.removeEventListener('mouseleave', stop)
    }
    divider.addEventListener('pointermove', onPointerMove)
    divider.addEventListener('pointerup', stop)
    divider.addEventListener('pointercancel', stop)
    window.addEventListener('mouseleave', stop)
  }, [])

  // Escape to close lightbox
  useEffect(() => {
    if (!lightbox) return
    const handleKey = (e) => { if (e.key === 'Escape') setLightbox(null) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightbox])

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* Task tabs */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {tasks.map(t => (
          <button
            key={t.num}
            type="button"
            onClick={() => setActiveTask(t.num)}
            className={`text-xs font-bold px-4 py-2 rounded-full transition flex items-center gap-2 cursor-pointer ${
              activeTask === t.num
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span>Task {t.num}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              activeTask === t.num ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {t.minWords} từ
            </span>
          </button>
        ))}
      </div>

      {/* Unified Split Frame */}
      <div
        ref={containerRef}
        className="flex flex-1 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs min-h-0"
        style={{ userSelect: dragging ? 'none' : 'auto' }}
      >
        {/* Left: Task prompt & visual */}
        <div
          className="overflow-y-auto bg-white p-6 sm:p-7 flex flex-col"
          style={{ width: `${leftPct}%`, flexShrink: 0 }}
        >
          <div className="flex items-center gap-2.5 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {task.num}
            </div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Task {task.num}</span>
          </div>

          {/* Visual illustration (Task 1 or Task 2 image) — Constrained max-height to avoid overflow */}
          {task.data?.imageUrl && (
            <div
              onClick={() => setLightbox(toImgSrc(task.data.imageUrl))}
              className="relative cursor-pointer group mb-5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-2.5 flex items-center justify-center overflow-hidden hover:border-zinc-300 transition"
              title="Bấm để phóng to ảnh"
            >
              <img
                src={toImgSrc(task.data.imageUrl)}
                alt={`Hình ảnh minh họa Task ${task.num}`}
                className="max-h-[260px] w-auto max-w-full rounded-lg object-contain block mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
              />
              <div className="absolute bottom-2.5 right-2.5 bg-black/65 backdrop-blur-xs text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm pointer-events-none">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Phóng to</span>
              </div>
            </div>
          )}

          {/* Prompt text */}
          {task.data?.prompt ? (
            <p className="text-zinc-800 text-[14px] leading-relaxed whitespace-pre-line font-medium mb-4">
              {task.data.prompt}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 italic mb-4">Chưa có nội dung đề bài cho Task {task.num}</p>
          )}

          {/* Requirement hints */}
          <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-medium shrink-0">
            <span>Tối thiểu <span className="font-bold text-zinc-800">{task.minWords} từ</span></span>
            <span>Khuyến nghị: <span className="font-semibold text-zinc-700">{task.timeHint}</span></span>
          </div>
        </div>

        {/* Divider */}
        <div
          onPointerDown={onDividerPointerDown}
          style={{ width: 5, cursor: 'col-resize', flexShrink: 0, touchAction: 'none', background: dragging ? '#18181b' : '#e4e4e7', transition: dragging ? 'none' : 'background 0.15s' }}
          onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#a1a1aa' }}
          onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e4e4e7' }}
          title="Kéo để chỉnh độ rộng 2 cột"
        />

        {/* Right: Essay area simulation (Identical to Writing exam interface) */}
        <div className="flex-1 overflow-hidden bg-zinc-50/50 p-6 sm:p-7 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bài viết Task {task.num}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-600 shadow-2xs">
              0 / {task.minWords} từ
            </span>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
            <textarea
              disabled
              placeholder={`Bắt đầu viết Task ${task.num} tại đây...\n\n(Đây là màn hình Preview mô phỏng giao diện làm bài thi thực tế của học viên)`}
              className="w-full flex-1 p-5 text-sm leading-relaxed text-zinc-500 placeholder:text-zinc-400 bg-white resize-none focus:outline-none cursor-not-allowed"
            />
            <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
              <span>Chế độ xem trước — không thể nhập bài</span>
              <span>0 từ · 0 ký tự</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 shrink-0">
            <p className="text-[11px] text-zinc-400 italic">Mô phỏng trải nghiệm thi thực tế</p>
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded-xl bg-zinc-200 text-zinc-400 text-xs font-bold cursor-not-allowed opacity-70"
            >
              Nộp Task {task.num} để AI chấm
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox fullsize visual viewer */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
            className="fixed top-4 right-5 z-[10001] w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white text-xl flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
          <img
            src={lightbox}
            alt="Task visual fullsize"
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

// ─── TAB: WRITING ─────────────────────────────────────────────────────────────

const DRAFT_PREFIX = 'draft_writing_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function WritingTab({ exams, onRefresh, examSeries = [], paginationData, fetchExams, loading, loadError }) {
  const [form, setForm] = useState(emptyWritingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const formRef = useRef(null)
  const previewRef = useRef(null)
  const imgRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const uploadTask1Image = async (file) => {
    if (file.size > 5 * 1024 * 1024) { showToast('Ảnh tối đa 5MB'); return }
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['png', 'jpg', 'jpeg'].includes(ext)) { showToast('Chỉ chấp nhận PNG hoặc JPG'); return }
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/admin/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: res.data.imageUrl } }))
    } catch { showToast('Lỗi upload ảnh — thử lại sau') }
    finally { setImgUploading(false) }
  }

  // Scroll the preview panel into view once it has rendered.
  useEffect(() => {
    if (showPreview) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showPreview])

  // On mount: purge stale draft_writing_* keys older than 7 days.
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(DRAFT_PREFIX)) continue
        try {
          const parsed = JSON.parse(localStorage.getItem(k))
          const savedAt = parsed && parsed._savedAt
          if (savedAt && Date.now() - savedAt > DRAFT_MAX_AGE_MS) localStorage.removeItem(k)
        } catch { localStorage.removeItem(k) }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  useEffect(() => {
    const key = `draft_writing_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const { _savedAt, ...data } = JSON.parse(saved)
        setDraftBanner({ key, data, savedAt: _savedAt })
      }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_writing_${editingId || 'new'}`
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...form, _savedAt: Date.now() }))
        const now = new Date()
        const hh = now.getHours().toString().padStart(2, '0')
        const mm = now.getMinutes().toString().padStart(2, '0')
        setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
        setTimeout(() => setToast(''), 3000)
      } catch {
        setToast('Không lưu được nháp (bộ nhớ đầy)')
        setTimeout(() => setToast(''), 3000)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
    setLoadingEdit(true)
    try {
      const res = await api.get(`/admin/exams/${id}`)
      const exam = res.data
      const t1 = exam.writingTasks.find(t => t.number === 1)
      const t2 = exam.writingTasks.find(t => t.number === 2)
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        task1: { prompt: t1?.prompt || '', imageUrl: t1?.imageUrl || '' },
        task2: { prompt: t2?.prompt || '' }
      })
      setEditingId(id)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      const msg = 'Lỗi tải đề để sửa. Thử lại.'
      setError(msg)
      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => {
    if (editingId) localStorage.removeItem(`draft_writing_${editingId}`)
    setEditingId(null); setForm(emptyWritingForm()); setEditHighlight(false); setDraftBanner(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const problems = []
    if (!form.title.trim()) problems.push('Chưa nhập tên đề')
    if (!form.task1.prompt.trim()) problems.push('Task 1: chưa nhập đề bài')
    if (!form.task2.prompt.trim()) problems.push('Task 2: chưa nhập đề bài')
    if (problems.length) {
      const msg = 'Không thể lưu đề:\n• ' + problems.join('\n• ')
      setError(msg)
      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        task1: { prompt: form.task1.prompt, imageUrl: form.task1.imageUrl || null },
        task2: { prompt: form.task2.prompt }
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_writing_${editingId}`)
        showToast('Cập nhật đề thành công!')
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        // Log audit vừa ghi ở backend — invalidate để khối "Lịch sử thay đổi" hiện ngay, không đợi hết staleTime.
        queryClient.invalidateQueries({ queryKey: ['admin', 'auditLogs', 'exam', editingId] })
        onRefresh()
      } else {
        await api.post('/admin/exams/writing', payload)
        localStorage.removeItem('draft_writing_new')
        showToast('Tạo đề thành công!')
        setForm(emptyWritingForm())
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        onRefresh()
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi tạo đề Writing'
      setError(msg)
      showAlert(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    // Xác nhận đã do modal của ExamList đảm nhiệm trước khi gọi onDelete
    try {
      await api.delete(`/admin/exams/${id}`)
      notifyTrashChanged()
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
      onRefresh()
    } catch { showToast('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-zinc-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
      <div className="relative">
      {loadingEdit && (
        <div className="absolute inset-0 z-20 rounded-2xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-sm font-semibold text-zinc-500">Đang tải đề để sửa…</span>
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} aria-busy={loadingEdit}
        className={`bg-white rounded-2xl p-6 border shadow-xs transition-all duration-500 ${loadingEdit ? 'opacity-60 pointer-events-none select-none' : ''} ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-zinc-200'}`}>
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">{editingId ? (form.title ? `Sửa đề Writing: ${form.title}` : 'Sửa đề Writing') : 'Tạo đề Writing mới'}</h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm whitespace-pre-line">{error}</div>}

        {draftBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-amber-700">Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-800">{form.title ? `Đang sửa đề: ${form.title}` : `Đang sửa đề ${editingId}`}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition shadow-2xs">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Tên đề</label>
            <input className={inputCls} required placeholder="VD: IELTS Writing Practice Test 1"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-5">
          <p className="text-xs font-medium text-zinc-700 mb-2">Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <Select
                ariaLabel="Bộ đề"
                value={form.seriesId}
                onChange={v => setForm({ ...form, seriesId: v, bookNumber: '' })}
                options={[
                  { value: '', label: '-- Không gắn --' },
                  ...liveExamSeries.map(s => ({ value: String(s.id), label: s.name })),
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <Select
                ariaLabel="Cuốn số"
                value={form.bookNumber}
                onChange={v => setForm({ ...form, bookNumber: v })}
                disabled={!form.seriesId}
                options={[
                  { value: '', label: '-- Chọn cuốn --' },
                  ...seriesBooks.map(b => ({ value: String(b.bookNumber), label: String(b.bookNumber) })),
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <Select
                ariaLabel="Test số"
                value={form.testNumber}
                onChange={v => setForm({ ...form, testNumber: v })}
                disabled={!form.bookNumber}
                options={[
                  { value: '', label: '-- Chọn test --' },
                  ...[1, 2, 3, 4].map(n => ({ value: String(n), label: `Test ${n}` })),
                ]}
              />
            </div>
          </div>
        </div>

        {/* Task 1 */}
        <div className="border border-zinc-200 rounded-2xl p-5 mb-5 bg-zinc-50/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">1</div>
            <span className="font-medium text-sm text-zinc-800">Task 1 — Mô tả biểu đồ / bản đồ / quy trình (tối thiểu 150 từ)</span>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Hình ảnh (biểu đồ / bản đồ) — tùy chọn</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
                className={`${btnSecondary} whitespace-nowrap flex items-center gap-1.5`}>
                {imgUploading ? 'Đang upload...' : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload ảnh</span>
                  </>
                )}
              </button>
              {form.task1.imageUrl && (
                <button type="button" onClick={() => setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: '' } }))}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs px-2 py-1 rounded transition flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa ảnh</span>
                </button>
              )}
              <input ref={imgRef} type="file" accept=".png,.jpg,.jpeg" className="hidden"
                onChange={e => { if (e.target.files[0]) uploadTask1Image(e.target.files[0]); e.target.value = '' }} />
            </div>
            {form.task1.imageUrl && (
              <img
                src={toImgSrc(form.task1.imageUrl)}
                alt="task1 preview" className="mt-2 max-h-48 rounded-lg border border-zinc-200 object-contain w-full bg-zinc-50" />
            )}
            <p className="text-xs text-zinc-400 mt-1">PNG hoặc JPG, tối đa 5MB</p>
          </div>
          <div>
            <label className={labelCls}>Đề bài Task 1</label>
            <textarea className={`${inputCls} h-28 resize-none`}
              placeholder="VD: The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
              value={form.task1.prompt} required
              onChange={e => setForm({ ...form, task1: { ...form.task1, prompt: e.target.value } })} />
          </div>
        </div>

        {/* Task 2 */}
        <div className="border border-zinc-200 rounded-2xl p-5 mb-6 bg-zinc-50/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">2</div>
            <span className="font-medium text-sm text-zinc-800">Task 2 — Viết luận (tối thiểu 250 từ)</span>
          </div>
          <div>
            <label className={labelCls}>Đề bài Task 2 (Essay)</label>
            <textarea className={`${inputCls} h-32 resize-none`}
              placeholder="VD: Some people believe that governments should invest more money in public transport rather than building new roads. To what extent do you agree or disagree?"
              value={form.task2.prompt} required
              onChange={e => setForm({ ...form, task2: { prompt: e.target.value } })} />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || loadingEdit}
          className="w-full h-10 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Writing' : 'Tạo đề Writing'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full h-10 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
            showPreview
              ? 'border-zinc-400 bg-zinc-100 text-zinc-900'
              : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{showPreview ? 'Đóng preview' : 'Preview nội dung đề'}</span>
        </button>
      </form>
      </div>

      {showPreview && (
        <div ref={previewRef} style={{ scrollMarginTop: 16 }}>
          <InlinePreviewPanel
            title={form.title || 'Writing'}
            hideAnswers
            onClose={() => setShowPreview(false)}
          >
            <WritingFormPreview form={form} />
          </InlinePreviewPanel>
        </div>
      )}

      {editingId && (
        <div className="mb-6">
          <ExamAuditHistory examId={editingId} />
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Danh sách đề Writing</h3>
        <ExamList exams={exams} skill="writing" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} paginationData={paginationData} fetchExams={fetchExams} loading={loading} error={loadError} />
      </div>
    </div>
  )
}

export default WritingTab
