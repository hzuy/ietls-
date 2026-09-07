import { useState, useEffect, useRef, useCallback } from 'react'
import { queryClient } from '../../lib/queryClient'
import api from '../../utils/axios'
import { showAlert } from '../../utils/alertUtils'
import { notifyTrashChanged } from '../../services/adminService'
import {
  READING_GROUP_TYPES,
  emptyReadingForm, emptyReadingGroupOf,
  recalcAllGroupNumbers, getGroupSlots,
  inputCls, labelCls, btnPrimary, btnSecondary,
  useExamSeriesList, useSeriesBooks,
} from './adminConstants'
import InlinePreviewPanel from '../common/InlinePreviewPanel'
import ExamList from './ExamList'
import AdminGroupPreview from '../practice/AdminGroupPreview'
import ReadingGroupEditor from './editors/ReadingGroupEditor'
import { Eye, ChevronDown } from 'lucide-react'

// ─── TAB: READING ─────────────────────────────────────────────────────────────

function ReadingFormPreview({ form, showAnswers }) {
  const [activePassage, setActivePassage] = useState(0)
  const [leftPct, setLeftPct] = useState(40)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const passage = form.passages[activePassage]
  const sortedGroups = passage
    ? [...(passage.questionGroups || [])].sort((a, b) => a.qNumberStart - b.qNumberStart)
    : []

  const onDividerPointerDown = useCallback((e) => {
    e.preventDefault()
    const container = containerRef.current
    const divider = e.currentTarget
    if (!container) return

    // Capture the pointer on the divider itself so move/up events keep
    // firing even when the cursor is released outside the browser window.
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
    // Fallback: end the drag if the mouse leaves the window entirely.
    window.addEventListener('mouseleave', stop)
  }, [])

  return (
    <div>
      {form.passages.length > 1 && (
        <div className="flex gap-2 mb-4">
          {form.passages.map((p, pi) => (
            <button
              key={pi}
              type="button"
              onClick={() => setActivePassage(pi)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${activePassage === pi ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'}`}
            >
              Passage {p.number}
            </button>
          ))}
        </div>
      )}
      {passage && (
        <div
          ref={containerRef}
          className="flex border border-zinc-200 rounded-xl overflow-hidden"
          style={{ minHeight: 400, userSelect: dragging ? 'none' : 'auto' }}
        >
          {/* Left: Passage text */}
          <div className="overflow-y-auto bg-white p-5" style={{ width: `${leftPct}%`, maxHeight: 600, flexShrink: 0 }}>
            {passage.title && <h2 className="font-bold text-zinc-900 text-sm mb-1">{passage.title}</h2>}
            {passage.subtitle && <p className="text-xs text-zinc-500 italic mb-3">{passage.subtitle}</p>}
            {passage.body ? (
              <div className="text-sm text-zinc-700 leading-7 whitespace-pre-wrap">{passage.body}</div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Chưa có nội dung bài đọc</p>
            )}
          </div>

          {/* Divider */}
          <div
            onPointerDown={onDividerPointerDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, touchAction: 'none', background: dragging ? '#18181b' : '#e4e4e7', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#a1a1aa' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e4e4e7' }}
          />

          {/* Right: Questions */}
          <div className="flex-1 overflow-y-auto bg-zinc-50 p-5" style={{ maxHeight: 600 }}>
            {sortedGroups.length > 0 ? (
              <div className="space-y-3">
                {sortedGroups.map((group, gi) => (
                  <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Chưa có câu hỏi cho passage này</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SpeakingRecordMockup() {
  return (
    <div className="flex flex-col items-center gap-4 bg-white rounded-2xl border border-[#bfdbfe] p-5 h-full min-h-[260px] justify-center">
      {/* Waveform placeholder */}
      <div className="flex items-end gap-0.5 h-10 mb-1">
        {[3,6,4,8,5,9,4,7,3,6,5,8,4,6,3].map((h, i) => (
          <div key={i} style={{ height: `${h * 4}px`, width: 3, borderRadius: 2, background: '#d4d4d8' }} />
        ))}
      </div>
      {/* Record button */}
      <button type="button" disabled
        className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center shadow-lg opacity-60 cursor-default">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
          <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <p className="text-xs text-zinc-400 font-medium">Sẵn sàng ghi âm</p>
      {/* Play back */}
      <div className="flex items-center gap-2 w-full mt-1">
        <button type="button" disabled
          className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center opacity-40 cursor-default">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#18181b"><polygon points="4,2 14,8 4,14"/></svg>
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-zinc-100" />
        <span className="text-xs text-zinc-400 font-mono">0:00</span>
      </div>
      <p className="text-[10px] text-zinc-400 italic text-center mt-1">Giao diện ghi âm — chỉ xem trước, không hoạt động trong preview</p>
    </div>
  )
}

function SpeakingFormPreview({ form }) {
  const [activePart, setActivePart] = useState(1)
  const PART_META = {
    1: { title: 'Part 1 — Introduction & Interview' },
    2: { title: 'Part 2 — Individual Long Turn' },
    3: { title: 'Part 3 — Two-way Discussion' },
  }

  const renderContent = () => {
    if (activePart === 1) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part1.description && <p className="text-sm text-zinc-600 italic mb-3 border-l-2 border-zinc-300 pl-3">{form.part1.description}</p>}
          <div className="space-y-2">
            {form.part1.questions.filter(q => q.trim()).map((q, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center border border-zinc-200">{i + 1}</span>
                <p className="text-sm text-zinc-700">{q}</p>
              </div>
            ))}
            {form.part1.questions.filter(q => q.trim()).length === 0 && <p className="text-sm text-zinc-400 italic">Chưa có câu hỏi</p>}
          </div>
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 2) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part2.instructions && <p className="text-sm text-zinc-500 italic mb-3">{form.part2.instructions}</p>}
          {form.part2.cueCard ? (
            <div className="bg-white border-l-4 border-zinc-900 border border-zinc-200 rounded-r-xl p-4 shadow-xs">
              <p className="text-xs font-bold text-zinc-900 uppercase tracking-wide mb-2">Cue Card</p>
              <p className="text-sm text-zinc-800 leading-7 whitespace-pre-wrap font-medium">{form.part2.cueCard}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">Chưa có Cue Card</p>
          )}
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 3) {
      const realTopics = form.part3.topics.filter(t => t.label.trim() || t.questions.some(q => q.trim()))
      return (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {form.part3.description && <p className="text-sm text-zinc-500 italic mb-3 border-l-2 border-zinc-300 pl-3">{form.part3.description}</p>}
            {realTopics.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">Chưa có chủ đề nào</p>
            ) : (
              <div className="space-y-3">
                {realTopics.map((topic, ti) => (
                  <div key={ti} className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
                    {topic.label && <p className="text-xs font-bold text-zinc-900 uppercase tracking-wide mb-2 pb-1.5 border-b border-zinc-200">{topic.label}</p>}
                    <div className="space-y-1.5">
                      {topic.questions.filter(q => q.trim()).map((q, qi) => (
                        <div key={qi} className="flex gap-2 text-sm text-zinc-700">
                          <span className="w-5 h-5 shrink-0 rounded-full bg-zinc-100 text-zinc-900 font-bold text-xs flex items-center justify-center border border-zinc-200 mt-0.5">{qi + 1}</span>
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
        </div>
      )
    }
  }

  return (
    <div>
      {/* Part tabs */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3].map(p => (
          <button key={p} type="button" onClick={() => setActivePart(p)}
            style={{
              background: activePart === p ? '#18181b' : '#fff',
              color: activePart === p ? '#fff' : '#18181b',
              borderColor: activePart === p ? '#18181b' : '#e4e4e7',
            }}
            className="px-4 py-1.5 rounded-xl border text-sm font-medium transition shadow-2xs">
            Part {p}
          </button>
        ))}
      </div>
      {/* Active part content */}
      <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-zinc-900 text-white px-4 py-2.5 font-semibold text-sm">{PART_META[activePart].title}</div>
        <div className="p-4 bg-zinc-50">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
// ─── TAB: READING ─────────────────────────────────────────────────────────────

const DRAFT_PREFIX = 'draft_reading_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function ReadingTab({ exams, onRefresh, examSeries = [], paginationData, fetchExams, loading, loadError }) {
  const [form, setForm] = useState(emptyReadingForm())
  const liveExamSeries = useExamSeriesList()
  const seriesBooks = useSeriesBooks(form.seriesId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openPassage, setOpenPassage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [addingGroupPassage, setAddingGroupPassage] = useState(null)
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

  // On mount: purge stale draft_reading_* keys (older than 7 days) so
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
    const key = `draft_reading_${editingId || 'new'}`
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
    const key = `draft_reading_${editingId || 'new'}`
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
        passages: exam.passages.map(p => ({
          id: p.id,
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || '',
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: (p.questionGroups || []).map(g => ({
            id: g.id,
            _id: g.id,
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || '',
            canReuse: g.canReuse || false,
            maxChoices: g.maxChoices || 2,
            noteSections: (g.noteSections || []).map(ns => ({
              title: ns.title || '',
              lines: (ns.lines || []).map(l => ({ content: l.contentWithTokens || '', lineType: l.lineType || 'content' }))
            })),
            matchingOptions: (g.matchingOptions || []).map(mo => ({ letter: mo.optionLetter, text: mo.optionText })),
            questions: (g.questions || []).map(q => ({
              id: q.id,
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['', '', '', ''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      })
      setForm(f => ({ ...f, passages: recalcAllGroupNumbers(f.passages) }))
      setEditingId(id)
      setOpenPassage(0)
      setEditHighlight(true)
      setTimeout(() => setEditHighlight(false), 2000)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      const msg = 'Lỗi tải đề để sửa. Vui lòng thử lại.'
      setError(msg)
      showAlert(msg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => {
    if (editingId) localStorage.removeItem(`draft_reading_${editingId}`)
    setEditingId(null); setForm(emptyReadingForm()); setOpenPassage(0); setEditHighlight(false); setDraftBanner(null)
  }

  const updatePassage = (pi, field, val) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], [field]: val }
    setForm({ ...form, passages: p })
  }

  const addGroup = (pi, type) => {
    const p = [...form.passages]
    const newGroup = emptyReadingGroupOf(type, 1) // start placeholder; recalc fixes it
    p[pi] = { ...p[pi], questionGroups: [...p[pi].questionGroups, newGroup] }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
    setAddingGroupPassage(null)
  }

  const updateGroup = (pi, gi, newGroup) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    const prevSlots = getGroupSlots(groups[gi])
    const nextSlots = getGroupSlots(newGroup)
    groups[gi] = newGroup
    p[pi] = { ...p[pi], questionGroups: groups }
    // Only recalc downstream numbers when question count changes
    const recalced = prevSlots !== nextSlots ? recalcAllGroupNumbers(p) : p
    setForm({ ...form, passages: recalced })
  }

  const removeGroup = (pi, gi) => {
    const p = [...form.passages]
    p[pi] = { ...p[pi], questionGroups: p[pi].questionGroups.filter((_, i) => i !== gi) }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const moveGroup = (pi, gi, dir) => {
    const p = [...form.passages]
    const groups = [...p[pi].questionGroups]
    const ni = gi + dir
    if (ni < 0 || ni >= groups.length) return
    ;[groups[gi], groups[ni]] = [groups[ni], groups[gi]]
    p[pi] = { ...p[pi], questionGroups: groups }
    setForm({ ...form, passages: recalcAllGroupNumbers(p) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side guardrails before hitting the API
    const problems = []
    if (!form.title.trim()) problems.push('Chưa nhập tên đề')
    form.passages.forEach(p => {
      if (!p.title?.trim() || !(p.body || '').trim()) {
        problems.push(`Passage ${p.number}: chưa có tiêu đề hoặc nội dung bài đọc`)
      }
      (p.questionGroups || []).forEach(g => {
        if (getGroupSlots(g) === 0) {
          const label = READING_GROUP_TYPES.find(t => t.value === g.type)?.label || g.type
          problems.push(`Passage ${p.number}: nhóm "${label}" chưa có câu hỏi nào`)
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

    const totalQ = form.passages.reduce(
      (a, p) => a + (p.questionGroups || []).reduce((b, g) => b + (g.qNumberEnd - g.qNumberStart + 1), 0), 0
    )
    if (totalQ !== 40 && !window.confirm(`Tổng số câu hiện tại là ${totalQ}, không phải 40. Vẫn lưu?`)) return

    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        passages: form.passages.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || null,
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: p.questionGroups.map(g => ({
            ...(typeof g._id === 'number' ? { id: g._id } : (g.id ? { id: g.id } : {})),
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            canReuse: g.canReuse || false,
            maxChoices: g.maxChoices || 2,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: (g.questions || []).map(q => ({
              ...(q.id ? { id: q.id } : {}),
              number: q.number,
              questionText: q.questionText || '',
              options: q.options || ['', '', '', ''],
              correctAnswer: q.correctAnswer || ''
            }))
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_reading_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        onRefresh()
      } else {
        await api.post('/admin/exams/reading', payload)
        localStorage.removeItem('draft_reading_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyReadingForm())
        setOpenPassage(0)
        queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
        onRefresh()
      }
    } catch (err) {
      const data = err.response?.data
      const errMsg = data?.blockedQuestions?.length
        ? `${data.message}\n${data.blockedQuestions.map(b => `Passage ${b.passageNumber} - Câu ${b.questionNumber}`).join('\n')}`
        : (data?.message || 'Lỗi lưu đề Reading')
      setError(errMsg)
      showAlert(errMsg, 'error')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        <h3 className="text-sm font-semibold text-zinc-900 mb-5">
          {editingId ? `Sửa đề Reading #${editingId}` : 'Tạo đề Reading mới'}
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
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Reading"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-5">
          <p className="text-xs font-bold text-zinc-800 mb-2">Gắn nhãn bộ đề (tuỳ chọn)</p>
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

        {/* Passages accordion — always 3 */}
        <div className="space-y-3 mb-5">
          {form.passages.map((passage, pi) => {
            const totalQs = passage.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)
            return (
              <div key={pi} className="border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setOpenPassage(openPassage === pi ? -1 : pi)}
                  aria-expanded={openPassage === pi}
                  aria-controls={`passage-panel-${pi}`}
                  className="w-full flex items-center justify-between px-5 py-3 bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-sm text-zinc-800">Passage {passage.number}</span>
                    <span className="text-xs text-zinc-500 mt-0.5">{passage.title || '(chưa đặt tiêu đề)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 font-medium">{passage.questionGroups.length} nhóm · {totalQs} câu</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${openPassage === pi ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {openPassage === pi && (
                  <div id={`passage-panel-${pi}`} role="region" aria-label={`Đoạn văn ${pi + 1}`} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Tiêu đề chính</label>
                        <input className={inputCls} placeholder="VD: The Evolution of AI"
                          value={passage.title} onChange={e => updatePassage(pi, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Tiêu đề phụ (tùy chọn)</label>
                        <input className={inputCls} placeholder="VD: A study on machine cognition"
                          value={passage.subtitle} onChange={e => updatePassage(pi, 'subtitle', e.target.value)} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={passage.letteredParagraphs}
                          onChange={e => updatePassage(pi, 'letteredParagraphs', e.target.checked)}
                          className="accent-zinc-900" />
                        <span className="text-xs text-zinc-600 font-medium">Đoạn văn có ký hiệu chữ cái (A, B, C...) — dùng cho Matching Paragraph</span>
                      </label>
                    </div>

                    <div>
                      <label className={labelCls}>Nội dung bài đọc</label>
                      <textarea className={`${inputCls} resize-none`} rows={10}
                        placeholder="Dán toàn bộ nội dung bài đọc vào đây. Dùng dòng trống để phân cách đoạn văn..."
                        value={passage.body} onChange={e => updatePassage(pi, 'body', e.target.value)} />
                    </div>

                    {/* Question Groups */}
                    <div>
                      <label className={labelCls}>Nhóm câu hỏi ({passage.questionGroups.length})</label>
                      <div className="space-y-3 mb-3">
                        {passage.questionGroups.map((group, gi) => (
                          <ReadingGroupEditor
                            key={group._id || gi}
                            group={group}
                            onChange={newGroup => updateGroup(pi, gi, newGroup)}
                            onRemove={() => removeGroup(pi, gi)}
                            onMoveUp={() => moveGroup(pi, gi, -1)}
                            onMoveDown={() => moveGroup(pi, gi, 1)}
                            isFirst={gi === 0}
                            isLast={gi === passage.questionGroups.length - 1}
                          />
                        ))}
                      </div>

                      {addingGroupPassage === pi ? (
                        <div className="border border-dashed border-zinc-400 rounded-lg p-4 bg-zinc-50/50">
                          <p className="text-xs font-bold text-zinc-700 mb-3">Chọn loại nhóm câu hỏi:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {READING_GROUP_TYPES.map(t => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => addGroup(pi, t.value)}
                                className="text-left px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 hover:bg-zinc-100 transition font-medium"
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setAddingGroupPassage(null)}
                            className="mt-2 text-xs text-zinc-400 hover:text-zinc-600">Hủy</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingGroupPassage(pi)}
                          className="w-full border-2 border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-lg py-2 px-3 text-xs font-medium transition">
                          + Thêm nhóm câu hỏi
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button type="submit" disabled={submitting || loadingEdit} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Reading' : 'Tạo đề Reading'}
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
            title={form.title || 'Reading'}
            showAnswers={showAnswers}
            setShowAnswers={setShowAnswers}
            onClose={() => setShowPreview(false)}
          >
            <ReadingFormPreview form={form} showAnswers={showAnswers} />
          </InlinePreviewPanel>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Danh sách đề Reading</h3>
        <ExamList exams={exams} skill="reading" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} paginationData={paginationData} fetchExams={fetchExams} loading={loading} error={loadError} />
      </div>
    </div>
  )
}

export { SpeakingFormPreview }
export default ReadingTab
