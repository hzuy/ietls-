import { Award, Clock, Users, FileText, Sparkles, Check } from 'lucide-react'

export default function BenefitsSection({ outcomes }) {
  const defaultOutcomes = [
    'Hình thành Tư duy học tiếng Anh đúng',
    'Bỏ Tư duy đọc dịch, nói dịch, viết dịch',
    'Xây nền tảng từ vựng, ngữ pháp căn bản',
    'Đọc hiểu nội dung văn bản ngắn',
    'Nói và viết câu đơn thành thạo và lưu loát'
  ]
  const list = outcomes && outcomes.length > 0 ? outcomes : defaultOutcomes

  return (
    <>
      {/* 2. Bạn đạt được sau khoá học */}
      <section>
        <h2 className="cd-section-title" style={{ marginBottom: 24 }}>Bạn đạt được sau khoá học</h2>
        <div className="cd-card">
          <ul className="cd-checklist">
            {list.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Khoá học bao gồm */}
      <section>
        <h2 className="cd-section-title" style={{ marginBottom: 24 }}>Khoá học bao gồm</h2>
        <div className="cd-special">
          <div className="cd-special-icon flex items-center justify-center">
            <Award className="w-6 h-6 text-slate-500 stroke-[1.75]" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <h4 style={{ fontSize: 18 }}>Linearthinking</h4>
              <span className="cd-badge-outline">IELTSPro độc quyền</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, margin: 0 }}>
                Phương pháp học tư duy thông minh giúp học nhanh, nhớ lâu.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <img src="https://flagcdn.com/w40/us.png" alt="US" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                <img src="https://flagcdn.com/w40/in.png" alt="India" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginLeft: -8 }} />
                <img src="https://flagcdn.com/w40/vn.png" alt="VN" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginLeft: -8 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="cd-grid">
          <div className="cd-grid-card">
            <div className="cd-grid-icon flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-500 stroke-[1.75]" />
            </div>
            <div className="cd-grid-content">
              <h4>54 giờ học trên lớp</h4>
              <p>Thời lượng học trên lớp cùng giáo viên</p>
            </div>
          </div>
          <div className="cd-grid-card">
            <div className="cd-grid-icon flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-500 stroke-[1.75]" />
            </div>
            <div className="cd-grid-content">
              <h4>Hỗ trợ từ giáo viên</h4>
              <p>Giáo viên hỗ trợ tận tình</p>
            </div>
          </div>
          <div className="cd-grid-card">
            <div className="cd-grid-icon flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-500 stroke-[1.75]" />
            </div>
            <div className="cd-grid-content">
              <h4>Tài liệu miễn phí</h4>
              <p>Tài liệu độc quyền và phát miễn phí</p>
            </div>
          </div>
          <div className="cd-grid-card">
            <div className="cd-grid-icon flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-500 stroke-[1.75]" />
            </div>
            <div className="cd-grid-content">
              <h4>Công nghệ của IELTSPro</h4>
              <p>Sử dụng công nghệ AI độc quyền của IELTSPro</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
