import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../utils/axios'
import {
  READING_GROUP_TYPES, READING_GROUP_INSTRUCTIONS,
  emptyReadingForm, emptyReadingGroupOf,
  recalcAllGroupNumbers, getGroupSlots,
  inputCls, labelCls, btnPrimary, btnSecondary,
  toImgSrc,
} from './adminConstants'
import ExamList from './ExamList'
import TrueFalseEditor from '../practice/TrueFalseEditor'
import SummaryCompletionEditor from '../practice/SummaryCompletionEditor'
import NoteCompletionEditor from '../practice/NoteCompletionEditor'
import TableCompletionEditor from '../practice/TableCompletionEditor'
import MCQGroupEditor from '../practice/MCQGroupEditor'
import MatchingEditor from '../practice/MatchingEditor'
import AdminGroupPreview from '../practice/AdminGroupPreview'
import { PreviewTokenLine, buildTokenNumMap } from '../practice/PreviewTokenLine'

// ─── TAB: READING ─────────────────────────────────────────────────────────────

function ReadingGroupEditor({ group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  const typeColors = {
    true_false_ng: 'bg-blue-100 text-blue-800 border-blue-300',
    yes_no_ng: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    note_completion: 'bg-amber-100 text-amber-800 border-amber-300',
    table_completion: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    mcq: 'bg-blue-100 text-blue-800 border-blue-300',
    mcq_multi: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    matching_information: 'bg-[#eff6ff] text-[#1a56db] border-[#bfdbfe]',
    drag_word_bank: 'bg-sky-100 text-sky-800 border-sky-300',
    matching_drag: 'bg-violet-100 text-violet-800 border-violet-300',
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColors[group.type] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500 font-medium">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2}
            className={`${inputCls} resize-none`}
            placeholder="Hướng dẫn làm bài..."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {(group.type === 'true_false_ng' || group.type === 'yes_no_ng') && (
          <TrueFalseEditor group={group} onChange={onChange} />
        )}
        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_information' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1a56db]" />
              <span className="text-xs text-gray-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

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
                background: isActive ? '#1a56db' : '#fff',
                color: isActive ? '#fff' : '#1e293b',
                borderColor: isActive ? '#1a56db' : '#e2e8f0',
              }}
            >
              Section {s.number}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
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
            <p className="text-xs text-gray-500 italic mb-3 border-l-2 border-[#bfdbfe] pl-2">{section.context}</p>
          )}
          {section.questionGroups.length > 0 ? (
            <div className="space-y-3">
              {section.questionGroups.map((group, gi) => (
                <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có câu hỏi</p>
          )}
        </div>
      )}
    </div>
  )
}

