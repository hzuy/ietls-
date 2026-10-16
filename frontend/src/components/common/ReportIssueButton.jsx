import { useState } from 'react'
import { Flag } from 'lucide-react'
import ReportIssueModal from './ReportIssueModal'

export default function ReportIssueButton({
  examId = null,
  practiceExamId = null,
  skill = 'reading',
  sourceType = 'exam',
  location = '',
  questionNumber = null,
  className = '',
  title = 'Báo lỗi',
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <>
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`relative p-2 rounded-full border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 hover:border-zinc-300 transition-colors shadow-2xs flex items-center justify-center cursor-pointer ${className}`}
          aria-label="Báo lỗi"
        >
          <Flag className="w-4 h-4 text-zinc-600" />
        </button>

        {/* Hover Tooltip (Styled after DOL English) */}
        {showTooltip && (
          <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white border border-zinc-200 rounded-2xl p-3 shadow-xl pointer-events-none animate-in fade-in duration-150">
            <p className="text-xs font-bold text-zinc-900 mb-0.5">{title}</p>
            <p className="text-[11px] text-zinc-500 leading-snug">
              Gửi phản hồi về câu hỏi hoặc bài này cho IELTS Pro
            </p>
          </div>
        )}
      </div>

      <ReportIssueModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        examId={examId}
        practiceExamId={practiceExamId}
        skill={skill}
        sourceType={sourceType}
        location={location}
        questionNumber={questionNumber}
      />
    </>
  )
}
