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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f4f8' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#1a56db' }}>I</div>
          <span className="font-bold text-lg" style={{ color: '#1e3a5f' }}>IELTS<span style={{ color: '#1a56db' }}>Pro</span></span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Đổi mật khẩu</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Tài khoản của bạn cần đặt lại mật khẩu mới để tiếp tục.
          </p>
        </div>

        {error && (
          <div
            className="p-3 rounded-xl mb-4 text-sm font-semibold"
            style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu hiện tại</label>
            <input
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
              placeholder="••••••••"
              value={form.oldPassword}
              onChange={e => setForm({ ...form, oldPassword: e.target.value })}
              onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu mới</label>
            <input
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
              placeholder="Tối thiểu 8 ký tự"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2"
            style={{ backgroundColor: loading ? '#93c5fd' : '#1a56db' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1a56db' }}
          >
            {loading ? 'Đang lưu...' : 'Xác nhận đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  )
}
