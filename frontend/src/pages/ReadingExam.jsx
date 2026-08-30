import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getReadingExam, getReadingExamWithAnswers, submitReadingExam, getFullTestStatus } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { BookOpen, ArrowLeft } from 'lucide-react'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import PassagePills from '../components/PassagePills'
import TableCompletionRender from '../components/TableCompletionRender'
import GroupBlock from '../components/exam/GroupBlock'
import TypeHeader from '../components/exam/TypeHeaders'
import QuestionBlock from '../components/exam/QuestionBlock'
import { groupByType } from '../components/exam/listening/OtherGroups'
import { fmt } from '../utils/practiceUtils'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'


const DEFAULT_READING_TIME = 60 * 60


export default function ReadingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === 'true'
  const resumeMode = searchParams.get('resume') === 'true'
  const viewResultMode = searchParams.get('viewResult') === 'true'
  const { user } = useAuth()

  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activePassage, setActivePassage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_READING_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(52)
  const bottomBarRef = useRef(null)
  const rightPanelRef = useRef(null)
  const bodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const savedDraftRef = useRef('{}')  // JSON của answers đã ghi vào draft gần nhất
  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('reading-split-ratio')
    const n = parseFloat(saved)
    return (!isNaN(n) && n >= 25 && n <= 75) ? n : 50
  })
  const [isDragging, setIsDragging] = useState(false)

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // MỘT interval sống suốt phiên (deps [phase, previewMode, id]). KHÔNG đưa
  // answers/timeLeft/user vào deps — đổi liên tục → interval bị reset, không bao
  // giờ fire. Đọc state mới nhất qua ref (sync mỗi render). persistDraftNow() còn
  // được useExitGuard gọi ngay tại mọi điểm thoát bài (onBeforeExit).
  const autosaveRef = useRef(null)
  useEffect(() => {
    autosaveRef.current = {
      answers, timeLeft,
      userId: user ? (user.id || user._id) : null,
    }
  })
  const persistDraftNow = useCallback(() => {
    const { answers, timeLeft, userId } = autosaveRef.current
    if (!userId || !id) return
    // P3-2: đừng để answers rỗng ghi đè một draft cũ không rỗng
    // (vd reload KHÔNG kèm ?resume=true → vào 'exam' với answers = {})
    if (Object.keys(answers).length === 0) {
      const existing = loadDraft(userId, id, 'reading')
      if (existing?.data && Object.keys(existing.data).length > 0) return
    }
    saveDraft({ userId, examId: id, skillType: 'reading', data: answers, timeRemaining: timeLeft })
    savedDraftRef.current = JSON.stringify(answers)
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam' || previewMode) return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, previewMode, id, persistDraftNow])

  // Cảnh báo khi thoát bằng Back/Forward/refresh nếu có đáp án chưa ghi vào draft
  const hasUnsavedAnswers = JSON.stringify(answers) !== savedDraftRef.current
  const exitGuard = useExitGuard(phase === 'exam' && !previewMode && hasUnsavedAnswers, persistDraftNow)

  useEffect(() => {
    document.title = 'Bài thi Reading | IELTS Pro'
    // Fetch reading_time setting from admin settings, fallback to 60 min
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.reading_time)
        if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60)
      })
      .catch(() => {})
    const fetchExam = previewMode ? getReadingExamWithAnswers : getReadingExam
    fetchExam(id)
      .then(data => {
        setExam(data)
        // Resume draft if ?resume=true
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'reading')
          if (draft?.data && Object.keys(draft.data).length > 0) {
            setAnswers(draft.data)
            savedDraftRef.current = JSON.stringify(draft.data)
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
          setPhase('exam')
        }
        // Jump straight to result view if ?viewResult=true
        if (viewResultMode) {
          setPhase('viewResult')
        }
      })
      .catch(() => navigate('/full-test', { replace: true }))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (phase === 'result' && result) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [phase, result])

  const handleBack = () => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/practice/reading')
    }
  }

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleDividerMouseDown = (e) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)

    const onMouseMove = (ev) => {
      if (!isDraggingRef.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(75, Math.max(25, ratio))
      setSplitRatio(clamped)
      localStorage.setItem('reading-split-ratio', clamped)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const resetSplit = (e) => {
    e.stopPropagation()
    setSplitRatio(50)
    localStorage.removeItem('reading-split-ratio')
  }

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

  useEffect(() => {
    if (!showConfirm) return
    const handler = (e) => { if (e.key === 'Escape') setShowConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showConfirm])

  useEffect(() => {
    if (!showExitConfirm && !exitGuard.prompt) return
    const handler = (e) => {
      if (e.key === 'Escape') { setShowExitConfirm(false); exitGuard.stay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showExitConfirm, exitGuard.prompt, exitGuard.stay])

  useEffect(() => {
    if (!showQuestionPanel) return
    const handler = (e) => { if (e.key === 'Escape') setShowQuestionPanel(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showQuestionPanel])

  useEffect(() => {
    if (!bottomBarRef.current) return
    const obs = new ResizeObserver(() => setBottomBarHeight(bottomBarRef.current?.offsetHeight || 52))
    obs.observe(bottomBarRef.current)
    return () => obs.disconnect()
  }, [])

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await submitReadingExam(id, answers)
      // disarm() gọi persistDraftNow (onBeforeExit) → clearDraft PHẢI chạy SAU nó
      await exitGuard.disarm()
      if (user) clearDraft(user.id || user._id, id, 'reading')
      navigate(`/reading/${id}/result`, { replace: true })
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Lỗi nộp bài thi. Vui lòng thử lại.')
    } finally { setSubmitting(false) }
  }

  // Get all questions for a passage (from groups or direct)
  const getPassageQuestions = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.flatMap(g => g.questions || [])
    }
    return passage.questions || []
  }

  // Get total question slots for a passage (uses qNumberEnd - qNumberStart + 1 for groups)
  const getPassageTotalSlots = (passage) => {
    if (passage.questionGroups && passage.questionGroups.length > 0) {
      return passage.questionGroups.reduce((sum, g) => sum + (g.qNumberEnd - g.qNumberStart + 1), 0)
    }
    return (passage.questions || []).length
  }

  // Get navigator items: one entry per slot number (expands ranges for mcq_multi etc.)
  const getPassageNavItems = (passage) => {
    if (!passage.questionGroups || passage.questionGroups.length === 0) {
      return (passage.questions || []).map(q => ({ number: q.number, qId: q.id }))
    }
    return passage.questionGroups.flatMap(g => {
      const items = []
      for (let n = g.qNumberStart; n <= g.qNumberEnd; n++) {
        let qId = null
        if (g.type === 'mcq_multi') {
          const maxC = g.maxChoices || 2
          const qi = Math.floor((n - g.qNumberStart) / maxC)
          qId = g.questions?.[qi]?.id ?? null
        } else {
          qId = (g.questions || []).find(q => q.number === n)?.id ?? null
        }
        items.push({ number: n, qId })
      }
      return items
    })
  }

  const jumpToQuestion = (qNumber) => {
    // Find which passage contains this question number
    let passageIdx = -1
    for (let i = 0; i < exam.passages.length; i++) {
      const pQs = getPassageQuestions(exam.passages[i])
      if (pQs.some(q => q.number === qNumber)) { passageIdx = i; break }
    }
    if (passageIdx === -1) return

    const doScroll = () => {
      let el = document.getElementById(`q-${qNumber}`)
      if (!el) {
        // Fallback for token-based groups: scroll to group start
        for (const group of (exam.passages[passageIdx].questionGroups || [])) {
          if (qNumber >= group.qNumberStart && qNumber <= group.qNumberEnd) {
            el = document.getElementById(`q-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (passageIdx !== activePassage) {
      setActivePassage(passageIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>
  if (!exam) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Không tìm thấy đề thi.</div>

  // ── View Result mode: redirect to dedicated result route ──────
  // (handled by navigate in doSubmit; ?viewResult=true redirects here too)
  if (viewResultMode) {
    navigate(`/reading/${id}/result`, { replace: true })
    return null
  }

  const allQ = exam.passages.flatMap(p => getPassageQuestions(p))
  const totalSlots = exam.passages.reduce((sum, p) => sum + getPassageTotalSlots(p), 0)
  const allNavItems = exam.passages.flatMap(p => getPassageNavItems(p))
  const answered = allNavItems.filter(item => item.qId && answers[item.qId]).length
  if (phase === 'start') return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center" style={{ background: 'var(--color-surface)', borderRadius: '24px', boxShadow: 'var(--shadow-md)', padding: 40, maxWidth: 448, width: '100%', textAlign: 'center', border: '1px solid var(--color-border)' }}>
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto mb-5">
          <BookOpen className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-heading)', marginBottom: 8 }}>{exam.title}</h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-body)', fontSize: 14, marginBottom: 4 }}>{exam.passages.length} Passages · <span style={{ fontFamily: 'var(--font-mono)' }}>{totalSlots}</span> câu hỏi</p>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-body)', fontSize: 14, marginBottom: 32 }}>Thời gian: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--skill-r-color)' }}>60 phút</span></p>
        <div style={{ background: 'var(--skill-r-bg)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'left', fontSize: 14, color: 'var(--color-heading)', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Đọc passage bên trái, trả lời câu hỏi bên phải</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Có thể chuyển qua lại giữa các passage</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 15, marginBottom: 8 }}>
          Bắt đầu làm bài
        </button>
        <button
          onClick={handleBack}
          className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 ease-in-out font-medium text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ width: '100%', padding: '12px 0', borderRadius: '12px' }}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại
        </button>
      </div>
    </div>
  )

  // ── Exam ──────────────────────────────────────────────────────
  const passage = exam.passages[activePassage]
  const useGroups = passage.questionGroups && passage.questionGroups.length > 0

  // Compute global question offset for this passage
  const passageOffsets = exam.passages.reduce((acc, p, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + getPassageQuestions(exam.passages[i - 1]).length)
    return acc
  }, [])

  const passageStartIdx = passageOffsets[activePassage]
  const passageQuestions = getPassageQuestions(passage)

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-raised)' }}>
      {/* Header */}
      <header style={{ background: 'var(--ink)', borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button aria-label="Đóng bài thi" onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)} className="bg-white/10 hover:bg-white/20 transition-colors" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>✕</button>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.title}</span>
          {previewMode && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: 'var(--primary)', color: 'var(--ink)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>Chế độ Preview</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {previewMode ? (
            <button
              onClick={() => setShowAnswers(v => !v)}
              className={showAnswers ? 'bg-[var(--skill-l-color)] text-white hover:opacity-90 transition' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition'}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '4px 12px', borderRadius: 99, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          ) : (
            <>
              {lastSavedAt && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                  ✓ Đã lưu {formatSavedAt(lastSavedAt)}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{answered}/{totalSlots} câu</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, padding: '4px 12px', borderRadius: 'var(--radius-sm)', background: timeLeft < 300 ? '#dc2626' : timeLeft < 600 ? '#d97706' : 'rgba(255,255,255,0.15)', color: timeLeft < 600 && timeLeft >= 300 ? '#fff' : 'white' }}>
                {fmt(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div ref={bodyRef} className={`flex-1 flex flex-col md:flex-row overflow-hidden${isDragging ? ' select-none' : ''}`}>
        {/* Left: Passage text */}
        <div
          className="overflow-y-auto bg-white px-8 py-6 border-b md:border-b-0 md:border-r border-gray-200"
          style={{ width: isMobile ? '100%' : `${splitRatio}%` }}
        >
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1 leading-snug">{passage.title}</h2>
          {passage.subtitle && <p className="text-sm text-gray-500 text-center mb-2 italic">{passage.subtitle}</p>}
          <div className="w-16 h-0.5 bg-blue-500 mx-auto mb-6" />
          <div className="text-gray-800 text-[0.92rem] leading-8 font-serif">
            {passage.body
              ? passage.body
                  .split(/\n\s*\n|\n/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((para, i) => {
                    if (passage.letteredParagraphs) {
                      const letter = String.fromCharCode(65 + i)
                      return (
                         <p key={i} className="mb-5">
                          <span className="font-bold text-blue-700 mr-2">{letter}</span>
                          {para.charAt(0).toUpperCase() + para.slice(1)}
                        </p>
                      )
                    }
                    const capitalized = para.charAt(0).toUpperCase() + para.slice(1)
                    return <p key={i} className="mb-5 indent-6">{capitalized}</p>
                  })
              : null
            }
          </div>
        </div>

        {/* Drag divider */}
        <div
          className="group relative flex-shrink-0 hidden md:flex flex-col items-center justify-center w-2 hover:w-3 transition-all duration-100 cursor-col-resize select-none"
          style={{ backgroundColor: isDragging ? '#93c5fd' : undefined }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={`w-full h-full absolute inset-0 transition-colors ${isDragging ? 'bg-blue-300' : 'bg-gray-200 group-hover:bg-blue-200'}`} />
          {/* Handle dots */}
          <div className="relative z-10 flex flex-col gap-1 pointer-events-none">
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
            <div className={`w-0.5 h-4 rounded-full transition-colors ${isDragging ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-500'}`} />
          </div>
          {/* Reset button — appears on hover */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={resetSplit}
            title="Reset 50/50"
            className="absolute top-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-300 rounded text-gray-500 hover:text-blue-600 hover:border-blue-400 text-[10px] px-1 py-0.5 shadow-sm leading-none"
          >
            ⇔
          </button>
        </div>

        {/* Right: Questions */}
        <div
          ref={rightPanelRef}
          className="overflow-y-auto bg-gray-50 px-6 py-5 max-md:w-full"
          style={{ width: isMobile ? '100%' : `${100 - splitRatio}%` }}
        >
          {useGroups ? (
            // New group-based rendering
            (() => {
              let groupOffset = passageStartIdx
              return [...passage.questionGroups].sort((a, b) => a.qNumberStart - b.qNumberStart).map((group, gi) => {
                const el = (
                  <GroupBlock
                    key={group.id || gi}
                    group={group}
                    answers={answers}
                    onAnswer={onAnswer}
                    globalOffset={groupOffset}
                    previewMode={previewMode}
                    showAnswers={showAnswers}
                  />
                )
                groupOffset += (group.questions || []).length
                return el
              })
            })()
          ) : (
            // Backward compat: flat questions grouped by type
            groupByType(passageQuestions).map((group, gi) => {
              const from = passageStartIdx + group.startOffset + 1
              const to = from + group.qs.length - 1
              return (
                <div key={gi}>
                  <TypeHeader type={group.type} from={from} to={to} />
                  {group.qs.map((q, qi) => (
                    <QuestionBlock
                      key={q.id}
                      q={q}
                      globalIdx={passageStartIdx + group.startOffset + qi}
                      answers={answers}
                      onAnswer={onAnswer}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Row 1: question numbers for active passage only (collapsible) */}
          {showNavNumbers && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-center bg-white">
              <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                {getPassageNavItems(passage).map(({ number, qId }) => {
                  const isAnswered = qId && answers[qId];
                  return (
                    <button
                      key={number}
                      onClick={() => jumpToQuestion(number)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center border
                        ${isAnswered
                          ? 'bg-[#002D5B] border-[#002D5B] text-white shadow-sm'
                          : 'bg-white border-gray-300 text-[#002D5B] hover:border-[#0066FF] hover:text-[#0066FF]'}`}
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 2: controls & Passage Pills */}
          <div className="px-6 h-[52px] flex items-center justify-between gap-6">
            {/* Left: icons + Grid toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                title="Bảng câu hỏi"
                aria-label="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showQuestionPanel ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-[#0066FF] hover:text-[#0066FF]'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button
                title={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                aria-label={showNavNumbers ? 'Thu gọn' : 'Mở rộng'}
                onClick={() => setShowNavNumbers(v => !v)}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-[#002D5B] hover:text-[#002D5B] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {showNavNumbers ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
                </svg>
              </button>
            </div>

            {/* Middle: Passage Pills */}
            <PassagePills
              items={exam.passages.map(p => {
                const navItems = getPassageNavItems(p)
                return {
                  label: `Passage ${p.number}`,
                  answered: navItems.filter(s => s.qId && answers[s.qId]).length,
                  total: navItems.length,
                }
              })}
              activeIndex={activePassage}
              onChange={setActivePassage}
            />

            {/* Right: Submit Button */}
            <div className="flex items-center shrink-0">
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question panel — popup bottom-left above bottom bar */}
      {showQuestionPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowQuestionPanel(false)} />
          <div
            className="fixed left-4 z-40 bg-white rounded-lg shadow-lg border border-gray-200 w-72 max-h-80 overflow-y-auto"
            style={{ bottom: bottomBarHeight + 8 }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">Bảng câu hỏi</h3>
              <button
                aria-label="Đóng"
                onClick={() => setShowQuestionPanel(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold transition"
              >✕</button>
            </div>
            <div className="px-4 py-3 space-y-4">
              {exam.passages.map((p, pi) => {
                const navItems = [...getPassageNavItems(p)].sort((a, b) => a.number - b.number)
                const isActive = activePassage === pi
                return (
                  <div key={pi}>
                    <p className={`text-xs font-bold mb-2 ${isActive ? 'text-[#1D4ED8]' : 'text-gray-500'}`}>
                      Passage {p.number}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {navItems.map(({ number, qId }) => (
                        <button
                          key={number}
                          onClick={() => { jumpToQuestion(number); setShowQuestionPanel(false) }}
                          className={`w-8 h-8 rounded text-xs font-bold transition
                            ${qId && answers[qId]
                              ? 'bg-[#1D4ED8] border border-[#1D4ED8] text-white'
                              : isActive
                                ? 'bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569]'
                                : 'bg-white border border-[#e2e8f0] text-[#1e293b]'}`}
                        >
                          {number}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Exit confirm modal — dùng chung cho nút ✕ và guard Back/Forward */}
      <ConfirmExitModal
        isOpen={showExitConfirm || exitGuard.prompt}
        onClose={() => { setShowExitConfirm(false); exitGuard.stay() }}
        onConfirm={async () => {
          setShowExitConfirm(false)
          if (exitGuard.prompt) { exitGuard.leave() }
          else { await exitGuard.disarm(); handleBack() }
        }}
      />

      {/* Confirm submit modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '24px', padding: 32, boxShadow: 'var(--shadow-md)', maxWidth: 360, width: '100%', border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-heading)', marginBottom: 8 }}>Nộp bài?</h2>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-body)', fontSize: 14, marginBottom: 8 }}>Bạn có chắc muốn nộp bài không?</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--color-heading)', marginBottom: 24 }}>
              Đã làm: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{answered}/{totalSlots}</span> câu
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: 14 }}
              >
                Tiếp tục làm
              </button>
              <button
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={submitting}
                className="btn-danger"
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: 14, opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? 'Đang chấm...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
