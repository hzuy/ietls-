import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Sparkles, Target, Lightbulb, Headphones } from 'lucide-react'

export default function About() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col font-['Be_Vietnam_Pro','Plus_Jakarta_Sans',sans-serif] transition-all duration-500 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* Navbar */}
      <Navbar />

      {/* ─── 1. HERO SECTION ──────────────────────────────────────────────────────── */}
      <section className="relative py-16 md:py-24 bg-gradient-to-b from-blue-50/50 via-white to-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100/80 text-blue-700 border border-blue-200/60">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                Hành Trình Của Chúng Tôi
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0B2345] leading-[1.15] tracking-tight">
                Về <span className="text-[#2563EB]">IELTSPro</span> — Chắp Cánh Ước Mơ Vươn Tầm Quốc Tế
              </h1>
              <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl">
                IELTSPro là nền tảng công nghệ luyện thi IELTS tiên phong kết hợp Trí tuệ Nhân tạo (AI) và phương pháp học chuẩn hóa quốc tế. Chúng tôi tự hào mang đến giải pháp luyện thi cá nhân hóa, giúp hàng nghìn học viên phá vỡ giới hạn và chinh phục band điểm mơ ước.
              </p>

            </div>

            {/* Right Image Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white group">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop"
                  alt="Không gian học tập hiện đại tại IELTSPro"
                  className="w-full h-[400px] md:h-[460px] object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                
                {/* Floating Badge */}
                <div className="absolute bottom-5 left-5 right-5 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-xl flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-slate-500 flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-6 h-6 text-slate-500 stroke-[1.75]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0B2345]">AI Powered System</p>
                    <p className="text-xs text-slate-500 font-medium">Công nghệ luyện thi tiên phong chính xác 98%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. TẦM NHÌN & SỨ MỆNH ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Tầm Nhìn & Sứ Mệnh
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0B2345] mt-3">
              Định Hướng Tương Lai Giáo Dục IELTS
            </h2>
            <p className="text-slate-500 text-sm md:text-base mt-2">
              Chúng tôi không chỉ dạy tiếng Anh mà còn tạo dựng nền tảng tư duy và sự tự tin cho thế hệ vươn ra toàn cầu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tầm Nhìn Card */}
            <div className="bg-slate-50/70 hover:bg-white rounded-3xl p-8 border border-slate-200/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                  <Target className="w-7 h-7 text-slate-500 stroke-[1.75]" />
                </div>
                <h3 className="text-xl font-bold text-[#0B2345] mb-3">Tầm Nhìn Chiến Lược</h3>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
                  Trở thành hệ sinh thái luyện thi IELTS thông minh hàng đầu khu vực, giúp học viên tiếp cận giáo dục chất lượng chuẩn quốc tế với chi phí tối ưu nhờ sức mạnh đột phá của AI.
                </p>
              </div>
            </div>

            {/* Sứ Mệnh Card */}
            <div className="bg-slate-50/70 hover:bg-white rounded-3xl p-8 border border-slate-200/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                  <Sparkles className="w-7 h-7 text-slate-500 stroke-[1.75]" />
                </div>
                <h3 className="text-xl font-bold text-[#0B2345] mb-3">Sứ Mệnh Tiên Phong</h3>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
                  Tối ưu hóa quy trình học IELTS thông qua lộ trình cá nhân hóa, phản hồi tự động chuẩn sát đề thi thật và cung cấp kho tài nguyên chuẩn mực cho mọi người học.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. GIÁ TRỊ CỐT LÕI ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50/60 border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-100/60 px-3 py-1 rounded-full border border-blue-200/60">
              Giá Trị Cốt Lõi
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0B2345] mt-3">
              Những Nguyên Tắc Tạo Nên Sự Khác Biệt
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* Card 1 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-5 shrink-0">
                <Target className="w-6 h-6 text-slate-500 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2345] mb-2">Chất Lượng Chuẩn Quốc Tế</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Nội dung học tập được kiểm duyệt nghiêm ngặt bởi đội ngũ chuyên gia 8.5+ IELTS, bám sát cấu trúc đề thi thực tế mới nhất.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-5 shrink-0">
                <Sparkles className="w-6 h-6 text-slate-500 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2345] mb-2">Học Viên Làm Trung Tâm</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Mọi tính năng và công cụ đều được thiết kế dựa trên thói quen và nhu cầu thực tế của người học, tối ưu thời gian học tập.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-5 shrink-0">
                <Headphones className="w-6 h-6 text-slate-500 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2345] mb-2">Tận Tâm Hỗ Trợ 24/7</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Đội ngũ giảng viên và trợ lý AI thông minh luôn đồng hành, giải đáp mọi thắc mắc và chấm chữa bài viết/nói bất kỳ lúc nào.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-5 shrink-0">
                <Lightbulb className="w-6 h-6 text-slate-500 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2345] mb-2">Công Nghệ AI Tiên Phong</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Liên tục cải tiến mô hình AI nhận diện giọng nói và chấm bài viết, giúp học viên phát hiện lỗi sai và cải thiện ngay lập tức.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. ĐỘI NGŨ GIẢNG VIÊN & CHUYÊN GIA ───────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Đội Ngũ Chuyên Gia
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0B2345] mt-3">
                Giảng Viên & Cố Vấn Chuyên Môn
              </h2>
            </div>
            <p className="text-slate-500 text-sm max-w-md">
              Hội tụ đội ngũ giáo viên giàu kinh nghiệm cùng các chuyên gia EdTech hàng đầu nghiên cứu lộ trình học cá nhân hóa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {[
              {
                name: 'Trần Giang Thanh',
                role: 'Academic Director tại IELTSPro',
                badge: '8.5 Overall',
                badgeBg: 'bg-[#2563EB] text-white',
                img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop',
                details: [
                  'Linearthinking Ambassador - Sứ giả Linearthinking',
                  '8.5 IELTS Overall | 8.5 IELTS Speaking',
                  'Thạc sĩ Giảng dạy ngôn ngữ | Cử nhân RMIT',
                  'IELTS Musketeer - The IELTS Face-off mùa 4',
                ],
              },
              {
                name: 'Hà Đặng Như Quỳnh',
                role: 'Academic Director tại IELTSPro',
                badge: '9.0 Overall',
                badgeBg: 'bg-[#6D28D9] text-white',
                img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop',
                details: [
                  'Linearthinking Ambassador - Sứ giả Linearthinking',
                  '9.0 IELTS Overall | 9.0 Speaking | 8.5 Writing',
                  'Nghiên cứu sinh - Tiến sĩ Giảng dạy tiếng Anh',
                  'Thạc sĩ Giảng dạy ngôn ngữ',
                ],
              },
              {
                name: 'Võ Đình Phúc',
                role: 'Academic Manager tại IELTSPro',
                badge: '8.5 Overall',
                badgeBg: 'bg-[#2563EB] text-white',
                img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=600&auto=format&fit=crop',
                details: [
                  'Linearthinking Ambassador - Sứ giả Linearthinking',
                  '8.5 IELTS Overall | 9.0 IELTS Speaking',
                  'Cử nhân ĐH Sư Phạm TPHCM',
                  'Thạc sĩ Giảng dạy Ngôn ngữ Anh (TESOL)',
                ],
              },
              {
                name: 'Phùng Minh Trí',
                role: 'Giáo viên IELTS tại IELTSPro',
                badge: '8.5 Overall',
                badgeBg: 'bg-[#0369A1] text-white',
                img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
                details: [
                  'Linearthinking Ambassador - Sứ giả Linearthinking',
                  '8.5 IELTS Overall | 8.0 Speaking | 8.0 Writing',
                  'Cử nhân Ngôn Ngữ Anh - ĐH Tôn Đức Thắng',
                  'Chuyên gia cố vấn phương pháp học từ vựng Linearthinking',
                ],
              },
            ].map((teacher, i) => (
              <div
                key={i}
                className="flex flex-col justify-between h-full bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 group"
              >
                <div className="relative h-56 overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={teacher.img}
                    alt={teacher.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className={`absolute top-3.5 right-3.5 text-xs font-extrabold px-3 py-1 rounded-full shadow-md z-10 ${teacher.badgeBg}`}>
                    {teacher.badge}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5 md:space-y-2">
                    <h3 className="text-base font-bold text-[#0B2345] group-hover:text-blue-600 transition-colors leading-tight">
                      {teacher.name}
                    </h3>
                    <p className="text-xs font-semibold text-blue-600 leading-snug">{teacher.role}</p>
                  </div>

                  <ul className="space-y-2 pt-3 mt-3 border-t border-slate-100 text-xs text-slate-600 flex-1 flex flex-col justify-between">
                    {teacher.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. BANNER THỐNG KÊ (DARK NAVY BANNER) ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 w-full my-8">
        <div className="relative bg-[#0B2345] rounded-3xl p-10 md:p-14 text-white overflow-hidden shadow-2xl border border-blue-900/60">
          {/* Background Decorative Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-0 md:divide-x divide-slate-700/60">
            <div className="p-2">
              <p className="text-3xl md:text-5xl font-extrabold text-blue-400 font-mono">10,000+</p>
              <p className="text-xs md:text-sm font-medium text-slate-300 uppercase tracking-wider mt-2">Học Viên Tin Tưởng</p>
            </div>
            <div className="p-2">
              <p className="text-3xl md:text-5xl font-extrabold text-blue-400 font-mono">95%</p>
              <p className="text-xs md:text-sm font-medium text-slate-300 uppercase tracking-wider mt-2">Đạt Band Mục Tiêu</p>
            </div>
            <div className="p-2">
              <p className="text-3xl md:text-5xl font-extrabold text-blue-400 font-mono">24/7</p>
              <p className="text-xs md:text-sm font-medium text-slate-300 uppercase tracking-wider mt-2">AI Chấm Điểm Tức Thì</p>
            </div>
            <div className="p-2">
              <p className="text-3xl md:text-5xl font-extrabold text-blue-400 font-mono">50+</p>
              <p className="text-xs md:text-sm font-medium text-slate-300 uppercase tracking-wider mt-2">Bộ Đề Cambridge Chuẩn</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. SECTION CTA (CALL TO ACTION) ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 w-full mb-16">
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-10 md:p-14 text-white text-center shadow-xl overflow-hidden">
          <div className="max-w-3xl mx-auto relative z-10 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              Bắt Đầu Hành Trình Chinh Phục IELTS Ngay Hôm Nay!
            </h2>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
              Trải nghiệm kho đề thi Cambridge thực tế và nhận đánh giá phản hồi chi tiết từ trí tuệ nhân tạo AI.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              <button
                onClick={() => navigate('/full-test')}
                className="px-8 py-4 rounded-xl bg-white hover:bg-blue-50 text-blue-600 font-extrabold text-sm shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                Bắt đầu luyện đề ngay →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Minimal */}
      <footer className="mt-auto py-8 bg-white border-t border-slate-200/80 text-center text-xs text-slate-500 font-medium tracking-wider uppercase">
        © 2026 IELTSPro Ecosystem. All Rights Reserved.
      </footer>
    </div>
  )
}
