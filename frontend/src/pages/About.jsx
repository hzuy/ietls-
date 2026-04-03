import React from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const About = () => {
  const navigate = useNavigate()

  // Bảng màu theo Style Guide
  const colors = {
    white: '#FFFFFF',
    navy: '#002D5B',
    royal: '#0066FF',
    slate: '#64748b',
    lightBlue: '#eff6ff'
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: colors.white, color: colors.navy }}>
      <Navbar />

      {/* 1. HERO SECTION: Giới thiệu IELTS Pro */}
      <section className="py-24 px-6 text-center" style={{ background: `linear-gradient(180deg, ${colors.lightBlue} 0%, ${colors.white} 100%)` }}>
        <div className="max-w-4xl mx-auto">
          <div 
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8 shadow-sm"
            style={{ backgroundColor: colors.royal, color: colors.white }}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            THE FUTURE OF IELTS PREP
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-8 leading-tight">
            IELTS Pro — Hệ sinh thái <br/>
            <span style={{ color: colors.royal }}>Luyện thi thông minh tích hợp AI</span>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed mb-10 opacity-90" style={{ color: colors.navy, maxWidth: '800px', margin: '0 auto 40px' }}>
            Chúng tôi tiên phong trong phương pháp <strong>Smart-Logic Practice</strong>, giúp tối ưu tư duy ngôn ngữ và bứt phá Band Score bằng công nghệ phản hồi thời gian thực. Đạt tỷ lệ hài lòng 99% từ cộng đồng học viên toàn cầu.
          </p>
        </div>
      </section>

      {/* 2. CHÚNG TÔI LÀ AI? */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="w-full aspect-square rounded-[3rem] overflow-hidden rotate-3 shadow-2xl border-8 border-white">
                <div className="w-full h-full flex items-center justify-center text-8xl" style={{ backgroundColor: colors.lightBlue }}>
                  🎯
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[200px]">
                <div className="font-extrabold text-2xl" style={{ color: colors.royal }}>15K+</div>
                <div className="text-xs font-bold opacity-60">Học viên đạt Band 7.0+</div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold mb-6">Chúng tôi là ai?</h2>
              <div className="space-y-6 text-base leading-relaxed opacity-90">
                <p>
                  Khởi nguồn từ một dự án nghiên cứu công nghệ giáo dục chuyên sâu vào năm 2024, 
                  <strong> IELTS Pro</strong> không chỉ là một website luyện đề. Chúng tôi là một "Trợ lý ảo" 
                  tận tâm, đồng hành cùng bạn trên từng trang giấy và từng câu nói.
                </p>
                <div className="p-6 rounded-2xl border border-slate-100" style={{ backgroundColor: '#fcfcfc' }}>
                  <p className="italic mb-4">
                    "Tên gọi <strong>Pro</strong> là sự hội tụ của <strong>Precision</strong> (Chính xác) 
                    và <strong>Progressive</strong> (Tiến bộ). Biểu tượng dấu chấm tròn hội tụ thể hiện 
                    sự tập trung tuyệt đối để bứt phá mọi mục tiêu."
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: colors.royal }}>P</div>
                    <span className="font-bold text-sm">Đội ngũ sáng lập IELTS Pro</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LỊCH SỬ PHÁT TRIỂN (TIMELINE) */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-16 text-center">Hành trình kiến tạo</h2>
          <div className="relative border-l-2 border-dashed ml-4 md:ml-0 md:left-1/2" style={{ borderColor: colors.royal }}>
            {[
              { year: '2024', title: 'Khởi đầu Beta', desc: 'Ra mắt phiên bản đầu tiên với tính năng chấm điểm Reading/Listening tự động chính xác 100%.' },
              { year: '2025', title: 'Kỷ nguyên AI', desc: 'Tích hợp mô hình ngôn ngữ lớn (LLM) để cung cấp nhận xét Writing và Speaking chi tiết đến từng câu chữ.' },
              { year: '2026', title: 'Vươn tầm EdTech', desc: 'Đạt mốc 50,000+ người dùng và vinh dự trở thành nền tảng EdTech tiêu biểu của năm.' }
            ].map((item, idx) => (
              <div key={idx} className={`relative mb-16 md:w-1/2 ${idx % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12 md:left-1/2'}`}>
                <div 
                  className={`absolute top-0 w-8 h-8 rounded-full border-4 border-white shadow-md flex items-center justify-center -left-[17px] md:left-auto ${idx % 2 === 0 ? 'md:-right-[17px]' : 'md:-left-[17px]'}`}
                  style={{ backgroundColor: colors.royal }}
                ></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <span className="text-sm font-black opacity-30">{item.year}</span>
                  <h3 className="text-xl font-bold mb-2" style={{ color: colors.royal }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed opacity-70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SỨ MỆNH */}
      <section className="py-24 px-6 text-center bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-5xl mb-8">🌍</div>
          <h2 className="text-3xl font-extrabold mb-8">Sứ mệnh của chúng tôi</h2>
          <p className="text-xl leading-relaxed italic" style={{ color: colors.slate }}>
            "Bình đẳng hóa cơ hội tiếp cận giáo dục chất lượng cao. Chúng tôi giúp học viên không chỉ đạt Band Score kỳ vọng mà còn làm chủ tư duy phản biện và kỹ năng sử dụng tiếng Anh như một công cụ học thuật quốc tế."
          </p>
        </div>
      </section>

      {/* 5. HỆ SINH THÁI CÔNG NGHỆ PRO-ECOSYSTEM */}
      <section className="py-24 px-6" style={{ backgroundColor: colors.navy, color: colors.white }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4">Hệ sinh thái Pro-Ecosystem</h2>
            <p className="opacity-60 text-sm">Tích hợp toàn diện mọi công cụ bạn cần</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Pro-Practice', desc: 'Kho đề thi khổng lồ từ Cambridge, mô phỏng phòng thi thật 99%.' },
              { name: 'Pro-AI Feedback', desc: 'Chấm chữa Writing/Speaking chi tiết từng tiêu chí giám khảo.' },
              { name: 'Pro-Analytics', desc: 'Biểu đồ phân tích điểm mạnh/yếu, gợi ý lộ trình cá nhân hóa.' },
              { name: 'Pro-Dictionary', desc: 'Tra từ điển học thuật chuyên sâu ngay trong lúc làm bài đọc.' }
            ].map((eco, idx) => (
              <div key={idx} className="p-8 rounded-2xl transition-all border border-white/10 hover:bg-white/5">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400 font-bold">0{idx+1}</div>
                <h3 className="text-lg font-bold mb-3">{eco.name}</h3>
                <p className="text-sm opacity-60 leading-relaxed">{eco.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. THÀNH TỰU & ĐỐI TƯỢNG */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-20">
            {[
              { val: '15K+', label: 'Học viên đạt 7.0+' },
              { val: '50K+', label: 'Thành viên cộng đồng' },
              { val: '100+', label: 'Đối tác giáo dục' }
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-10 rounded-2xl shadow-sm border border-slate-50" style={{ backgroundColor: colors.lightBlue }}>
                <div className="text-4xl font-black mb-2" style={{ color: colors.royal }}>{stat.val}</div>
                <div className="text-sm font-bold opacity-60 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-extrabold mb-10">IELTS Pro dành cho ai?</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {['Sinh viên cần chứng chỉ ra trường', 'Người đi làm bận rộn', 'Học sinh THPT săn học bổng'].map((target, idx) => (
                <div key={idx} className="px-6 py-4 rounded-xl border border-slate-200 font-bold text-sm shadow-sm transition-all hover:border-blue-300">
                  ✅ {target}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. TẠI SAO CHỌN IELTS PRO? */}
      <section className="py-24 px-6" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-16 text-center">Tại sao bạn nên chọn chúng tôi?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Smart-Logic', desc: 'Phương pháp học bản chất, tư duy logic, nói không với học vẹt hay học mẹo.' },
              { title: 'Đội ngũ chuyên gia', desc: 'Được cố vấn chuyên môn bởi các giảng viên IELTS 8.5+ giàu kinh nghiệm.' },
              { title: 'Siêu công nghệ 24/7', desc: 'Hệ thống AI hỗ trợ phản hồi và giải đáp thắc mắc của bạn bất kể ngày đêm.' }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-xl">
                <div className="w-12 h-1 bg-blue-600 mb-6 rounded-full"></div>
                <h4 className="text-xl font-bold mb-4">{item.title}</h4>
                <p className="text-sm leading-relaxed opacity-70">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto p-12 rounded-[2rem] text-white shadow-2xl" style={{ backgroundColor: colors.royal }}>
          <h2 className="text-3xl font-extrabold mb-6">Bắt đầu hành trình chinh phục IELTS ngay hôm nay</h2>
          <p className="mb-10 opacity-80">Hãy để AI của chúng tôi chỉ ra con đường ngắn nhất đến mục tiêu của bạn.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => navigate('/reading')}
              className="px-10 py-4 rounded-xl font-bold bg-white transition-all shadow-lg hover:scale-105"
              style={{ color: colors.royal }}
            >
              Làm bài thi thử
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-10 py-4 rounded-xl font-bold border border-white/30 transition-all hover:bg-white/10"
            >
              Quay lại trang chủ
            </button>
          </div>
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="py-12 border-t border-slate-100 text-center text-xs opacity-40 uppercase tracking-[0.2em]">
        © 2026 IELTS Pro Ecosystem. All Rights Reserved.
      </footer>
    </div>
  )
}

export default About
