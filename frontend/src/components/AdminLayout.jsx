import { NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/admin',          label: 'Dashboard',       icon: '📊', end: true },
  { to: '/admin/exams',    label: 'Quản lý đề thi',  icon: '📚' },
  { to: '/admin/users',    label: 'Người dùng',       icon: '👥' },
  { to: '/admin/attempts', label: 'Lịch sử thi',      icon: '📋' },
  { to: '/admin/analytics',label: 'Thống kê',          icon: '📈' },
  { to: '/admin/accounts', label: 'Tài khoản',         icon: '🔑' },
  { to: '/admin/settings', label: 'Cài đặt',           icon: '⚙️' },
]

export default function AdminLayout({ children }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex font-['Nunito',sans-serif]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0 sticky top-0 h-screen">
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

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#1a56db] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
          >
            <span>←</span>
            <span>Về trang chủ</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
