import { useState, useEffect, useRef } from 'react'
import { Bot, User, LogOut } from 'lucide-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NavDropdown from './nav/NavDropdown'
import LogoutConfirmModal from './nav/LogoutConfirmModal'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')

function NavBtn({ children, active, onClick, hasDropdown }) {
  return (
    <button
      onClick={onClick}
      className={`nav-item flex items-center gap-1 border-none tracking-[0.01em] whitespace-nowrap shrink-0 px-3 py-1.5 rounded-xl ${active ? 'active' : 'bg-transparent text-slate-600'}`}
      style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)' }}
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
        className={`flex items-center gap-2.5 px-4 py-2 transition-colors duration-300 whitespace-nowrap rounded-md mx-1 cursor-pointer ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-transparent text-slate-700 hover:bg-slate-50 hover:text-blue-600'} ${bold ? 'font-semibold' : ''}`}
        style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)' }}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
    </Link>
  )
}

function NavDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
}

/* ── Mobile drawer link ─────────────────────────────────────────────────── */
function MobileNavLink({ to, children, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center px-4 py-3 rounded-xl no-underline transition-colors ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
      style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', minHeight: 44 }}
    >
      {children}
    </Link>
  )
}


export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, openAuthModal, handleLogout } = useAuth()
  const isLoggedIn = !!user?.name

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [announcement] = useState(() => sessionStorage.getItem('__announcement__') || '')
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const closeTimer = useRef(null)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Close dropdowns and mobile menu on route change */
  useEffect(() => {
    setOpenDropdown(null)
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  /* Click-outside + Escape to close user menu */
  useEffect(() => {
    if (!userMenuOpen) return
    const onMouseDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    const onKeyDown = (e) => { if (e.key === 'Escape') setUserMenuOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [userMenuOpen])

  /* Prevent body scroll when mobile menu is open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const openMenu = (name) => { clearTimeout(closeTimer.current); setOpenDropdown(name) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setOpenDropdown(null), 150) }

  const isFullTestActive =
    location.pathname.startsWith('/full-test') ||
    location.pathname === '/cambridge' ||
    location.pathname === '/practice-plus'

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* Announcement banner */}
      {announcement && !announcementDismissed && (
        <div style={{ background: 'var(--warning-bg)', borderBottom: '1px solid #fde68a', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 60 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: '#92400e', fontFamily: 'var(--font-body)', lineHeight: 1.5, textAlign: 'center' }}>{announcement}</span>
          <button onClick={() => setAnnouncementDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 16, padding: '0 4px', lineHeight: 1, opacity: 0.7, minHeight: 44, minWidth: 44 }} aria-label="Đóng thông báo">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      <header className={`w-full sticky top-0 z-50 h-16 border-b transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-[0_4px_12px_rgba(15,23,42,0.05)]' : 'bg-white'}`}>
        <div className="app-container h-full flex items-center justify-between flex-nowrap gap-4">

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none' }} className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', flexShrink: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: 'var(--ink)' }} className="whitespace-nowrap">
              IELTS<span style={{ color: 'var(--primary)', fontWeight: 500 }}>Pro</span>
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
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2 flex-nowrap shrink-0">
              {isLoggedIn ? (
                <>
                  {/* Bot — progress link */}
                  <Link to="/progress"
                    className="flex items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all shrink-0 no-underline"
                    style={{ width: 36, height: 36 }}
                    title="Phân tích lỗi sai"
                    aria-label="Phân tích lỗi sai"
                  >
                    <Bot size={18} strokeWidth={1.8} />
                  </Link>

                  {/* Avatar + dropdown */}
                  <div ref={userMenuRef} className="relative shrink-0">
                    <button
                      onClick={() => setUserMenuOpen(o => !o)}
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen}
                      aria-label="Tài khoản"
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--primary)', border: '2px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', flexShrink: 0, padding: 0,
                        outline: 'none',
                        boxShadow: userMenuOpen ? '0 0 0 2px #BFDBFE' : 'none',
                        transition: 'box-shadow 0.2s ease',
                      }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </button>

                    {userMenuOpen && (
                      <div
                        role="menu"
                        style={{
                          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                          minWidth: 215,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-md)',
                          padding: '4px',
                          zIndex: 200,
                        }}
                      >
                        <Link
                          to="/profile"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                          className="no-underline"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 500, transition: 'background 0.15s ease', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <User size={15} strokeWidth={1.8} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                          Thông tin cá nhân
                        </Link>
                        <div style={{ height: 1, background: 'var(--border-soft)', margin: '3px 8px' }} />
                        <button
                          role="menuitem"
                          onClick={() => { setUserMenuOpen(false); setShowLogoutConfirm(true) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--error)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 500,
                            transition: 'background 0.15s ease', textAlign: 'left', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <LogOut size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                          Đăng xuất
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => openAuthModal('login')} className="btn-secondary" style={{ minHeight: 44, padding: '0.375rem 1rem' }}>Đăng nhập</button>
                  <button onClick={() => openAuthModal('register')} className="btn-primary" style={{ minHeight: 44, padding: '0.375rem 1rem' }}>Đăng ký</button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center rounded-xl border transition-colors"
              style={{ width: 44, height: 44, flexShrink: 0, borderColor: 'var(--border)', background: '#fff', color: '#334155' }}
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
              aria-expanded={mobileOpen}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="6" x2="17" y2="6"/>
                <line x1="3" y1="10" x2="17" y2="10"/>
                <line x1="3" y1="14" x2="17" y2="14"/>
              </svg>
            </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 bottom-0 z-[101] md:hidden flex flex-col"
        style={{
          width: 'min(320px, 85vw)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform var(--transition)',
          boxShadow: mobileOpen ? '4px 0 24px rgba(15,23,42,0.2)' : 'none',
          overflowY: 'auto',
          background: '#fff',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ minHeight: 64, borderBottomColor: 'var(--border-soft)' }}>
          <Link to="/" onClick={closeMobile} style={{ textDecoration: 'none' }} className="flex items-center gap-2">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              IELTS<span style={{ color: 'var(--primary)', fontWeight: 500 }}>Pro</span>
            </span>
          </Link>
          <button
            onClick={closeMobile}
            className="flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            style={{ width: 44, height: 44 }}
            aria-label="Đóng menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l14 14M16 2L2 16"/>
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-3 py-4">
          <MobileNavLink to="/" active={location.pathname === '/'} onClick={closeMobile}>Trang chủ</MobileNavLink>
          <MobileNavLink to="/full-test" active={location.pathname === '/full-test'} onClick={closeMobile}>Full Test</MobileNavLink>
          <MobileNavLink to="/cambridge" active={location.pathname === '/cambridge'} onClick={closeMobile}>
            <span className="ml-3 text-slate-500">Cambridge Academic</span>
          </MobileNavLink>
          <MobileNavLink to="/practice-plus" active={location.pathname === '/practice-plus'} onClick={closeMobile}>
            <span className="ml-3 text-slate-500">Practice Test Plus</span>
          </MobileNavLink>

          <div className="my-1 border-t border-slate-100" />

          <MobileNavLink to="/practice/reading" active={location.pathname.startsWith('/practice/reading')} onClick={closeMobile}>Reading</MobileNavLink>
          <MobileNavLink to="/practice/listening" active={location.pathname.startsWith('/practice/listening')} onClick={closeMobile}>Listening</MobileNavLink>

          <div className="my-1 border-t border-slate-100" />

          <MobileNavLink to="/writing-samples" active={location.pathname.startsWith('/writing-samples')} onClick={closeMobile}>Bài mẫu Writing</MobileNavLink>
          <MobileNavLink to="/speaking-samples" active={location.pathname.startsWith('/speaking-samples')} onClick={closeMobile}>Bài mẫu Speaking</MobileNavLink>
        </nav>

        {/* Auth section */}
        <div className="mt-auto border-t border-slate-100 px-3 py-4 flex flex-col gap-2">
          {isLoggedIn ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 mb-1">
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }} className="truncate">{user.name}</span>
              </div>
              <MobileNavLink to="/profile" active={location.pathname === '/profile'} onClick={closeMobile}>Tài khoản</MobileNavLink>
              <MobileNavLink to="/progress" active={location.pathname === '/progress'} onClick={closeMobile}>Phân tích lỗi sai</MobileNavLink>
              <button
                onClick={() => { closeMobile(); setShowLogoutConfirm(true) }}
                className="flex items-center w-full px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { closeMobile(); openAuthModal('login') }} className="btn-secondary w-full">Đăng nhập</button>
              <button onClick={() => { closeMobile(); openAuthModal('register') }} className="btn-primary w-full">Đăng ký</button>
            </>
          )}
        </div>
      </div>

      <LogoutConfirmModal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout() }}
      />
    </>
  )
}
