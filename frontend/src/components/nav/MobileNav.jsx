function MobileItem({ label, onClick, active, indent }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: indent ? '6px 32px' : '10px 20px',
        fontSize: indent ? 13 : 14,
        fontWeight: active ? 700 : 500,
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.82)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >{label}</button>
  )
}

export default function MobileNav({
  series,
  location,
  mobileExpanded,
  setMobileExpanded,
  onNavigate,
  isLoggedIn,
  user,
  onOpenAuthModal,
  onShowLogoutConfirm,
}) {
  return (
    <div style={{ background: '#162d4a', borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
      <MobileItem label="Trang chủ" onClick={() => onNavigate('/')} active={location.pathname === '/'} />

      {/* Full Test accordion */}
      <MobileItem
        label={`Full Test ${mobileExpanded === 'fulltest' ? '▴' : '▾'}`}
        onClick={() => setMobileExpanded(v => v === 'fulltest' ? null : 'fulltest')}
        active={location.pathname.startsWith('/full-test')}
      />
      {mobileExpanded === 'fulltest' && (
        <>
          <MobileItem label="📚 Tất cả bộ đề" onClick={() => onNavigate('/full-test')} indent />
          {series.map(s => (
            <MobileItem key={s.id} label={`📖 ${s.name}`} onClick={() => onNavigate(`/full-test/${s.id}`)} indent />
          ))}
        </>
      )}

      <MobileItem label="Reading" onClick={() => onNavigate('/practice/reading')} active={location.pathname.startsWith('/practice/reading')} />
      <MobileItem label="Listening" onClick={() => onNavigate('/practice/listening')} active={location.pathname.startsWith('/practice/listening')} />

      {/* Bài mẫu accordion */}
      <MobileItem
        label={`Bài mẫu ${mobileExpanded === 'baimu' ? '▴' : '▾'}`}
        onClick={() => setMobileExpanded(v => v === 'baimu' ? null : 'baimu')}
        active={location.pathname.startsWith('/writing-samples') || location.pathname.startsWith('/speaking-samples')}
      />
      {mobileExpanded === 'baimu' && (
        <>
          <MobileItem label="✍️ Writing" onClick={() => onNavigate('/writing-samples')} indent />
          <MobileItem label="   Task 1" onClick={() => onNavigate('/writing-samples?task=task1')} indent />
          <MobileItem label="   Task 2" onClick={() => onNavigate('/writing-samples?task=task2')} indent />
          <MobileItem label="🎤 Speaking" onClick={() => onNavigate('/speaking-samples')} indent />
          <MobileItem label="   Part 1" onClick={() => onNavigate('/speaking-samples?part=task1')} indent />
          <MobileItem label="   Part 2" onClick={() => onNavigate('/speaking-samples?part=task2')} indent />
          <MobileItem label="   Part 3" onClick={() => onNavigate('/speaking-samples?part=task3')} indent />
        </>
      )}

      {/* Mobile auth */}
      <div style={{ margin: '12px 20px 0', display: 'flex', gap: 8 }}>
        {isLoggedIn ? (
          <>
            <button onClick={() => onNavigate('/profile')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
            >{user?.name}</button>
            <button onClick={onShowLogoutConfirm}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >Đăng xuất</button>
          </>
        ) : (
          <>
            <button onClick={() => onOpenAuthModal('login')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
            >Đăng nhập</button>
            <button onClick={() => onOpenAuthModal('register')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#1a56db', color: 'white', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >Đăng ký</button>
          </>
        )}
      </div>
    </div>
  )
}
