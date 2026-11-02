import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { changePassword, getMe } from '../services/userService'
import { usePasswordChange } from '../hooks/usePasswordChange'
import PillButton from '../components/common/PillButton'
import PasswordInput from '../components/common/PasswordInput'
import { readPasswordForm } from '../utils/passwordUtils'

export default function ChangePassword() {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [hasPassword, setHasPassword] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const token = localStorage.getItem('token')
  const passwordChange = usePasswordChange(changePassword, () => {
    setForm({ oldPassword: '', newPassword: '', confirm: '' })
  })

  useEffect(() => {
    if (!token) return
    let active = true
    getMe().then(data => {
      if (active) {
        setHasPassword(data.hasPassword !== false)
        if (data.hasPassword === false) localStorage.removeItem('requirePasswordChange')
      }
    }).catch(() => {
      if (active) setLoadError(true)
    })
    return () => { active = false }
  }, [token])

  const syncPasswordValues = values => {
    setForm({ oldPassword: values.currentPassword, newPassword: values.newPassword, confirm: values.confirmation })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (hasPassword !== true) return
    await passwordChange.submitForm(e.currentTarget, syncPasswordValues)
  }

  if (!token) return <Navigate to="/" replace state={{ authModal: 'login' }} />

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--primary)' }}>I</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>IELTS<span style={{ color: 'var(--primary)' }}>Pro</span></span>
        </div>

        <div className="mb-6">
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Đổi mật khẩu</h1>
        </div>

        {loadError && <p role="alert" className="text-sm text-red-600 mb-4">Không thể tải thông tin tài khoản. Vui lòng tải lại trang để thử lại.</p>}
        {hasPassword === false ? (
          <div className="text-sm text-zinc-600">
            <p>Tài khoản này đăng nhập bằng Google và chưa có mật khẩu riêng. Vui lòng quản lý mật khẩu trong tài khoản Google của bạn.</p>
            <Link to="/" className="inline-block mt-4 underline">Về trang chủ</Link>
          </div>
        ) : <form onSubmit={handleSubmit} className="space-y-4" aria-busy={passwordChange.saving}>
          <div>
            <label htmlFor="cp-old" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Mật khẩu hiện tại</label>
            <PasswordInput
              id="cp-old"
              visibilityLabel="mật khẩu hiện tại"
              name="currentPassword"
              disabled={passwordChange.saving}
              placeholder="••••••••"
              value={form.oldPassword}
              onChange={event => syncPasswordValues(readPasswordForm(event.currentTarget.form))}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Mật khẩu mới</label>
            <PasswordInput
              id="cp-new"
              visibilityLabel="mật khẩu mới"
              name="newPassword"
              disabled={passwordChange.saving}
              placeholder="Tối thiểu 8 ký tự"
              value={form.newPassword}
              onChange={event => syncPasswordValues(readPasswordForm(event.currentTarget.form))}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Xác nhận mật khẩu mới</label>
            <PasswordInput
              id="cp-confirm"
              visibilityLabel="mật khẩu xác nhận"
              name="confirmPassword"
              disabled={passwordChange.saving}
              placeholder="Nhập lại mật khẩu mới"
              value={form.confirm}
              onChange={event => syncPasswordValues(readPasswordForm(event.currentTarget.form))}
              required
              autoComplete="new-password"
            />
          </div>
          <PillButton type="submit" disabled={passwordChange.saving || hasPassword !== true} fullWidth className="mt-2 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2">
            {passwordChange.saving ? 'Đang đổi mật khẩu…' : 'Xác nhận đổi mật khẩu'}
          </PillButton>
        </form>}
      </div>
    </div>
  )
}
