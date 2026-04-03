import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getAdminDashboard } from '../../services/adminService'
import AdminLayout from '../../components/AdminLayout'

import { roundIELTS, formatBand } from '../../utils/ielts'

const SKILL_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const SKILL_COLOR = { reading: 'bg-blue-500', listening: 'bg-green-500', writing: 'bg-purple-500', speaking: 'bg-orange-500' }

function BarChart({ data, labelKey, valueKey, color = '#1a56db' }) {
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

function LineChart({ data, labelKey, valueKey, color = '#1a56db' }) {
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

function getRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role) return user.role
    const token = localStorage.getItem('token')
    if (token) return JSON.parse(atob(token.split('.')[1])).role || 'user'
  } catch {}
  return 'user'
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartRange, setChartRange] = useState(30)
  const navigate = useNavigate()
  const location = useLocation()
  const role = getRole()
  const forbidden = location.state?.forbidden

  useEffect(() => {
    getAdminDashboard()
      .then(data => setData(data))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  if (!data) return <AdminLayout><div className="p-8 text-gray-400">Không thể tải dữ liệu.</div></AdminLayout>

  const { stats, attemptsByDay, bandDistribution, skillDistribution, recentAttempts, registrationsByDay, systemLogs, systemHealth } = data
  const displayDays = attemptsByDay.slice(-chartRange)
  const totalSkill = skillDistribution.reduce((s, d) => s + d.count, 0)

  // Admin: nhấn mạnh số liệu hệ thống
  const adminCards = [
    { label: 'Tổng người dùng',    value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: 'text-[#1a56db]',  bg: 'bg-blue-50' },
    { label: 'Tổng đề thi',        value: stats.totalExams,          sub: 'Đề đang có',                color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Lượt thi hôm nay',   value: stats.attemptsToday,       sub: 'Hôm nay',                   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Band TB hệ thống',   value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',          color: 'text-purple-600', bg: 'bg-purple-50' },
  ]
  // Teacher: nhấn mạnh số liệu học tập
  const teacherCards = [
    { label: 'Lượt thi hôm nay',   value: stats.attemptsToday,       sub: 'Hôm nay',                   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Band TB hệ thống',   value: formatBand(stats.avgBand), sub: 'Toàn bộ lượt thi',          color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Tổng đề thi',        value: stats.totalExams,          sub: 'Đề đang có',                color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Tổng học viên',      value: stats.totalUsers,          sub: stats.usersThisMonth > 0 ? `+${stats.usersThisMonth} tháng này` : 'Tháng này chưa có', color: 'text-[#1a56db]',  bg: 'bg-blue-50' },
  ]
  const statCards = role === 'admin' ? adminCards : teacherCards

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Thông báo forbidden */}
        {forbidden && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
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
                <h2 className="font-bold text-[#002D5B] text-base">Tăng trưởng người dùng (30 ngày)</h2>
                <span className="text-xs font-bold text-[#0066FF] bg-blue-50 px-2 py-1 rounded-lg">+{stats.usersThisMonth} mới</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Số lượng đăng ký tài khoản mới theo thời gian</p>
              {registrationsByDay ? (
                <LineChart 
                  data={registrationsByDay} 
                  labelKey="date" 
                  valueKey="count" 
                  color="#0066FF" 
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-300 text-xs italic">Đang tải dữ liệu...</div>
              )}
              <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] text-gray-400 font-medium">{registrationsByDay?.[0]?.date}</span>
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
                    <div className={`h-full rounded-full transition-all duration-500 ${ (systemHealth?.aiLimit || 0) > 80 ? 'bg-red-500' : 'bg-orange-500' }`} 
                         style={{ width: `${systemHealth?.aiLimit || 0}%` }} />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-50 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${(systemHealth?.serverMemory || 0) < 90 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`text-xs font-bold ${(systemHealth?.serverMemory || 0) < 90 ? 'bg-green-500' : 'bg-red-500'}`}>
                    {(systemHealth?.serverMemory || 0) < 90 ? 'Mọi hệ thống hoạt động bình thường' : 'Hệ thống đang quá tải'}
                  </span>
                </div>
              </div>
            </div>

            {/* System Logs */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-bold text-[#002D5B] text-base">Nhật ký hệ thống (Gần nhất)</h2>
                <button className="text-xs font-bold text-[#0066FF] hover:underline">Xem log chi tiết →</button>
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
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${log.status === 'Thành công' || log.status === 'Hoàn tất' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
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

        {/* Charts — chỉ hiện cho teacher */}
        {role === 'teacher' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800 text-sm">Lượt thi theo ngày</h2>
                  <div className="flex gap-1">
                    {[7, 30].map(d => (
                      <button key={d} onClick={() => setChartRange(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${chartRange === d ? 'bg-[#1a56db] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {d}N
                      </button>
                    ))}
                  </div>
                </div>
                <BarChart data={displayDays} labelKey="date" valueKey="count" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{displayDays[0]?.date?.slice(5)}</span>
                  <span className="text-[10px] text-gray-400">{displayDays[displayDays.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm mb-4">Tỷ lệ theo kỹ năng</h2>
                {totalSkill === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-3">
                    {skillDistribution.map(d => (
                      <div key={d.skill}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{SKILL_LABEL[d.skill]}</span>
                          <span className="text-gray-400">{d.count} ({totalSkill > 0 ? Math.round(d.count / totalSkill * 100) : 0}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${SKILL_COLOR[d.skill]}`}
                            style={{ width: `${totalSkill > 0 ? (d.count / totalSkill * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 text-sm mb-4">Phân bố Band Score</h2>
              <BarChart data={bandDistribution} labelKey="range" valueKey="count" color="#7c3aed" />
              <div className="flex justify-between mt-2">
                {bandDistribution.map(d => (
                  <span key={d.range} className="text-[10px] text-gray-400 flex-1 text-center">{d.range}</span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Hoạt động gần đây</h2>
                <button onClick={() => navigate('/admin/attempts')}
                  className="text-xs text-[#1a56db] font-medium hover:underline">
                  Xem tất cả →
                </button>
              </div>
              {recentAttempts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Chưa có lượt thi nào</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="px-5 py-3 text-left font-medium">Người dùng</th>
                        <th className="px-4 py-3 text-left font-medium">Kỹ năng</th>
                        <th className="px-4 py-3 text-left font-medium">Đề thi</th>
                        <th className="px-4 py-3 text-left font-medium">Band</th>
                        <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttempts.map(a => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-800">{a.user?.name}</p>
                            <p className="text-xs text-gray-400">{a.user?.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {SKILL_LABEL[a.exam?.skill]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{a.exam?.title}</td>
                          <td className="px-4 py-3">
                            {a.score != null ? (
                              <span className={`font-bold ${a.score >= 7 ? 'text-green-600' : a.score >= 5 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {a.score.toFixed(1)}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
