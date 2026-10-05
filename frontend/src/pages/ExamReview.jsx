import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SkillResult from '../components/SkillResult'
import { X, LayoutGrid, ChevronLeft, ChevronRight, BookOpen, Check, Minus } from 'lucide-react'
import api from '../utils/axios'
import { queryClient } from '../lib/queryClient'
import { getReadingExam } from '../services/examService'
import { getMyHistory } from '../services/historyService'
import GroupBlock from '../components/exam/GroupBlock'
import QuestionBlock from '../components/exam/QuestionBlock'
import TypeHeader from '../components/exam/TypeHeaders'
import ReviewExplanation from '../components/exam/ReviewExplanation'
import QuestionNavButton from '../components/common/QuestionNavButton'
import QuestionPanelPopover from '../components/common/QuestionPanelPopover'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import ExamActionDialog from '../components/common/ExamActionDialog'
import { getPassageSlots } from '../utils/questionCount'
import { findRange, splitParagraphs } from '../utils/textMatch'
import { examExitPath } from '../utils/submittedExam'

const noop = () => {}

const WHOLE_GROUP_TYPES = new Set(['note_completion', 'matching_information', 'drag_word_bank', 'table_completion', 'matching_drag', 'diagram_label', 'matching_headings', 'mcq_multi'])
const FS = { fontSize: 14 }

function buildReviewMap(sections) {
  const map = {}
  for (const sec of sections || []) {
    for (const q of sec.questions || []) {
      if (q.grouped) {
        ;(q.numbers || []).forEach((n, i) => {
          map[n] = {
            status: q.statuses?.[i] || 'missed',
            userAnswer: q.userAnswers?.[i] || '',
            correctAnswer: q.answers?.[i] || '',
            explanation: q.explanation || null,
          }
        })
      } else {
        map[q.number] = {
          status: q.status || 'missed',
          userAnswer: q.userAnswer || '',
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || null,
        }
      }
    }
  }
  return map
}

function buildAnswersById(exam, reviewMap) {
  const out = {}
  for (const p of exam?.passages || []) {
    for (const q of p.questions || []) out[q.id] = reviewMap[q.number]?.userAnswer || ''
    for (const g of p.questionGroups || []) {
      for (const q of g.questions || []) {
        if (g.type === 'mcq_multi') {
          const size = g.maxChoices || 2
          const picks = Array.from({ length: size }, (_, i) => reviewMap[q.number + i]?.userAnswer).filter(Boolean)
          out[q.id] = picks.join(',')
        } else {
          out[q.id] = reviewMap[q.number]?.userAnswer || ''
        }
      }
    }
  }
  return out
}

function locateTargets(explanation) {
  if (explanation?.v !== 2) return null
  const byPara = {}
  const add = (para, text, kind) => {
    if (para == null || !text) return
    ;(byPara[para] ||= []).push({ text, kind })
  }
  for (const part of explanation.evidence?.parts || []) add(part.paragraph, part.text, 'evidence')
  const keywordPara = explanation.locate?.paragraph
  for (const k of explanation.locate?.keywords || []) {
    if (keywordPara != null) add(keywordPara, k, 'keyword')
    for (const part of explanation.evidence?.parts || []) add(part.paragraph, k, 'keyword')
  }
  return Object.keys(byPara).length ? byPara : null
}

function MarkedParagraph({ text, marks }) {
  const ranges = []
  for (const m of marks || []) {
    const r = findRange(text, m.text)
    if (r) ranges.push({ ...r, kind: m.kind })
  }
  if (!ranges.length) return text
  const cuts = [...new Set([0, text.length, ...ranges.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b)
  const nodes = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]
    const b = cuts[i + 1]
    const covering = ranges.filter(r => r.start <= a && r.end >= b)
    const piece = text.slice(a, b)
    if (!covering.length) {
      nodes.push(piece)
      continue
    }
    const evidence = covering.some(r => r.kind === 'evidence')
    const keyword = covering.some(r => r.kind === 'keyword')
    nodes.push(
      <mark
        key={a}
        className={`text-inherit ${evidence ? 'bg-amber-100' : 'bg-transparent'} ${keyword ? 'underline decoration-indigo-500 decoration-2 underline-offset-4 font-medium' : ''}`}
      >
        {piece}
      </mark>
    )
  }
  return nodes
}

