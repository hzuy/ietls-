import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { login, register, googleAuth } from '../services/userService'

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

  // Google Sign-In state (dùng chung cho cả 2 tab)
  const [googleError, setGoogleError] = useState('')

  // Xử lý y hệt handleLogin/handleRegister: lưu token/user, theo dõi requirePasswordChange, gọi onSuccess
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleError('')
    try {
      const data = await googleAuth(credentialResponse.credential)
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
      setGoogleError(err.response?.data?.message || 'Đăng nhập Google thất bại')
    }
  }

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const inputStyle = { border: '1px solid var(--border)', color: 'var(--text)' }
  const inputCls   = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'

  // Khối "hoặc" + nút Google — dùng chung cho cả 2 tab, chỉ đổi text nút theo ngữ cảnh
  const googleSection = (
    <>
      {googleError && (
        <div role="alert" className="p-3 rounded-xl mb-4 mt-4 text-sm font-medium bg-red-50 border border-red-200 text-red-600" style={{ fontFamily: 'var(--font-body)' }}>
          ⚠️ {googleError}
        </div>
      )}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--subtle)', fontFamily: 'var(--font-body)' }}>hoặc</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setGoogleError('Đăng nhập Google thất bại')}
          text={tab === 'register' ? 'signup_with' : 'signin_with'}
          width="320"
        />
      </div>
    </>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-8 relative"
        style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        {/* Nút X */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          style={{ position: 'absolute', top: 14, right: 18, color: 'var(--subtle)', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          className="font-bold hover:text-gray-600 transition-colors"
        >
          ×
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#2563EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37,99,235,0.3)', flexShrink: 0,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#0B2345' }} className="whitespace-nowrap">
            IELTS<span style={{ color: '#2563EB', fontWeight: 500 }}>Pro</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="pb-3 px-1 mr-6 text-sm font-bold transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : 'var(--subtle)',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer', paddingBottom: 12, paddingLeft: 4, paddingRight: 4, marginRight: 24,
              }}
            >
              {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        {/* LOGIN */}
        {tab === 'login' && (
          <>
            <h2 className="text-xl font-extrabold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Đăng nhập</h2>
            <p className="text-sm mb-5" style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>Chào mừng bạn quay lại!</p>

            {loginError && (
              <div role="alert" className="p-3 rounded-xl mb-4 text-sm font-medium bg-red-50 border border-red-200 text-red-600" style={{ fontFamily: 'var(--font-body)' }}>
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Email</label>
                <input
                  id="login-email"
                  type="email"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="example@gmail.com"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Mật khẩu</label>
                <input
                  id="login-password"
                  type="password"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl text-sm font-bold btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            {googleSection}

            <p className="text-center text-sm mt-5" style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
              Chưa có tài khoản?{' '}
              <button onClick={() => onTabChange('register')} className="font-bold" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng ký ngay
              </button>
            </p>
          </>
        )}

        {/* REGISTER */}
        {tab === 'register' && (
          <>
            <h2 className="text-xl font-extrabold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Tạo tài khoản</h2>
            <p className="text-sm mb-5" style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>Miễn phí, không cần thẻ tín dụng</p>

            {regError && (
              <div role="alert" className="p-3 rounded-xl mb-4 text-sm font-medium bg-red-50 border border-red-200 text-red-600" style={{ fontFamily: 'var(--font-body)' }}>
                ⚠️ {regError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Họ và tên</label>
                <input
                  id="reg-name"
                  type="text"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Nguyễn Văn A"
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Email</label>
                <input
                  id="reg-email"
                  type="email"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="example@gmail.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-bold mb-1.5" style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}>Mật khẩu</label>
                <input
                  id="reg-password"
                  type="password"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Tối thiểu 8 ký tự"
                  value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 rounded-xl text-sm font-bold btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {regLoading ? 'Đang tạo tài khoản...' : 'Đăng ký miễn phí'}
              </button>
            </form>

            {googleSection}

            <p className="text-center text-sm mt-5" style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
              Đã có tài khoản?{' '}
              <button onClick={() => onTabChange('login')} className="font-bold" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng nhập
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
