/**
 * SkillResult.jsx — Shared result page for Reading & Listening
 * Used inside ReadingExam and ListeningExam when ?viewResult=true,
 * and as a standalone page via /reading/:id/result or /listening/:id/result
 */
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RotateCcw, BookOpen, Home, Trophy, Target, Award, AlertCircle, BarChart2, Check, Sparkles, X } from 'lucide-react'
import api from '../utils/axios'
import { askAITutor } from './common/AIChatbotDrawer'
import QuestionTypeBreakdown from './exam/QuestionTypeBreakdown'

// ─── Palette ──────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  correct: { bg: 'var(--success)', text: '#fff' },
  wrong:   { bg: 'var(--error)',   text: '#fff' },
  missed:  { bg: '#6b7280',        text: '#fff' },
}

const BADGE_COLORS = {
  green: { bg: 'var(--success-bg)', text: 'var(--success)' },
  red:   { bg: 'var(--error-bg)',   text: 'var(--error)' },
  gray:  { bg: '#f3f4f6',           text: '#6b7280' },
}

// ─── Score messaging ──────────────────────────────────────────────────────────

function getScoreMessage(correct, total) {
  if (!total) return 'Chưa có dữ liệu kết quả.'
  const r = correct / total
  if (r === 0)   return 'Oops! Bạn chưa làm đúng câu nào, cố gắng lần sau nha.'
  if (r < 0.3)   return 'Cố gắng thêm nhé! Bạn đang trên đà tiến bộ.'
  if (r < 0.6)   return 'Khá tốt! Tiếp tục luyện tập để cải thiện thêm.'
  if (r < 0.85)  return 'Tốt lắm! Bạn đang làm rất tốt.'
  return 'Xuất sắc! Bạn đã làm rất tốt bài thi này!'
}

function ResultHeroIcon({ correct, total }) {
  if (!total) {
    return (
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500">
        <BookOpen className="w-8 h-8 stroke-[1.75]" />
      </div>
    )
  }
  const r = correct / total
  if (r >= 0.85) {
    return (
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
        <Trophy className="w-8 h-8 stroke-[1.75]" />
      </div>
    )
  }
  if (r >= 0.5) {
    return (
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
        <Target className="w-8 h-8 stroke-[1.75]" />
      </div>
    )
  }
  return (
    <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500">
      <BookOpen className="w-8 h-8 stroke-[1.75]" />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ value, color }) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%',
      fontSize: 13, fontWeight: 600,
      background: c.bg, color: c.text,
      flexShrink: 0,
    }}>
      {value}
    </span>
  )
}

function QNum({ num, status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.missed
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
      background: c.bg, color: c.text,
    }}>
      {num}
    </span>
  )
}

export const splitGroupedQuestions = (questions) => {
  const result = [];
  (questions || []).forEach(q => {
    if (!q.grouped) {
      result.push(q);
      return;
    }
    // Split into pairs
    const pairSize = 2;
    const numbers = q.numbers || [];
    const answers = q.answers || [];
    for (let i = 0; i < numbers.length; i += pairSize) {
      result.push({
        ...q,
        numbers: numbers.slice(i, i + pairSize),
        answers: answers.slice(i, i + pairSize),
        userAnswers: q.userAnswers?.slice(i, i + pairSize) ?? [],
        statuses: q.statuses?.slice(i, i + pairSize) ?? Array(pairSize).fill('missed'),
      });
    }
  });
  return result;
};

export const calcSummary = (sections) => {
  let correct = 0, wrong = 0, missed = 0;

  (sections || []).forEach(section => {
    (section?.questions || []).forEach(q => {
      if (q.grouped && Array.isArray(q.statuses)) {
        // Câu grouped: đếm từng status trong mảng
        q.statuses.forEach(status => {
          if (status === 'correct')     correct++;
          else if (status === 'wrong')  wrong++;
          else                          missed++;
        });
      } else {
        // Câu đơn thông thường
        if (q.status === 'correct')     correct++;
        else if (q.status === 'wrong')  wrong++;
        else                            missed++;
      }
    });
  });

  return { correct, wrong, missed, total: correct + wrong + missed };
};

export const fixSections = (sections) => {
  let counter = 1;

  return (sections || []).map(section => {
    const sectionFrom = counter;
    const fixedQuestions = [];

    (section?.questions || []).forEach(q => {
      if (q.grouped) {
        const size = q.numbers?.length ?? q.answers?.length ?? 2;
        const fixedNumbers = Array.from({ length: size }, (_, i) => counter + i);
        fixedQuestions.push({
          ...q,
          numbers: fixedNumbers,
        });
        counter += size;
      } else {
        fixedQuestions.push({
          ...q,
          number: counter,
        });
        counter += 1;
      }
    });

    return {
      ...section,
      from: sectionFrom,
      to: counter - 1,
      questions: fixedQuestions,
    };
  });
};

