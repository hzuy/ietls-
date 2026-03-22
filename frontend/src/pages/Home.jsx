import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const skills = [
  {
    name: 'Reading',
    sub: 'Đọc hiểu',
    desc: '3 đoạn văn · 40 câu hỏi · 60 phút',
    path: '/reading',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 20h9" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    name: 'Listening',
    sub: 'Nghe hiểu',
    desc: '4 phần · 40 câu hỏi · 30 phút',
    path: '/listening',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="18" r="3" stroke="#1a56db" strokeWidth="2"/>
        <circle cx="18" cy="16" r="3" stroke="#1a56db" strokeWidth="2"/>
      </svg>
    ),
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    name: 'Writing',
    sub: 'Viết luận',
    desc: 'Task 1 + Task 2 · AI chấm điểm',
    path: '/writing',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    name: 'Speaking',
    sub: 'Nói',
    desc: '3 phần · AI nhận xét phát âm',
    path: '/speaking',
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="19" x2="12" y2="23" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="23" x2="16" y2="23" stroke="#1a56db" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
]

const stats = [
  { label: 'Đề thi', value: '50+' },
  { label: 'Học viên', value: '1,200+' },
  { label: 'Band Score TB', value: '6.5' },
  { label: 'AI Feedback', value: '24/7' },
]

export default function Home() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-4"
                style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}
              >
                <span className="w-2 h-2 rounded-full bg-current inline-block"></span>
                Nền tảng luyện thi IELTS
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight" style={{ color: '#1e3a5f' }}>
                Xin chào, <span style={{ color: '#1a56db' }}>{user.name || 'bạn'}</span>!
              </h1>
              <p className="text-base mb-6" style={{ color: '#64748b', maxWidth: 420 }}>
                Luyện tập đầy đủ 4 kỹ năng IELTS với AI phản hồi thông minh. Chinh phục band score mục tiêu của bạn.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/reading')}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-sm"
                  style={{ backgroundColor: '#1a56db' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
                >
                  Bắt đầu luyện tập
                </button>
                <button
                  className="px-6 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ color: '#1a56db', border: '1px solid #fecaca', backgroundColor: 'white' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                >
                  Xem hướng dẫn
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              {stats.map(s => (
                <div
                  key={s.label}
                  className="rounded-2xl p-5 text-center min-w-[110px]"
                  style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                  <div className="text-2xl font-extrabold" style={{ color: '#1a56db' }}>{s.value}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Skill Cards */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Chọn kỹ năng luyện tập</h2>
        <p className="text-sm mb-6" style={{ color: '#64748b' }}>Luyện đủ 4 kỹ năng để đạt band score cao nhất</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {skills.map(skill => (
            <button
              key={skill.name}
              onClick={() => navigate(skill.path)}
              className="text-left rounded-2xl p-6 transition-all group"
              style={{
                backgroundColor: 'white',
                border: `1px solid ${skill.border}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: skill.bg }}
              >
                {skill.icon}
              </div>
              <div className="font-extrabold text-lg mb-0.5" style={{ color: '#1e3a5f' }}>{skill.name}</div>
              <div className="text-xs font-bold mb-2" style={{ color: skill.color }}>{skill.sub}</div>
              <div className="text-xs" style={{ color: '#8594A3' }}>{skill.desc}</div>
              <div
                className="mt-4 flex items-center gap-1 text-xs font-bold"
                style={{ color: skill.color }}
              >
                Luyện tập ngay
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Full Test banner */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <button
          onClick={() => navigate('/full-test')}
          className="w-full text-left rounded-2xl p-6 flex items-center justify-between transition-all group"
          style={{ backgroundColor: 'white', border: '1px solid #fecaca', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,37,37,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#eff6ff' }}>📚</div>
            <div>
              <p className="font-extrabold text-base" style={{ color: '#1e3a5f' }}>Luyện đề Cambridge Full Test</p>
              <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Luyện đầy đủ 4 kỹ năng theo đúng bộ đề Cambridge IELTS 1–19</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold shrink-0" style={{ color: '#1a56db' }}>
            Xem ngay
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>

      {/* Tips section */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <h3 className="font-extrabold text-base mb-4" style={{ color: '#1e3a5f' }}>Lộ trình luyện thi hiệu quả</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Làm bài thử', desc: 'Chọn đề và làm bài trong điều kiện thi thật với đồng hồ đếm ngược' },
              { step: '02', title: 'Nhận phản hồi AI', desc: 'AI phân tích điểm mạnh/yếu, chấm Writing & nhận xét Speaking' },
              { step: '03', title: 'Cải thiện band score', desc: 'Ôn lại lỗi sai, theo dõi tiến độ và chinh phục mục tiêu' },
            ].map(item => (
              <div key={item.step} className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0"
                  style={{ backgroundColor: '#eff6ff', color: '#1a56db' }}
                >
                  {item.step}
                </div>
                <div>
                  <div className="font-bold text-sm mb-1" style={{ color: '#1e3a5f' }}>{item.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
