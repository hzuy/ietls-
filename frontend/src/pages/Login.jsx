import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/axios'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', form)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-2/5 p-12"
        style={{ background: 'linear-gradient(145deg, #1a56db 0%, #991b1b 100%)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">I</div>
            <span className="text-white font-bold text-xl">IELTSPro</span>
          </div>
          <h2 className="text-white text-3xl font-extrabold leading-tight mb-4">
            Luyện thi IELTS<br />thông minh hơn
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Nền tảng luyện thi IELTS với AI phản hồi tức thì, giúp bạn đạt band score mục tiêu nhanh hơn.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: '50+', l: 'Đề thi' },
            { v: '6.5', l: 'Band TB' },
            { v: '1,200+', l: 'Học viên' },
            { v: '24/7', l: 'AI hỗ trợ' },
          ].map(s => (
            <div key={s.l} className="bg-white/10 rounded-xl p-4">
              <div className="text-white text-xl font-extrabold">{s.v}</div>
              <div className="text-blue-100 text-xs mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{ backgroundColor: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}
        >
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#1a56db' }}>I</div>
            <span className="font-bold text-lg" style={{ color: '#1e3a5f' }}>IELTS<span style={{ color: '#1a56db' }}>Pro</span></span>
          </div>

          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Đăng nhập</h1>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>Chào mừng bạn quay lại!</p>

          {error && (
            <div
              className="p-3 rounded-xl mb-4 text-sm font-semibold"
              style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Email</label>
              <input
                type="email"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
                placeholder="example@gmail.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1e293b' }}>Mật khẩu</label>
              <input
                type="password"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ border: '1.5px solid #e2e8f0', color: '#1e293b' }}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={e => e.currentTarget.style.borderColor = '#1a56db'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2"
              style={{ backgroundColor: loading ? '#f87171' : '#1a56db' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1a56db' }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: '#64748b' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-bold" style={{ color: '#1a56db' }}>
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
