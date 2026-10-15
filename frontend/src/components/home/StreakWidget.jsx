import { useMemo, useState, useRef } from 'react'
import { Flame } from 'lucide-react'

// Thứ tự ngày trong tuần: Thứ 2 (Mon) -> Chủ nhật (Sun)
const DAY_LABELS = ['', 'Tue', '', 'Thu', '', 'Sat', '']
const WEEKS_COUNT = 18

/**
 * Tính toán ma trận 18 tuần gần nhất kết thúc ở tuần hiện tại.
 */
function useHeatmapMatrix(streak = 0, activityMap = {}) {
  return useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayDay = today.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
    const todayIndex = todayDay === 0 ? 6 : todayDay - 1 // 0 = Mon ... 6 = Sun

    // Ngày Chủ nhật kết thúc tuần hiện tại
    const currentSunday = new Date(today)
    currentSunday.setDate(today.getDate() + (6 - todayIndex))

    // Ngày Thứ 2 bắt đầu của 18 tuần trước
    const startDate = new Date(currentSunday)
    startDate.setDate(currentSunday.getDate() - (WEEKS_COUNT * 7 - 1))

    const weeks = []
    const monthLabels = []
    let lastSeenMonth = -1

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const days = []
      let monthHeader = ''

      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + (w * 7 + d))

        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const dayStr = String(date.getDate()).padStart(2, '0')
        const dateKey = `${y}-${m}-${dayStr}`

        const isFuture = date > today
        const isToday = date.getTime() === today.getTime()

        let count = activityMap?.[dateKey] || 0

        // Nếu streak > 0 nhưng không có bài tập trong activityMap,
        // phản ánh các ngày trong chuỗi streak gần đây
        if (count === 0 && streak > 0 && !isFuture) {
          const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays >= 0 && diffDays < streak) {
            count = 1
          }
        }

        days.push({
          date,
          dateKey,
          count,
          isFuture,
          isToday,
        })

        // Gắn nhãn tháng ở cột tuần chứa những ngày đầu tháng
        if (!monthHeader && date.getDate() <= 7 && date.getMonth() !== lastSeenMonth) {
          monthHeader = date.toLocaleString('en-US', { month: 'short' })
          lastSeenMonth = date.getMonth()
        }
      }

      weeks.push(days)
      monthLabels.push(monthHeader)
    }

    return { weeks, monthLabels }
  }, [streak, activityMap])
}

function getCellColor(count, isFuture) {
  if (isFuture) return 'bg-zinc-100/60'
  if (count === 0) return 'bg-[#edeef1]'
  if (count === 1) return 'bg-[#bbf7d0]' // mint nhạt
  if (count === 2) return 'bg-[#86efac]' // xanh lá vừa
  if (count === 3) return 'bg-[#22c55e]' // xanh lá
  if (count === 4) return 'bg-[#15803d]' // xanh lá đậm
  return 'bg-[#4f46e5]'                  // tím đậm
}