function PassageView({ passage, targets }) {
  const paragraphs = useMemo(() => splitParagraphs(passage?.body), [passage])
  const dimOthers = !!targets
  return (
    <div className="text-zinc-800 text-[15px] leading-relaxed">
      <h2 className="text-lg font-semibold text-zinc-900 mb-1 leading-snug">{passage?.title}</h2>
      {passage?.subtitle && <p className="text-sm text-zinc-500 mb-4 italic">{passage.subtitle}</p>}
      {paragraphs.map((para, i) => {
        const text = para.charAt(0).toUpperCase() + para.slice(1)
        const marks = targets?.[i]
        return (
          <p
            key={i}
            data-para={i}
            data-target={marks ? 'true' : undefined}
            className={`mb-4 transition-opacity duration-200 ${dimOthers && !marks ? 'opacity-35' : ''}`}
          >
            {passage?.letteredParagraphs && <span className="font-bold text-zinc-900 mr-2">{String.fromCharCode(65 + i)}</span>}
            {marks ? <MarkedParagraph text={text} marks={marks} /> : text}
          </p>
        )
      })}
    </div>
  )
}

function ScoreBadge({ value }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-full border-[3px] border-zinc-200 flex items-center justify-center">
      <span className="text-xs font-bold font-mono tabular-nums text-zinc-900">{value}</span>
    </div>
  )
}

