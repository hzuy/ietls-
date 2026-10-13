import { useNavigate } from 'react-router-dom'
import { formatBand } from '../../utils/ielts'
import StatValue from '../common/StatValue'
import { BookOpen, Headphones, PenTool, Mic, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SKILLS = [
  { key: 'reading',   label: 'Reading',   icon: BookOpen,   colorVar: '--skill-r-color', bg: 'bg-sky-50',     text: 'text-sky-700' },
  { key: 'listening', label: 'Listening', icon: Headphones, colorVar: '--skill-l-color', bg: 'bg-violet-50',  text: 'text-violet-700' },
  { key: 'writing',   label: 'Writing',   icon: PenTool,    colorVar: '--skill-w-color', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { key: 'speaking',  label: 'Speaking',  icon: Mic,        colorVar: '--skill-s-color', bg: 'bg-rose-50',    text: 'text-rose-700' },
]

function SkillRow({ skill, band }) {
  const Icon = skill.icon
  const hasScore = band != null && band > 0
  const pct = hasScore ? Math.min((band / 9) * 100, 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${skill.bg}`}>
            <Icon className={`w-3 h-3 ${skill.text}`} />
          </span>
          <span className="text-zinc-700 font-medium">{skill.label}</span>
        </div>
        <span className="font-mono font-semibold text-zinc-900">
          {hasScore ? formatBand(band) : '—'}
        </span>
      </div>
      <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: hasScore ? `var(${skill.colorVar}, var(--primary))` : undefined,
          }}
        />
      </div>
    </div>
  )
}

export default function BandOverviewWidget({ stats, isAuthenticated, className = '' }) {
  const navigate = useNavigate()
  const bandBySkill = isAuthenticated ? (stats?.bandBySkill ?? null) : null
  const hasAnyScore = bandBySkill && Object.values(bandBySkill).some(v => v != null && v > 0)
  const hasOverall = hasAnyScore && stats?.avgBand != null && stats?.avgBand > 0

  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs h-full flex flex-col justify-between min-h-[220px] ${className}`}>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            Band điểm hiện tại
          </h3>
          <span className="font-mono text-xs font-semibold text-zinc-900">
            {hasOverall ? formatBand(stats?.avgBand) : '—'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 my-auto">
          {SKILLS.map(skill => (
            <SkillRow
              key={skill.key}
              skill={skill}
              band={bandBySkill?.[skill.key] ?? null}
            />
          ))}
        </div>
      </div>

      <div className="pt-3.5 mt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
        {hasAnyScore ? (
          <>
            <p className="text-[11px] text-zinc-400">
              Dựa trên kết quả các bài thi đã nộp
            </p>
            <span className="text-[11px] font-mono font-medium text-zinc-500">
              {stats?.totalAttempts ? `${stats.totalAttempts} bài thi` : 'IELTS Scale'}
            </span>
          </>
        ) : (
          <>
            <p className="text-[11px] text-zinc-400">
              Chưa có bài thi nào hoàn thành.
            </p>
            <button
              type="button"
              onClick={() => navigate('/cambridge')}
              className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-900 cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              Làm bài ngay →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
