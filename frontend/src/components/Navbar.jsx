import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NavDropdown from './nav/NavDropdown'
import LogoutConfirmModal from './nav/LogoutConfirmModal'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')

function NavBtn({ children, active, onClick, hasDropdown }) {
  return (
    <button
      onClick={onClick}
      className={`nav-item flex items-center gap-1 border-none tracking-[0.01em] text-[14px] whitespace-nowrap shrink-0 px-3 py-1.5 rounded-xl ${active ? 'active' : 'bg-transparent text-slate-600'}`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <span className="whitespace-nowrap">{children}</span>
      {hasDropdown && (
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-70 mt-[1px] shrink-0">
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      )}
    </button>
  )
}

function CustomDropItem({ to, icon, label, bold, active }) {
  return (
    <Link to={to} className="block no-underline">
      <div
        className={`flex items-center gap-2.5 px-4 py-2 text-[14px] transition-colors duration-300 whitespace-nowrap rounded-md mx-1 cursor-pointer ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-transparent text-slate-700 hover:bg-slate-50 hover:text-blue-600'} ${bold ? 'font-semibold' : ''}`}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {icon && <span className="text-[15px]">{icon}</span>}
        <span>{label}</span>
      </div>
    </Link>
  )
}

function NavDivider() {
  return <div style={{ height: 1, background: '#E2E8F0', margin: '4px 8px' }} />
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, openAuthModal, handleLogout } = useAuth()
  const isLoggedIn = !!user?.name

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [announcement, setAnnouncement] = useState(() => sessionStorage.getItem('__announcement__') || '')
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)

  const closeTimer = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpenDropdown(null)
  }, [location.pathname])

  const openMenu = (name) => { clearTimeout(closeTimer.current); setOpenDropdown(name) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setOpenDropdown(null), 150) }

  const isFullTestActive =
    location.pathname.startsWith('/full-test') ||
    location.pathname === '/cambridge' ||
    location.pathname === '/practice-plus'

  const isCoursesActive = location.pathname.startsWith('/courses')

  return (
    <>
      {/* BUG-25: System announcement banner */}
      {announcement && !announcementDismissed && (
        <div style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 60 }}>
          <span style={{ fontSize: 13, color: '#92400e', fontFamily: 'var(--font-body)', lineHeight: 1.5, textAlign: 'center' }}>📢 {announcement}</span>
          <button onClick={() => setAnnouncementDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 16, padding: '0 4px', lineHeight: 1, opacity: 0.7 }} title="Đóng">✕</button>
        </div>
      )}
      <header className={`w-full sticky top-0 z-50 h-16 border-b border-slate-200 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-[0_4px_12px_rgba(15,23,42,0.05)]' : 'bg-white'}`}>
        <div className="app-container h-full flex items-center justify-between flex-nowrap gap-4">

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none' }} className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#2563EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)', flexShrink: 0,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#0B2345' }} className="whitespace-nowrap">
              IELTS<span style={{ color: '#2563EB', fontWeight: 500 }}>Pro</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 md:gap-1.5 flex-nowrap whitespace-nowrap shrink-0">
            <NavBtn active={location.pathname === '/'} onClick={() => navigate('/')}>Trang chủ</NavBtn>

            <NavDropdown name="fulltest" isOpen={openDropdown === 'fulltest'} onOpen={openMenu} onClose={scheduleClose}
              dropdownStyle={{ minWidth: 250 }}
              trigger={<NavBtn active={isFullTestActive} onClick={() => navigate('/full-test')} hasDropdown>Full Test</NavBtn>}
            >
              <div style={{ padding: '4px 0' }}>
                <CustomDropItem to="/full-test" label="Tất cả bộ đề" bold active={location.pathname === '/full-test'} />
                <NavDivider />
                <CustomDropItem to="/cambridge" label="IELTS Cambridge Academic" active={location.pathname === '/cambridge'} />
                <CustomDropItem to="/practice-plus" label="IELTS Practice Test Plus" active={location.pathname === '/practice-plus'} />
              </div>
            </NavDropdown>

            <NavBtn active={location.pathname.startsWith('/practice/reading')} onClick={() => navigate('/practice/reading')}>Reading</NavBtn>
            <NavBtn active={location.pathname.startsWith('/practice/listening')} onClick={() => navigate('/practice/listening')}>Listening</NavBtn>

            <NavDropdown name="baimu" isOpen={openDropdown === 'baimu'} onOpen={openMenu} onClose={scheduleClose}
              dropdownStyle={{ width: 300 }}
              trigger={
                <NavBtn active={location.pathname.startsWith('/writing-samples') || location.pathname.startsWith('/speaking-samples')} hasDropdown>
                  Bài mẫu
                </NavBtn>
              }
            >
              <div style={{ display: 'flex', padding: '6px 0' }}>
                <div style={{ flex: 1 }}>
                  <Link to="/writing-samples" style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '8px 16px', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--skill-w-color)', fontFamily: 'var(--font-body)' }}>Writing</div>
                  </Link>
                  {[['task1', 'Task 1'], ['task2', 'Task 2']].map(([v, l]) => (
                    <Link key={v} to={`/writing-samples?task=${v}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '7px 16px 7px 24px', fontSize: 'var(--fs-sm)', color: 'var(--muted)', fontFamily: 'var(--font-body)', transition: 'background var(--transition)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >{l}</div>
                    </Link>
                  ))}
                </div>
                <div style={{ width: 1, background: 'var(--border-soft)', margin: '6px 0' }} />
                <div style={{ flex: 1 }}>
                  <Link to="/speaking-samples" style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '8px 16px', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--skill-s-color)', fontFamily: 'var(--font-body)' }}>Speaking</div>
                  </Link>
                  {[['task1', 'Part 1'], ['task2', 'Part 2'], ['task3', 'Part 3']].map(([v, l]) => (
                    <Link key={v} to={`/speaking-samples?part=${v}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '7px 16px 7px 24px', fontSize: 'var(--fs-sm)', color: 'var(--muted)', fontFamily: 'var(--font-body)', transition: 'background var(--transition)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >{l}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </NavDropdown>

            <NavDropdown name="courses" isOpen={openDropdown === 'courses'} onOpen={openMenu} onClose={scheduleClose}
              dropdownStyle={{ width: 340 }}
              trigger={<NavBtn active={isCoursesActive} onClick={() => navigate('/courses')} hasDropdown>Khóa học</NavBtn>}
            >
              <div style={{ padding: '6px 0' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ flex: 1 }}>
                    <CustomDropItem to="/courses/ielts-4-0" label="IELTS 4.0+" active={location.pathname === '/courses/ielts-4-0'} />
                    <CustomDropItem to="/courses/ielts-5-0" label="IELTS 5.0+" active={location.pathname === '/courses/ielts-5-0'} />
                    <CustomDropItem to="/courses/ielts-6-0" label="IELTS 6.0+" active={location.pathname === '/courses/ielts-6-0'} />
                    <CustomDropItem to="/courses/ielts-6-5" label="IELTS 6.5+" active={location.pathname === '/courses/ielts-6-5'} />
                    <CustomDropItem to="/courses/ielts-7-0" label="IELTS 7.0+" active={location.pathname === '/courses/ielts-7-0'} />
                  </div>
                  <div style={{ width: 1, background: '#E2E8F0', margin: '4px 0' }} />
                  <div style={{ flex: 1 }}>
                    <CustomDropItem to="/courses/pre-ielts" label="PRE IELTS" active={location.pathname === '/courses/pre-ielts'} />
                    <CustomDropItem to="/courses/ws-resolution" label="Giải đề W&S" active={location.pathname === '/courses/ws-resolution'} />
                  </div>
                </div>
              </div>
            </NavDropdown>
          </nav>

          {/* Right: auth */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0 whitespace-nowrap">
            <div className="hidden md:flex items-center gap-2 md:gap-3 flex-nowrap shrink-0 whitespace-nowrap">
              {isLoggedIn ? (
                <>
                  <Link to="/progress"
                    className="text-xs md:text-sm font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 transition-all whitespace-nowrap shrink-0 hover:bg-blue-100 flex items-center gap-1.5"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    <span>📊 Phân tích lỗi sai</span>
                  </Link>
                  <div role="button" tabIndex={0} aria-label="Tài khoản" onClick={() => navigate('/profile')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/profile') }}
                    className="flex items-center gap-2 cursor-pointer px-2.5 py-1 rounded-full border border-slate-200 transition-colors whitespace-nowrap shrink-0 hover:border-blue-600"
                  >
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: '#0B2345', fontFamily: 'var(--font-body)' }} className="whitespace-nowrap max-w-[120px] truncate">{user.name}</span>
                  </div>
                  <button onClick={() => setShowLogoutConfirm(true)}
                    className="text-xs md:text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-transparent text-slate-600 transition-all whitespace-nowrap shrink-0 hover:border-red-300 hover:text-red-500"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >Đăng xuất</button>
                </>
              ) : (
                <>
                  <button onClick={() => openAuthModal('login')}
                    className="text-xs md:text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-transparent text-slate-600 transition-all whitespace-nowrap shrink-0 hover:border-blue-600 hover:text-blue-600"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >Đăng nhập</button>
                  <button onClick={() => openAuthModal('register')}
                    className="text-xs md:text-sm font-bold px-3.5 py-1.5 rounded-lg border-none bg-blue-600 text-white transition-all whitespace-nowrap shrink-0 hover:bg-blue-700 shadow-sm"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >Đăng ký</button>
                </>
              )}
            </div>

          </div>
        </div>

      </header>

      <LogoutConfirmModal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout() }}
      />
    </>
  )
}
