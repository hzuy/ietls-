import { useState, useEffect, useRef } from 'react'
import { queryClient } from '../../lib/queryClient'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { notifyTrashChanged } from '../../services/adminService'
import { emptySpeakingForm, inputCls, labelCls, btnPrimary, btnSecondary, useExamSeriesList, useSeriesBooks } from './adminConstants'
import Select from './Select'
import ExamList from './ExamList'
import InlinePreviewPanel from '../common/InlinePreviewPanel'
// SpeakingFormPreview is defined in ReadingTab.jsx alongside the other form
// previews and re-exported; extracting the previews into a shared module is
// deferred to a later refactor.
import { SpeakingFormPreview } from './ReadingTab'
import { Eye } from 'lucide-react'

// ─── TAB: SPEAKING ────────────────────────────────────────────────────────────

const DRAFT_PREFIX = 'draft_speaking_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function SpeakingTab({ exams, onRefresh, examSeries = [], paginationData, fetchExams, loading, loadError }) {
  const [form, setForm] = useState(emptySpeakingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)
  const previewRef = useRef(null)

  const showToast = (msg) => { showAlert(msg); setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Scroll the preview panel into view once it has rendered.
  useEffect(() => {
    if (showPreview) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showPreview])

  // On mount: purge stale draft_speaking_* keys older than 7 days.
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
    const key = `draft_speaking_${editingId || 'new'}`
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
    const key = `draft_speaking_${editingId || 'new'}`
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
      const p1 = exam.speakingParts.find(p => p.number === 1)
      const p2 = exam.speakingParts.find(p => p.number === 2)
      const p3 = exam.speakingParts.find(p => p.number === 3)

      // Reconstruct Part 3 topic groups from ##TOPIC## markers. Every marker starts
      // a new topic — including a bare "##TOPIC##:" (empty label), which is a valid
      // boundary. Questions before the first marker (legacy data) go into an
      // unlabelled leading topic.
      const part3Topics = []
      let currentTopic = null
      const pushTopic = (t) => part3Topics.push({ ...t, questions: t.questions.length ? t.questions : [''] })
      for (const q of (p3?.questions || [])) {
        if (q.questionText.startsWith('##TOPIC##:')) {
          if (currentTopic) pushTopic(currentTopic)
          currentTopic = { label: q.questionText.slice('##TOPIC##:'.length), questions: [] }
        } else {
          if (!currentTopic) currentTopic = { label: '', questions: [] }
          currentTopic.questions.push(q.questionText)
        }
      }
      if (currentTopic) pushTopic(currentTopic)
      if (!part3Topics.length) part3Topics.push({ label: '', questions: [''] })

      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        part1: { description: p1?.cueCard || '', questions: p1?.questions.map(q => q.questionText) || [''] },
        part2: (() => {
          const raw = p2?.cueCard || ''
          const sep = raw.indexOf('\n===\n')
          return sep === -1
            ? { instructions: '', cueCard: raw, questions: p2?.questions.map(q => q.questionText) || [''] }
            : { instructions: raw.slice(0, sep), cueCard: raw.slice(sep + 5), questions: p2?.questions.map(q => q.questionText) || [''] }
        })(),
        part3: { description: p3?.cueCard || '', topics: part3Topics }
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
    if (editingId) localStorage.removeItem(`draft_speaking_${editingId}`)
    setEditingId(null); setForm(emptySpeakingForm()); setEditHighlight(false); setDraftBanner(null)
  }

  // ── Part 1 helpers ─────────────────────────────────────────────
  const updateP1Question = (idx, val) => {
    const qs = [...form.part1.questions]; qs[idx] = val
    setForm({ ...form, part1: { ...form.part1, questions: qs } })
  }
  const addP1Question = () =>
    setForm(f => ({ ...f, part1: { ...f.part1, questions: [...f.part1.questions, ''] } }))
  const removeP1Question = (idx) => {
    const qs = form.part1.questions.filter((_, i) => i !== idx)
    setForm(f => ({ ...f, part1: { ...f.part1, questions: qs.length ? qs : [''] } }))
  }

  // ── Part 2 helpers ─────────────────────────────────────────────
  const updateP2Question = (idx, val) => {
    const qs = [...form.part2.questions]; qs[idx] = val
    setForm({ ...form, part2: { ...form.part2, questions: qs } })
  }
  const addP2Question = () =>
    setForm({ ...form, part2: { ...form.part2, questions: [...form.part2.questions, ''] } })
  const removeP2Question = (idx) => {
    const qs = form.part2.questions.filter((_, i) => i !== idx)
    setForm({ ...form, part2: { ...form.part2, questions: qs.length ? qs : [''] } })
  }

  // ── Part 3 topic helpers ────────────────────────────────────────
  const updateTopicLabel = (ti, val) => {
    const topics = [...form.part3.topics]
    topics[ti] = { ...topics[ti], label: val }
    setForm({ ...form, part3: { topics } })
  }
  const updateTopicQuestion = (ti, qi, val) => {
    const topics = [...form.part3.topics]
    const qs = [...topics[ti].questions]; qs[qi] = val
    topics[ti] = { ...topics[ti], questions: qs }
    setForm({ ...form, part3: { topics } })
  }
  const addTopicQuestion = (ti) => {
    const topics = [...form.part3.topics]
    topics[ti] = { ...topics[ti], questions: [...topics[ti].questions, ''] }
    setForm({ ...form, part3: { topics } })
  }
  const removeTopicQuestion = (ti, qi) => {
    const topics = [...form.part3.topics]
    const qs = topics[ti].questions.filter((_, i) => i !== qi)
    topics[ti] = { ...topics[ti], questions: qs.length ? qs : [''] }
    setForm({ ...form, part3: { topics } })
  }
  const addTopic = () =>
    setForm({ ...form, part3: { topics: [...form.part3.topics, { label: '', questions: ['', ''] }] } })
  const removeTopic = (ti) => {
    const topics = form.part3.topics.filter((_, i) => i !== ti)
    setForm({ ...form, part3: { topics: topics.length ? topics : [{ label: '', questions: [''] }] } })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const p1Count = form.part1.questions.filter(q => q.trim()).length
    const p3Count = form.part3.topics.reduce((n, t) => n + t.questions.filter(q => q.trim()).length, 0)
    const problems = []
    if (!form.title.trim()) problems.push('Chưa nhập tên đề')
    if (p1Count === 0 && p3Count === 0) problems.push('Part 1 và Part 3 đều chưa có câu hỏi nào')
    if (problems.length) {
      const msg = 'Không thể lưu đề:\n• ' + problems.join('\n• ')
      setError(msg)
      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    setSubmitting(true)
    try {
      // Flatten Part 3 topics → questions with a ##TOPIC## marker before each topic.
      // The marker is ALWAYS emitted (bare "##TOPIC##:" when the label is empty) so
      // an unlabelled topic keeps its boundary instead of merging into the previous
      // one. A topic with no questions is dropped entirely.
      const part3Questions = form.part3.topics.flatMap(t => {
        const qs = t.questions.filter(q => q.trim())
        if (qs.length === 0) return []
        return [`##TOPIC##:${t.label.trim()}`, ...qs]
      })

      const p2CueCard = form.part2.instructions.trim()
        ? `${form.part2.instructions.trim()}\n===\n${form.part2.cueCard}`
        : form.part2.cueCard
      const speakingPayload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        part1: { cueCard: form.part1.description, questions: form.part1.questions.filter(q => q.trim()) },
        part2: { cueCard: p2CueCard, questions: form.part2.questions.filter(q => q.trim()) },
        part3: { cueCard: form.part3.description, questions: part3Questions }
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, speakingPayload)
        localStorage.removeItem(`draft_speaking_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        onRefresh()
      } else {
        await api.post('/admin/exams/speaking', speakingPayload)
        localStorage.removeItem('draft_speaking_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptySpeakingForm())
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        onRefresh()
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi tạo đề Speaking'
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
        <div className="fixed bottom-4 right-4 bg-zinc-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
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
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">{editingId ? `Sửa đề Speaking #${editingId}` : 'Tạo đề Speaking mới'}</h3>

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
            <span className="text-sm font-semibold text-zinc-800">Đang sửa đề #{editingId}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition shadow-2xs">
                {showPreview ? 'Ẩn preview' : 'Preview'}
              </button>
              <button type="button" onClick={cancelEdit} className={btnSecondary + ' text-xs'}>Hủy sửa</button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Tên đề</label>
          <input className={inputCls} required placeholder="VD: Cambridge 18 · Test 1 · Speaking"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
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

        {/* ── Part 1 ── */}
        <div className="border border-zinc-200 rounded-2xl p-5 mb-4 bg-zinc-50/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">1</div>
            <div>
              <span className="font-medium text-sm text-zinc-800">Part 1 — Introduction & Interview</span>
              <p className="text-xs text-zinc-500 mt-0.5">Examiner hỏi về chủ đề quen thuộc trong cuộc sống</p>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-20 resize-none`}
              placeholder="VD: The examiner asks you about yourself, your home, work or studies and other familiar topics."
              value={form.part1.description}
              onChange={e => setForm({ ...form, part1: { ...form.part1, description: e.target.value } })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Câu hỏi</label>
              <button type="button" onClick={addP1Question} className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 transition">+ Thêm câu</button>
            </div>
            <div className="space-y-2">
              {form.part1.questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={inputCls}
                    placeholder={`VD: Can you find food from many different countries where you live? [Why/Why not?]`}
                    value={q} onChange={e => updateP1Question(idx, e.target.value)} />
                  {form.part1.questions.length > 1 && (
                    <button type="button" onClick={() => removeP1Question(idx)}
                      className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Part 2 ── */}
        <div className="border border-zinc-200 rounded-2xl p-5 mb-4 bg-zinc-50/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">2</div>
            <div>
              <span className="font-medium text-sm text-zinc-800">Part 2 — Individual Long Turn (Cue Card)</span>
              <p className="text-xs text-zinc-500 mt-0.5">Thí sinh chuẩn bị 1 phút, nói 1–2 phút</p>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-16 resize-none`}
              placeholder="VD: You will have to talk about the topic for one to two minutes..."
              value={form.part2.instructions}
              onChange={e => setForm({ ...form, part2: { ...form.part2, instructions: e.target.value } })} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Nội dung Cue Card</label>
            <textarea className={`${inputCls} h-36 resize-none`}
              placeholder={`Describe a law that was introduced in your country and that you thought was a very good idea.\n\nYou should say:\n  what the law was\n  who introduced it\n  when and why it was introduced\nand explain why you thought this law was such a good idea.`}
              value={form.part2.cueCard}
              onChange={e => setForm({ ...form, part2: { ...form.part2, cueCard: e.target.value } })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Follow-up questions (tùy chọn)</label>
              <button type="button" onClick={addP2Question} className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 transition">+ Thêm câu</button>
            </div>
            <div className="space-y-2">
              {form.part2.questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={inputCls} placeholder={`Follow-up ${idx + 1}...`}
                    value={q} onChange={e => updateP2Question(idx, e.target.value)} />
                  {form.part2.questions.length > 1 && (
                    <button type="button" onClick={() => removeP2Question(idx)}
                      className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Part 3 ── */}
        <div className="border border-zinc-200 rounded-2xl p-5 mb-6 bg-zinc-50/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <span className="font-medium text-sm text-zinc-800">Part 3 — Two-way Discussion</span>
                <p className="text-xs text-zinc-500 mt-0.5">Nhiều chủ đề thảo luận, mỗi chủ đề có nhiều câu hỏi</p>
              </div>
            </div>
            <button type="button" onClick={addTopic} className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 transition">+ Thêm chủ đề</button>
          </div>

          <div className="mb-4">
            <label className={labelCls}>Mô tả / Hướng dẫn cho thí sinh</label>
            <textarea className={`${inputCls} h-16 resize-none`}
              placeholder="VD: Discussion topics: The examiner will ask you questions about the following topics."
              value={form.part3.description}
              onChange={e => setForm({ ...form, part3: { ...form.part3, description: e.target.value } })} />
          </div>

          <div className="space-y-4">
            {form.part3.topics.map((topic, ti) => (
              <div key={ti} className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input className={inputCls} placeholder={`VD: School rules`}
                    value={topic.label} onChange={e => updateTopicLabel(ti, e.target.value)} />
                  {form.part3.topics.length > 1 && (
                    <button type="button" onClick={() => removeTopic(ti)}
                      className="text-red-500 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap shrink-0">
                      Xóa chủ đề
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {topic.questions.map((q, qi) => (
                    <div key={qi} className="flex gap-2">
                      <input className={inputCls}
                        placeholder={`VD: What kinds of rules are common in a school?`}
                        value={q} onChange={e => updateTopicQuestion(ti, qi, e.target.value)} />
                      {topic.questions.length > 1 && (
                        <button type="button" onClick={() => removeTopicQuestion(ti, qi)}
                          className="text-red-400 hover:text-red-600 px-2 flex-shrink-0">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addTopicQuestion(ti)} className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 transition">
                    + Thêm câu hỏi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={submitting || loadingEdit} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Speaking' : 'Tạo đề Speaking'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className={`w-full py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            showPreview
              ? 'border-zinc-400 bg-zinc-100 text-zinc-900'
              : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showPreview ? 'Thu gọn preview' : 'Xem trước nội dung đề'}</span>
        </button>
      </form>
      </div>

      {showPreview && (
        <div ref={previewRef} style={{ scrollMarginTop: 16 }}>
          <InlinePreviewPanel
            title={form.title || 'Speaking'}
            hideAnswers
            onClose={() => setShowPreview(false)}
          >
            <SpeakingFormPreview form={form} />
          </InlinePreviewPanel>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Danh sách đề Speaking</h3>
        <ExamList exams={exams} skill="speaking" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} paginationData={paginationData} fetchExams={fetchExams} loading={loading} error={loadError} />
      </div>
    </div>
  )
}

export default SpeakingTab
