import { BookOpen, Headphones, FileText, Mic, Award } from 'lucide-react'

const SKILL_ICONS = {
  reading: BookOpen,
  listening: Headphones,
  writing: FileText,
  speaking: Mic,
  fullTest: Award,
}

/**
 * AcademicCover — 100% Vector CSS/SVG Academic Book Cover Fallback
 *
 * Render bìa sách học thuật thuần CSS/SVG tông Zinc Monochrome cực nét trên
 * mọi loại màn hình (Full HD, 2K, 4K, Retina), không phụ thuộc vào độ phân
 * giải hay hiện tượng mờ hạt của ảnh raster.
 *
 * Props:
 *   title      : string (vd: "Cambridge IELTS 19", "Reading Practice 1")
 *   subtitle   : string (vd: "Academic Tests", "4 Full Tests")
 *   seriesName : string (vd: "CAMBRIDGE", "IELTS PRO")
 *   volume     : string|number (vd: "19", "01")
 *   skill      : 'reading' | 'listening' | 'writing' | 'speaking' | 'fullTest'
 *   compact    : boolean (chế độ thu nhỏ cho thumbnail sidebar/hero nhỏ)
 *   className  : string
 */
export default function AcademicCover({
  title = 'IELTS Practice',
  subtitle,
  seriesName,
  volume,
  skill,
  compact = false,
  className = '',
}) {
  // Tự động phân tích Volume/Book Number từ title nếu chưa được truyền riêng
  const parsedVolume = volume ?? (() => {
    const match = title.match(/(?:Cambridge|IELTS|Test|Practice|Vol|Cuốn|Tập)\s*#?(\d+)/i)
    return match ? match[1] : null
  })()

  const parsedSeries = seriesName ?? (() => {
    if (/cambridge/i.test(title)) return 'CAMBRIDGE'
    if (/ielts/i.test(title)) return 'IELTS PRO'
    return 'ACADEMIC'
  })()

  const SkillIcon = skill && SKILL_ICONS[skill] ? SKILL_ICONS[skill] : null

  if (compact) {
    return (
      <div
        className={`w-full h-full relative overflow-hidden flex flex-col justify-between p-2 select-none bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-white border-l-2 border-zinc-700/80 ${className}`}
        style={{
          imageRendering: '-webkit-optimize-contrast',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="flex items-center justify-between text-[8px] font-bold font-mono tracking-widest text-zinc-400 uppercase">
          <span>{parsedSeries.slice(0, 4)}</span>
          {parsedVolume && <span>#{parsedVolume}</span>}
        </div>
        <div className="my-auto text-center py-1">
          {parsedVolume ? (
            <span className="block font-mono text-xl font-black tracking-tight text-white leading-none">
              {parsedVolume}
            </span>
          ) : (
            <BookOpen className="w-4 h-4 mx-auto text-zinc-400 stroke-[1.75]" />
          )}
        </div>
        <div className="text-[7px] text-center font-mono text-zinc-400 uppercase truncate">
          {subtitle || 'IELTS'}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full relative overflow-hidden flex flex-col justify-between p-4 sm:p-5 select-none bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-white border-l-4 border-zinc-700/80 shadow-inner ${className}`}
      style={{
        imageRendering: '-webkit-optimize-contrast',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Subtle geometric grid background accent */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-zinc-700/60 pb-2">
        <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-400">
          IELTS ACADEMIC
        </span>
        <span className="text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
          OFFICIAL
        </span>
      </div>

      {/* Center Body — Big Crisp Typography */}
      <div className="relative z-10 my-auto py-3 text-center">
        <span className="block text-[11px] sm:text-xs font-bold font-mono tracking-widest text-zinc-400 uppercase mb-1">
          {parsedSeries}
        </span>

        {parsedVolume ? (
          <span className="block font-mono text-4xl sm:text-5xl font-black text-white tracking-tight leading-none my-1 drop-shadow-sm">
            {parsedVolume}
          </span>
        ) : (
          <span className="block font-mono text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug my-1 line-clamp-2">
            {title}
          </span>
        )}

        <span className="inline-block mt-2 text-[10px] font-semibold tracking-wider uppercase text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
          {subtitle || 'Examination Papers'}
        </span>
      </div>

      {/* Bottom Footer with Skill Icon / Info */}
      <div className="relative z-10 pt-2 border-t border-zinc-700/60 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
        <div className="flex items-center gap-1.5 truncate">
          {SkillIcon ? (
            <SkillIcon className="w-3.5 h-3.5 text-zinc-300 stroke-[1.75]" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 text-zinc-300 stroke-[1.75]" />
          )}
          <span className="truncate">{skill ? skill.toUpperCase() : 'PRACTICE'}</span>
        </div>
        <span className="text-zinc-500 text-[9px]">4K VECTOR</span>
      </div>
    </div>
  )
}
