import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import { Eye, Clock } from 'lucide-react'

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * ExamAttemptListModal — Hiển thị danh sách các lượt làm bài (attempts) của một kỹ năng cụ thể
 * Được gọi từ Modal chọn kỹ năng (FullTestDetail.jsx)
 *
 * Props:
 *   open        — boolean
 *   onClose     — () => void
 *   skill       — string ('reading', 'listening', 'writing', 'speaking')
 *   skillLabel  — string (e.g. 'Reading')
 *   attempts    — array of attempt objects
 */
export default function ExamAttemptListModal({
  open,
  onClose,
  skill,
  skillLabel,
  attempts = []
}) {
  const navigate = useNavigate()

  if (!open) return null

  const handleReview = (h) => {
    const params = new URLSearchParams({ attemptId: h.attemptId })
    if (h.finishedAt) params.set('finishedAt', h.finishedAt)
    const targetRoute = (h.skill === 'reading' || h.skill === 'listening') ? 'explanation' : 'result'
    navigate(`/${h.skill}/${h.examId}/${targetRoute}?${params.toString()}`)
  }

  // Lấy color css vars từ index.css
  const getSkillColorVar = (s) => {
    switch(s) {
      case 'reading': return 'var(--skill-r-color)'
      case 'listening': return 'var(--skill-l-color)'
      case 'writing': return 'var(--skill-w-color)'
      case 'speaking': return 'var(--skill-s-color)'
      default: return 'var(--primary)'
    }
  }
  
  const skillColor = getSkillColorVar(skill)

  return (
    <Modal
      onClose={onClose}
      size="md"
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 sticky top-0 bg-[var(--surface)] z-10 pb-2 border-b border-zinc-100">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Lịch sử làm bài <span style={{ color: skillColor }}>{skillLabel}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-bold cursor-pointer border-none bg-transparent"
          >
            ✕
          </button>
        </div>
        
        {attempts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">Bạn chưa có lượt làm bài nào cho đề này.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {attempts.map((a, i) => (
              <div 
                key={a.attemptId} 
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-zinc-900 text-sm">
                      Lần {attempts.length - i}
                    </span>
                    {(a.bandScore !== null && a.bandScore !== undefined) && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        Band {a.bandScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {fmtDateTime(a.finishedAt)}
                    </span>
                    {a.total > 0 && (
                      <span className="font-medium">
                        {a.correct}/{a.total} câu
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleReview(a)}
                  className="h-9 px-4 rounded-full text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs leading-none"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem lại
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
