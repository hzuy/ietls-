import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getListeningExam, getListeningExamWithAnswers, submitListeningExam, getFullTestStatus } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, formatSavedAt } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { Headphones, ArrowLeft } from 'lucide-react'
import { getSectionSlots } from '../utils/questionCount'
import MatchingTickGrid from '../components/MatchingTickGrid'
import DragWordBankGroup from '../components/DragWordBankGroup'
import MatchingDragGroup from '../components/MatchingDragGroup'
import DiagramLabelGroup from '../components/DiagramLabelGroup'
import MatchingHeadingsGroup from '../components/MatchingHeadingsGroup'
import PassagePills from '../components/PassagePills'
import QuestionNavButton from '../components/common/QuestionNavButton'
import TableCompletionRender from '../components/TableCompletionRender'
import NoteCompletionGroup from '../components/exam/listening/NoteCompletionGroup'
import MCQGroup from '../components/exam/listening/MCQGroup'
import MapDiagramGroup from '../components/exam/listening/MapDiagramGroup'
import { GroupBlock, QuestionBlock, groupByType } from '../components/exam/listening/OtherGroups'
import { fmt } from '../utils/practiceUtils'
import { toImgSrc } from '../utils/practiceConfig'
import ConfirmExitModal from '../components/ConfirmExitModal'
import { useExitGuard } from '../hooks/useExitGuard'


const DEFAULT_LISTENING_TIME = 40 * 60
// ─────────────────────────────────────────────────────────────────────────────

