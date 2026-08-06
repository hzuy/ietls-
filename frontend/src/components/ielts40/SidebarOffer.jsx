import { useState, useEffect } from 'react'
import { Clock, GraduationCap, FileText, Sparkles, Crown, Headphones, ShieldCheck } from 'lucide-react'

export default function SidebarOffer() {
  const [timeLeft, setTimeLeft] = useState((9 * 3600) + (2 * 60) + 45)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const d = Math.floor(timeLeft / (3600 * 24))
  const h = Math.floor((timeLeft % (3600 * 24)) / 3600)
  const m = Math.floor((timeLeft % 3600) / 60)
  const s = Math.floor(timeLeft % 60)

  return (
    <aside className="cd-sidebar">
      <div className="cd-sb-card">
        <div className="sidebar-header">
          <h3 className="sidebar-title" style={{ marginBottom: 20 }}>Ưu đãi học phí</h3>
          <div className="cd-timer flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            <div className="cd-timer-text">
              Kết thúc sau <span className="cd-countdown">{`${d}d ${h}h ${m}m ${s}s`}</span>
            </div>
          </div>
          <p className="cd-promo-note" style={{ marginTop: 12, marginBottom: 20 }}>*Ưu đãi HÈ đăng ký trước 15/06/2026</p>
          <button className="cd-btn-cta">Đăng ký khóa học</button>
        </div>

        <ul className="cd-sb-list">
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Phương pháp Linearthinking</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>54 giờ học trên lớp</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Sách giáo trình miễn phí</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Sử dụng công nghệ của IELTSPro</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <Crown className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Tài khoản IELTSPro Premium 1 năm</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <Headphones className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Support tận tình từ giáo viên</span>
          </li>
          <li>
            <span className="cd-sb-icon flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </span>
            <span>Hỗ trợ học lại</span>
          </li>
        </ul>
      </div>
    </aside>
  )
}
