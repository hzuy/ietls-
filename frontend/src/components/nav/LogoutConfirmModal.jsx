import { LogOut } from 'lucide-react'

export default function LogoutConfirmModal({ open, onClose, onConfirm }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 28, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <LogOut size={20} className="text-slate-600" strokeWidth={2} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>Đăng xuất</h3>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Bạn có chắc muốn đăng xuất không?</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--text)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >Hủy</button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none', background: '#dc2626', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-body)', color: 'white', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}
          >Đăng xuất</button>
        </div>
      </div>
    </div>
  )
}
