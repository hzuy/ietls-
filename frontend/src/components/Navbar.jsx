import { useNavigate, useLocation } from 'react-router-dom'

const navLinks = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Full Test', path: '/full-test' },
  { label: 'Reading', path: '/reading' },
  { label: 'Listening', path: '/listening' },
  { label: 'Writing', path: '/writing' },
  { label: 'Speaking', path: '/speaking' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <header style={{ background: '#1e3a5f', borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: '#1a56db' }}
          >
            I
          </div>
          <span className="font-bold text-lg" style={{ color: '#ffffff' }}>
            IELTS<span style={{ color: '#93c5fd' }}>Pro</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const active = location.pathname === link.path
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="px-4 py-2 rounded-lg text-sm font-600 transition-all"
                style={{
                  color: active ? '#ffffff' : '#94a3b8',
                  backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  fontWeight: active ? 700 : 600,
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {link.label}
              </button>
            )
          })}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: '#1a56db' }}
            >
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-semibold" style={{ color: '#ffffff' }}>
              {user.name}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  )
}
