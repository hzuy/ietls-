import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { login, register, googleAuth, verifyEmail, resendVerification } from '../services/userService'
import { showAlert } from '../utils/alertUtils'
import { AlertCircle, MailCheck, ArrowLeft } from 'lucide-react'
import PillButton from './common/PillButton'
import PillInput from './common/PillInput'

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
  const [googleLoading, setGoogleLoading] = useState(false)

  const [verifyFor, setVerifyFor]         = useState(null)
  const [verifyCode, setVerifyCode]       = useState('')
  const [verifyError, setVerifyError]     = useState('')
  const [verifyInfo, setVerifyInfo]       = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendIn, setResendIn]           = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const startVerify = (email, mailSent, message) => {
    setVerifyFor(email)
    setVerifyCode('')
    setVerifyError(mailSent ? '' : message)
    setVerifyInfo(mailSent ? message : '')
    setResendIn(mailSent ? 60 : 0)
  }

  const finishLogin = (data) => {
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
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(verifyCode)) {
      setVerifyError('Mã xác thực gồm 6 chữ số')
      return
    }
    setVerifyLoading(true)
    setVerifyError('')
    try {
      finishLogin(await verifyEmail(verifyFor, verifyCode))
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'ALREADY_VERIFIED') {
        setVerifyFor(null)
        setLoginForm(f => ({ ...f, email: verifyFor }))
        onTabChange('login')
        showAlert(data.message, 'info')
        return
      }
      setVerifyError(data?.message || 'Xác thực thất bại')
      if (data?.reason === 'too_many' || data?.reason === 'expired') setVerifyCode('')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleResend = async () => {
    setVerifyError('')
    setVerifyInfo('')
    try {
      const data = await resendVerification(verifyFor)
      setVerifyInfo(data.message)
      setResendIn(data.retryAfter || 60)
    } catch (err) {
      const data = err.response?.data
      setVerifyError(data?.message || 'Không gửi lại được mã')
      if (data?.retryAfter) setResendIn(data.retryAfter)
    }
  }

  // Xử lý đăng nhập / đăng ký qua Google OAuth2 popup:
  // Nhận access_token từ Google popup -> gửi backend xác thực qua Google UserInfo API.
  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleError('')
    setGoogleLoading(true)
    try {
      const data = await googleAuth({ accessToken: tokenResponse.access_token })
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
      const msg = err.response?.data?.message || 'Đăng nhập Google thất bại'
      setGoogleError(msg)
      showAlert(msg, 'error')
    } finally {
      setGoogleLoading(false)
    }
  }

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      setGoogleError('Đăng nhập Google thất bại')
      showAlert('Đăng nhập Google thất bại', 'error')
    },
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      finishLogin(await login(loginForm.email, loginForm.password))
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'EMAIL_NOT_VERIFIED') {
        startVerify(data.email || loginForm.email, data.mailSent, data.message)
        return
      }
      const msg = data?.message || 'Đăng nhập thất bại'
      setLoginError(msg)
      showAlert(msg, 'error')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (regForm.password.length < 8) {
      const msg = 'Mật khẩu phải có ít nhất 8 ký tự'
      setRegError(msg)
      showAlert(msg, 'error')
      return
    }
    setRegLoading(true)
    setRegError('')
    try {
      const data = await register(regForm)
      startVerify(data.email || regForm.email, data.mailSent, data.message)
    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng ký thất bại'
      setRegError(msg)
      showAlert(msg, 'error')
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

  // Bo góc pill (bản sắc riêng phía người dùng), kích thước/cỡ chữ theo chuẩn
  // gọn của admin (h-9) — xem CLAUDE.md "Redesign giao diện người dùng".
  // Input/nút dùng PillInput/PillButton dùng chung; label/tiêu đề style riêng
  // vì không có component chung cho chúng.
  const labelCls = 'block text-xs font-semibold mb-1.5'

  // Khối "hoặc" + nút Google — dùng chung cho cả 2 tab, chỉ đổi text nút theo ngữ cảnh.
  // shape="pill" là prop có sẵn của @react-oauth/google (Google tự render pill
  // trong iframe riêng) — không dùng CSS/wrapper để ép hình, vì nội dung iframe
  // nằm ngoài tầm với của CSS trang chủ.
  const googleSection = (
    <>
      {googleError && (
        <div role="alert" className="p-3 rounded-2xl mb-4 mt-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>hoặc</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      {/* Nút Google Native — chuẩn branding Google với SVG logo 4 màu và font chữ Inter của hệ sinh thái.
          Render 0ms, không dùng iframe cross-origin nên tuyệt đối KHÔNG có hiện tượng FOUT (nhảy/đổi cỡ chữ sau 1s)
          hay chênh lệch giao diện giữa các trình duyệt. */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => triggerGoogleLogin()}
          disabled={googleLoading || loginLoading || regLoading}
          aria-label={tab === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}
          className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-full border transition-all text-sm font-medium hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.26 21.36 7.36 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.26C.46 8.19 0 9.99 0 12s.46 3.81 1.26 5.41l4.02-3.13z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.26 6.59l4.02 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
            />
          </svg>
          <span className="font-medium text-sm tracking-normal">
            {googleLoading ? 'Đang kết nối Google...' : tab === 'login' ? 'Đăng nhập với Google' : 'Đăng ký với Google'}
          </span>
        </button>
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
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        {/* Nút X */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          style={{ position: 'absolute', top: 3, right: 4, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--subtle)', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          className="font-bold hover:text-zinc-600 transition-colors"
        >
          ×
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(24,24,27,0.2)', flexShrink: 0,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }} className="whitespace-nowrap">
            IELTS<span style={{ color: 'var(--primary)', fontWeight: 500 }}>Pro</span>
          </span>
        </div>

        {verifyFor && (
          <div>
            <button
              type="button"
              onClick={() => setVerifyFor(null)}
              className="tap-pad inline-flex items-center gap-1 text-xs font-semibold mb-4"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại
            </button>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                <MailCheck className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="font-bold m-0 mb-1" style={{ color: 'var(--ink)', fontSize: 18 }}>Xác thực email</h2>
              <p className="text-xs m-0" style={{ color: 'var(--muted)' }}>
                Nhập mã 6 số đã gửi tới <strong style={{ color: 'var(--ink)' }}>{verifyFor}</strong>
              </p>
            </div>

            {verifyError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
            {verifyInfo && !verifyError && (
              <div role="status" className="p-3 rounded-2xl mb-4 text-xs font-medium" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {verifyInfo}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="verify-code" className={labelCls} style={{ color: 'var(--text)' }}>Mã xác thực</label>
                <PillInput
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="______"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center tracking-[0.5em] font-mono"
                  required
                  autoFocus
                />
              </div>
              <PillButton type="submit" disabled={verifyLoading || verifyCode.length !== 6} fullWidth>
                {verifyLoading ? 'Đang xác thực...' : 'Xác thực'}
              </PillButton>
            </form>

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Không nhận được mã? Kiểm tra cả thư mục Spam.{' '}
              {resendIn > 0 ? (
                <span className="tabular-nums">Gửi lại sau {resendIn}s</span>
              ) : (
                <button type="button" onClick={handleResend} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Gửi lại mã
                </button>
              )}
            </p>
          </div>
        )}

        {!verifyFor && (<>
        {/* Tabs */}
        <div className="flex mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="pb-3 pointer-coarse:pt-2 px-1 mr-6 text-sm font-bold transition-colors"
              style={{
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
            {loginError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className={labelCls} style={{ color: 'var(--text)' }}>Email</label>
                <PillInput
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="example@gmail.com"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="login-password" className={labelCls} style={{ color: 'var(--text)' }}>Mật khẩu</label>
                <PillInput
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <PillButton type="submit" disabled={loginLoading} fullWidth className="mt-2">
                {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </PillButton>
            </form>

            {googleSection}

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Chưa có tài khoản?{' '}
              <button onClick={() => onTabChange('register')} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng ký ngay
              </button>
            </p>
          </>
        )}

        {/* REGISTER */}
        {tab === 'register' && (
          <>
            {regError && (
              <div role="alert" className="p-3 rounded-2xl mb-4 text-xs font-medium bg-error-bg border border-error-border text-error-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className={labelCls} style={{ color: 'var(--text)' }}>Họ và tên</label>
                <PillInput
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="reg-email" className={labelCls} style={{ color: 'var(--text)' }}>Email</label>
                <PillInput
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="example@gmail.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-password" className={labelCls} style={{ color: 'var(--text)' }}>Mật khẩu</label>
                <PillInput
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />
              </div>
              <PillButton type="submit" disabled={regLoading} fullWidth className="mt-2">
                {regLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
              </PillButton>
            </form>

            {googleSection}

            <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Đã có tài khoản?{' '}
              <button onClick={() => onTabChange('login')} className="tap-pad font-bold" style={{ fontSize: 'inherit', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Đăng nhập
              </button>
            </p>
          </>
        )}
        </>)}
      </div>
    </div>
  )
}
