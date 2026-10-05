import React, { useMemo } from 'react'
import { Target } from 'lucide-react'

const QUESTION_TYPE_LABELS = {
  fill_blank: 'Summary / Note Completion',
  short_answer: 'Short Answer Questions',
  mcq: 'Multiple Choice (Single)',
  mcq_multi: 'Multiple Choice (Multiple Answers)',
  matching: 'Matching Information',
  matching_features: 'Matching Features',
  matching_headings: 'Matching Headings',
  matching_paragraph: 'Matching Paragraph Information',
  matching_endings: 'Matching Sentence Endings',
  map_diagram: 'Map / Diagram Labelling',
  diagram_label: 'Diagram Labelling',
  list_selection: 'List Selection',
  choose_title: 'Choose a Title',
  true_false_ng: 'True / False / Not Given',
  yes_no_ng: 'Yes / No / Not Given',
  table_completion: 'Table Completion',
  flow_chart: 'Flow-chart Completion',
  sentence_completion: 'Sentence Completion',
  note_completion: 'Note/Form Completion',
}

function isMissed(answer) {
  return answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0)
}

/**
 * Normalizes question types from API or aggregates from sections
 */
export function deriveQuestionTypeAnalysis(questionTypes, sections) {
  if (Array.isArray(questionTypes) && questionTypes.length > 0) {
    return questionTypes.map(item => {
      const correct = item.correct || 0
      const wrong   = item.wrong  || 0
      const missed  = item.missed || 0
      const total   = item.total  || (correct + wrong + missed)
      const rate    = total > 0 ? Math.round((correct / total) * 100) : 0
      let status = 'proficient'
      let statusLabel = 'Thành thạo'
      if (rate < 50) { status = 'needs_practice'; statusLabel = 'Cần luyện thêm' }
      else if (rate < 80) { status = 'average'; statusLabel = 'Cần ôn lại' }
      return {
        name: QUESTION_TYPE_LABELS[item.name] || item.name || 'Dạng câu hỏi khác',
        total, correct, wrong, missed,
        accuracyRate: rate,
        status, statusLabel,
      }
    })
  }

  // Fallback: aggregate from sections
  if (!sections || !Array.isArray(sections)) return []
  const questionsWithType = sections.flatMap(s => s.questions || []).filter(q => q.type || q.questionType)
  if (questionsWithType.length === 0) return []

  const stats = {}
  questionsWithType.forEach(q => {
    const rawType  = q.type || q.questionType || (q.grouped ? 'mcq_multi' : 'mcq')
    const typeName = QUESTION_TYPE_LABELS[rawType] || rawType || 'Dạng câu hỏi khác'
    if (!stats[typeName]) stats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }
    if (q.grouped && Array.isArray(q.statuses)) {
      q.statuses.forEach(st => {
        stats[typeName].total++
        if (st === 'correct') stats[typeName].correct++
        else if (st === 'wrong') stats[typeName].wrong++
        else stats[typeName].missed++
      })
    } else {
      stats[typeName].total++
      const skipped = isMissed(q.userAnswer)
      const st = skipped ? 'missed' : (q.status || 'missed')
      if (st === 'correct') stats[typeName].correct++
      else if (st === 'wrong') stats[typeName].wrong++
      else stats[typeName].missed++
    }
  })

  return Object.values(stats).map(item => {
    const rate = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0
    let status = 'proficient'
    let statusLabel = 'Thành thạo'
    if (rate < 50) { status = 'needs_practice'; statusLabel = 'Cần luyện thêm' }
    else if (rate < 80) { status = 'average'; statusLabel = 'Cần ôn lại' }
    return { ...item, accuracyRate: rate, status, statusLabel }
  })
}

/** Small colored circle badge with number */
function StatCircle({ value, color }) {
  const styles = {
    green:  { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
    red:    { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
    gray:   { bg: '#f4f4f5', text: '#71717a', border: '#e4e4e7' },
  }
  const s = styles[color] || styles.gray
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: '50%',
      fontSize: 12,
      fontWeight: 700,
      background: s.bg,
      color: s.text,
      border: `1.5px solid ${s.border}`,
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </span>
  )
}

export default function QuestionTypeBreakdown({ questionTypes, sections }) {
  const analysisData = useMemo(
    () => deriveQuestionTypeAnalysis(questionTypes, sections),
    [questionTypes, sections]
  )

  if (!analysisData || analysisData.length === 0) return null

  return (
    <div
      data-testid="question-type-breakdown"
      style={{
        background: '#fff',
        border: '1px solid #e4e4e7',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18181b' }}>Bảng thống kê</h3>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e4e4e7' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#71717a', whiteSpace: 'nowrap' }}>
                LOẠI
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#71717a', whiteSpace: 'nowrap' }}>
                SỐ CÂU
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#16a34a', whiteSpace: 'nowrap' }}>
                ĐÚNG
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#dc2626', whiteSpace: 'nowrap' }}>
                SAI
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#71717a', whiteSpace: 'nowrap' }}>
                BỎ QUA
              </th>
            </tr>
          </thead>
          <tbody>
            {analysisData.map((item, idx) => (
              <tr
                key={item.name || idx}
                style={{
                  borderBottom: idx < analysisData.length - 1 ? '1px solid #f4f4f5' : 'none',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Loại */}
                <td style={{ padding: '10px 12px 10px 4px', fontWeight: 500, color: '#18181b', minWidth: 140 }}>
                  {item.name}
                </td>

                {/* Số câu */}
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#3f3f46', fontVariantNumeric: 'tabular-nums' }}>
                  {item.total}
                </td>

                {/* Đúng */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatCircle value={item.correct} color="green" />
                  </div>
                </td>

                {/* Sai */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatCircle value={item.wrong} color="red" />
                  </div>
                </td>

                {/* Bỏ qua */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatCircle value={item.missed} color="gray" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
