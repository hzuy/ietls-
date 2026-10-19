import React, { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { ExplanationStatusBadge } from './QuestionExplanationModal'

/**
 * Shared ExplanationChipGrid for all 4 admin views:
 * - Reading Practice
 * - Listening Practice
 * - Exam Reading (/admin/exams/reading)
 * - Exam Listening (/admin/exams/listening)
 *
 * Requirements:
 * - Unified CSS Grid with 5 columns on desktop (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2)
 * - Fixed height and width per chip (h-9 w-full), consistent across 1, 5, 7, 10+ questions
 * - Label "GIẢI THÍCH 4 BƯỚC" at top left
 * - Inner contents (Câu {qNum} + status badge) aligned evenly without warping chip sizes
 */
export default function ExplanationChipGrid({
  questions = [],
  group = {},
  onSelectQuestion,
  className = '',
  generatingQuestionNumbers = null,
  unsavedQuestionNumbers = null,
}) {
  const questionsList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) return questions
    if (Array.isArray(group?.questions) && group.questions.length > 0) return group.questions
    if (group?.qNumberStart && group?.qNumberEnd) {
      const list = []
      const start = Number(group.qNumberStart)
      const end = Number(group.qNumberEnd)
      for (let num = start; num <= end; num++) {
        list.push({ number: num, id: `q_${num}` })
      }
      return list
    }
    return []
  }, [questions, group])

  if (!questionsList || questionsList.length === 0) return null

  return (
    <div
      data-testid="explanation-chip-grid"
      className={`px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 space-y-2 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Giải thích 4 bước</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {questionsList.map((q, idx) => {
          const qNum = q.number ?? (Number(group?.qNumberStart) ? Number(group.qNumberStart) + idx : idx + 1)
          const exp = q.explanation || group?.explanations?.[qNum] || group?.explanations?.[String(qNum)]

          const isGeneratingThis = generatingQuestionNumbers
            ? (generatingQuestionNumbers instanceof Set ? generatingQuestionNumbers.has(qNum) : generatingQuestionNumbers.includes?.(qNum))
            : false

          const isUnsavedThis = unsavedQuestionNumbers
            ? (unsavedQuestionNumbers instanceof Set ? unsavedQuestionNumbers.has(qNum) : unsavedQuestionNumbers.includes?.(qNum))
            : false

          return (
            <button
              key={qNum}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectQuestion?.({ question: q, qNum, explanation: exp })
              }}
              className="h-10 w-full min-w-0 px-1.5 sm:px-2 inline-flex items-center justify-between gap-1 rounded-xl text-xs font-medium border bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800 transition shadow-2xs cursor-pointer select-none"
              title={`Xem, duyệt, góp ý hoặc sửa tay giải thích câu ${qNum}`}
            >
              <span className="font-bold text-[11px] shrink-0 text-zinc-900">Câu {qNum}</span>
              <ExplanationStatusBadge
                explanation={exp}
                isGenerating={isGeneratingThis}
                isUnsaved={isUnsavedThis}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
