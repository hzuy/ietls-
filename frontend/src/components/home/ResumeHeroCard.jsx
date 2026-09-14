import React from 'react'
import { Clock, Play, Trash2, BookOpen, Headphones, PenTool, Mic } from 'lucide-react'

const SKILL_ICONS = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
  'practice-reading': BookOpen,
  'practice-listening': Headphones,
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

export default function ResumeHeroCard({ draft, onResume, onDiscard }) {
  if (!draft) return null

  const details = parseDraftDetails(draft)
  if (!details) return null

  const SkillIcon = SKILL_ICONS[details.skillType] || BookOpen

  return (
    <div
      data-testid="resume-hero-card"
      className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs transition-all hover:border-zinc-300 relative overflow-hidden"
    >
      {/* Top row: Badge & Status time */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            TIẾP TỤC BÀI LÀM
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 font-medium">
            <SkillIcon className="w-3.5 h-3.5" />
            {details.skillDisplay}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Thời gian còn: <strong className="text-zinc-800 font-semibold">{details.timeLeftFormatted}</strong></span>
          {details.savedAtFormatted && (
            <span className="hidden sm:inline text-zinc-400">
              · Lưu lúc {details.savedAtFormatted}
            </span>
          )}
        </div>
      </div>

      {/* Main title */}
      <div className="mt-3.5 mb-2">
        <h2 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight truncate">
          {details.title}
        </h2>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>
            Đã hoàn thành <strong className="font-semibold text-zinc-900 font-mono">{details.answeredCount}/{details.totalQuestions}</strong> câu ({details.percentage}%)
          </span>
          <span className="font-mono text-xs font-medium text-zinc-700">
            {details.percentage}%
          </span>
        </div>
        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 rounded-full transition-all duration-500"
            style={{ width: `${details.percentage}%` }}
          />
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-zinc-100">
        <button
          type="button"
          onClick={() => onResume(draft)}
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium h-9 px-5 rounded-full transition-colors inline-flex items-center justify-center leading-none gap-2 cursor-pointer shadow-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Tiếp tục làm bài</span>
        </button>

        <button
          type="button"
          onClick={() => onDiscard(draft)}
          className="bg-transparent hover:bg-zinc-100 text-zinc-600 text-sm font-medium h-9 px-4 rounded-full transition-colors inline-flex items-center justify-center leading-none gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Bỏ qua / Hủy bài nháp</span>
        </button>
      </div>
    </div>
  )
}
