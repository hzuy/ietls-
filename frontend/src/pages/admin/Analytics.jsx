import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react'
import { getAdminAnalytics, getAdminUser } from '../../services/adminService'
import { Users2, BarChart2, Trophy, Award, ChevronRight, ChevronDown, Check } from 'lucide-react'
import StudentDetailModal from '../../components/admin/StudentDetailModal'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

import { formatBand } from '../../utils/ielts'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'
import { getChartTheme } from '../../utils/chartTheme'

// ─── Constants ───────────────────────────────────────────────────────────────
// Dải màu phân cấp hiệu suất học thuật (Performance Palette) cho 6 mốc Band Score
const BAND_COLORS = [
  '#f43f5e', // <4.0: Rose / Đỏ dịu (Yếu)
  '#f97316', // 4.0–4.9: Orange / Cam (Trung bình yếu)
  '#eab308', // 5.0–5.9: Yellow / Amber (Trung bình)
  '#3b82f6', // 6.0–6.9: Blue / Xanh dương (Khá)
  '#10b981', // 7.0–7.9: Emerald / Xanh lá (Tốt)
  '#8b5cf6', // 8.0–9.0: Purple/Violet / Tím cao cấp (Xuất sắc)
]

// Theme màu đồng bộ 4 kỹ năng giữa Doughnut Chart và Bảng phân tích chi tiết
const SKILL_THEMES = {
  reading: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    bar: 'bg-blue-500',
  },
  listening: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
  },
  writing: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    bar: 'bg-purple-500',
  },
  speaking: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
  },
}

// Date labels: monthly data (period=all) keeps YYYY-MM; daily data strips year
function formatDateLabel(date, period) {
  if (!date) return ''
  return period === 'all' ? date.slice(0, 7) : date.slice(5) // MM-DD
}

// Nhãn nút dropdown khi đã áp dụng khoảng tùy chỉnh: "YYYY-MM-DD" → "DD/MM"
function formatShortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Thứ tự lựa chọn trong dropdown lọc thời gian — 'today' là mặc định khi mở trang
const PERIOD_OPTIONS = [
  { value: 'today',  label: 'Hôm nay' },
  { value: 'week',   label: '7 ngày' },
  { value: 'month',  label: '30 ngày' },
  { value: 'all',    label: 'Tất cả' },
  { value: 'custom', label: 'Tùy chỉnh' },
]

// ─── Tooltips ────────────────────────────────────────────────────────────────
// `tooltipStyle` truyền từ Analytics() (theo resolvedTheme) — background/border là
// inline style thật (không phải class) nên phải tính theo theme ở JS, CSS không đụng tới được.
function AttemptTooltip({ active, payload, label, tooltipStyle }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5">{label}</p>
      <p className="text-zinc-600 font-medium">{payload[0].value} lượt thi</p>
    </div>
  )
}

function DonutTooltip({ active, payload, total, tooltipStyle }) {
  if (!active || !payload?.length) return null
  const { skill, count } = payload[0].payload
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5">{SKILL_LABEL[skill]}</p>
      <p className="text-zinc-600">{count} lượt · {pct}%</p>
    </div>
  )
}

function BandTooltip({ active, payload, label, total, tooltipStyle }) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const color = payload[0].payload?.fill || payload[0].color || '#3b82f6'
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
        Band {label}
      </p>
      <p className="text-zinc-600">{count} lượt · {pct}% tổng</p>
    </div>
  )
}

