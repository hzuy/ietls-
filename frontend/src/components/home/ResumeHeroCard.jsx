import React from 'react'
import { Clock, Play, BookOpen, Headphones, PenTool, Mic } from 'lucide-react'
import PillButton from '../common/PillButton'

const SKILL_ICONS = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
  'practice-reading': BookOpen,
  'practice-listening': Headphones,
}

// Màu sắc & icon theo kỹ năng
const SKILL_COLORS = {
  reading:             { bg: 'bg-sky-50',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  listening:           { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  writing:             { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  speaking:            { bg: 'bg-rose-50',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  'practice-reading':  { bg: 'bg-sky-50',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  'practice-listening':{ bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
}

export function parseDraftDetails(draft) {
  if (!draft || !draft.data) return null

  let answeredCount = 0
  const data = draft.data

  if (draft.skillType === 'writing') {
    if (data.essays) {
      answeredCount = Object.values(data.essays).filter(t => typeof t === 'string' && t.trim().length > 0).length
    }
  } else if (draft.skillType === 'speaking') {
    if (data.transcripts) {
      answeredCount = Object.values(data.transcripts).filter(t => typeof t === 'string' && t.trim().length > 0).length
    }
  } else {
    // Reading / Listening / Practice
    if (typeof data === 'object') {
      answeredCount = Object.values(data).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length
    }
  }

  const totalQuestions = draft.totalQuestions || (
    draft.skillType === 'writing' ? 2 :
    draft.skillType === 'speaking' ? 3 : 40
  )

  const percentage = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0

  let timeLeftFormatted = 'Chưa tính giờ'
  if (typeof draft.timeRemaining === 'number' && draft.timeRemaining >= 0) {
    const m = Math.floor(draft.timeRemaining / 60)
    const s = draft.timeRemaining % 60
    timeLeftFormatted = `${m}:${String(s).padStart(2, '0')}`
  }

  const skillNames = {
    reading: 'IELTS Reading',
    listening: 'IELTS Listening',
    writing: 'IELTS Writing',
    speaking: 'IELTS Speaking',
    'practice-reading': 'Reading Practice',
    'practice-listening': 'Listening Practice',
  }
  const skillDisplay = skillNames[draft.skillType] || 'IELTS Test'
  const title = draft.examTitle || `${skillDisplay} · Đề #${draft.examId}`

  let savedAtFormatted = ''
  if (draft.savedAt) {
    const d = new Date(draft.savedAt)
    if (!isNaN(d.getTime())) {
      savedAtFormatted = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
  }

  return {
    title,
    skillDisplay,
    skillType: draft.skillType,
    examId: draft.examId,
    answeredCount,
    totalQuestions,
    percentage,
    timeLeftFormatted,
    savedAtFormatted,
  }
}

export default function ResumeHeroCard({ draft, onResume }) {
  if (!draft) return null

  const details = parseDraftDetails(draft)
  if (!details) return null

  const SkillIcon = SKILL_ICONS[details.skillType] || BookOpen
  const colors = SKILL_COLORS[details.skillType] || SKILL_COLORS.reading

  return (
    <div
      data-testid="resume-hero-card"
      className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs transition-all hover:border-zinc-300 relative overflow-hidden"
    >
      {/* Top row: Badge & Status time */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Tiếp tục bài làm
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text}`}>
            <SkillIcon className="w-3 h-3" />
            {details.skillDisplay}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Còn: <strong className="text-zinc-800 font-semibold">{details.timeLeftFormatted}</strong></span>
          {details.savedAtFormatted && (
            <span className="hidden sm:inline text-zinc-400">
              · Lưu {details.savedAtFormatted}
            </span>
          )}
        </div>
      </div>

      {/* Main title */}
      <div className="mt-3 mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight truncate">
          {details.title}
        </h2>
      </div>

      {/* Progress section — chỉ hiển thị một lần */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>
            <strong className="font-semibold text-zinc-900 font-mono">{details.answeredCount}/{details.totalQuestions}</strong> câu đã làm
          </span>
        </div>
        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${details.percentage}%`, background: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-100">
        <PillButton type="button" onClick={() => onResume(draft)}>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Tiếp tục</span>
        </PillButton>
      </div>
    </div>
  )
}
