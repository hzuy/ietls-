import React, { useMemo } from 'react'
import { Target, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

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
      const total = item.total || (correct + (item.wrong || 0) + (item.missed || 0))
      const rate = total > 0 ? Math.round((correct / total) * 100) : 0
      let status = 'proficient'
      let statusLabel = 'Thành thạo'
      if (rate < 50) {
        status = 'needs_practice'
        statusLabel = 'Cần luyện thêm'
      } else if (rate < 80) {
        status = 'average'
        statusLabel = 'Cần ôn lại'
      }
      return {
        name: QUESTION_TYPE_LABELS[item.name] || item.name || 'Dạng câu hỏi khác',
        total,
        correct,
        wrong: item.wrong || 0,
        missed: item.missed || 0,
        accuracyRate: rate,
        status,
        statusLabel,
      }
    })
  }

  // Fallback: aggregate from sections only if questions actually have type or questionType
  if (!sections || !Array.isArray(sections)) return []
  const questionsWithType = sections.flatMap(s => s.questions || []).filter(q => q.type || q.questionType)
  if (questionsWithType.length === 0) return []

  const stats = {}
  questionsWithType.forEach(q => {
    const rawType = q.type || q.questionType || (q.grouped ? 'mcq_multi' : 'mcq')
    const typeName = QUESTION_TYPE_LABELS[rawType] || rawType || 'Dạng câu hỏi khác'
    if (!stats[typeName]) {
      stats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }
    }
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
    if (rate < 50) {
      status = 'needs_practice'
      statusLabel = 'Cần luyện thêm'
    } else if (rate < 80) {
      status = 'average'
      statusLabel = 'Cần ôn lại'
    }
    return {
      ...item,
      accuracyRate: rate,
      status,
      statusLabel,
    }
  })
}

export default function QuestionTypeBreakdown({ questionTypes, sections }) {
  const analysisData = useMemo(() => {
    return deriveQuestionTypeAnalysis(questionTypes, sections)
  }, [questionTypes, sections])

  if (!analysisData || analysisData.length === 0) {
    return null
  }

  return (
    <div
      data-testid="question-type-breakdown"
      className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6 shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 pb-4 border-b border-zinc-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900">
              <Target className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 m-0">
              Phân tích theo dạng câu hỏi
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Đánh giá mức độ thành thạo và tỷ lệ chính xác trên từng dạng bài
          </p>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          {analysisData.length} dạng bài
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/50">
              <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500">
                Dạng bài
              </th>
              <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500 text-center">
                Số câu
              </th>
              <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500 text-center">
                Đúng / Tổng
              </th>
              <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500">
                Tỷ lệ chính xác
              </th>
              <th className="py-2.5 px-3.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500 text-right">
                Đánh giá
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {analysisData.map((item, idx) => {
              const isProficient = item.status === 'proficient'
              const isAverage = item.status === 'average'

              return (
                <tr
                  key={item.name || idx}
                  className="hover:bg-zinc-50/70 transition-colors"
                >
                  {/* Dạng bài */}
                  <td className="py-3 px-3.5 font-medium text-zinc-900">
                    {item.name}
                  </td>

                  {/* Số câu */}
                  <td className="py-3 px-3.5 text-center font-mono text-zinc-600">
                    {item.total}
                  </td>

                  {/* Đúng / Tổng */}
                  <td className="py-3 px-3.5 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-mono text-xs bg-zinc-100 text-zinc-800 border border-zinc-200/60">
                      <strong className="font-bold text-zinc-900">{item.correct}</strong>
                      <span className="text-zinc-400 mx-0.5">/</span>
                      <span>{item.total}</span>
                    </span>
                  </td>

                  {/* Tỷ lệ chính xác + Progress bar */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-20 sm:w-28 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isProficient
                              ? 'bg-success'
                              : isAverage
                              ? 'bg-warning'
                              : 'bg-error'
                          }`}
                          style={{ width: `${item.accuracyRate}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-zinc-800 w-9 shrink-0">
                        {item.accuracyRate}%
                      </span>
                    </div>
                  </td>

                  {/* Đánh giá / Benchmark */}
                  <td className="py-3 px-3.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        isProficient
                          ? 'bg-success-bg text-success-text border-success-border'
                          : isAverage
                          ? 'bg-warning-bg text-warning-text border-warning-border'
                          : 'bg-error-bg text-error-text border-error-border'
                      }`}
                    >
                      {isProficient ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isAverage ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {item.statusLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
