import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NavDropdown, { DropItem } from './nav/NavDropdown'
import MobileNav from './nav/MobileNav'
import LogoutConfirmModal from './nav/LogoutConfirmModal'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function NavBtn({ children, active, onClick, hasDropdown }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        padding: '7px 14px', borderRadius: 8, border: 'none',
        color: active ? '#ffffff' : '#94a3b8',
        backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        fontWeight: active ? 700 : 600, fontSize: 14, cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#ffffff' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' } }}
    >
      {children}
      {hasDropdown && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>▾</span>}
    </button>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, openAuthModal, handleLogout } = useAuth()
  const isLoggedIn = !!user?.name

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)   // 'fulltest' | 'baimu' | null
  const [series, setSeries] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState(null) // 'fulltest' | 'baimu' | null

  const closeTimer = useRef(null)
  const navRef = useRef(null)

  useEffect(() => {
    fetch(API_BASE + '/series')
      .then(r => r.ok ? r.json() : [])
      .then(setSeries)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setOpenDropdown(null)
    setMobileOpen(false)
    setMobileExpanded(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openMenu = (name) => { clearTimeout(closeTimer.current); setOpenDropdown(name) }
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setOpenDropdown(null), 150) }

  const go = (path) => navigate(path)

  const handleMobileLogout = () => {
    setMobileOpen(false)
    setShowLogoutConfirm(true)
  }

  return (
    <>
      <header
        ref={navRef}
        style={{ background: '#1e3a5f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => go('/')}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#0066FF' }} />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: '#ffffff' }}>
              IELTS<span style={{ color: '#93c5fd' }}>PRO</span>
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">

            <NavBtn active={location.pathname === '/'} onClick={() => go('/')}>Trang chủ</NavBtn>

            {/* Full Test dropdown */}
            <NavDropdown
              name="fulltest"
              isOpen={openDropdown === 'fulltest'}
              onOpen={openMenu}
              onClose={scheduleClose}
              dropdownStyle={{ minWidth: 220 }}
              trigger={
                <NavBtn active={location.pathname.startsWith('/full-test')} hasDropdown>Full Test</NavBtn>
              }
            >
              <DropItem
                icon="📚" label="Tất cả bộ đề" bold
                active={location.pathname === '/full-test' && !new URLSearchParams(location.search).get('series')}
                onClick={() => go('/full-test')}
              />
              {series.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
                  {series.map(s => (
                    <DropItem key={s.id} icon="📖" label={s.name} onClick={() => go(`/full-test/${s.id}`)} />
                  ))}
                </>
              )}
            </NavDropdown>

            <NavBtn
              active={location.pathname.startsWith('/practice/reading')}
              onClick={() => go('/practice/reading')}
            >Reading</NavBtn>

            <NavBtn
              active={location.pathname.startsWith('/practice/listening')}
              onClick={() => go('/practice/listening')}
            >Listening</NavBtn>

            {/* Bài mẫu dropdown */}
            <NavDropdown
              name="baimu"
              isOpen={openDropdown === 'baimu'}
              onOpen={openMenu}
              onClose={scheduleClose}
              dropdownStyle={{ width: 320 }}
              trigger={
                <NavBtn
                  active={location.pathname.startsWith('/writing-samples') || location.pathname.startsWith('/speaking-samples')}
                  hasDropdown
                >Bài mẫu</NavBtn>
              }
            >
              <div style={{ display: 'flex' }}>
                {/* Writing column */}
                <div style={{ flex: 1 }}>
                  <div
                    onClick={() => go('/writing-samples')}
                    style={{ padding: '10px 16px 8px', fontSize: 13, fontWeight: 700, color: '#b45309', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >✍️ Writing</div>
                  {[
                    { label: 'Task 1', path: '/writing-samples?task=task1' },
                    { label: 'Task 2', path: '/writing-samples?task=task2' },
                  ].map(({ label, path }) => {
                    const isCurrent = location.pathname + location.search === path
                    return (
                      <div key={label} onClick={() => go(path)}
                        style={{ padding: '8px 16px 8px 28px', fontSize: 13, color: isCurrent ? '#1a56db' : '#4b5563', background: isCurrent ? '#eff6ff' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#f8fafc' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isCurrent ? '#eff6ff' : 'transparent' }}
                      >{label}</div>
                    )
                  })}
                </div>
                {/* Vertical divider */}
                <div style={{ width: 1, background: '#e2e8f0', margin: '8px 0' }} />
                {/* Speaking column */}
                <div style={{ flex: 1 }}>
                  <div
                    onClick={() => go('/speaking-samples')}
                    style={{ padding: '10px 16px 8px', fontSize: 13, fontWeight: 700, color: '#0f6e56', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >🎤 Speaking</div>
                  {[
                    { label: 'Part 1', path: '/speaking-samples?part=task1' },
                    { label: 'Part 2', path: '/speaking-samples?part=task2' },
                    { label: 'Part 3', path: '/speaking-samples?part=task3' },
                  ].map(({ label, path }) => {
                    const isCurrent = location.pathname + location.search === path
                    return (
                      <div key={label} onClick={() => go(path)}
                        style={{ padding: '8px 16px 8px 28px', fontSize: 13, color: isCurrent ? '#1a56db' : '#4b5563', background: isCurrent ? '#eff6ff' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#f8fafc' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isCurrent ? '#eff6ff' : 'transparent' }}
                      >{label}</div>
                    )
                  })}
                </div>
              </div>
            </NavDropdown>
          </nav>

          {/* Right: auth + hamburger */}
          <div className="flex items-center gap-3">
            {/* Desktop auth */}
            <div className="hidden md:flex items-center gap-3">
              {isLoggedIn ? (
                <>
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate('/profile')}
                    style={{ borderRadius: 8, padding: '4px 8px', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#1a56db' }}>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#ffffff' }}>{user.name}</span>
                  </div>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; e.currentTarget.style.color = '#ffffff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#94a3b8' }}
                  >Đăng xuất</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ color: '#ffffff', border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'}
                  >Đăng nhập</button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ backgroundColor: '#1a56db', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
                  >Đăng ký</button>
                </>
              )}
            </div>

            {/* Hamburger */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileOpen(v => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}
            >
              <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 2, transition: 'transform 0.2s', transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 2, transition: 'opacity 0.2s', opacity: mobileOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: 22, height: 2, background: 'white', borderRadius: 2, transition: 'transform 0.2s', transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <MobileNav
            series={series}
            location={location}
            mobileExpanded={mobileExpanded}
            setMobileExpanded={setMobileExpanded}
            onNavigate={go}
            isLoggedIn={isLoggedIn}
            user={user}
            onOpenAuthModal={(mode) => { setMobileOpen(false); openAuthModal(mode) }}
            onShowLogoutConfirm={handleMobileLogout}
          />
        )}
      </header>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout() }}
      />
    </>
  )
}
