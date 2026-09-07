import { useState, useRef, useEffect } from 'react'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { notifyTrashChanged } from '../../services/adminService'
import {
  GROUP_TYPES, GROUP_INSTRUCTIONS, SECTION_HINTS,
  emptyListeningForm, emptyGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
  SERVER_BASE, toImgSrc,
  useExamSeriesList, useSeriesBooks,
  getQuestionTypeTheme,
  recalcAllListeningNumbers, getGroupSlots,
} from './adminConstants'
import ExamList from './ExamList'
import DiagramLabelEditor from '../practice/DiagramLabelEditor'
import SummaryCompletionEditor from '../practice/SummaryCompletionEditor'
import InlinePreviewPanel from '../common/InlinePreviewPanel'
import TableCompletionEditor from './editors/TableCompletionEditor'
import NoteCompletionEditor from './editors/NoteCompletionEditor'
import MCQGroupEditor from './editors/MCQGroupEditor'
import MatchingEditor from './editors/MatchingEditor'
import AdminGroupPreview from '../practice/AdminGroupPreview'
import { Volume2, Upload, Sparkles, Eye, ChevronDown } from 'lucide-react'

// ─── PREVIEW: LISTENING FORM ──────────────────────────────────────────────────

function ListeningFormPreview({ form, showAnswers }) {
  const [activeSection, setActiveSection] = useState(0)
  const section = form.sections[activeSection]

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {form.sections.map((s, si) => {
          const total = s.questionGroups.reduce((acc, g) => acc + (g.qNumberEnd - g.qNumberStart + 1), 0)
          const isActive = activeSection === si
          return (
            <button
              key={si}
              type="button"
              onClick={() => setActiveSection(si)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
              style={{
                background: isActive ? '#18181b' : '#fff',
                color: isActive ? '#fff' : '#18181b',
                borderColor: isActive ? '#18181b' : '#e4e4e7',
              }}
            >
              Section {s.number}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                {total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active section content */}
      {section && (
        <div>
          {section.context && (
            <p className="text-xs text-zinc-500 italic mb-3 border-l-2 border-zinc-300 pl-2">{section.context}</p>
          )}
          {section.questionGroups.length > 0 ? (
            <div className="space-y-3">
              {section.questionGroups.map((group, gi) => (
                <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">Chưa có câu hỏi</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: LISTENING ───────────────────────────────────────────────────────────


// ─── GROUP EDITOR ─────────────────────────────────────────────────────────────

function GroupEditor({ group = {}, onChange, onRemove }) {
  const groupType = group?.type || 'fill_blank'
  const typeLabel = GROUP_TYPES.find(t => t.value === groupType)?.label || groupType
  const theme = getQuestionTypeTheme(groupType)

  return (
    <div className={`border ${theme.cardBorder} ${theme.cardBg} rounded-2xl overflow-hidden transition-all duration-200 mb-4 shadow-xs`}>
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.headerBg}`}>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${theme.badge}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-zinc-500 font-semibold">
          Câu {group.qNumberStart}–{group.qNumberEnd}
        </span>
        <span className="text-[10px] text-zinc-400">tự động đánh số</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onRemove}
            className="text-red-500 hover:text-red-600 text-xs font-semibold px-2 py-0.5 rounded hover:bg-red-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="VD: Choose the correct letter, A, B or C."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <div className="space-y-3">
            {group.type === 'matching' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={group.canReuse || false}
                  onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                  className="accent-zinc-900" />
                <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại chữ cái (mỗi lựa chọn có thể khớp nhiều câu)</span>
              </label>
            )}
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-zinc-900" />
              <span className="text-xs text-zinc-600 font-medium">Cho phép dùng lại chữ cái (mỗi lựa chọn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'diagram_label' && (
          <DiagramLabelEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

const DRAFT_PREFIX = 'draft_listening_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function ListeningTab({ exams, onRefresh, examSeries = [], paginationData, fetchExams, loading, loadError }) {
  const [form, setForm] = useState(emptyListeningForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState(0)
  const [uploading, setUploading] = useState({})
  const [transcribing, setTranscribing] = useState({})
  const [addingGroupSection, setAddingGroupSection] = useState(null)
  const fileRefs = useRef({})
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [toast, setToast] = useState('')
  const [draftBanner, setDraftBanner] = useState(null)
  const [editHighlight, setEditHighlight] = useState(false)
  const formRef = useRef(null)
  const previewRef = useRef(null)

  const showToast = (msg) => { showAlert(msg); setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Scroll the preview panel into view once it has rendered (not when hidden).
  useEffect(() => {
    if (showPreview) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showPreview])

  // On mount: purge stale draft_listening_* keys (older than 7 days) so
  // abandoned drafts don't accumulate in localStorage forever.
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(DRAFT_PREFIX)) continue
        try {
          const parsed = JSON.parse(localStorage.getItem(k))
          const savedAt = parsed && parsed._savedAt
          // Drop drafts we can date to older than the max age. Drafts with no
          // timestamp (created before this field existed) are left alone —
          // they pick one up on the next autosave.
          if (savedAt && Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
            localStorage.removeItem(k)
          }
        } catch { localStorage.removeItem(k) }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  useEffect(() => {
    const key = `draft_listening_${editingId || 'new'}`
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
    const key = `draft_listening_${editingId || 'new'}`
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
      setForm({
        title: exam.title,
        bookNumber: exam.bookNumber?.toString() || '',
        testNumber: exam.testNumber?.toString() || '',
        seriesId: exam.seriesId?.toString() || '',
        sections: recalcAllListeningNumbers(exam.listeningSections.map(s => ({
          id: s.id,
          number: s.number,
          context: s.context || '',
          audioUrl: s.audioUrl || '',
          transcript: s.transcript || '',
          questionGroups: (s.questionGroups || []).map(g => ({
            id: g.id,
            _id: g.id,
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || '',
            noteSections: (g.noteSections || []).map(ns => ({
              title: ns.title || '',
              lines: (ns.lines || []).map(l => ({ content: l.contentWithTokens || '', lineType: l.lineType || 'content' }))
            })),
            matchingOptions: (g.matchingOptions || []).map(mo => ({ letter: mo.optionLetter, text: mo.optionText })),
            questions: (g.questions || []).map(q => ({
              id: q.id,
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['','','',''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        })))
      })
      setEditingId(id)
      setOpenSection(0)
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
    if (editingId) localStorage.removeItem(`draft_listening_${editingId}`)
    setEditingId(null); setForm(emptyListeningForm()); setOpenSection(0); setEditHighlight(false); setDraftBanner(null)
  }

  // All form mutations use the functional setForm(prev => …) form so that async
  // callbacks (audio upload / AI transcription, which resolve seconds later)
  // merge into the LATEST form state instead of overwriting edits made while
  // the request was in flight.
  const updateSection = (si, field, val) => {
    setForm(prev => {
      const s = [...prev.sections]
      s[si] = { ...s[si], [field]: val }
      return { ...prev, sections: s }
    })
  }

  const uploadAudio = async (si, file) => {
    setUploading(u => ({ ...u, [si]: true }))
    try {
      const formData = new FormData()
      formData.append('audio', file)
      const res = await api.post('/admin/upload-audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      updateSection(si, 'audioUrl', res.data.audioUrl)
    } catch { showToast('Lỗi upload audio — kiểm tra định dạng (mp3/wav/ogg/m4a/aac) và dung lượng (≤ 100MB)') }
    finally { setUploading(u => ({ ...u, [si]: false })) }
  }

  const transcribeAudio = async (si) => {
    const audioUrl = form.sections[si]?.audioUrl
    if (!audioUrl) return
    setTranscribing(t => ({ ...t, [si]: true }))
    try {
      const res = await api.post('/admin/transcribe', { audioUrl })
      updateSection(si, 'transcript', res.data.transcript || '')
    } catch { showToast('Lỗi phiên âm audio — thử lại sau') }
    finally { setTranscribing(t => ({ ...t, [si]: false })) }
  }

  // Question numbers run continuously 1..40 across all four sections and are
  // recomputed by recalcAllListeningNumbers after every structural change
  // (same mechanism ReadingTab uses across its passages). Admins never type
  // numbers by hand.
  const addGroup = (si, type) => {
    setForm(prev => {
      const s = [...prev.sections]
      const newGroup = emptyGroupOf(type, 1) // start is a placeholder; recalc fixes it
      s[si] = { ...s[si], questionGroups: [...s[si].questionGroups, newGroup] }
      return { ...prev, sections: recalcAllListeningNumbers(s) }
    })
    setAddingGroupSection(null)
  }

  const updateGroup = (si, gi, newGroup) => {
    setForm(prev => {
      const s = [...prev.sections]
      const groups = [...s[si].questionGroups]
      const prevSlots = getGroupSlots(groups[gi])
      const nextSlots = getGroupSlots(newGroup)
      groups[gi] = newGroup
      s[si] = { ...s[si], questionGroups: groups }
      // Only recalc downstream numbers when the question count changed
      return { ...prev, sections: prevSlots !== nextSlots ? recalcAllListeningNumbers(s) : s }
    })
  }

  const removeGroup = (si, gi) => {
    setForm(prev => {
      const s = [...prev.sections]
      s[si] = { ...s[si], questionGroups: s[si].questionGroups.filter((_, i) => i !== gi) }
      return { ...prev, sections: recalcAllListeningNumbers(s) }
    })
  }

  const moveGroup = (si, gi, dir) => {
    setForm(prev => {
      const s = [...prev.sections]
      const groups = [...s[si].questionGroups]
      const ni = gi + dir
      if (ni < 0 || ni >= groups.length) return prev
      ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
      s[si] = { ...s[si], questionGroups: groups }
      return { ...prev, sections: recalcAllListeningNumbers(s) }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side guardrails before hitting the API
    const problems = []
    if (!form.title.trim()) problems.push('Chưa nhập tên đề')
    form.sections.forEach(s => {
      if (s.questionGroups.length > 0 && !(s.audioUrl || '').trim()) {
        problems.push(`Section ${s.number}: có nhóm câu hỏi nhưng chưa có file audio`)
      }
      s.questionGroups.forEach(g => {
        if (getGroupSlots(g) === 0) {
          const label = GROUP_TYPES.find(t => t.value === g.type)?.label || g.type
          problems.push(`Section ${s.number}: nhóm "${label}" chưa có câu hỏi nào`)
        }
      })
    })
    if (problems.length) {
      const msg = 'Không thể lưu đề:\n• ' + problems.join('\n• ')
      setError(msg)
      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const totalQ = form.sections.reduce(
      (a, s) => a + s.questionGroups.reduce((b, g) => b + (g.qNumberEnd - g.qNumberStart + 1), 0), 0
    )
    if (totalQ !== 40 && !window.confirm(`Tổng số câu hiện tại là ${totalQ}, không phải 40. Vẫn lưu?`)) return

    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        level: 'intermediate',
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        sections: form.sections.map(s => ({
          ...(s.id ? { id: s.id } : {}),
          number: s.number,
          context: s.context,
          audioUrl: s.audioUrl || null,
          transcript: s.transcript || null,
          questionGroups: s.questionGroups.map(g => ({
            ...(typeof g._id === 'number' ? { id: g._id } : (g.id ? { id: g.id } : {})),
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: (g.questions || []).map(q => ({
              ...(q.id ? { id: q.id } : {}),
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['','','',''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_listening_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/listening', payload)
        localStorage.removeItem('draft_listening_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyListeningForm())
        setOpenSection(0)
        onRefresh()
      }
    } catch (err) {
      const data = err.response?.data
      const errMsg = data?.blockedQuestions?.length
        ? `${data.message}\n${data.blockedQuestions.map(b => `Section ${b.sectionNumber} - Câu ${b.questionNumber}`).join('\n')}`
        : (data?.message || 'Lỗi lưu đề Listening')
      setError(errMsg)
      showAlert(errMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    // Xác nhận đã do modal của ExamList đảm nhiệm trước khi gọi onDelete
    try {
      await api.delete(`/admin/exams/${id}`)
      notifyTrashChanged()
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
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">
          {editingId ? `Sửa đề Listening #${editingId}` : 'Tạo đề Listening mới'}
        </h3>

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
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Listening"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-5">
          <p className="text-xs font-medium text-zinc-700 mb-2">Gắn nhãn bộ đề (tuỳ chọn)</p>
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

        <div className="space-y-3 mb-5">
          {form.sections.map((section, si) => (
            <div key={si} className="border border-zinc-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === si ? -1 : si)}
                aria-expanded={openSection === si}
                aria-controls={`ls-section-panel-${si}`}
                className="w-full flex items-center justify-between px-5 py-3 bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium text-sm text-zinc-800">Section {section.number}</span>
                  <span className="text-xs text-zinc-500 mt-0.5">{SECTION_HINTS[section.number] || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-medium">{section.questionGroups.length} nhóm · {section.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)} câu</span>
                  {section.audioUrl && (
                    <span className="text-[11px] bg-zinc-100 text-zinc-800 border border-zinc-200 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-zinc-600" />
                      <span>Audio</span>
                    </span>
                  )}
                  {section.transcript && (
                    <span className="text-[11px] bg-zinc-100 text-zinc-800 border border-zinc-200 font-medium px-2 py-0.5 rounded-full">
                      Transcript
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${openSection === si ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {openSection === si && (
                <div id={`ls-section-panel-${si}`} role="region" aria-label={`Section ${section.number}`} className="p-5 space-y-4">
                  <div>
                    <label className={labelCls}>File MP3 — Section {section.number}</label>
                    <div className="flex gap-2">
                      <input className={inputCls} placeholder="URL audio sau khi upload"
                        value={section.audioUrl} onChange={e => updateSection(si, 'audioUrl', e.target.value)} />
                      <button type="button" onClick={() => fileRefs.current[si]?.click()} disabled={uploading[si]}
                        className={`${btnSecondary} whitespace-nowrap flex items-center gap-1.5`}>
                        {uploading[si] ? 'Đang upload...' : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload MP3</span>
                          </>
                        )}
                      </button>
                      <input type="file" accept=".mp3,.wav,.ogg,.m4a,.aac" className="hidden"
                        ref={el => fileRefs.current[si] = el}
                        onChange={e => e.target.files[0] && uploadAudio(si, e.target.files[0])} />
                    </div>
                    {section.audioUrl && (
                      <audio
                        controls
                        src={toImgSrc(section.audioUrl)}
                        className="w-full mt-2 rounded-lg"
                        style={{ height: '40px' }}
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Mô tả tình huống (Context)</label>
                    <textarea className={`${inputCls} h-16 resize-none`}
                      placeholder={section.number <= 2 ? 'VD: Two friends are discussing their weekend plans...' : 'VD: A professor is giving a lecture about climate change...'}
                      value={section.context} onChange={e => updateSection(si, 'context', e.target.value)} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>Transcript</label>
                      <button type="button" onClick={() => transcribeAudio(si)}
                        disabled={!section.audioUrl || transcribing[si]}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                          section.audioUrl && !transcribing[si]
                            ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 cursor-pointer'
                            : 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                        }`}>
                        {transcribing[si] ? (
                          <>
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                            </svg>
                            Đang phiên âm...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                            AI Phiên âm
                          </>
                        )}
                      </button>
                    </div>
                    <textarea className={`${inputCls} h-28 resize-none`}
                      placeholder={section.audioUrl ? 'Nhấn "AI Phiên âm" hoặc nhập thủ công...' : 'Upload audio để dùng AI phiên âm...'}
                      value={section.transcript} onChange={e => updateSection(si, 'transcript', e.target.value)} />
                  </div>

                  <div>
                    <label className={labelCls}>Nhóm câu hỏi ({section.questionGroups.length})</label>
                    <div className="space-y-3 mb-3">
                      {section.questionGroups.map((group, gi) => (
                        <div key={group._id || gi} className="flex gap-2 items-start">
                          <div className="flex flex-col gap-1 pt-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, -1)}
                              disabled={gi === 0}
                              className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển lên">▲</button>
                            <button
                              type="button"
                              onClick={() => moveGroup(si, gi, 1)}
                              disabled={gi === section.questionGroups.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-25 text-xs transition"
                              title="Di chuyển xuống">▼</button>
                          </div>
                          <div className="flex-1">
                            <GroupEditor
                              group={group}
                              onChange={newGroup => updateGroup(si, gi, newGroup)}
                              onRemove={() => removeGroup(si, gi)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {addingGroupSection === si ? (
                      <div className="border border-dashed border-zinc-400 rounded-lg p-4 bg-zinc-50/50">
                        <p className="text-xs font-bold text-zinc-700 mb-3">Chọn loại nhóm câu hỏi:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {GROUP_TYPES.map(t => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => addGroup(si, t.value)}
                              className="text-left px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 hover:bg-zinc-100 transition font-medium"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setAddingGroupSection(null)}
                          className="mt-2 text-xs text-zinc-400 hover:text-zinc-600">Hủy</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingGroupSection(si)}
                        className="w-full border-2 border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-lg py-2 px-3 text-xs font-medium transition">
                        + Thêm nhóm câu hỏi
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting || loadingEdit} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Listening' : 'Tạo đề Listening'}
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
            title={form.title || 'Listening'}
            showAnswers={showAnswers}
            setShowAnswers={setShowAnswers}
            onClose={() => setShowPreview(false)}
          >
            <ListeningFormPreview form={form} showAnswers={showAnswers} />
          </InlinePreviewPanel>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Danh sách đề Listening ({paginationData?.total ?? exams.length})</h3>
        <ExamList exams={exams} skill="listening" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} paginationData={paginationData} fetchExams={fetchExams} loading={loading} error={loadError} />
      </div>
    </div>
  )
}

export default ListeningTab
