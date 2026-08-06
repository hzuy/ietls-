import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../services/userService'

export default function ChangePassword() {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự')
      return
    }
    if (form.newPassword !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      await changePassword(form.oldPassword, form.newPassword)
      localStorage.removeItem('requirePasswordChange')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--primary)' }}>I</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>IELTS<span style={{ color: 'var(--primary)' }}>Pro</span></span>
        </div>

        <div className="mb-6">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Đổi mật khẩu</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>
            Tài khoản của bạn cần đặt lại mật khẩu mới để tiếp tục.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl mb-4 text-sm font-medium bg-slate-50 border border-slate-200 text-slate-700"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cp-old" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Mật khẩu hiện tại</label>
            <input
              id="cp-old"
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
              placeholder="••••••••"
              value={form.oldPassword}
              onChange={e => setForm({ ...form, oldPassword: e.target.value })}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Mật khẩu mới</label>
            <input
              id="cp-new"
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
              placeholder="Tối thiểu 8 ký tự"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Xác nhận mật khẩu mới</label>
            <input
              id="cp-confirm"
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {loading ? 'Đang lưu...' : 'Xác nhận đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  )
}
