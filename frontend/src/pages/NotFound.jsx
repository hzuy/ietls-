import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-[120px] font-extrabold text-slate-900 leading-none mb-4 tracking-tighter" style={{ fontFamily: 'var(--font-mono)' }}>
          404
        </h1>
        <h2 className="text-[24px] font-bold text-slate-900 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          Trang không tồn tại
        </h2>
        <p className="text-[15px] text-slate-600 mb-8 max-w-sm mx-auto" style={{ fontFamily: 'var(--font-body)' }}>
          Trang bạn đang tìm kiếm có thể đã bị xóa, đổi tên hoặc tạm thời không truy cập được.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary px-8 py-3.5 text-[15px] font-bold"
        >
          Quay về trang chủ
        </button>
      </div>
    </div>
  )
}
