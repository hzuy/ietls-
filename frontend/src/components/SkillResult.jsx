/**
 * SkillResult.jsx — Shared result page for Reading & Listening
 * Used inside ReadingExam and ListeningExam when ?viewResult=true,
 * and as a standalone page via /reading/:id/result or /listening/:id/result
 */
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../utils/axios'

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

function getIllustration(correct, total) {
  if (!total) return '📖'
  const r = correct / total
  if (r >= 0.85) return '🏆'
  if (r >= 0.5)  return '📖'
  return '🧑‍💻'
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

function AnswerRow({ q }) {
  // ── Grouped "In either order" (mcq_multi) ──────────────────────
  if (q.grouped) {
    return (
      <React.Fragment>
        {q.numbers.map((num, i) => {
          const rowStatus = q.statuses?.[i] ?? 'missed'
          const rowUserAns = q.userAnswers?.[i]
          const skipped = isMissed(rowUserAns)
          
          if (skipped) {
            return (
              <div key={num} className="answer-row" style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '4px 0',
                overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'
              }}>
                <QNum num={num} status="missed" />
                <MissedLabel />
                <span style={{ color: '#d1d5db', flexShrink: 0, marginLeft: '8px', marginRight: '8px' }}>|</span>
                <span style={{
                  color: '#16a34a', fontWeight: 500, fontSize: '14px',
                  flexShrink: 0, whiteSpace: 'nowrap'
                }}>
                  {q.answers[i]}
                </span>
              </div>
            )
          }

          return (
            <div key={num} className="answer-row" style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '6px 0',
            }}>
              <QNum num={num} status={rowStatus} />

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flex: 1,
              }}>
                {rowStatus === 'wrong' && (
                  <span style={{
                    color: '#dc2626', textDecoration: 'line-through',
                    fontSize: '13px', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word',
                    lineHeight: 1.4
                  }}>
                    {rowUserAns}
                  </span>
                )}

                <span style={{
                  color: '#16a34a', fontWeight: 500, fontSize: '14px',
                  whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word',
                  lineHeight: 1.4
                }}>
                  {q.answers[i]}
                </span>
              </div>
            </div>
          )
        })}
      </React.Fragment>
    )
  }

  // ── Single flat question ─────────────────────────────────────
  const skipped = isMissed(q.userAnswer)
  const effectiveStatus = skipped ? 'missed' : q.status

  return (
    <div className="answer-row" style={{
      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '4px 0',
      overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'
    }}>
      <QNum num={q.number} status={effectiveStatus} />

      {!skipped && effectiveStatus === 'wrong' && (
        <span style={{
          color: '#dc2626', textDecoration: 'line-through', fontSize: '13px',
          flexShrink: 0, whiteSpace: 'nowrap'
        }}>
          {q.userAnswer}
        </span>
      )}
      {skipped && <MissedLabel />}

      <span style={{ color: '#d1d5db', flexShrink: 0, marginLeft: skipped ? '8px' : 0, marginRight: skipped ? '8px' : 0 }}>|</span>
      <span style={{
        color: '#16a34a', fontWeight: 500, fontSize: '14px',
        flexShrink: 0, whiteSpace: 'nowrap'
      }}>
        {q.correctAnswer}
      </span>
    </div>
  )
}

