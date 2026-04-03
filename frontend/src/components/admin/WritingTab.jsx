import { useState, useRef } from 'react'
import api from '../../utils/axios'
import { emptyWritingForm, inputCls, labelCls, btnPrimary, btnSecondary, toImgSrc } from './adminConstants'
import ExamList from './ExamList'
import { useExamSeriesList, useSeriesBooks } from './ReadingTab'

// ─── INLINE PREVIEW PANEL ─────────────────────────────────────────────────────

function InlinePreviewPanel({ title, showAnswers, setShowAnswers, onClose, children }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-indigo-800">Xem trước — {title}</span>
          <button
            type="button"
            onClick={() => setShowAnswers(v => !v)}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-[#1a56db] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#bfdbfe] hover:text-[#1a56db]'}`}
          >
            {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition font-medium"
        >
          Thu gọn ↑
        </button>
      </div>
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

// ─── PREVIEW: WRITING ─────────────────────────────────────────────────────────

function WritingFormPreview({ form }) {
  const [activeTask, setActiveTask] = useState(1)
  const [lightbox, setLightbox] = useState(null)

  const tasks = [
    { num: 1, data: form.task1, minWords: 150, timeHint: '20 phút' },
    { num: 2, data: form.task2, minWords: 250, timeHint: '40 phút' },
  ]
  const task = tasks.find(t => t.num === activeTask)

  return (
    <div>
      {/* Task tabs */}
      <div className="flex gap-1.5 mb-4">
        {tasks.map(t => (
          <button key={t.num} type="button" onClick={() => setActiveTask(t.num)}
            style={{
              background: activeTask === t.num ? '#1a56db' : '#fff',
              color: activeTask === t.num ? '#fff' : '#1e293b',
              borderColor: activeTask === t.num ? '#1a56db' : '#e2e8f0',
            }}
            className="px-4 py-1.5 rounded-lg border text-sm font-medium transition">
            Task {t.num}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex gap-4" style={{ minHeight: 320 }}>
        {/* Left: task prompt */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#bfdbfe] p-5 overflow-y-auto" style={{ maxHeight: 480 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#1a56db] text-white text-xs font-bold uppercase tracking-wide">
              TASK {task.num}
            </span>
          </div>
          {task.num === 1 && task.data.imageUrl && (
            <div onClick={() => setLightbox(toImgSrc(task.data.imageUrl))}
              className="relative cursor-pointer group mb-4 inline-block w-full">
              <img src={toImgSrc(task.data.imageUrl)} alt="Task 1 visual"
                className="w-full rounded-xl border border-gray-200 object-contain" />
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 11, opacity: 0, transition: 'opacity 0.15s' }}
                className="group-hover:opacity-100">
                Phóng to
              </div>
            </div>
          )}
          {task.data.prompt ? (
            <p className="text-sm text-gray-700 leading-7">{task.data.prompt}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có đề bài</p>
          )}
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-400">Tối thiểu <span className="font-bold text-gray-600">{task.minWords} từ</span></p>
            <p className="text-xs text-gray-400">Khuyến nghị: <span className="font-medium text-gray-500">{task.timeHint}</span></p>
          </div>
        </div>

        {/* Right: essay area demo */}
        <div className="w-80 shrink-0 flex flex-col gap-2">
          <div className="bg-white rounded-xl border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Bài viết Task {task.num}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                0/{task.minWords} từ
              </span>
            </div>
            <textarea
              disabled
              placeholder={`Bắt đầu viết Task ${task.num} tại đây...`}
              style={{ backgroundColor: '#f8fafc', flex: 1, minHeight: 200, padding: '16px', fontSize: 13, lineHeight: 1.75, resize: 'none', border: 'none', outline: 'none', color: '#9ca3af', cursor: 'not-allowed' }}
            />
          </div>
          <p className="text-[10px] text-gray-300 italic text-center">Khu vực demo — không nhập được trong preview</p>
          <button type="button" disabled
            className="w-full py-2.5 rounded-xl bg-gray-200 text-gray-400 text-sm font-bold cursor-not-allowed opacity-60">
            Nộp Task {task.num} để AI chấm
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 16, right: 20, zIndex: 10000, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <img src={lightbox} alt="Task visual fullsize" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ─── TAB: WRITING ─────────────────────────────────────────────────────────────

function WritingTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptyWritingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const formRef = useRef(null)
  const imgRef = useRef(null)

  const uploadTask1Image = async (file) => {
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh tối đa 5MB'); return }
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['png', 'jpg', 'jpeg'].includes(ext)) { alert('Chỉ chấp nhận PNG hoặc JPG'); return }
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/admin/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: res.data.imageUrl } }))
    } catch { alert('Lỗi upload ảnh') }
    finally { setImgUploading(false) }
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_writing_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_writing_${editingId || 'new'}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      setToast(`Đã lưu bản nháp lúc ${hh}:${mm}`)
      setTimeout(() => setToast(''), 3000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, editingId])

  const loadForEdit = async (id) => {
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
    } catch { alert('Lỗi tải đề để sửa') }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyWritingForm()); setEditHighlight(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
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
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/writing', payload)
        localStorage.removeItem('draft_writing_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyWritingForm())
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi tạo đề Writing')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa đề này?')) return
    try {
      await api.delete(`/admin/exams/${id}`)
      onRefresh()
    } catch { alert('Lỗi xóa đề') }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className={`bg-white rounded-2xl p-6 border shadow-sm transition-all duration-500 ${editHighlight ? 'border-amber-400 shadow-amber-100' : 'border-gray-100'}`}>
        <h3 className="font-bold text-gray-800 mb-5">{editingId ? `✏️ Sửa đề Writing #${editingId}` : 'Tạo đề Writing mới'}</h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        {draftBanner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-yellow-700">📋 Có bản nháp chưa lưu. Khôi phục?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition">Khôi phục</button>
              <button type="button" onClick={() => { localStorage.removeItem(draftBanner.key); setDraftBanner(null) }}
                className="text-xs px-2.5 py-1 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">Bỏ qua</button>
            </div>
          </div>
        )}

        {editingId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">✏️ Đang sửa đề #{editingId}</span>
            <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Tên đề</label>
            <input className={inputCls} required placeholder="VD: IELTS Writing Practice Test 1"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
          <p className="text-xs font-bold text-blue-700 mb-2">📚 Gắn nhãn bộ đề (tuỳ chọn)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Bộ đề</label>
              <select className={inputCls} value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value, bookNumber: '' })}>
                <option value="">-- Không gắn --</option>
                {liveExamSeries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuốn số</label>
              <select className={inputCls} value={form.bookNumber} onChange={e => setForm({ ...form, bookNumber: e.target.value })} disabled={!form.seriesId}>
                <option value="">-- Chọn cuốn --</option>
                {seriesBooks.map(b => <option key={b.bookNumber} value={b.bookNumber}>{b.bookNumber}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Test số</label>
              <select className={inputCls} value={form.testNumber} onChange={e => setForm({ ...form, testNumber: e.target.value })} disabled={!form.bookNumber}>
                <option value="">-- Chọn test --</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>Test {n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Task 1 */}
        <div className="border border-amber-200 rounded-2xl p-5 mb-5 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">1</div>
            <span className="font-semibold text-gray-700">Task 1 — Mô tả biểu đồ / bản đồ / quy trình (tối thiểu 150 từ)</span>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Hình ảnh (biểu đồ / bản đồ) — tùy chọn</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => imgRef.current?.click()} disabled={imgUploading}
                className={`${btnSecondary} whitespace-nowrap`}>
                {imgUploading ? 'Đang upload...' : '📷 Upload ảnh'}
              </button>
              {form.task1.imageUrl && (
                <button type="button" onClick={() => setForm(f => ({ ...f, task1: { ...f.task1, imageUrl: '' } }))}
                  className="text-red-400 hover:text-red-600 text-xs px-2">✕ Xóa ảnh</button>
              )}
              <input ref={imgRef} type="file" accept=".png,.jpg,.jpeg" className="hidden"
                onChange={e => { if (e.target.files[0]) uploadTask1Image(e.target.files[0]); e.target.value = '' }} />
            </div>
            {form.task1.imageUrl && (
              <img
                src={form.task1.imageUrl.startsWith('/') ? `http://localhost:3001${form.task1.imageUrl}` : form.task1.imageUrl}
                alt="task1 preview" className="mt-2 max-h-48 rounded-xl border object-contain w-full bg-gray-50" />
            )}
            <p className="text-xs text-gray-400 mt-1">PNG hoặc JPG, tối đa 5MB</p>
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
        <div className="border border-blue-200 rounded-2xl p-5 mb-6 bg-blue-50/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</div>
            <span className="font-semibold text-gray-700">Task 2 — Viết luận (tối thiểu 250 từ)</span>
          </div>
          <div>
            <label className={labelCls}>Đề bài Task 2 (Essay)</label>
            <textarea className={`${inputCls} h-32 resize-none`}
              placeholder="VD: Some people believe that governments should invest more money in public transport rather than building new roads. To what extent do you agree or disagree?"
              value={form.task2.prompt} required
              onChange={e => setForm({ ...form, task2: { prompt: e.target.value } })} />
          </div>
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Writing' : 'Tạo đề Writing'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          {showPreview ? '▲ Thu gọn preview' : '👁 Xem trước nội dung đề'}
        </button>
      </form>

      {showPreview && (
        <InlinePreviewPanel
          title={form.title || 'Writing'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <WritingFormPreview form={form} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Writing ({exams.filter(e => e.skill === 'writing').length})</h3>
        <ExamList exams={exams} skill="writing" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} />
      </div>
    </div>
  )
}

export default WritingTab