export default function ListeningExam() {
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
  const [activeSection, setActiveSection] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_LISTENING_TIME)
  const [phase, setPhase] = useState('start')
  const [showAnswers, setShowAnswers] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const [showNavNumbers, setShowNavNumbers] = useState(true)
  const [showQuestionPanel, setShowQuestionPanel] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(0)
  const audioRef = useRef(null)
  const bottomBarRef = useRef(null)
  const savedDraftRef = useRef('{}')  // JSON của answers đã ghi vào draft gần nhất
  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header

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
      const existing = loadDraft(userId, id, 'listening')
      if (existing?.data && Object.keys(existing.data).length > 0) return
    }
    saveDraft({ userId, examId: id, skillType: 'listening', data: answers, timeRemaining: timeLeft })
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
    document.title = 'Bài thi Listening | IELTS Pro'
    // Fetch listening_time setting from admin settings, fallback to 40 min
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.listening_time)
        if (!isNaN(mins) && mins > 0) setTimeLeft(mins * 60)
      })
      .catch(() => {})
    const fetchExam = previewMode ? getListeningExamWithAnswers : getListeningExam
    fetchExam(id)
      .then(data => {
        setExam(data)
        if (resumeMode && user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'listening')
          if (draft?.data && Object.keys(draft.data).length > 0) {
            setAnswers(draft.data)
            savedDraftRef.current = JSON.stringify(draft.data)
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
          setPhase('exam')
        }
        if (viewResultMode) setPhase('viewResult')
      })
      .catch(() => navigate('/full-test', { replace: true }))
      .finally(() => setLoading(false))
  }, [id])

  // Skip start screen in preview mode
  useEffect(() => {
    if (previewMode && exam && phase === 'start') setPhase('exam')
  }, [previewMode, exam])

  useEffect(() => {
    if (phase !== 'exam' || result || previewMode) return
    if (timeLeft <= 0) { doSubmit(); return }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft, result, previewMode])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [activeSection])

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
      navigate('/practice/listening')
    }
  }

  useEffect(() => {
    if (!bottomBarRef.current) return
    const ro = new ResizeObserver(entries => {
      setBottomBarHeight(entries[0].contentRect.height)
    })
    ro.observe(bottomBarRef.current)
    return () => ro.disconnect()
  }, [])

  const onAnswer = (qId, val) => setAnswers(a => ({ ...a, [qId]: val }))

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await submitListeningExam(id, answers)
      // disarm() gọi persistDraftNow (onBeforeExit) → clearDraft PHẢI chạy SAU nó
      await exitGuard.disarm()
      if (user) clearDraft(user.id || user._id, id, 'listening')
      navigate(`/listening/${id}/result`, { replace: true })
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Lỗi nộp bài thi. Vui lòng thử lại.')
    } finally { setSubmitting(false) }
  }

  const jumpToQuestion = (slot) => {
    let sectionIdx = activeSection
    for (let i = 0; i < exam.listeningSections.length; i++) {
      const s = exam.listeningSections[i]
      const inSection = (s.questionGroups || []).some(g => slot.number >= g.qNumberStart && slot.number <= g.qNumberEnd)
        || (s.questions || []).some(q => q.number === slot.number)
      if (inSection) { sectionIdx = i; break }
    }
    const doScroll = () => {
      let el = document.getElementById(`question-${slot.number}`)
        || document.getElementById(`q-${slot.number}`)
      if (!el) {
        for (const group of (exam.listeningSections[sectionIdx].questionGroups || [])) {
          if (slot.number >= group.qNumberStart && slot.number <= group.qNumberEnd) {
            el = document.getElementById(`question-${group.qNumberStart}`)
            break
          }
        }
      }
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (sectionIdx !== activeSection) {
      setActiveSection(sectionIdx)
      setTimeout(doScroll, 50)
    } else {
      doScroll()
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Đang tải đề...</div>
  if (!exam) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Không tìm thấy đề thi.</div>

  const allQ = exam.listeningSections.flatMap(s => getSectionSlots(s))
  const answered = allQ.filter(s => s.qId && answers[s.qId]).length

  // ── Start ─────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center" style={{ background: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', padding: 40, maxWidth: 448, width: '100%', textAlign: 'center', border: '1px solid var(--border)' }}>
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto mb-5">
          <Headphones className="w-8 h-8 text-slate-600 stroke-[1.75]" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>{exam.title}</h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 4 }}>{exam.listeningSections.length} Sections · <span style={{ fontFamily: 'var(--font-mono)' }}>{allQ.length}</span> câu hỏi</p>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 32 }}>Thời gian: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--skill-l-color)' }}>40 phút</span></p>
        <div style={{ background: 'var(--skill-l-bg)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'left', fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Nghe audio rồi trả lời câu hỏi bên dưới</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Có thể tua lại audio trong phần làm bài</p>
          <p style={{ fontFamily: 'var(--font-body)', margin: 0 }}>• Bài sẽ tự nộp khi hết giờ</p>
        </div>
        <button onClick={() => setPhase('exam')} className="btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: 'var(--fs-base)', marginBottom: 8 }}>
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

  const section = exam.listeningSections[activeSection]
  let startIdx = 0
  for (let i = 0; i < activeSection; i++) startIdx += getSectionSlots(exam.listeningSections[i]).length

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-raised)' }}>
      {/* Header */}
      <header style={{ background: 'var(--ink)', borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button aria-label="Đóng bài thi" onClick={() => previewMode ? navigate('/admin') : setShowExitConfirm(true)} className="bg-white/10 hover:bg-white/20 transition-colors" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: 'none', color: 'white', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', flexShrink: 0 }}>✕</button>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.title}</span>
          {previewMode && <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-xs)', background: 'var(--primary)', color: 'var(--ink)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>Chế độ Preview</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {previewMode ? (
            <button
              onClick={() => setShowAnswers(v => !v)}
              className={showAnswers ? 'bg-[var(--skill-l-color)] text-white hover:opacity-90 transition' : 'bg-white/10 text-white hover:bg-white/20 transition'}
              style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-xs)', padding: '4px 12px', borderRadius: 99, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          ) : (
            <>
              {lastSavedAt && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                  ✓ Đã lưu {formatSavedAt(lastSavedAt)}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)' }}>{answered}/{allQ.length} câu</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, padding: '4px 12px', borderRadius: 'var(--radius-sm)', background: timeLeft < 300 ? '#dc2626' : timeLeft < 600 ? '#d97706' : 'rgba(255,255,255,0.15)', color: 'white' }}>
                {fmt(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Audio player */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Section {section.number} — {section.context}</p>
          {section.audioUrl ? (
            <audio ref={audioRef} controls className="w-full h-10" src={toImgSrc(section.audioUrl)} />
          ) : (
            <div className="bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-400 text-center">Chưa có file audio cho section này</div>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {/* Questions */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-xs font-bold text-[var(--primary-hover)] uppercase tracking-wider mb-5">
              Section {section.number}
              {section.context && <span className="font-normal text-gray-400 ml-1">— {section.context}</span>}
            </p>

            {/* Legacy: direct questions (groupId = null) */}
            {(section.questions || []).length > 0 && groupByType(section.questions).map((group, gi) => (
              <div key={gi} className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
                  <p className="font-bold text-gray-800">Questions {startIdx + group.startOffset + 1}–{startIdx + group.startOffset + group.qs.length}</p>
                </div>
                {group.qs.map((q, qi) => (
                  <QuestionBlock key={q.id} q={q} globalIdx={startIdx + group.startOffset + qi}
                    answers={answers} onAnswer={onAnswer} previewMode={previewMode} showAnswers={showAnswers} />
                ))}
              </div>
            ))}

            {/* New: group-based questions */}
            {(section.questionGroups || []).map(group => (
              <GroupBlock key={group.id} group={group} answers={answers} onAnswer={onAnswer}
                previewMode={previewMode} showAnswers={showAnswers} />
            ))}

            {getSectionSlots(section).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 italic">Section này chưa có câu hỏi.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigator bar — 2 rows */}
      {!previewMode && (
        <div ref={bottomBarRef} className="bg-white border-t border-gray-200 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {/* Row 1: question numbers for active section only (collapsible) */}
          {showNavNumbers && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-center bg-white">
              <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                {getSectionSlots(section).map(slot => (
                  <QuestionNavButton
                    key={slot.number}
                    number={slot.number}
                    status={slot.qId && answers[slot.qId] ? 'answered' : 'unanswered'}
                    onClick={() => jumpToQuestion(slot)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 2: controls */}
          <div className="px-6 h-[52px] flex items-center justify-between gap-6">
            {/* Left: icons */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                title="Bảng câu hỏi"
                aria-label="Bảng câu hỏi"
                onClick={() => setShowQuestionPanel(v => !v)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showQuestionPanel ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
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
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-[var(--ink)] hover:text-[var(--ink)] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {showNavNumbers ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
                </svg>
              </button>
            </div>

            {/* Middle: Section Pills */}
            <PassagePills
              items={exam.listeningSections.map(s => {
                const slots = getSectionSlots(s)
                return {
                  label: `Section ${s.number}`,
                  answered: slots.filter(sl => sl.qId && answers[sl.qId]).length,
                  total: slots.length,
                }
              })}
              activeIndex={activeSection}
              onChange={setActiveSection}
            />

            {/* Right: submit */}
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

      {/* Question panel popup */}
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
              {exam.listeningSections.map((s, si) => {
                const slots = [...getSectionSlots(s)].sort((a, b) => a.number - b.number)
                const isActive = activeSection === si
                return (
                  <div key={si}>
                    <p className={`text-xs font-bold mb-2 ${isActive ? 'text-[var(--primary-hover)]' : 'text-gray-500'}`}>
                      Section {s.number}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map(slot => (
                        <QuestionNavButton
                          key={slot.number}
                          number={slot.number}
                          status={slot.qId && answers[slot.qId] ? 'answered' : 'unanswered'}
                          onClick={() => { jumpToQuestion(slot); setShowQuestionPanel(false) }}
                        />
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
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: 32, boxShadow: 'var(--shadow-md)', maxWidth: 360, width: '100%', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>Nộp bài?</h2>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 'var(--fs-sm)', marginBottom: 8 }}>Bạn có chắc muốn nộp bài không?</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 24 }}>
              Đã làm: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{answered}/{allQ.length}</span> câu
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: 'var(--fs-sm)' }}
              >
                Tiếp tục làm
              </button>
              <button
                onClick={() => { setShowConfirm(false); doSubmit() }}
                disabled={submitting}
                className="btn-danger"
                style={{ flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: 'var(--fs-sm)', opacity: submitting ? 0.5 : 1 }}
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