function isMissed(answer) {
  return answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0)
}

const MissedLabel = () => (
  <span style={{
    fontSize: '14px',
    fontWeight: 500,
    color: '#9ca3af',
    flexShrink: 0,
  }}>
    Missed
  </span>
)

function AnswerRow({ q, onAskAI }) {
  // ── Grouped "In either order" (mcq_multi) ──────────────────────
  if (q.grouped) {
    return (
      <React.Fragment>
        {q.numbers.map((num, i) => {
          const rowStatus = q.statuses?.[i] ?? 'missed'
          const rowUserAns = q.userAnswers?.[i]
          const skipped = isMissed(rowUserAns)
          const isWrongOrSkipped = rowStatus === 'wrong' || skipped

          return (
            <div key={num} className="answer-row group flex items-center justify-between gap-2 py-2 border-b border-zinc-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <QNum num={num} status={rowStatus} />
                {skipped ? (
                  <MissedLabel />
                ) : rowStatus === 'wrong' ? (
                  <span className="text-red-600 line-through text-xs font-medium truncate max-w-[130px]">
                    {rowUserAns}
                  </span>
                ) : (
                  <span className="text-zinc-400 text-xs font-medium">Đúng</span>
                )}
                <span className="text-zinc-300">|</span>
                <span className="text-emerald-600 font-semibold text-xs truncate">
                  {q.answers[i]}
                </span>
              </div>
              {isWrongOrSkipped && onAskAI && (
                <button
                  type="button"
                  onClick={() => onAskAI(num, rowUserAns, q.answers[i])}
                  title="Hỏi AI Tutor giải thích câu này"
                  className="shrink-0 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition cursor-pointer border border-zinc-200 shadow-2xs"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Hỏi AI Tutor</span>
                </button>
              )}
            </div>
          )
        })}
      </React.Fragment>
    )
  }

  // ── Single flat question ─────────────────────────────────────
  const skipped = isMissed(q.userAnswer)
  const effectiveStatus = skipped ? 'missed' : q.status
  const isWrongOrSkipped = effectiveStatus === 'wrong' || skipped

  return (
    <div className="answer-row group flex items-center justify-between gap-2 py-2 border-b border-zinc-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <QNum num={q.number} status={effectiveStatus} />
        {skipped ? (
          <MissedLabel />
        ) : effectiveStatus === 'wrong' ? (
          <span className="text-red-600 line-through text-xs font-medium truncate max-w-[130px]">
            {q.userAnswer}
          </span>
        ) : (
          <span className="text-zinc-400 text-xs font-medium">Đúng</span>
        )}
        <span className="text-zinc-300">|</span>
        <span className="text-emerald-600 font-semibold text-xs truncate">
          {q.correctAnswer}
        </span>
      </div>
      {isWrongOrSkipped && onAskAI && (
        <button
          type="button"
          onClick={() => onAskAI(q.number, q.userAnswer, q.correctAnswer)}
          title="Hỏi AI Tutor giải thích câu này"
          className="shrink-0 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-50 hover:bg-zinc-100 transition cursor-pointer border border-zinc-200 shadow-2xs"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Hỏi AI Tutor</span>
        </button>
      )}
    </div>
  )
}

function SectionBlock({ section, skillType, filterStatus = 'all', onAskAI }) {
  const label = skillType === 'reading'
    ? `PASSAGE ${section.number} (QUESTION ${section.from} – ${section.to})`
    : `SECTION ${section.number} (QUESTION ${section.from} – ${section.to})`

  const filteredQuestions = (section.questions || []).filter(q => {
    if (filterStatus === 'all') return true
    if (q.grouped) {
      return (q.statuses || []).some((st, i) => {
        const skipped = isMissed(q.userAnswers?.[i])
        const eff = skipped ? 'missed' : st
        return eff === filterStatus
      })
    }
    const skipped = isMissed(q.userAnswer)
    const eff = skipped ? 'missed' : q.status
    return eff === filterStatus
  })

  if (filterStatus !== 'all' && filteredQuestions.length === 0) {
    return null
  }

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#9ca3af',
        margin: '16px 0 8px',
      }}>
        {label}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '6px 36px'
      }}>
        {filteredQuestions.map((q, i) => <AnswerRow key={i} q={q} onAskAI={onAskAI} />)}
      </div>
    </div>
  )
}

// ─── Score Ring Component ───────────────────────────────────────────────────────

