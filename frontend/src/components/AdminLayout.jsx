import { Suspense, useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFormDirty } from '../context/FormDirtyContext'
import { NAV_LEAVE_MSG } from '../hooks/useUnsavedChanges'
import { getTrashCount, onTrashChanged } from '../services/adminService'
import {
  LayoutDashboard,
  Users,
  UserCheck,
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

// Single source of truth for every sidebar entry (nav links + logout).
const navCls = (isActive) =>
  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
    isActive
      ? 'bg-blue-50/80 text-blue-600 font-semibold'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

const navIconCls = (isActive) =>
  `shrink-0 transition-colors ${
    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
  }`

// Fallback riêng cho vùng nội dung — CHỈ thay phần trong <main>, không đụng
// sidebar/header. Suspense đặt ở đây (thay vì 1 Suspense duy nhất bọc toàn bộ
// <Routes> ở App.jsx) để lần đầu vào 1 mục admin chưa cache chunk, sidebar vẫn
// đứng yên, chỉ vùng nội dung hiện spinner.
function AdminContentLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, handleLogout: authLogout } = useAuth()
  const isDirty = useFormDirty()
  const NAV = NAV_ALL.filter(item => item.roles.includes(role))

  // Chặn điều hướng in-app khi form đang dở: trả false nếu người dùng chọn ở lại.
  const confirmLeave = () => !isDirty || window.confirm(NAV_LEAVE_MSG)
  const [showLogout, setShowLogout] = useState(false)
  const [trashCount, setTrashCount] = useState(0)

  const isStaff = role === 'teacher' || role === 'admin'

  const refreshTrashCount = useCallback((force = false) => {
    if (!isStaff) return
    getTrashCount({ force })
      .then(setTrashCount)
      .catch(() => {})
  }, [isStaff])

  // Initial load (cache-aware) + live sync: any restore / permanent-delete / purge /
  // soft-delete elsewhere fires notifyTrashChanged() → refetch a fresh count now.
  useEffect(() => {
    refreshTrashCount()
    const unsubscribe = onTrashChanged(() => refreshTrashCount(true))
    return unsubscribe
  }, [refreshTrashCount])

  const handleLogout = () => {
    authLogout()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1D4ED8] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Admin Panel</p>
              <p className="text-xs text-slate-500">IELTS Management</p>
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
                onClick={(e) => { if (!isActive && !confirmLeave()) e.preventDefault() }}
                className={navCls(isActive)}
              >
                <IconComp
                  size={20}
                  strokeWidth={2}
                  className={navIconCls(isActive)}
                />
                <span className="flex-1">{item.label}</span>
                {item.trash && trashCount > 0 && (
                  <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white leading-none">
                    {trashCount}
                  </span>
                )}
              </NavLink>
            )
          })}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); if (confirmLeave()) setShowLogout(true) }}
            role="button"
            tabIndex={0}
            className={navCls(false)}
          >
            <LogOut
              size={18}
              strokeWidth={2}
              className={navIconCls(false)}
            />
            <span className="flex-1">Đăng xuất</span>
          </a>
        </nav>
      </aside>

      {/* Main content — route con render qua <Outlet/>, Suspense riêng chỉ bọc vùng này */}
      <main className="admin-main flex-1 min-w-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <Suspense fallback={<AdminContentLoader />}>
          <Outlet />
        </Suspense>
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
