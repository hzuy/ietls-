import { BookOpen, Headphones, PenTool, Mic } from 'lucide-react'

export default function SkillsSection() {
  return (
    <section className="skills-section section-py text-center">
      <div className="c-container">
        <div className="section-header">
          <h2>Làm chủ 4 kỹ năng cốt lõi</h2>
          <p>Phát triển đồng đều mọi kỹ năng với ngân hàng câu hỏi bám sát format đề thi thật và phản hồi chi tiết từ chuyên gia.</p>
        </div>

        <div className="grid-4 text-left">
          <div className="skill-card reading">
            <div className="skill-icon">
              <BookOpen className="w-6 h-6 text-slate-600 stroke-[1.75]" />
            </div>
            <h3>Reading</h3>
            <p>Luyện tập kỹ năng Skimming, Scanning và đọc hiểu sâu với hơn 500 bài đọc chuẩn Cambridge.</p>
            <span className="skill-tag">2,500+ Câu hỏi</span>
          </div>
          <div className="skill-card listening">
            <div className="skill-icon">
              <Headphones className="w-6 h-6 text-slate-600 stroke-[1.75]" />
            </div>
            <h3>Listening</h3>
            <p>Làm quen với đa dạng accent quốc tế, cải thiện tốc độ xử lý thông tin và nghe chép chính tả.</p>
            <span className="skill-tag">120+ Audio Tests</span>
          </div>
          <div className="skill-card writing">
            <div className="skill-icon">
              <PenTool className="w-6 h-6 text-slate-600 stroke-[1.75]" />
            </div>
            <h3>Writing</h3>
            <p>Hệ thống hóa cấu trúc lập luận Task 1 & 2. AI chấm điểm, phân tích từ vựng và gợi ý ý tưởng.</p>
            <span className="skill-tag">AI Tự động chấm</span>
          </div>
          <div className="skill-card speaking">
            <div className="skill-icon">
              <Mic className="w-6 h-6 text-slate-600 stroke-[1.75]" />
            </div>
            <h3>Speaking</h3>
            <p>Phòng thi ảo 1-1. Đánh giá chi tiết về Pronunciation, Fluency, Lexical Resource và Grammar.</p>
            <span className="skill-tag">Mock Test 1-1</span>
          </div>
        </div>
      </div>
    </section>
  )
}
