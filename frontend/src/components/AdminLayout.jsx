import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTrashCount } from '../services/adminService'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  FileText,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  History,
  Trash2,
  Sliders,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ALL = [
  { to: '/admin',           label: 'Dashboard',       icon: LayoutDashboard, end: true,  roles: ['admin', 'teacher'] },
  // Admin
  { to: '/admin/users',     label: 'Người dùng',       icon: Users,           roles: ['admin'] },
  { to: '/admin/accounts',  label: 'Quản lý nhân sự',  icon: UserCheck,       roles: ['admin'] },
  { to: '/admin/series',    label: 'Quản lý bộ đề',    icon: FolderKanban,    roles: ['admin'] },
  // Staff / Teacher / Admin
  { to: '/admin/exams/cambridge',     label: 'Quản lý đề thi',    icon: FileText,   roles: ['admin', 'teacher'], isExam: true },
  { to: '/admin/reading-practice',   label: 'Reading Practice',  icon: BookOpen,   roles: ['teacher'] },
  { to: '/admin/listening-practice', label: 'Listening Practice',icon: Headphones, roles: ['teacher'] },
  { to: '/admin/writing-samples',    label: 'Writing Samples',   icon: PenTool,    roles: ['teacher'] },
  { to: '/admin/speaking-samples',   label: 'Speaking Samples',  icon: Mic,        roles: ['teacher'] },
  { to: '/admin/attempts',           label: 'Lịch sử thi',       icon: History,    roles: ['admin', 'teacher'] },
  { to: '/admin/trash',              label: 'Đã xóa',             icon: Trash2,     roles: ['admin', 'teacher'], trash: true },
  // Both
  { to: '/admin/settings',  label: 'Hệ thống',          icon: Sliders,     roles: ['admin'] },
  { to: '/admin/profile',   label: 'Cài đặt',           icon: Settings,    roles: ['admin', 'teacher'] },
]

const navCls = (isActive) =>
  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
    isActive
      ? 'bg-blue-50/80 text-blue-600 font-semibold'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, handleLogout: authLogout } = useAuth()
  const NAV = NAV_ALL.filter(item => item.roles.includes(role))
  const [showLogout, setShowLogout] = useState(false)
  const [trashCount, setTrashCount] = useState(0)

  useEffect(() => {
    if (role !== 'teacher' && role !== 'admin') return
    const CACHE_KEY = '__trashCount__'
    const CACHE_TTL = 5 * 60 * 1000
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { count, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) {
          setTrashCount(count)
          return
        }
      }
    } catch {}
    getTrashCount()
      .then(count => {
        setTrashCount(count)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, ts: Date.now() }))
      })
      .catch(() => {})
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
            <div className="w-8 h-8 bg-[#1D4ED8] rounded-lg flex items-center justify-center">
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
          {NAV.map(item => {
            const IconComp = item.icon
            const isExamMenu = item.isExam || item.to.startsWith('/admin/exams')
            const isActive = isExamMenu
              ? location.pathname.startsWith('/admin/exams')
              : (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))

            return (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={item.end}
                className={navCls(isActive)}
              >
                <IconComp
                  size={20}
                  strokeWidth={1.75}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {item.trash && trashCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white leading-none">
                    {trashCount}
                  </span>
                )}
              </NavLink>
            )
          })}
          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition group"
          >
            <LogOut
              size={20}
              strokeWidth={1.75}
              className="shrink-0 text-slate-400 group-hover:text-red-600 transition-colors"
            />
            <span>Đăng xuất</span>
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {children}
      </main>

      {/* Logout dialog */}
      {showLogout && (
        <div
          onClick={() => setShowLogout(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </div>
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
                className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition"
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
