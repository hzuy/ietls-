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

import { roundIELTS, formatBand } from '../../utils/ielts'
import { ADMIN_SKILL_COLORS, SKILL_LABEL, SKILL_ORDER } from '../../utils/adminSkillColors'

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  boxShadow: '0 4px 12px rgba(0,0,0,.08)',
  fontSize: 12,
  padding: '8px 12px',
}

function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle}>
      <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
      <p style={{ color: '#0066FF' }}>{payload[0].value} người đăng ký</p>
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

  if (loading) return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 120, background: '#f3f4f6',
            borderRadius: 12, marginBottom: 16,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        `}</style>
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { stats, attemptsByDay, bandDistribution, skillDistribution, recentAttempts, registrationsByDay, systemLogs, systemHealth } = data

  const growthData = useMemo(
    () => (registrationsByDay || []).slice(-userGrowthRange).map(d => ({
      ...d,
      label: d.date?.slice(5),
    })),
    [registrationsByDay, userGrowthRange]
  )

  const totalSkill = useMemo(
    () => (skillDistribution || []).reduce((s, d) => s + d.count, 0),
    [skillDistribution]
  )

  const orderedSkills = useMemo(
    () => SKILL_ORDER.map(sk => (skillDistribution || []).find(s => s.skill === sk)).filter(Boolean),
    [skillDistribution]
  )

  // Admin / Teacher stat cards
  const adminCards = [
    { label: 'Tổng người dùng',  value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: '#2563EB', bg: '#EFF6FF', Icon: Users },
    { label: 'Tổng đề thi',      value: stats.totalExams,          sub: 'Đề đang có',             color: '#EA580C', bg: '#FFF7ED', Icon: ClipboardList },
    { label: 'Lượt thi hôm nay', value: stats.attemptsToday,       sub: 'Hôm nay',                color: '#16a34a', bg: '#f0fdf4', Icon: Activity },
    { label: 'Band TB hệ thống', value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',       color: '#7C3AED', bg: '#f5f3ff', Icon: Star },
  ]
  const teacherCards = [
    { label: 'Lượt thi hôm nay', value: stats.attemptsToday,       sub: 'Hôm nay',                color: '#16a34a', bg: '#f0fdf4', Icon: Activity },
    { label: 'Band TB hệ thống', value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',       color: '#7C3AED', bg: '#f5f3ff', Icon: Star },
    { label: 'Tổng đề thi',      value: stats.totalExams,          sub: 'Đề đang có',             color: '#EA580C', bg: '#FFF7ED', Icon: ClipboardList },
    { label: 'Tổng học viên',    value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: '#2563EB', bg: '#EFF6FF', Icon: Users },
  ]
  const statCards = role === 'admin' ? adminCards : teacherCards

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {forbidden && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium">
            Bạn không có quyền truy cập trang đó.
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(c => (
            <div key={c.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: c.bg }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: c.color + '20' }}>
                <c.Icon size={18} style={{ color: c.color }} strokeWidth={2} />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: c.color }}>{c.value}</div>
                <div className="text-xs font-semibold text-gray-700 mt-0.5">{c.label}</div>
                <div className="text-[10px] text-gray-400">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Admin-only sections ── */}
        {role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            {/* Area chart — user growth */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-[#002D5B] text-base">Tăng trưởng người dùng</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[7, 30].map(d => (
                      <button key={d} onClick={() => setUserGrowthRange(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition
                          ${userGrowthRange === d ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {d}N
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-[#0066FF] bg-blue-50 px-2 py-1 rounded-lg">
                    +{stats.usersThisMonth} mới
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Số lượng đăng ký tài khoản mới theo thời gian</p>

              {growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0066FF" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<GrowthTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#0066FF"
                      strokeWidth={2}
                      fill="url(#growthGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#0066FF' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-300 text-xs italic">Đang tải dữ liệu...</div>
              )}
            </div>

            {/* System health */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-[#002D5B] text-base mb-6">Sức khỏe hệ thống</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600 uppercase tracking-wider">Dung lượng Server</span>
                    <span className="text-[#002D5B]">{systemHealth?.serverMemory || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0066FF] rounded-full transition-all duration-500"
                         style={{ width: `${systemHealth?.serverMemory || 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600 uppercase tracking-wider">API AI (LLM) Limit</span>
                    <span className="text-[#002D5B]">{systemHealth?.aiLimit || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${(systemHealth?.aiLimit || 0) > 80 ? 'bg-blue-500' : 'bg-orange-500'}`}
                         style={{ width: `${systemHealth?.aiLimit || 0}%` }} />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-50 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${(systemHealth?.serverMemory || 0) < 90 ? 'bg-green-500' : 'bg-blue-500'}`} />
                  <span className={`text-xs font-bold ${(systemHealth?.serverMemory || 0) < 90 ? 'text-green-600' : 'text-red-500'}`}>
                    {(systemHealth?.serverMemory || 0) < 90 ? 'Mọi hệ thống hoạt động bình thường' : 'Hệ thống đang quá tải'}
                  </span>
                </div>
              </div>
            </div>

            {/* System logs */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-bold text-[#002D5B] text-base">Nhật ký hệ thống (Gần nhất)</h2>
                <button onClick={() => navigate('/admin/attempts')}
                  className="text-xs font-bold text-[#0066FF] hover:underline">Xem log chi tiết →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50/30">
                      <th className="px-6 py-3 text-left font-bold">Thời gian</th>
                      <th className="px-6 py-3 text-left font-bold">Người thực hiện</th>
                      <th className="px-6 py-3 text-left font-bold">Hành động</th>
                      <th className="px-6 py-3 text-left font-bold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(systemLogs || []).map((log, i) => (
                      <tr key={i} className={`transition-colors hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">{log.time}</td>
                        <td className="px-6 py-4 font-bold text-[#002D5B] text-xs">{log.user}</td>
                        <td className="px-6 py-4 text-xs text-gray-600">{log.action}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold
                            ${log.status === 'Thành công' || log.status === 'Hoàn tất'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-blue-50 text-blue-600'}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!systemLogs || systemLogs.length === 0) && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 text-xs italic">Chưa có nhật ký hoạt động</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Teacher — link to Analytics */}
        {role === 'teacher' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <span>📈 Xem biểu đồ phân tích chi tiết tại</span>
            <Link to="/admin/analytics" className="text-[#1D4ED8] font-semibold hover:underline">
              Thống kê & Phân tích →
            </Link>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