function AnswerSummary({ number, info }) {
  if (!info) return null
  const missed = !info.userAnswer
  const correct = info.status === 'correct'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
          correct ? 'bg-emerald-50 text-emerald-700' : missed ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
        }`}
      >
        {correct ? <Check className="w-3 h-3" /> : missed ? <Minus className="w-3 h-3" /> : <X className="w-3 h-3" />}
        Câu {number} · {correct ? 'Đúng' : missed ? 'Bỏ trống' : 'Sai'}
      </span>
      {!correct && (
        <span className="text-zinc-500">
          Bạn trả lời:{' '}
          <span className={missed ? 'text-amber-600' : 'text-red-600 line-through'}>{missed ? '—' : info.userAnswer}</span>
        </span>
      )}
      <span className="text-zinc-500">
        Đáp án: <span className="font-semibold text-emerald-700">{info.correctAnswer}</span>
      </span>
    </div>
  )
}

function LocateSwitch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={FS}
      className="inline-flex items-center gap-2 h-9 pointer-coarse:h-11 px-3 rounded-full border border-zinc-200 bg-white font-medium text-zinc-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:border-zinc-300"
    >
      Định vị đáp án
      <span className={`relative w-8 h-[18px] rounded-full transition-colors ${checked ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export default function ExamReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const attemptId = searchParams.get('attemptId')

  const [exam, setExam] = useState(null)
  const [result, setResult] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeNumber, setActiveNumber] = useState(null)
  const [locate, setLocate] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [showAnswerSheet, setShowAnswerSheet] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [footerHeight, setFooterHeight] = useState(64)

  const rightPaneRef = useRef(null)
  const passagePaneRef = useRef(null)
  const sheetBodyRef = useRef(null)
  const footerRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = e => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      queryClient.fetchQuery({ queryKey: ['exam', 'reading', id, { previewMode: false }], queryFn: () => getReadingExam(id), staleTime: 1000 * 60 * 5 }),
      api.get(`/reading/exams/${id}/result-detail`, { params: attemptId ? { attemptId } : {} }).then(r => r.data),
    ])
      .then(([examData, resultData]) => {
        setExam(examData)
        setResult(resultData)
        const first = getPassageSlots(examData.passages?.[0])[0]?.number ?? null
        setActiveNumber(n => n ?? first)
      })
      .catch(err => setError(err?.response?.data?.message || 'Không tải được bài chữa.'))
      .finally(() => setLoading(false))
  }, [id, attemptId])

  useEffect(() => {
    document.title = 'Chữa bài Reading | IELTS Pro'
    load()
  }, [load])

  useEffect(() => {
    getMyHistory({ examId: id, limit: 50 })
      .then(d => setAttempts(d.history || []))
      .catch(() => setAttempts([]))
  }, [id])

  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setFooterHeight(el.offsetHeight))
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading, exam, result])

  useEffect(() => {
    const offset = footerHeight + (isMobile ? 56 : 0)
    document.documentElement.style.setProperty('--chat-fab-offset', `${offset}px`)
    return () => document.documentElement.style.removeProperty('--chat-fab-offset')
  }, [footerHeight, isMobile])

  const reviewMap = useMemo(() => buildReviewMap(result?.sections), [result])
  const answersById = useMemo(() => buildAnswersById(exam, reviewMap), [exam, reviewMap])
  const passageNumbers = useMemo(
    () => (exam?.passages || []).map(p => getPassageSlots(p).map(s => s.number)),
    [exam]
  )
  const allNumbers = useMemo(() => passageNumbers.flat(), [passageNumbers])
  const activePassage = Math.max(0, passageNumbers.findIndex(list => list.includes(activeNumber)))
  const passage = exam?.passages?.[activePassage]
  const activeInfo = reviewMap[activeNumber]
  const explanation = activeInfo?.explanation || null
  const targets = locate ? locateTargets(explanation) : null
  const canLocate = explanation?.v === 2 && !!locateTargets(explanation)

  const activeGroup = useMemo(
    () => (passage?.questionGroups || []).find(g => activeNumber >= g.qNumberStart && activeNumber <= g.qNumberEnd) || null,
    [passage, activeNumber]
  )
  const activeGroupQuestion = activeGroup ? (activeGroup.questions || []).find(q => q.number === activeNumber) || null : null
  const activeFlatQuestion = !activeGroup ? (passage?.questions || []).find(q => q.number === activeNumber) : null

  const correctCount = useMemo(() => Object.values(reviewMap).filter(r => r.status === 'correct').length, [reviewMap])

  const paragraphLabel = useCallback(
    i => (passage?.letteredParagraphs ? `Đoạn ${String.fromCharCode(65 + i)}` : `Đoạn ${i + 1}`),
    [passage]
  )

  const selectNumber = useCallback(n => {
    setActiveNumber(n)
    rightPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const step = delta => {
    const idx = allNumbers.indexOf(activeNumber)
    const next = allNumbers[idx + delta]
    if (next != null) selectNumber(next)
  }

  const targetKey = targets ? `${activeNumber}:${Object.keys(targets).join(',')}` : ''
  useEffect(() => {
    if (!targetKey) return
    const timer = setTimeout(() => {
      const root = isMobile ? sheetBodyRef.current : passagePaneRef.current
      root?.querySelector('[data-target]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => clearTimeout(timer)
  }, [targetKey, sheetOpen, isMobile])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = e => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  useEffect(() => {
    if (!showAnswerSheet) return
    const onKey = e => { if (e.key === 'Escape') setShowAnswerSheet(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showAnswerSheet])

  const toggleLocate = value => {
    setLocate(value)
    if (value && isMobile) setSheetOpen(true)
  }

  const changeAttempt = value => {
    const next = new URLSearchParams(searchParams)
    next.set('attemptId', value)
    setSearchParams(next)
  }

  const close = () => navigate(examExitPath(exam, 'reading'), { replace: true })
  const requestClose = () => setConfirmExit(true)

  if (loading) return <SkeletonExamPage />
  if (error || !exam || !result) {
    return <ExamErrorState title="Không thể tải bài chữa" message={error || 'Không tìm thấy kết quả.'} onRetry={load} onBack={close} backLabel="Quay lại" />
  }

  const currentAttemptId = attemptId || attempts[0]?.attemptId
  const attemptSelect = attempts.length > 0 && (
    <select
      value={currentAttemptId ?? ''}
      onChange={e => changeAttempt(e.target.value)}
      aria-label="Chọn lượt làm bài"
      style={FS}
      className="h-9 pointer-coarse:h-11 max-w-full rounded-xl border border-zinc-200 bg-white px-3 text-zinc-800 cursor-pointer focus:outline-none focus:border-zinc-900"
    >
      {attempts.map((a, i) => (
        <option key={a.attemptId} value={a.attemptId}>
          Lần {attempts.length - i}: {new Date(a.finishedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </option>
      ))}
    </select>
  )

  const band = typeof result.bandScore === 'number' ? result.bandScore.toFixed(1) : '–'

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[var(--surface-raised)]">
      <header className="bg-white border-b border-zinc-200 shrink-0 z-20">
        <div className="h-16 px-3 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={requestClose}
            aria-label="Đóng"
            className="exam-bar-btn w-9 h-9 shrink-0 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm sm:text-base font-semibold text-zinc-900 truncate">{exam.title}</p>
            <button
              type="button"
              onClick={() => setShowAnswerSheet(true)}
              className="tap-pad text-xs text-zinc-500 underline hover:text-zinc-900 bg-transparent border-none p-0 cursor-pointer"
            >
              Xem Answer Sheet
            </button>
          </div>
          <ScoreBadge value={band} />
          <div className="hidden md:block">{attemptSelect}</div>
        </div>
        {attemptSelect && <div className="md:hidden px-3 pb-2.5">{attemptSelect}</div>}
      </header>

      <div className="flex-1 min-h-0 flex">
        {!isMobile && (
          <div ref={passagePaneRef} className="w-1/2 overflow-y-auto bg-white border-r border-zinc-200 px-8 py-6">
            <PassageView passage={passage} targets={targets} />
          </div>
        )}

        <div ref={rightPaneRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-5 max-md:pb-36">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              {activeGroup && !WHOLE_GROUP_TYPES.has(activeGroup.type) && activeGroupQuestion ? (
                <>
                  <TypeHeader type={activeGroupQuestion.type || activeGroup.type} from={activeGroup.qNumberStart} to={activeGroup.qNumberEnd} />
                  <QuestionBlock q={activeGroupQuestion} globalIdx={activeNumber - 1} answers={answersById} onAnswer={noop} previewMode showAnswers={false} />
                </>
              ) : activeGroup ? (
                <GroupBlock
                  group={activeGroup}
                  answers={answersById}
                  onAnswer={noop}
                  globalOffset={0}
                  previewMode
                  showAnswers={false}
                  review={activeGroup.type === 'note_completion' ? reviewMap : undefined}
                  activeNumber={activeNumber}
                  onSelectNumber={selectNumber}
                />
              ) : activeFlatQuestion ? (
                <>
                  <TypeHeader type={activeFlatQuestion.type} from={activeNumber} to={activeNumber} />
                  <QuestionBlock q={activeFlatQuestion} globalIdx={activeNumber - 1} answers={answersById} onAnswer={noop} previewMode showAnswers={false} />
                </>
              ) : null}
            </div>

            <AnswerSummary number={activeNumber} info={activeInfo} />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="m-0 font-semibold text-zinc-900" style={{ fontSize: 16 }}>Giải thích chi tiết</h3>
              <LocateSwitch checked={locate && canLocate} disabled={!canLocate} onChange={toggleLocate} />
            </div>

            <ReviewExplanation explanation={explanation} paragraphLabel={paragraphLabel} />
          </div>
        </div>
      </div>

      {isMobile && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed right-4 z-20 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-white border border-zinc-200 shadow-lg font-medium text-zinc-900 cursor-pointer"
          style={{ ...FS, bottom: footerHeight + 12 }}
        >
          <BookOpen className="w-4 h-4" />
          Bài đọc
        </button>
      )}

      <footer ref={footerRef} className="bg-white border-t border-zinc-200 shrink-0 px-3 sm:px-6 py-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowPanel(v => !v)}
          style={FS}
          className="shrink-0 flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-zinc-100 transition cursor-pointer text-left"
        >
          <span className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600">
            <LayoutGrid className="w-4 h-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-zinc-900">Tất cả câu hỏi</span>
            <span className="text-xs text-zinc-500 tabular-nums">Làm đúng {correctCount} / {allNumbers.length}</span>
          </span>
        </button>

        <div className="hidden md:flex flex-1 min-w-0 justify-center">
          <div className="seg-scroller gap-1.5 rounded-full border border-zinc-200 bg-white p-1">
            {passageNumbers.map((nums, pi) => (
              pi === activePassage ? (
                <div key={pi} className="flex items-center gap-1.5">
                  <span className="px-2 text-sm font-semibold text-zinc-900 whitespace-nowrap">Passage {exam.passages[pi].number}</span>
                  {nums.map(n => (
                    <QuestionNavButton key={n} number={n} status={reviewMap[n]?.status || 'missed'} active={n === activeNumber} roundedFull onClick={() => selectNumber(n)} />
                  ))}
                </div>
              ) : (
                <button
                  key={pi}
                  type="button"
                  onClick={() => selectNumber(nums[0])}
                  style={FS}
                  className="exam-bar-btn h-8 px-3 rounded-full font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer whitespace-nowrap"
                >
                  P{exam.passages[pi].number}
                </button>
              )
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={allNumbers.indexOf(activeNumber) <= 0}
            aria-label="Câu trước"
            style={FS}
            className="exam-bar-btn h-9 px-3 sm:px-4 rounded-full border border-zinc-200 bg-white font-medium text-zinc-800 inline-flex items-center gap-1 cursor-pointer hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Trước</span>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={allNumbers.indexOf(activeNumber) >= allNumbers.length - 1}
            aria-label="Câu tiếp"
            style={FS}
            className="exam-bar-btn h-9 px-3 sm:px-4 rounded-full bg-zinc-900 text-white font-medium inline-flex items-center gap-1 cursor-pointer hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <span className="hidden sm:inline">Tiếp</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {showPanel && (
        <QuestionPanelPopover
          bottomOffset={footerHeight + 8}
          activeIndex={activePassage}
          onClose={() => setShowPanel(false)}
          onJump={selectNumber}
          groups={exam.passages.map((p, pi) => ({
            label: `Passage ${p.number}`,
            items: passageNumbers[pi].map(n => ({
              number: n,
              ref: n,
              answered: reviewMap[n]?.status === 'correct',
              status: reviewMap[n]?.status || 'missed',
              active: n === activeNumber,
            })),
          }))}
        />
      )}

      <ExamActionDialog
        open={confirmExit}
        title="Thoát trang chữa bài?"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0">Bài chữa của lượt làm này vẫn được lưu lại, bạn có thể xem lại bất cứ lúc nào.</p>
            {exam.seriesId ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-zinc-700">
                <p className="m-0 mb-1.5 font-semibold text-zinc-900">Cách xem lại bài chữa</p>
                <ol className="m-0 pl-5 list-decimal flex flex-col gap-1">
                  <li>Vào <strong>Tất cả bộ đề Full Test</strong>, mở sách <strong>{[result.bookName, exam.bookNumber].filter(Boolean).join(' ')}</strong>, bấm <strong>Test {exam.testNumber}</strong></li>
                  <li>Ở dòng <strong>Reading</strong>, bấm <strong>Lịch sử</strong></li>
                  <li>Chọn lượt làm, bấm <strong>Xem lại</strong></li>
                </ol>
              </div>
            ) : null}
          </div>
        }
        cancelLabel="Ở lại xem tiếp"
        confirmLabel="Thoát"
        onCancel={() => setConfirmExit(false)}
        onConfirm={close}
      />

      {isMobile && sheetOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Bài đọc">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-2 pb-2 border-b border-zinc-100">
              <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-zinc-300" />
              <span className="text-base font-semibold text-zinc-900 mt-2">Bài đọc</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Đóng bài đọc"
                className="exam-bar-btn mt-2 w-9 h-9 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={sheetBodyRef} className="flex-1 overflow-y-auto px-5 py-4">
              <PassageView passage={passage} targets={targets} />
            </div>
          </div>
        </div>
      )}

      {/* ── Answer Sheet Modal Overlay ── */}
      {showAnswerSheet && result && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Answer Sheet"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Backdrop */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowAnswerSheet(false)}
          />
          {/* Panel — scrollable, centered, max-width constrained */}
          <div style={{
            position: 'relative',
            margin: 'auto',
            width: '100%',
            maxWidth: 900,
            maxHeight: '92dvh',
            background: 'var(--bg, #f9fafb)',
            borderRadius: 20,
            boxShadow: '0 24px 60px rgba(0,0,0,.22)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <SkillResult
              skillType="reading"
              examId={id}
              dataProp={result}
              isAnswerSheet={true}
              onClose={() => setShowAnswerSheet(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
