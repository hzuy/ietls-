export default function LogoutConfirmModal({ open, onClose, onConfirm }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚪</div>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>Đăng xuất</h3>
        </div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Bạn có chắc muốn đăng xuất không?</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >Hủy</button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#dc2626', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
          >Đăng xuất</button>
        </div>
      </div>
    </div>
  )
}
