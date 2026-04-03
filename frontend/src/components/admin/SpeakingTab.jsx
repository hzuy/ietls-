import { useState } from 'react'
import api from '../../utils/axios'
import { emptySpeakingForm, inputCls, labelCls, btnPrimary, btnSecondary, btnGhost } from './adminConstants'
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

// ─── TAB: SPEAKING ────────────────────────────────────────────────────────────

function SpeakingTab({ exams, onRefresh, examSeries = [] }) {
  const [form, setForm] = useState(emptySpeakingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_speaking_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_speaking_${editingId || 'new'}`
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
      const p1 = exam.speakingParts.find(p => p.number === 1)
      const p2 = exam.speakingParts.find(p => p.number === 2)
      const p3 = exam.speakingParts.find(p => p.number === 3)

      // Reconstruct Part 3 topic groups from ##TOPIC## markers
      const part3Topics = []
      let currentTopic = null
      for (const q of (p3?.questions || [])) {
        if (q.questionText.startsWith('##TOPIC##:')) {
          if (currentTopic) part3Topics.push(currentTopic)
          currentTopic = { label: q.questionText.replace('##TOPIC##:', ''), questions: [] }
        } else {
          if (!currentTopic) currentTopic = { label: '', questions: [] }
          currentTopic.questions.push(q.questionText)
        }
      }
      if (currentTopic) part3Topics.push(currentTopic)
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
    } catch { alert('Lỗi tải đề để sửa') }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptySpeakingForm()); setEditHighlight(false) }

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
    setSubmitting(true)
    setError('')
    try {
      // Flatten Part 3 topics → questions with ##TOPIC## markers
      const part3Questions = form.part3.topics.flatMap(t => [
        t.label.trim() ? `##TOPIC##:${t.label.trim()}` : null,
        ...t.questions.filter(q => q.trim())
      ]).filter(Boolean)

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
        onRefresh()
      } else {
        await api.post('/admin/exams/speaking', speakingPayload)
        localStorage.removeItem('draft_speaking_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptySpeakingForm())
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi tạo đề Speaking')
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
        <h3 className="font-bold text-gray-800 mb-5">{editingId ? `✏️ Sửa đề Speaking #${editingId}` : 'Tạo đề Speaking mới'}</h3>

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
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview(v => !v)}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold border border-blue-200 bg-white text-blue-500 hover:border-blue-400 hover:text-blue-700 transition">
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

        {/* ── Part 1 ── */}
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-4 bg-[#eff6ff]/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">1</div>
            <div>
              <span className="font-semibold text-gray-700">Part 1 — Introduction & Interview</span>
              <p className="text-xs text-gray-400 mt-0.5">Examiner hỏi về chủ đề quen thuộc trong cuộc sống</p>
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
              <button type="button" onClick={addP1Question} className={btnGhost}>+ Thêm câu</button>
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
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-4 bg-[#eff6ff]/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">2</div>
            <div>
              <span className="font-semibold text-gray-700">Part 2 — Individual Long Turn (Cue Card)</span>
              <p className="text-xs text-gray-400 mt-0.5">Thí sinh chuẩn bị 1 phút, nói 1–2 phút</p>
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
              <button type="button" onClick={addP2Question} className={btnGhost}>+ Thêm câu</button>
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
        <div className="border border-[#bfdbfe] rounded-2xl p-5 mb-6 bg-[#eff6ff]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1a56db] text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <span className="font-semibold text-gray-700">Part 3 — Two-way Discussion</span>
                <p className="text-xs text-gray-400 mt-0.5">Nhiều chủ đề thảo luận, mỗi chủ đề có nhiều câu hỏi</p>
              </div>
            </div>
            <button type="button" onClick={addTopic} className={btnGhost}>+ Thêm chủ đề</button>
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
              <div key={ti} className="bg-white border border-[#e2e8f0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input className={inputCls} placeholder={`VD: School rules`}
                    value={topic.label} onChange={e => updateTopicLabel(ti, e.target.value)} />
                  {form.part3.topics.length > 1 && (
                    <button type="button" onClick={() => removeTopic(ti)}
                      className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap shrink-0">
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
                  <button type="button" onClick={() => addTopicQuestion(ti)} className={btnGhost + ' text-xs'}>
                    + Thêm câu hỏi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Speaking' : 'Tạo đề Speaking'}
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
          title={form.title || 'Speaking'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <SpeakingFormPreview form={form} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Speaking ({exams.filter(e => e.skill === 'speaking').length})</h3>
        <ExamList exams={exams} skill="speaking" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} />
      </div>
    </div>
  )
}

export default SpeakingTab
