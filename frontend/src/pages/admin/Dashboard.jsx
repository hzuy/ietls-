import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { getAdminDashboard } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { Users, ClipboardList, Activity, Star } from 'lucide-react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { formatBand } from '../../utils/ielts'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,.06)',
  fontSize: 12,
  padding: '8px 12px',
}

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-zinc-900 mb-0.5">{label}</p>
      <p className="text-zinc-600 font-medium">{payload[0].value} người đăng ký</p>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userGrowthRange, setUserGrowthRange] = useState(30)
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const forbidden = location.state?.forbidden

  useEffect(() => {
    getAdminDashboard()
      .then(data => setData(data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  const growthData = useMemo(
    () => (data?.registrationsByDay || []).slice(-userGrowthRange).map(d => ({
      ...d,
      label: d.date?.slice(5),
    })),
    [data?.registrationsByDay, userGrowthRange]
  )

  const totalSkill = useMemo(
    () => (data?.skillDistribution || []).reduce((s, d) => s + d.count, 0),
    [data?.skillDistribution]
  )

  const orderedSkills = useMemo(
    () => SKILL_ORDER.map(sk => (data?.skillDistribution || []).find(s => s.skill === sk)).filter(Boolean),
    [data?.skillDistribution]
  )

  if (loading) return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-zinc-100 rounded-2xl mb-4 animate-pulse" />
        ))}
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-zinc-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { stats, attemptsByDay, bandDistribution, skillDistribution, recentAttempts, systemLogs, systemHealth } = data

  // Admin / Teacher stat cards
  const adminCards = [
    { label: 'Tổng người dùng',  value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', Icon: Users },
    { label: 'Tổng đề thi',      value: stats.totalExams,          sub: 'Đề đang có',             Icon: ClipboardList },
    { label: 'Lượt thi hôm nay', value: stats.attemptsToday,       sub: 'Hôm nay',                Icon: Activity },
    { label: 'Band TB hệ thống', value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',       Icon: Star },
  ]
  const teacherCards = [
    { label: 'Lượt thi hôm nay', value: stats.attemptsToday,       sub: 'Hôm nay',                Icon: Activity },
    { label: 'Band TB hệ thống', value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',       Icon: Star },
    { label: 'Tổng đề thi',      value: stats.totalExams,          sub: 'Đề đang có',             Icon: ClipboardList },
    { label: 'Tổng học viên',    value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', Icon: Users },
  ]
  const statCards = role === 'admin' ? adminCards : teacherCards

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {forbidden && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-zinc-100 border border-zinc-200 text-sm text-zinc-800 font-medium">
            Bạn không có quyền truy cập trang đó.
          </div>
        )}

        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight mb-6">Dashboard</h1>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(c => (
            <div key={c.label} className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                <c.Icon size={18} className="text-zinc-900" strokeWidth={2} />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums leading-tight text-zinc-900">{c.value}</div>
                <div className="text-xs font-medium text-zinc-700 mt-0.5">{c.label}</div>
                <div className="text-[11px] text-zinc-400">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Admin-only sections ── */}
        {role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            {/* Area chart — user growth */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-zinc-900">Tăng trưởng người dùng</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {[7, 30].map(d => (
                      <button key={d} onClick={() => setUserGrowthRange(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shadow-2xs
                          ${userGrowthRange === d ? 'bg-zinc-900 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                        {d}N
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-800 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-lg">
                    +{stats.usersThisMonth} mới
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Số lượng đăng ký tài khoản mới theo thời gian</p>

              {growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#18181b" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<GrowthTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#18181b"
                      strokeWidth={2}
                      fill="url(#growthGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#18181b' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-300 text-xs italic">Đang tải dữ liệu...</div>
              )}
            </div>

            {/* System health */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs">
              <h2 className="text-sm font-semibold text-zinc-900 mb-6">Sức khỏe hệ thống</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-zinc-600 uppercase tracking-wider text-[11px]">Dung lượng Server</span>
                    <span className="text-zinc-900 font-semibold">{systemHealth?.serverMemory || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                         style={{ width: `${systemHealth?.serverMemory || 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-zinc-600 uppercase tracking-wider text-[11px]">API AI (LLM) Limit</span>
                    <span className="text-zinc-900 font-semibold">{systemHealth?.aiLimit || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 bg-zinc-700"
                         style={{ width: `${systemHealth?.aiLimit || 0}%` }} />
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-100 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-zinc-900" />
                  <span className="text-xs font-medium text-zinc-700">
                    {(systemHealth?.serverMemory || 0) < 90 ? 'Mọi hệ thống hoạt động bình thường' : 'Hệ thống đang quá tải'}
                  </span>
                </div>
              </div>
            </div>

            {/* System logs */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-zinc-900">Nhật ký hệ thống (Gần nhất)</h2>
                <button onClick={() => navigate('/admin/attempts')}
                  className="text-xs font-medium text-zinc-900 hover:underline">Xem log chi tiết →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-50 border-b border-zinc-200">
                      <th className="px-6 py-3 text-left font-semibold">Thời gian</th>
                      <th className="px-6 py-3 text-left font-semibold">Người thực hiện</th>
                      <th className="px-6 py-3 text-left font-semibold">Hành động</th>
                      <th className="px-6 py-3 text-left font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(systemLogs || []).map((log, i) => (
                      <tr key={i} className={`transition-colors hover:bg-zinc-50 ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                        <td className="px-6 py-4 text-xs font-medium text-zinc-500">{log.time}</td>
                        <td className="px-6 py-4 font-semibold text-zinc-900 text-xs">{log.user}</td>
                        <td className="px-6 py-4 text-xs text-zinc-600">{log.action}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!systemLogs || systemLogs.length === 0) && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-zinc-400 text-xs italic">Chưa có nhật ký hoạt động</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Teacher — link to Analytics */}
        {role === 'teacher' && (
          <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
            <span>📈 Xem biểu đồ phân tích chi tiết tại</span>
            <Link to="/admin/analytics" className="text-zinc-900 font-medium hover:underline">
              Thống kê & Phân tích →
            </Link>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
