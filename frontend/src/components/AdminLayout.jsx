import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTrashCount } from '../services/adminService'

const NAV_ALL = [
  { to: '/admin',           label: 'Dashboard',       icon: '📊', end: true,  roles: ['admin', 'teacher'] },
  // Admin
  { to: '/admin/users',     label: 'Người dùng',       icon: '👥', roles: ['admin'] },
  { to: '/admin/accounts',  label: 'Quản lý nhân sự',  icon: '🔑', roles: ['admin'] },
  { to: '/admin/series', label: 'Quản lý bộ đề', icon: '🗂️', roles: ['admin'] },
  // Teacher
  { to: '/admin/exams',              label: 'Quản lý đề thi',    icon: '📚', roles: ['teacher'] },
  { to: '/admin/reading-practice',   label: 'Reading Practice',  icon: '📖', roles: ['teacher'] },
  { to: '/admin/listening-practice', label: 'Listening Practice',icon: '🎧', roles: ['teacher'] },
  { to: '/admin/writing-samples',    label: 'Writing Samples',   icon: '✍️', roles: ['teacher'] },
  { to: '/admin/speaking-samples',   label: 'Speaking Samples',  icon: '🎤', roles: ['teacher'] },
  { to: '/admin/attempts',           label: 'Lịch sử thi',       icon: '📋', roles: ['teacher'] },
  { to: '/admin/analytics',          label: 'Thống kê',           icon: '📈', roles: ['teacher'] },
  { to: '/admin/trash',              label: 'Đã xóa',             icon: '🗑️', roles: ['teacher'], trash: true },
  // Both
  { to: '/admin/settings',  label: 'Hệ thống',          icon: '⚙️', roles: ['admin'] },
  { to: '/admin/profile',   label: 'Cài đặt',           icon: '🔧', roles: ['admin', 'teacher'] },
]

function getRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role) return user.role
    const token = localStorage.getItem('token')
    if (token) return JSON.parse(atob(token.split('.')[1])).role || 'user'
  } catch {}
  return 'user'
}

const navCls = (isActive) =>
  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
    isActive
      ? 'bg-[#1a56db] text-white shadow-sm'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
  }`

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const { handleLogout: authLogout } = useAuth()
  const role = getRole()
  const NAV = NAV_ALL.filter(item => item.roles.includes(role))
  const [showLogout, setShowLogout] = useState(false)
  const [trashCount, setTrashCount] = useState(0)

  useEffect(() => {
    if (role !== 'teacher' && role !== 'admin') return
    getTrashCount().then(count => setTrashCount(count)).catch(() => {})
  }, [])

  const handleLogout = () => {
    authLogout()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-['Nunito',sans-serif]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a56db] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Admin Panel</p>
              <p className="text-[10px] text-gray-400">IELTS Management</p>
            </div>
          </div>
        </div>

        {/* Nav — all items flat, no groups */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navCls(isActive)}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.trash && trashCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">{trashCount}</span>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <span className="text-base">🚪</span>
            <span>Đăng xuất</span>
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>

      {/* Logout dialog */}
      {showLogout && (
        <div
          onClick={() => setShowLogout(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🚪</div>
              <h3 className="font-bold text-gray-800 text-base">Đăng xuất</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Bạn có chắc muốn đăng xuất không?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogout(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