function ReadingFormPreview({ form, showAnswers }) {
  const [activePassage, setActivePassage] = useState(0)
  const [leftPct, setLeftPct] = useState(40)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const passage = form.passages[activePassage]
  const sortedGroups = passage
    ? [...(passage.questionGroups || [])].sort((a, b) => a.qNumberStart - b.qNumberStart)
    : []

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(75, Math.max(25, pct)))
    }
    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
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
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${activePassage === pi ? 'bg-[#1a56db] text-white' : 'bg-gray-100 text-gray-600 hover:bg-[#eff6ff] hover:text-[#1a56db]'}`}
            >
              Passage {p.number}
            </button>
          ))}
        </div>
      )}
      {passage && (
        <div
          ref={containerRef}
          className="flex border border-gray-200 rounded-xl overflow-hidden"
          style={{ minHeight: 400, userSelect: dragging ? 'none' : 'auto' }}
        >
          {/* Left: Passage text */}
          <div className="overflow-y-auto bg-white p-5" style={{ width: `${leftPct}%`, maxHeight: 600, flexShrink: 0 }}>
            {passage.title && <h2 className="font-bold text-gray-800 text-sm mb-1">{passage.title}</h2>}
            {passage.subtitle && <p className="text-xs text-gray-500 italic mb-3">{passage.subtitle}</p>}
            {passage.body ? (
              <div className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{passage.body}</div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có nội dung bài đọc</p>
            )}
          </div>

          {/* Divider */}
          <div
            onMouseDown={onDividerMouseDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: dragging ? '#3b82f6' : '#e5e7eb', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#93c5fd' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e5e7eb' }}
          />

          {/* Right: Questions */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-5" style={{ maxHeight: 600 }}>
            {sortedGroups.length > 0 ? (
              <div className="space-y-3">
                {sortedGroups.map((group, gi) => (
                  <AdminGroupPreview key={gi} group={group} showAnswers={showAnswers} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có câu hỏi cho passage này</p>
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
          <div key={i} style={{ height: `${h * 4}px`, width: 3, borderRadius: 2, background: '#bfdbfe' }} />
        ))}
      </div>
      {/* Record button */}
      <button type="button" disabled
        className="w-14 h-14 rounded-full bg-[#1a56db] flex items-center justify-center shadow-lg opacity-60 cursor-default">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
          <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <p className="text-xs text-gray-400 font-medium">Sẵn sàng ghi âm</p>
      {/* Play back */}
      <div className="flex items-center gap-2 w-full mt-1">
        <button type="button" disabled
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center opacity-40 cursor-default">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#1a56db"><polygon points="4,2 14,8 4,14"/></svg>
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
        <span className="text-xs text-gray-300 font-mono">0:00</span>
      </div>
      <p className="text-[10px] text-gray-300 italic text-center mt-1">Giao diện ghi âm — chỉ xem trước, không hoạt động trong preview</p>
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
          {form.part1.description && <p className="text-sm text-gray-600 italic mb-3 border-l-2 border-[#bfdbfe] pl-3">{form.part1.description}</p>}
          <div className="space-y-2">
            {form.part1.questions.filter(q => q.trim()).map((q, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center">{i + 1}</span>
                <p className="text-sm text-gray-700">{q}</p>
              </div>
            ))}
            {form.part1.questions.filter(q => q.trim()).length === 0 && <p className="text-sm text-gray-400 italic">Chưa có câu hỏi</p>}
          </div>
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 2) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part2.instructions && <p className="text-sm text-gray-500 italic mb-3">{form.part2.instructions}</p>}
          {form.part2.cueCard ? (
            <div className="bg-[#eff6ff] border-l-4 border-[#1a56db] rounded-r-xl p-4">
              <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-2">Cue Card</p>
              <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap font-medium">{form.part2.cueCard}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có Cue Card</p>
          )}
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )

    if (activePart === 3) return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {form.part3.description && <p className="text-sm text-gray-500 italic mb-3 border-l-2 border-[#bfdbfe] pl-3">{form.part3.description}</p>}
          <div className="space-y-3">
            {form.part3.topics.map((topic, ti) => (
              <div key={ti} className="bg-white rounded-xl border border-[#e2e8f0] p-3">
                {topic.label && <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-2 pb-1.5 border-b border-[#e2e8f0]">{topic.label}</p>}
                <div className="space-y-1.5">
                  {topic.questions.filter(q => q.trim()).map((q, qi) => (
                    <div key={qi} className="flex gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-[#eff6ff] text-[#1a56db] font-bold text-xs flex items-center justify-center mt-0.5">{qi + 1}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-52 shrink-0"><SpeakingRecordMockup /></div>
      </div>
    )
  }

  return (
    <div>
      {/* Part tabs */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3].map(p => (
          <button key={p} type="button" onClick={() => setActivePart(p)}
            style={{
              background: activePart === p ? '#1a56db' : '#fff',
              color: activePart === p ? '#fff' : '#1e293b',
              borderColor: activePart === p ? '#1a56db' : '#e2e8f0',
            }}
            className="px-4 py-1.5 rounded-lg border text-sm font-medium transition">
            Part {p}
          </button>
        ))}
      </div>
      {/* Active part content */}
      <div className="border border-[#bfdbfe] rounded-2xl overflow-hidden">
        <div className="bg-[#1a56db] text-white px-4 py-2.5 font-semibold text-sm">{PART_META[activePart].title}</div>
        <div className="p-4 bg-[#eff6ff]/40">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

// ─── SHARED HOOKS for exam-series dropdowns ────────────────────────────────────
function useExamSeriesList() {
  const [list, setList] = useState([])
  useEffect(() => {
    api.get('/admin/exam-series').then(r => setList(r.data)).catch(() => {})
  }, [])
  return list
}

function useSeriesBooks(seriesId) {
  const [books, setBooks] = useState([])
  useEffect(() => {
    if (!seriesId) { setBooks([]); return }
    setBooks([])
    api.get(`/admin/exam-series/${seriesId}/books`)
      .then(r => setBooks(r.data))
      .catch(() => setBooks([]))
  }, [seriesId])
  return books
}
// ───────────────────────────────────────────────────────────────────────────────

function ReadingTab({ exams, onRefresh, examSeries = [] }) {
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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const key = `draft_reading_${editingId || 'new'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ key, data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [editingId])

  useEffect(() => {
    if (!form.title && !editingId) return
    const key = `draft_reading_${editingId || 'new'}`
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
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || '',
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: (p.questionGroups || []).map(g => ({
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
    } catch { alert('Lỗi tải đề để sửa') }
    finally { setLoadingEdit(false) }
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyReadingForm()); setOpenPassage(0); setEditHighlight(false) }

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
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        bookNumber: form.bookNumber ? parseInt(form.bookNumber) : null,
        testNumber: form.testNumber ? parseInt(form.testNumber) : null,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        passages: form.passages.map(p => ({
          number: p.number,
          title: p.title,
          subtitle: p.subtitle || null,
          letteredParagraphs: p.letteredParagraphs || false,
          body: p.body,
          questionGroups: p.questionGroups.map((g, gi) => ({
            type: g.type,
            qNumberStart: g.qNumberStart,
            qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '',
            imageUrl: g.imageUrl || null,
            canReuse: g.canReuse || false,
            maxChoices: g.maxChoices || 2,
            noteSections: g.noteSections,
            matchingOptions: g.matchingOptions,
            questions: g.questions
          }))
        }))
      }
      if (editingId) {
        await api.put(`/admin/exams/${editingId}`, payload)
        localStorage.removeItem(`draft_reading_${editingId}`)
        showToast('✅ Cập nhật đề thành công!')
        onRefresh()
      } else {
        await api.post('/admin/exams/reading', payload)
        localStorage.removeItem('draft_reading_new')
        showToast('✅ Tạo đề thành công!')
        setForm(emptyReadingForm())
        setOpenPassage(0)
        onRefresh()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi lưu đề Reading')
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
        <h3 className="font-bold text-gray-800 mb-5">
          {editingId ? `Sửa đề Reading #${editingId}` : 'Tạo đề Reading mới'}
        </h3>

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
            <span className="text-sm font-semibold text-amber-700">Đang sửa đề #{editingId}</span>
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
          <input className={inputCls} required placeholder="VD: Cambridge 19 Test 1 Reading"
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

        {/* Passages accordion — always 3 */}
        <div className="space-y-3 mb-5">
          {form.passages.map((passage, pi) => {
            const totalQs = passage.questionGroups.reduce((a, g) => a + (g.qNumberEnd - g.qNumberStart + 1), 0)
            return (
              <div key={pi} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPassage(openPassage === pi ? -1 : pi)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-sm text-blue-800">Passage {passage.number}</span>
                    <span className="text-xs text-blue-500 mt-0.5">{passage.title || '(chưa đặt tiêu đề)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400">{passage.questionGroups.length} nhóm · {totalQs} câu</span>
                    <span className="text-blue-400 text-xs">{openPassage === pi ? '▲' : '▼'}</span>
                  </div>
                </button>

                {openPassage === pi && (
                  <div className="p-5 space-y-4">
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
                          className="accent-[#1a56db]" />
                        <span className="text-xs text-gray-600 font-medium">Đoạn văn có ký hiệu chữ cái (A, B, C...) — dùng cho Matching Paragraph</span>
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
                        <div className="border border-dashed border-[#1a56db] rounded-xl p-4">
                          <p className="text-xs font-bold text-gray-600 mb-3">Chọn loại nhóm câu hỏi:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {READING_GROUP_TYPES.map(t => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => addGroup(pi, t.value)}
                                className="text-left px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#1a56db] hover:text-[#1a56db] hover:bg-blue-50 transition font-medium"
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setAddingGroupPassage(null)}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingGroupPassage(pi)}
                          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#1a56db] hover:text-[#1a56db] transition font-medium">
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

        <button type="submit" disabled={submitting} className={btnPrimary + ' w-full'}>
          {submitting ? 'Đang lưu...' : editingId ? 'Cập nhật đề Reading' : 'Tạo đề Reading'}
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
          title={form.title || 'Reading'}
          showAnswers={showAnswers}
          setShowAnswers={setShowAnswers}
          onClose={() => setShowPreview(false)}
        >
          <ReadingFormPreview form={form} showAnswers={showAnswers} />
        </InlinePreviewPanel>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">Danh sách đề Reading ({exams.filter(e => e.skill === 'reading').length})</h3>
        <ExamList exams={exams} skill="reading" onDelete={handleDelete} onEdit={loadForEdit} editingId={editingId} examSeries={examSeries} />
      </div>
    </div>
  )
}

export { useExamSeriesList, useSeriesBooks, InlinePreviewPanel, ListeningFormPreview }
export default ReadingTab
