import { BookOpen } from 'lucide-react'
import ReviewExplanation from '../exam/ReviewExplanation'
import { ExplanationStatusBadge } from '../admin/QuestionExplanationModal'
import LearnerGroupPreview from './LearnerGroupPreview'

export default function AdminGroupPreview({ group, skill = 'reading', practice = false, showAnswers, showExplanations = false }) {
  const qStart = group.qNumberStart
  const questions = group.questions || []
  const hasExplanations = questions.some(q => q.explanation) || Object.keys(group.explanations || {}).length > 0
  const ExplanationsSection = () => {
    if (!showExplanations || !hasExplanations) return null

    const expList = questions.length > 0
      ? questions.map((q, idx) => {
          const qNum = q.number || (qStart + idx)
          const exp = q.explanation || group.explanations?.[qNum] || group.explanations?.[String(qNum)]
          return { qNum, correctAnswer: q.correctAnswer, exp, id: q.id || qNum || idx }
        }).filter(item => Boolean(item.exp))
      : Object.entries(group.explanations || {}).map(([numStr, exp]) => ({
          qNum: Number(numStr) || numStr,
          correctAnswer: null,
          exp,
          id: numStr
        }))

    if (expList.length === 0) return null

    return (
      <div className="mt-4 pt-4 border-t border-zinc-200">
        <div className="flex items-center gap-2 mb-3 px-1 text-emerald-800 font-semibold text-xs">
          <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
          <span>Giải thích chi tiết ({expList.length} câu hỏi)</span>
        </div>

        <div className="space-y-3 bg-zinc-50/80 rounded-xl p-3.5 border border-zinc-200">
          {expList.map(({ qNum, correctAnswer, exp, id }) => {
            let parsedExp = exp
            if (typeof parsedExp === 'string') {
              try { parsedExp = JSON.parse(parsedExp) } catch { /* Preserve legacy plain text explanations. */ }
            }
            return (
              <div key={id} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {qNum}
                  </span>
                  <ExplanationStatusBadge explanation={parsedExp} />
                  {correctAnswer && (
                    <span className="text-xs font-bold text-zinc-800 ml-auto">
                      Đáp án đúng: <span className="text-emerald-700 font-semibold">{correctAnswer}</span>
                    </span>
                  )}
                </div>
                <ReviewExplanation explanation={parsedExp} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return <div>
    <LearnerGroupPreview group={group} skill={skill} practice={practice} showAnswers={showAnswers} />
    <ExplanationsSection />
  </div>
}