function ScoreRing({ score, maxScore, isPractice, correct, totalQuestions, bandScore }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // animate progress on mount
    const timer = setTimeout(() => {
      setProgress(maxScore ? score / maxScore : 0);
    }, 50); // slight delay to allow initial render at 0
    return () => clearTimeout(timer);
  }, [score, maxScore]);

  const size = 88;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2; // 41
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.min(Math.max(progress || 0, 0), 1);
  const offset = circumference * (1 - safeProgress);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#18181b"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', flexDirection: isPractice ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'center'
      }}>
        {isPractice ? (
          <span className="text-3xl font-bold tabular-nums font-mono text-zinc-900">
            {correct}/{totalQuestions}
          </span>
        ) : (
          <span className="text-3xl font-bold tabular-nums font-mono text-zinc-900">
            {typeof bandScore === 'number' ? bandScore.toFixed(1) : bandScore}
          </span>
        )}
      </div>
      <div style={{
        position: 'absolute', top: -4, right: -4,
        width: 22, height: 22, borderRadius: '50%',
        background: '#18181b', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}>
        <Check className="w-3 h-3 text-white stroke-[2.5]" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SkillResult({ examId: examIdProp, skillType, onClose, dataProp, isPractice }) {
  const { id: examIdParam } = useParams()
  const examId = examIdProp ?? examIdParam   // prop takes priority, fallback to URL :id
  const navigate = useNavigate()
  const answerKeyRef = useRef(null)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    if (dataProp) {
      const fixed = fixSections(dataProp.sections)
      const split = fixed.map(s => ({
        ...s,
        questions: splitGroupedQuestions(s.questions)
      }))
      const summary = calcSummary(split)
      
      setData({
        ...dataProp,
        sections: split,
        correct: summary.correct,
        wrong: summary.wrong,
        missed: summary.missed,
        totalQuestions: summary.total
      })
      setLoading(false)
      return
    }

    api.get(`/${skillType}/exams/${examId}/result-detail`)
      .then(r => {
        const d = r.data
        const fixed = fixSections(d.sections)
        const split = fixed.map(s => ({
          ...s,
          questions: splitGroupedQuestions(s.questions)
        }))
        const summary = calcSummary(split)
        
        setData({
          ...d,
          sections: split,
          correct: summary.correct,
          wrong: summary.wrong,
          missed: summary.missed,
        })
      })
      .catch(e => setError(e?.response?.data?.message || 'Không thể tải kết quả'))
      .finally(() => setLoading(false))
  }, [examId, skillType, dataProp])

  const handleClose = () => {
    if (onClose) return onClose()
    navigate(-1)
  }

  const handleRetry = () => {
    if (isPractice) {
      navigate(`/practice/${skillType}/${examId}`)
    } else {
      navigate(`/${skillType}/${examId}`)
    }
  }

  const handleNextPractice = () => {
    navigate(`/practice/${skillType}`)
  }

  const skillLabel = skillType === 'reading' ? 'Reading' : 'Listening'

  if (loading) return (
    <div className="min-h-screen bg-zinc-50/50">
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl animate-pulse" style={{
            height: i === 1 ? 180 : i === 2 ? 220 : 400,
          }} />
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center max-w-sm w-full shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-600">
          <AlertCircle className="w-6 h-6 stroke-[2]" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">
          Không thể tải kết quả
        </h2>
        <p className="text-sm text-zinc-500 mb-6">{error}</p>
        <button onClick={handleClose}
          className="btn-primary px-5 h-9 rounded-full text-xs sm:text-sm font-medium">
          ← Quay lại
        </button>
      </div>
    </div>
  )

  const { bookName, testNumber, bandScore, correct, wrong, missed, totalQuestions, questionTypes, sections } = data

  const handleAskAI = (questionNum, userAns, correctAns) => {
    const prompt = `Trong bài thi ${bookName || ''} Test ${testNumber || ''} (${skillLabel}), câu hỏi số ${questionNum}: đáp án của tôi là "${userAns || 'bỏ qua'}", nhưng đáp án đúng là "${correctAns}". Giải thích giúp tôi tại sao đáp án đúng lại là "${correctAns}" và phân tích lỗi sai trong câu trả lời của tôi.`
    askAITutor(prompt)
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 font-sans text-zinc-900">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3 flex items-center">
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'center' }}>
          <p className="font-bold text-sm text-zinc-900 m-0">
            Answer key — {skillLabel}
          </p>
          <p className="text-xs text-zinc-500 m-0">
            {bookName} · Test {testNumber}
          </p>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold cursor-pointer flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* ── Bento Score Hero Card ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* Bento Col 1: Overall Band & Score (lg:col-span-4) */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
              {isPractice ? 'Practice Score' : 'Band Score'}
            </span>
            <ScoreRing 
              score={isPractice ? correct : (typeof bandScore === 'number' ? bandScore : 0)} 
              maxScore={isPractice ? totalQuestions : 9} 
              isPractice={isPractice} 
              correct={correct} 
              totalQuestions={totalQuestions} 
              bandScore={bandScore} 
            />
            <div className="mt-4 flex items-center gap-2">
              <ResultHeroIcon correct={correct} total={totalQuestions} />
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 m-0">
                  {correct}/{totalQuestions} câu đúng
                </p>
                <p className="text-[11px] text-zinc-500 m-0">
                  Độ chính xác {totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Bento Col 2: Breakdown per Section/Part (lg:col-span-5) */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Chi tiết từng phần
                </span>
                <span className="text-xs font-semibold text-zinc-600 truncate max-w-[160px]">
                  {getScoreMessage(correct, totalQuestions)}
                </span>
              </div>
              <div className="space-y-2.5">
                {(sections || []).map(sec => {
                  let secCorrect = 0
                  let secTotal = 0
                  ;(sec.questions || []).forEach(q => {
                    if (q.grouped) {
                      ;(q.statuses || []).forEach(st => {
                        secTotal++
                        if (st === 'correct') secCorrect++
                      })
                    } else {
                      secTotal++
                      if (q.status === 'correct') secCorrect++
                    }
                  })
                  const pct = secTotal ? Math.round((secCorrect / secTotal) * 100) : 0
                  return (
                    <div key={sec.number} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 font-medium w-24 truncate">
                        {skillType === 'reading' ? `Passage ${sec.number}` : `Section ${sec.number}`}
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-[180px] mx-2">
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-zinc-800 text-right w-12 shrink-0">
                        {secCorrect}/{secTotal}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đúng: <strong className="text-zinc-900">{correct}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Sai: <strong className="text-zinc-900">{wrong}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Bỏ qua: <strong className="text-zinc-900">{missed}</strong>
              </span>
            </div>
          </div>

          {/* Bento Col 3: Quick Action Cluster (lg:col-span-3) */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-center gap-2.5">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-300" />
              Làm lại đề này
            </button>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium border border-zinc-200 hover:bg-zinc-100 text-zinc-900 transition-colors flex items-center justify-center gap-2 cursor-pointer bg-white shadow-xs"
            >
              <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
              Xem bảng phân tích
            </button>
            <button
              type="button"
              onClick={() => askAITutor(`Tôi vừa hoàn thành bài thi ${bookName || ''} Test ${testNumber || ''} (${skillLabel}) với kết quả ${correct}/${totalQuestions} câu đúng (${typeof bandScore === 'number' ? `Band ${bandScore}` : ''}). Hãy phân tích lỗi sai phổ biến và hướng dẫn cải thiện giúp tôi.`)}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-200/80"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Hỏi AI Tutor câu sai
            </button>
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleNextPractice}
                className="text-zinc-600 hover:text-zinc-900 font-medium transition cursor-pointer bg-transparent border-none p-0 flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Luyện bài khác
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-zinc-400 hover:text-zinc-700 font-medium transition cursor-pointer bg-transparent border-none p-0 flex items-center gap-1"
              >
                <Home className="w-3.5 h-3.5" />
                Trang chủ
              </button>
            </div>
          </div>
        </div>

        {/* ── Question-Type Breakdown Table ── */}
        <QuestionTypeBreakdown questionTypes={questionTypes} sections={sections} />

        {/* ── Answer Key ── */}
        <div
          ref={answerKeyRef}
          className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 m-0">
                Answer key
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Bấm "Hỏi AI" ở từng câu sai để nhận giải thích chi tiết
              </p>
            </div>

            {/* Smart Filter Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full border border-zinc-200/60 shrink-0">
              {[
                { id: 'all', label: `Tất cả (${totalQuestions})` },
                { id: 'wrong', label: `Câu sai cần sửa (${wrong})` },
                { id: 'correct', label: `Câu đúng (${correct})` },
                { id: 'missed', label: `Chưa làm (${missed})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer border-none ${
                    filterStatus === tab.id
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sections && sections.length > 0 ? (
              sections.map(s => (
                <SectionBlock key={s.number} section={s} skillType={skillType} filterStatus={filterStatus} onAskAI={handleAskAI} />
              ))
            ) : (
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Không có dữ liệu chi tiết cho bài thi này.</p>
            )}
          </div>
        </div>


      </div>
    </div>
  )
}
