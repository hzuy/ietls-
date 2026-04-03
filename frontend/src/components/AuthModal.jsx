import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../services/userService'

export default function AuthModal({ tab, onTabChange, onSuccess, onClose }) {
  const navigate = useNavigate()

  // Login state
  const [loginForm, setLoginForm]       = useState({ email: '', password: '' })
  const [loginError, setLoginError]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register state
  const [regForm, setRegForm]       = useState({ name: '', email: '', password: '' })
  const [regError, setRegError]     = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const data = await login(loginForm.email, loginForm.password)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      if (data.requirePasswordChange) {
        localStorage.setItem('requirePasswordChange', 'true')
        onClose()
        navigate('/change-password')
      } else {
        localStorage.removeItem('requirePasswordChange')
        onSuccess(data.user)
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Đăng nhập thất bại')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (regForm.password.length < 8) {
      setRegError('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    setRegLoading(true)
    setRegError('')
    try {
      await register(regForm)
      // Auto-login sau khi đăng ký thành công
      const data = await login(regForm.email, regForm.password)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.removeItem('requirePasswordChange')
      onSuccess(data.user)
    } catch (err) {
      setRegError(err.response?.data?.message || 'Đăng ký thất bại')
    } finally {
      setRegLoading(false)
    }
  }

  const inputStyle = { border: '1.5px solid #e2e8f0', color: '#1e293b' }
  const inputCls   = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-8 relative"
        style={{ backgroundColor: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0' }}
      >
        {/* Nút X */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 18, color: '#94a3b8', fontSize: 22, lineHeight: 1 }}
          className="font-bold hover:text-gray-600 transition-colors"
        >
          ×
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-100">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#0066FF' }}></div>
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: '#1e3a5f' }}>
            IELTS<span style={{ color: '#1a56db' }}>PRO</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex mb-6" style={{ borderBottom: '1px solid #e2e8f0' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="pb-3 px-1 mr-6 text-sm font-bold transition-colors"
              style={{
                borderBottom: tab === t ? '2px solid #1a56db' : '2px solid transparent',
                color: tab === t ? '#1a56db' : '#94a3b8',
              }}
            >
              {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <>
            <h2 className="text-xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Đăng nhập</h2>
            <p className="text-sm mb-5" style={{ color: '#64748b' }}>Chào mừng bạn quay lại!</p>

            {loginError && (
              <div className="p-3 rounded-xl mb-4 text-sm font-semibold" style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Email</label>
                <input
                  type="email"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="example@gmail.com"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu</label>
                <input
                  type="password"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2"
                style={{ backgroundColor: loginLoading ? '#93c5fd' : '#1a56db' }}
                onMouseEnter={e => { if (!loginLoading) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
                onMouseLeave={e => { if (!loginLoading) e.currentTarget.style.backgroundColor = '#1a56db' }}
              >
                {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="text-center text-sm mt-5" style={{ color: '#64748b' }}>
              Chưa có tài khoản?{' '}
              <button onClick={() => onTabChange('register')} className="font-bold" style={{ color: '#1a56db' }}>
                Đăng ký ngay
              </button>
            </p>
          </>
        )}

        {/* ── REGISTER ── */}
        {tab === 'register' && (
          <>
            <h2 className="text-xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Tạo tài khoản</h2>
            <p className="text-sm mb-5" style={{ color: '#64748b' }}>Miễn phí, không cần thẻ tín dụng</p>

            {regError && (
              <div className="p-3 rounded-xl mb-4 text-sm font-semibold" style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}>
                {regError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Họ và tên</label>
                <input
                  type="text"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Nguyễn Văn A"
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Email</label>
                <input
                  type="email"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="example@gmail.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu</label>
                <input
                  type="password"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Tối thiểu 8 ký tự"
                  value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                  onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2"
                style={{ backgroundColor: regLoading ? '#93c5fd' : '#1a56db' }}
                onMouseEnter={e => { if (!regLoading) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
                onMouseLeave={e => { if (!regLoading) e.currentTarget.style.backgroundColor = '#1a56db' }}
              >
                {regLoading ? 'Đang tạo tài khoản...' : 'Đăng ký miễn phí'}
              </button>
            </form>

            <p className="text-center text-sm mt-5" style={{ color: '#64748b' }}>
              Đã có tài khoản?{' '}
              <button onClick={() => onTabChange('login')} className="font-bold" style={{ color: '#1a56db' }}>
                Đăng nhập
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
