import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { getAdminDashboard } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../context/AuthContext'


import { roundIELTS, formatBand } from '../../utils/ielts'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const SKILL_COLOR = { reading: 'bg-blue-500', listening: 'bg-green-500', writing: 'bg-purple-500', speaking: 'bg-orange-500' }

function BarChart({ data, labelKey, valueKey, color = '#1D4ED8' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full rounded-t" style={{ height: `${(d[valueKey] / max) * 100}%`, background: color, minHeight: d[valueKey] > 0 ? 2 : 0 }} />
          {data.length <= 10 && (
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d[labelKey]}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function LineChart({ data, labelKey, valueKey, color = '#1D4ED8' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - (d[valueKey] / max) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="relative h-32 w-full mt-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={(i / (data.length - 1)) * 100}
            cy={100 - (d[valueKey] / max) * 100}
            r="1.5"
            fill="white"
            stroke={color}
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartRange, setChartRange] = useState(30)
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
        {[1,2,3].map(i => (
          <div key={i} style={{
            height: 120, background: '#f3f4f6',
            borderRadius: 12, marginBottom: 16,
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { stats, attemptsByDay, bandDistribution, skillDistribution, recentAttempts, registrationsByDay, systemLogs, systemHealth } = data
  const displayDays = useMemo(() => attemptsByDay.slice(-chartRange), [attemptsByDay, chartRange])
  const totalSkill = useMemo(() => skillDistribution.reduce((s, d) => s + d.count, 0), [skillDistribution])

  // Admin: nhấn mạnh số liệu hệ thống
  const adminCards = [
    { label: 'Tổng người dùng',    value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: 'text-[#1D4ED8]',  bg: 'bg-blue-50' },
    { label: 'Tổng đề thi',        value: stats.totalExams,          sub: 'Đề đang có',                color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Lượt thi hôm nay',   value: stats.attemptsToday,       sub: 'Hôm nay',                   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Band TB hệ thống',   value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',          color: 'text-purple-600', bg: 'bg-purple-50' },
  ]
  // Teacher: nhấn mạnh số liệu học tập
  const teacherCards = [
    { label: 'Lượt thi hôm nay',   value: stats.attemptsToday,       sub: 'Hôm nay',                   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Band TB hệ thống',   value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',          color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Tổng đề thi',        value: stats.totalExams,          sub: 'Đề đang có',                color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Tổng học viên',      value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: 'text-[#1D4ED8]',  bg: 'bg-blue-50' },
  ]
  const statCards = role === 'admin' ? adminCards : teacherCards

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Thông báo forbidden */}
        {forbidden && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium">
            Bạn không có quyền truy cập trang đó.
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-sm font-semibold text-gray-700 mt-1">{c.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Admin Specific Sections */}
        {role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* User Growth (Line Chart) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-[#002D5B] text-base">Tăng trưởng người dùng</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[7, 30].map(d => (
                      <button key={d} onClick={() => setUserGrowthRange(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${userGrowthRange === d ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {d}N
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-[#0066FF] bg-blue-50 px-2 py-1 rounded-lg">+{stats.usersThisMonth} mới</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Số lượng đăng ký tài khoản mới theo thời gian</p>
              {registrationsByDay ? (
                <LineChart
                  data={registrationsByDay.slice(-userGrowthRange)}
                  labelKey="date"
                  valueKey="count"
                  color="#0066FF"
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-300 text-xs italic">Đang tải dữ liệu...</div>
              )}
              <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] text-gray-400 font-medium">{registrationsByDay?.slice(-userGrowthRange)?.[0]?.date}</span>
                <span className="text-[10px] text-gray-400 font-medium">Hôm nay</span>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-[#002D5B] text-base mb-6">Sức khỏe hệ thống</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600 uppercase tracking-wider">Dung lượng Server</span>
                    <span className="text-[#002D5B]">{systemHealth?.serverMemory || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0066FF] rounded-full transition-all duration-500" style={{ width: `${systemHealth?.serverMemory || 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600 uppercase tracking-wider">API AI (LLM) Limit</span>
                    <span className="text-[#002D5B]">{systemHealth?.aiLimit || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${ (systemHealth?.aiLimit || 0) > 80 ? 'bg-blue-500' : 'bg-orange-500' }`} 
                         style={{ width: `${systemHealth?.aiLimit || 0}%` }} />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-50 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${(systemHealth?.serverMemory || 0) < 90 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <span className={`text-xs font-bold ${(systemHealth?.serverMemory || 0) < 90 ? 'text-green-600' : 'text-red-500'}`}>
                    {(systemHealth?.serverMemory || 0) < 90 ? 'Mọi hệ thống hoạt động bình thường' : 'Hệ thống đang quá tải'}
                  </span>
                </div>
              </div>
            </div>

            {/* System Logs */}
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
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">{log.time}</td>
                        <td className="px-6 py-4 font-bold text-[#002D5B] text-xs">{log.user}</td>
                        <td className="px-6 py-4 text-xs text-gray-600">{log.action}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${log.status === 'Thành công' || log.status === 'Hoàn tất' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
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

        {/* BUG-19: Teacher charts moved to Analytics — show link */}
        {role === 'teacher' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <span>📈 Xem biểu đồ phân tích chi tiết tại</span>
            <Link to="/admin/analytics" className="text-[#1D4ED8] font-semibold hover:underline">Thống kê &amp; Phân tích →</Link>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