export default function StreakWidget({
  streak = 0,
  activityMap = {},
  freezeCount = 0,
  isAuthenticated = false,
  loading = false,
  className = '',
}) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const currentStreak = isAuthenticated ? Math.max(0, streak) : 0
  const { weeks, monthLabels } = useHeatmapMatrix(currentStreak, activityMap)

  const handleCellMouseEnter = (e, day) => {
    if (day.isFuture) return
    const cellEl = e.currentTarget
    const cellRect = cellEl.getBoundingClientRect()
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()

    const d = day.date.getDate()
    const m = day.date.getMonth() + 1
    const text = day.count > 0
      ? `Luyện ${day.count} lần vào ngày ${d}/${m}`
      : `Lười quá, không luyện vào ngày ${d}/${m}`

    const y = cellRect.top + cellRect.height / 2 - containerRect.top
    const isNearRight = (containerRect.right - cellRect.right) < 220
    const placement = isNearRight ? 'left' : 'right'
    const x = placement === 'right'
      ? cellRect.right - containerRect.left + 8
      : cellRect.left - containerRect.left - 8

    setTooltip({ text, x, y, placement })
  }

  const handleCellMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div
      ref={containerRef}
      aria-busy={loading || undefined}
      className={`relative rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs h-full flex flex-col justify-between ${className}`}
    >
      {/* Floating Tooltip */}
      {tooltip && (
        <div
          data-testid="heatmap-tooltip"
          style={{
            position: 'absolute',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: tooltip.placement === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)',
          }}
          className="pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-75 select-none"
        >
          <div className="relative bg-[#1e293b] text-white text-[12px] sm:text-[13px] font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
            <span
              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1e293b] rotate-45 ${
                tooltip.placement === 'right' ? '-left-1' : '-right-1'
              }`}
            />
            {tooltip.text}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 flex-1">
        {/* CỘT TRÁI: Bảng Heatmap & Legend */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-x-auto pb-2 -mb-2 scrollbar-none">
            <div className="inline-block min-w-full">
              {/* Header Tháng */}
              <div className="flex items-center pl-7 sm:pl-8 mb-1.5 h-4">
                {monthLabels.map((m, idx) => (
                  <div
                    key={idx}
                    className="w-3.5 sm:w-4 mr-1 sm:mr-1.5 shrink-0 text-[10px] sm:text-xs text-zinc-400 font-medium text-left leading-none"
                  >
                    {m}
                  </div>
                ))}
              </div>

              {/* Grid 7 hàng (ngày) x 18 cột (tuần) */}
              <div className="flex items-start">
                {/* Trục nhãn ngày (Tue, Thu, Sat) */}
                <div className="flex flex-col justify-between pr-2 shrink-0 h-[108px] sm:h-[122px] py-0.5">
                  {DAY_LABELS.map((dayName, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] sm:text-[11px] font-medium text-zinc-400 text-right h-3 sm:h-3.5 leading-none flex items-center justify-end"
                    >
                      {dayName}
                    </span>
                  ))}
                </div>

                {/* Các cột tuần */}
                <div className="flex gap-1 sm:gap-1.5">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1 sm:gap-1.5">
                      {week.map((day) => {
                        const cellColor = loading ? 'bg-zinc-100 animate-pulse' : getCellColor(day.count, day.isFuture)

                        return (
                          <div
                            key={day.dateKey}
                            data-testid={`heatmap-cell-${day.dateKey}`}
                            onMouseEnter={(e) => handleCellMouseEnter(e, day)}
                            onMouseLeave={handleCellMouseLeave}
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3.5px] transition-transform hover:scale-110 cursor-pointer ${cellColor} ${
                              day.isToday ? 'ring-1.5 ring-zinc-400 ring-offset-1' : ''
                            }`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend dưới Heatmap */}
          <div className="flex items-center justify-end mt-4 pt-3 text-[11px] sm:text-xs text-zinc-400 font-medium border-t border-zinc-100">
            {/* Bên phải: Thang đo cấp độ Ít -> Nhiều */}
            <div className="flex items-center gap-1.5">
              <span>Ít</span>
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#edeef1] shrink-0" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#bbf7d0] shrink-0" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#86efac] shrink-0" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#22c55e] shrink-0" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#15803d] shrink-0" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[3px] bg-[#4f46e5] shrink-0" />
              <span>Nhiều</span>
            </div>
          </div>
        </div>

        {/* ĐƯỜNG KẺ DỌC PHÂN CÁCH */}
        <div className="hidden xl:block w-px self-stretch bg-zinc-200/80 my-1" />
        <div className="block xl:hidden h-px w-full bg-zinc-200/80" />

        {/* CỘT PHẢI: Số Streak & Ngọn lửa */}
        <div className="w-full xl:w-48 shrink-0 flex flex-col items-center justify-center text-center py-2 xl:py-0">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#ffedd5] flex items-center justify-center shrink-0 shadow-2xs">
              <Flame className="w-7 h-7 text-[#f97316] fill-[#f97316]" />
            </div>
            {loading ? (
              <span className="w-12 h-12 rounded-xl bg-zinc-100 animate-pulse" aria-hidden="true" />
            ) : (
              <span className="text-5xl font-black text-[#f97316] font-display leading-none tracking-tight">
                {currentStreak}
              </span>
            )}
          </div>

          <p className="text-sm sm:text-base font-semibold text-zinc-700 mt-3.5">
            Day streak
          </p>
          <p className="text-[11px] italic text-zinc-400 mt-1 text-center">
            *Streak ngày mới bắt đầu lúc 0h giờ VN
          </p>
        </div>
      </div>
    </div>
  )
}
