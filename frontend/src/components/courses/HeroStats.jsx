import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HeroStats() {
  const navigate = useNavigate()
  const [displayBand, setDisplayBand] = useState(0)
  const [displayStudents, setDisplayStudents] = useState(0)
  const [displayEight, setDisplayEight] = useState(0)

  useEffect(() => {
    const duration = 1500
    const start = performance.now()

    const animateStats = (currentTime) => {
      const elapsed = currentTime - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      setDisplayBand(2.5 * ease)
      setDisplayStudents(Math.floor(3000 * ease))
      setDisplayEight(Math.floor(200 * ease))

      if (progress < 1) {
        requestAnimationFrame(animateStats)
      }
    }

    requestAnimationFrame(animateStats)
  }, [])

  return (
    <section className="hero text-center">
      <div className="c-container">
        <div className="c-badge">📖 IELTS Official Practice Platform</div>
        <h1>Chinh phục mục tiêu <span>IELTS</span><br />với chuẩn mực học thuật quốc tế</h1>
        <p>Nền tảng luyện thi duy nhất kết hợp phương pháp sư phạm hiện đại và trí tuệ nhân tạo, thiết kế riêng cho mục tiêu từ Band 5.0 đến 8.0+.</p>
        
        <div className="hero-actions">
          <button className="c-btn btn-primary" onClick={() => navigate('/practice/reading')}>Làm bài test năng lực</button>
          <button className="c-btn btn-outline" onClick={() => document.getElementById('course-level-roadmap')?.scrollIntoView({ behavior: 'smooth' })}>Xem khóa học</button>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <h3>{displayBand.toFixed(1)} band</h3>
            <p>Số điểm trung bình được cải thiện</p>
          </div>
          <div className="stat-item">
            <h3>{displayStudents}</h3>
            <p>Bạn học đạt 7.0 điểm IELTS trở lên</p>
          </div>
          <div className="stat-item">
            <h3>{displayEight}</h3>
            <p>Bạn học đạt 8.0 điểm IELTS trở lên</p>
          </div>
        </div>
      </div>
    </section>
  )
}