function SectionBlock({ section, skillType }) {
  const label = skillType === 'reading'
    ? `PASSAGE ${section.number} (QUESTION ${section.from} – ${section.to})`
    : `SECTION ${section.number} (QUESTION ${section.from} – ${section.to})`

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#9ca3af',
        margin: '20px 0 10px',
      }}>
        {label}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px 64px'
      }}>
        {section.questions.map((q, i) => <AnswerRow key={i} q={q} />)}
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
          stroke="#FDE7C3"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f59e0b"
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
          <span style={{
            fontSize: 26, fontWeight: 800, color: '#f59e0b',
            fontFamily: 'var(--font-mono)',
          }}>
            {correct}/{totalQuestions}
          </span>
        ) : (
          <span style={{
            fontSize: 26, fontWeight: 800, color: '#f59e0b',
            fontFamily: 'var(--font-mono)',
          }}>
            {typeof bandScore === 'number' ? bandScore.toFixed(1) : bandScore}
          </span>
        )}
      </div>
      <div style={{
        position: 'absolute', top: -4, right: -4,
        width: 22, height: 22, borderRadius: '50%',
        background: '#f59e0b', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        zIndex: 10,
      }}>✓</div>
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

  const skillLabel = skillType === 'reading' ? 'Reading' : 'Listening'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: '#fff', borderRadius: 16,
            height: i === 1 ? 180 : i === 2 ? 220 : 400,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#111827', marginBottom: 8 }}>
          Không thể tải kết quả
        </h2>
        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>{error}</p>
        <button onClick={handleClose} className="btn-hover-default"
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          ← Quay lại
        </button>
      </div>
    </div>
  )

  const { bookName, testNumber, bandScore, correct, wrong, missed, totalQuestions, questionTypes, sections } = data

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'var(--font-body)' }}>

      {/* ── Sticky Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: 0 }}>
            Answer key — {skillLabel}
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            {bookName} · Test {testNumber}
          </p>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            aria-label="Đóng"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid #e5e7eb', background: '#f9fafb',
              color: '#374151', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 24px 60px' }}>

        {/* ── Score Card ── */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '28px 32px',
          marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', gap: 32,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 20px',
              lineHeight: 1.4, fontFamily: 'var(--font-display)',
            }}>
              {getScoreMessage(correct, totalQuestions)}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
              {/* Band circle */}
              <ScoreRing 
                score={isPractice ? correct : (typeof bandScore === 'number' ? bandScore : 0)} 
                maxScore={isPractice ? totalQuestions : 9} 
                isPractice={isPractice} 
                correct={correct} 
                totalQuestions={totalQuestions} 
                bandScore={bandScore} 
              />

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { label: 'Đúng:',    value: correct, color: 'green' },
                  { label: 'Sai:',     value: wrong,   color: 'red'   },
                  { label: 'Bỏ qua:', value: missed,  color: 'gray'  },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, color: '#374151', minWidth: 60 }}>{label}</span>
                    <StatBadge value={value} color={color} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                onClick={() => answerKeyRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-hover-default"
                style={{
                  background: '#f59e0b', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#d97706'}
                onMouseLeave={e => e.currentTarget.style.background = '#f59e0b'}
              >
                Xem giải thích ↓
              </button>
              <button
                onClick={() => navigate('/progress')}
                className="btn-hover-default"
                style={{
                  background: '#1D4ED8', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.2s, box-shadow 0.2s', display: 'flex', alignItems: 'center', gap: 6
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={e => e.currentTarget.style.background = '#1D4ED8'}
              >
                <span>📊 Xem Phân tích Lỗi sai & Lộ trình AI</span>
              </button>
            </div>
          </div>

          {/* Illustration */}
          <div style={{ flexShrink: 0, fontSize: 68, userSelect: 'none', lineHeight: 1 }}>
            {getIllustration(correct, totalQuestions)}
          </div>
        </div>

        {/* ── Stats Table ── */}
        {questionTypes && questionTypes.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '22px 28px',
            marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            <h3 style={{
              fontSize: 15, fontWeight: 700, color: '#111827',
              margin: '0 0 18px', fontFamily: 'var(--font-display)',
            }}>
              Bảng thống kê theo loại câu hỏi
            </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['LOẠI', 'SỐ CÂU', 'ĐÚNG', 'SAI', 'BỎ QUA'].map((h, i) => (
                    <th key={h} style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: '#9ca3af',
                      padding: '10px 14px',
                      textAlign: i === 0 ? 'left' : 'center',
                      borderBottom: '1px solid #e5e7eb',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(questionTypes || []).map(t => (
                  <tr key={t.name}>
                    <td style={{ padding: '14px', textAlign: 'left', fontWeight: 500, color: '#111827', fontSize: 14, borderBottom: '1px solid #f3f4f6' }}>{t.name}</td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 14, borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{t.total}</td>
                    <td style={{ padding: '14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}><StatBadge value={t.correct} color="green" /></td>
                    <td style={{ padding: '14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}><StatBadge value={t.wrong}   color="red"   /></td>
                    <td style={{ padding: '14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}><StatBadge value={t.missed}  color="gray"  /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ── Answer Key ── */}
        <div
          ref={answerKeyRef}
          style={{
            background: '#fff', borderRadius: 16, padding: '22px 28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          <h3 style={{
            fontSize: 15, fontWeight: 700, color: '#111827',
            margin: '0 0 20px', fontFamily: 'var(--font-display)',
          }}>
            Answer key
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {sections && sections.length > 0 ? (
              sections.map(s => (
                <SectionBlock key={s.number} section={s} skillType={skillType} />
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