// ─── Skeleton for period-dependent sections ───────────────────────────────────
function ChartSkeleton({ height = 180 }) {
  return (
    <div className="animate-pulse rounded-xl bg-zinc-100" style={{ height }} />
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────
export default function Analytics() {
  const [period, setPeriod]           = useState('today') // 'today' | 'week' | 'month' | 'all' | 'custom'
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [showCustomPopover, setShowCustomPopover] = useState(false)
  const popoverRef = useRef(null)
  const navigate = useNavigate()
  const chart = useMemo(() => getChartTheme(), [])
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // period='custom' chỉ được set từ handleApplyCustom, vốn đã chặn khi thiếu
  // ngày — nhưng vẫn giữ điều kiện customFrom/customTo ở đây để query không
  // bao giờ bắn request "custom" thiếu from/to trong bất kỳ trường hợp nào.
  const isCustomRange = period === 'custom' && Boolean(customFrom && customTo)

  const {
    data = null,
    isLoading: initialLoading,
    isFetching: chartLoading,
  } = useQuery({
    queryKey: isCustomRange
      ? ['admin', 'analytics', 'custom', customFrom, customTo]
      : ['admin', 'analytics', period],
    queryFn: async () => {
      try {
        return await getAdminAnalytics(isCustomRange ? { from: customFrom, to: customTo } : { period })
      } catch (err) {
        if (err.response?.status === 403) navigate('/')
        throw err
      }
    },
    staleTime: 1000 * 60 * 5,
  })

  // Đóng popover khi click ra ngoài hoặc nhấn Escape — cùng pattern với
  // userMenuRef trong Navbar.jsx.
  useEffect(() => {
    if (!showCustomPopover) return
    const onMouseDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowCustomPopover(false)
      }
    }
    const onKeyDown = (e) => { if (e.key === 'Escape') setShowCustomPopover(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showCustomPopover])

  // Student Detail Modal state
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetail, setStudentDetail] = useState(null)
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false)
  const [selectedRank, setSelectedRank] = useState(null)
  // Cache chi tiết học viên trong phiên xem Analytics — mở lại cùng học viên thì
  // hiển thị tức thì (0ms), không gọi lại API. Không cần invalidate: dữ liệu chỉ
  // sống trong session xem trang này, refresh trang sẽ tự làm mới.
  const studentDetailCache = useRef(new Map())

  const handleOpenStudentDetail = useCallback(async (student, rank) => {
    setSelectedStudent(student)
    setSelectedRank(rank)

    const cached = studentDetailCache.current.get(student.id)
    if (cached) {
      setStudentDetail(cached)
      setLoadingStudentDetail(false)
      return
    }

    setStudentDetail(null)
    setLoadingStudentDetail(true)

    try {
      const detail = await getAdminUser(student.id)
      studentDetailCache.current.set(student.id, detail)
      setStudentDetail(detail)
    } catch (err) {
      console.error('Không thể tải chi tiết học viên:', err)
      // Fallback: sử dụng dữ liệu đã có sẵn từ card topUsers
      setStudentDetail({
        user: student,
        attempts: [],
        skillStats: {},
        totalAttempts: student.attemptCount,
      })
    } finally {
      setLoadingStudentDetail(false)
    }
  }, [])

  const handleCloseStudentDetail = useCallback(() => {
    setSelectedStudent(null)
    setStudentDetail(null)
    setSelectedRank(null)
  }, [])

  const handlePeriodChange = useCallback((p) => {
    setPeriod(p)
    setShowCustomPopover(false)
  }, [])

  // Chọn "Tùy chỉnh" trong dropdown chỉ mở popover chọn ngày — period chỉ thực
  // sự đổi thành 'custom' sau khi bấm "Áp dụng" (handleApplyCustom).
  const handleListboxChange = useCallback((value) => {
    if (value === 'custom') {
      setShowCustomPopover(true)
    } else {
      handlePeriodChange(value)
    }
  }, [handlePeriodChange])

  const handleCustomFromChange = useCallback((e) => {
    const value = e.target.value
    setCustomFrom(value)
    if (value && customTo && value > customTo) setCustomTo('')
  }, [customTo])

  const handleCustomToChange = useCallback((e) => {
    setCustomTo(e.target.value)
  }, [])

  const handleApplyCustom = useCallback(() => {
    if (!customFrom || !customTo) return
    setPeriod('custom')
    setShowCustomPopover(false)
  }, [customFrom, customTo])

  // Nhãn hiển thị trên nút dropdown: khoảng ngày đã áp dụng khi period='custom',
  // ngược lại là nhãn preset tương ứng
  const dropdownLabel = useMemo(() => {
    if (period === 'custom' && isCustomRange) {
      return `${formatShortDate(customFrom)} – ${formatShortDate(customTo)}`
    }
    return PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Chọn khoảng'
  }, [period, isCustomRange, customFrom, customTo])

  // ─── Derived data ───────────────────────────────────────────────────────────
  // period is the single source of truth — show all data returned for current period
  const displayDays = useMemo(
    () => (data?.attemptsByDay || []).map(d => ({ ...d, label: formatDateLabel(d.date, period) })),
    [data, period]
  )

  const bandTotal = useMemo(
    () => (data?.bandDistribution || []).reduce((s, d) => s + d.count, 0),
    [data]
  )

  const totalSkill = useMemo(
    () => (data?.skillBreakdown || []).reduce((s, d) => s + d.count, 0),
    [data]
  )

  const skillBreakdown = useMemo(() => {
    if (!data?.skillBreakdown) return []
    return SKILL_ORDER.map(sk => data.skillBreakdown.find(s => s.skill === sk)).filter(Boolean)
  }, [data])

  // Exclude zero-count slices from pie (recharts renders tiny artefact lines at 0)
  const pieData = useMemo(
    () => skillBreakdown.filter(d => d.count > 0),
    [skillBreakdown]
  )

  // ─── Initial skeleton (very first load) ─────────────────────────────────────
  if (initialLoading) return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse h-28 bg-zinc-100 rounded-2xl mb-4" />
      ))}
    </div>
  )

  if (!data) return (
    <div className="p-8 text-zinc-400">Không thể tải dữ liệu.</div>
  )

  const { overview, topUsers } = data
  const maxSkillCount = Math.max(...skillBreakdown.map(s => s.count), 1)

  return (
    <div className="p-6 max-w-6xl mx-auto">

        {/* ── Header + period dropdown ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Thống kê & Phân tích</h1>

          <div className="relative">
            <Listbox value={period} onChange={handleListboxChange} disabled={chartLoading}>
              {({ open }) => (
                <>
                  <ListboxButton
                    className={`w-full sm:w-auto min-w-[136px] px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 inline-flex items-center justify-between gap-2 cursor-pointer
                      ${chartLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <span className="truncate">{dropdownLabel}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </ListboxButton>

                  <ListboxOptions
                    anchor="bottom end"
                    transition
                    className="z-20 mt-2 w-44 rounded-xl border border-zinc-200 bg-white shadow-lg p-1 focus:outline-none transition duration-100 ease-out data-[closed]:opacity-0 data-[closed]:scale-95">
                    {PERIOD_OPTIONS.map(opt => (
                      <ListboxOption key={opt.value} value={opt.value}
                        className={({ focus }) => `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer select-none transition-colors ${focus ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'}`}>
                        {({ selected }) => (
                          <>
                            <span>{opt.label}</span>
                            {selected && <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />}
                          </>
                        )}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </>
              )}
            </Listbox>

            {/* Popover chọn khoảng ngày — mở khi chọn "Tùy chỉnh" trong dropdown */}
            {showCustomPopover && (
              <div ref={popoverRef}
                className="absolute right-0 top-full mt-2 z-20 w-72 bg-white border border-zinc-200 rounded-xl shadow-lg p-3">
                <label className="text-xs font-medium text-zinc-700 mb-1.5 block">Khoảng ngày</label>
                <div className="flex items-center border border-zinc-200 rounded-md h-9 bg-zinc-50 w-full hover:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-200 focus-within:border-zinc-900 transition shadow-2xs">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={handleCustomFromChange}
                    max={todayStr}
                    aria-label="Từ ngày"
                    className="grouped-field flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit-month-field]:bg-transparent [&::-webkit-datetime-edit-day-field]:bg-transparent [&::-webkit-datetime-edit-year-field]:bg-transparent [&::-webkit-datetime-edit-month-field]:text-zinc-900 [&::-webkit-datetime-edit-day-field]:text-zinc-900 [&::-webkit-datetime-edit-year-field]:text-zinc-900"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">–</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={handleCustomToChange}
                    min={customFrom || undefined}
                    max={todayStr}
                    aria-label="Đến ngày"
                    className="grouped-field flex-1 min-w-0 h-full px-2.5 text-xs bg-transparent cursor-pointer text-zinc-900 focus:outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit-month-field]:bg-transparent [&::-webkit-datetime-edit-day-field]:bg-transparent [&::-webkit-datetime-edit-year-field]:bg-transparent [&::-webkit-datetime-edit-month-field]:text-zinc-900 [&::-webkit-datetime-edit-day-field]:text-zinc-900 [&::-webkit-datetime-edit-year-field]:text-zinc-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!customFrom || !customTo}
                  className="w-full h-8 mt-2 rounded-md bg-zinc-900 text-white text-xs font-medium transition hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-900 cursor-pointer">
                  Áp dụng
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Card 1 — tổng user toàn hệ thống, KHÔNG phụ thuộc period */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
              <Users2 size={20} className="text-zinc-900" strokeWidth={2} />
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{overview.totalUsersAll}</div>
              <div className="text-xs text-zinc-500 mt-0.5 font-medium">Tổng người dùng</div>
            </div>
          </div>

          {/* Cards 2-3 — phụ thuộc period, mờ khi đang tải */}
          {[
            { label: 'Lượt thi',        value: overview.totalAttempts,       Icon: BarChart2 },
            { label: 'Band trung bình', value: formatBand(overview.avgBand), Icon: Trophy },
          ].map(c => (
            <div key={c.label}
              className={`bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4 transition-opacity ${chartLoading ? 'opacity-50' : 'opacity-100'}`}>
              <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                <c.Icon size={20} className="text-zinc-900" strokeWidth={2} />
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{c.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5 font-medium">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Area chart — lượt thi theo ngày */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
            <h2 className="font-semibold text-zinc-900 text-sm mb-4">Lượt thi</h2>

            {chartLoading ? <ChartSkeleton height={180} /> : (
              displayDays.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={displayDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={chart.lineFillFrom} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={chart.lineFillFrom} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} opacity={chart.gridOpacity} vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={chart.axis}
                      tick={{ fontSize: 10, fill: chart.axis }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke={chart.axis}
                      tick={{ fontSize: 10, fill: chart.axis }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AttemptTooltip tooltipStyle={chart.tooltip} />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={chart.line}
                      strokeWidth={2}
                      fill="url(#primaryGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: chart.line }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-zinc-300">Chưa có dữ liệu</div>
              )
            )}
          </div>

          {/* Donut chart — tỷ lệ theo kỹ năng */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
            <h2 className="font-semibold text-zinc-900 text-sm mb-4">Tỷ lệ theo kỹ năng</h2>
            {chartLoading ? (
              <div className="flex items-center gap-4">
                <ChartSkeleton height={140} />
                <div className="flex-1 space-y-3">
                  {[1,2,3,4].map(i => <ChartSkeleton key={i} height={18} />)}
                </div>
              </div>
            ) : totalSkill === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">Chưa có dữ liệu</p>
            ) : (
              <div className="flex items-center gap-5">
                {/* Donut */}
                <div className="shrink-0">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={pieData}
                      cx={70}
                      cy={70}
                      innerRadius={38}
                      outerRadius={58}
                      dataKey="count"
                      stroke="none"
                      paddingAngle={pieData.length > 1 ? 2 : 0}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.skill} fill={ADMIN_SKILL_COLORS[entry.skill].base} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip total={totalSkill} tooltipStyle={chart.tooltip} />} />
                  </PieChart>
                </div>

                {/* Total + legend */}
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-bold tabular-nums text-zinc-900 leading-tight">{totalSkill}</div>
                  <div className="text-xs text-zinc-500 mb-4 font-medium">tổng lượt thi</div>
                  <div className="space-y-2.5">
                    {skillBreakdown.map(d => (
                      <div key={d.skill} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-zinc-700">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: ADMIN_SKILL_COLORS[d.skill].base }} />
                          {SKILL_LABEL[d.skill]}
                        </span>
                        <span className="tabular-nums text-zinc-500 font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Band Score distribution — nay lọc theo period/khoảng tùy chỉnh giống các biểu đồ
            khác, nên dùng chung ChartSkeleton khi chartLoading thay vì luôn render tức thì */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs mb-6">
          <h2 className="font-semibold text-zinc-900 text-sm mb-4">Phân bố Band Score</h2>
          {chartLoading ? (
            <ChartSkeleton height={180} />
          ) : (data.bandDistribution || []).some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.bandDistribution} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} opacity={chart.gridOpacity} vertical={false} />
                <XAxis
                  dataKey="range"
                  stroke={chart.axis}
                  tick={{ fontSize: 10, fill: chart.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chart.axis}
                  tick={{ fontSize: 10, fill: chart.axis }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<BandTooltip total={bandTotal} tooltipStyle={chart.tooltip} />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data.bandDistribution || []).map((_, i) => (
                    <Cell key={i} fill={BAND_COLORS[i] ?? '#8b5cf6'} />
                  ))}
                  <LabelList dataKey="count" position="top"
                    style={{ fontSize: 10, fill: chart.axis, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-300">Chưa có dữ liệu</div>
          )}
        </div>

        {/* Skill breakdown table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 mb-4">
          <h2 className="font-semibold text-zinc-900 text-sm mb-4">Phân tích theo kỹ năng</h2>
          {chartLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <ChartSkeleton key={i} height={44} />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-zinc-500 border-b border-zinc-200 font-medium">
                    <th className="py-2 text-left">Kỹ năng</th>
                    <th className="px-4 py-2 text-right">Lượt thi</th>
                    <th className="px-4 py-2 text-right">Band TB</th>
                    <th className="px-4 py-2 text-left">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {skillBreakdown.map((s, idx) => {
                    const theme = SKILL_THEMES[s.skill] || {
                      badge: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
                      bar: 'bg-zinc-900',
                    }
                    return (
                      <tr key={s.skill}
                        className={`border-b border-zinc-100 ${idx % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                        <td className="py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${theme.badge}`}>
                            {SKILL_LABEL[s.skill]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-800 tabular-nums">{s.count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {s.avgScore != null
                            ? <span className="font-semibold text-zinc-900">
                                {formatBand(s.avgScore)}
                              </span>
                            : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden max-w-[100px]">
                              <div className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                                style={{
                                  width: `${maxSkillCount > 0 ? (s.count / maxSkillCount * 100) : 0}%`,
                                }} />
                            </div>
                            <span className="text-[11px] text-zinc-500 tabular-nums w-8">
                              {maxSkillCount > 0 ? Math.round(s.count / maxSkillCount * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top 10 users — period-sensitive */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
            <h2 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <span>Top 10 Band Score cao nhất</span>
            </h2>
            <span className="text-[11px] text-zinc-400 font-medium">Bấm vào thí sinh để xem chi tiết bài thi</span>
          </div>

          {chartLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <ChartSkeleton key={i} height={52} />)}
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => <ChartSkeleton key={i} height={52} />)}
              </div>
            </div>
          ) : topUsers.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột trái: Hạng 1 -> Hạng 5 (Top Tier) */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Trophy size={13} className="text-amber-500" />
                    <span>Top Tier (Hạng 1 – 5)</span>
                  </span>
                  <span>Điểm TB</span>
                </div>
                <div className="space-y-2">
                  {topUsers.slice(0, 5).map((u, i) => {
                    const rank = i + 1
                    let rankBadgeStyle = 'bg-zinc-100 text-zinc-600'
                    if (rank === 1) rankBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                    else if (rank === 2) rankBadgeStyle = 'bg-zinc-200 text-zinc-800 border-zinc-300 font-bold'
                    else if (rank === 3) rankBadgeStyle = 'bg-amber-50 text-amber-900 border-amber-200 font-bold'

                    return (
                      <div
                        key={u.id || rank}
                        onClick={() => handleOpenStudentDetail(u, rank)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenStudentDetail(u, rank) }}
                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0 border ${rankBadgeStyle}`}
                          >
                            {rank}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {u.attemptCount} lượt thi
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-lg shadow-2xs">
                            Band {formatBand(u.avgScore)}
                          </span>
                          <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cột phải: Hạng 6 -> Hạng 10 */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Award size={13} className="text-zinc-400" />
                    <span>Hạng 6 – 10</span>
                  </span>
                  <span>Điểm TB</span>
                </div>
                {topUsers.length > 5 ? (
                  <div className="space-y-2">
                    {topUsers.slice(5, 10).map((u, i) => {
                      const rank = i + 6
                      const rankBadgeStyle = 'bg-zinc-100 text-zinc-600'

                      return (
                        <div
                          key={u.id || rank}
                          onClick={() => handleOpenStudentDetail(u, rank)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenStudentDetail(u, rank) }}
                          className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0 border ${rankBadgeStyle}`}
                            >
                              {rank}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                {u.attemptCount} lượt thi
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-lg shadow-2xs">
                              Band {formatBand(u.avgScore)}
                            </span>
                            <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-zinc-400 italic border border-dashed border-zinc-200 rounded-xl">
                    Chưa có thêm học viên trong nhóm này
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Student Detail Modal */}
        <StudentDetailModal
          isOpen={Boolean(selectedStudent)}
          onClose={handleCloseStudentDetail}
          student={selectedStudent}
          rank={selectedRank}
          detailData={studentDetail}
          loading={loadingStudentDetail}
        />

      </div>
  )
}
