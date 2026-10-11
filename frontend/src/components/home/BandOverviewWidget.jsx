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
  const pct = band != null ? Math.min((band / 9) * 100, 100) : 0
  const hasScore = band != null

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

export default function BandOverviewWidget({ stats, isAuthenticated }) {
  const navigate = useNavigate()
  const bandBySkill = isAuthenticated ? (stats?.bandBySkill ?? null) : null
  const hasAnyScore = bandBySkill && Object.values(bandBySkill).some(v => v !== null)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          Band điểm hiện tại
        </h3>
        {hasAnyScore && (
          <span className="font-mono text-xs font-semibold text-zinc-900">
            {formatBand(stats?.avgBand)}
          </span>
        )}
      </div>

      {!isAuthenticated || !hasAnyScore ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Làm bài đầu tiên để xem band ước tính.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cambridge')}
            className="h-7 px-3 text-[11px] font-medium text-white rounded-full cursor-pointer inline-flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            Làm bài đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {SKILLS.map(skill => (
            <SkillRow
              key={skill.key}
              skill={skill}
              band={bandBySkill?.[skill.key] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
