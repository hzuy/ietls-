import QuestionNavButton from './QuestionNavButton'

/**
 * QuestionPanelPopover — popover "Bảng câu hỏi" dùng chung cho ReadingExam + ListeningExam
 * (tách từ 2 khối gần trùng khít — P3a + G). Practice KHÔNG dùng: theo thiết kế Practice
 * là danh sách phẳng, không có passage/section nên không có popover.
 *
 * Mỗi nhóm (Passage / Section) hiển thị theo thứ tự:
 *   tiêu đề "Passage N · x/y"  →  progress bar (track --border-soft, fill --primary)  →  lưới số câu
 * Tỉ lệ answered/total tính từ chính mảng items — KHÔNG cần state mới.
 *
 * Props:
 *   groups       — [{ label, items: [{ number, answered, ref }] }]
 *   activeIndex  — index nhóm đang xem (đổi màu tiêu đề)
 *   bottomOffset — px: đáy popover cách đáy viewport (thường bottomBarHeight + 8)
 *   onJump       — (ref) => void — nhảy tới câu; ref do caller tự định nghĩa (số câu hoặc slot)
 *   onClose      — () => void
 */
export default function QuestionPanelPopover({ groups, activeIndex, bottomOffset, onJump, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className="fixed left-4 z-40 bg-white rounded-lg shadow-lg border border-gray-200 w-72 max-h-80 overflow-y-auto"
        style={{ bottom: bottomOffset }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">Bảng câu hỏi</h3>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold transition"
          >✕</button>
        </div>
        <div className="px-4 py-3 space-y-4">
          {groups.map((g, gi) => {
            const total = g.items.length
            const answered = g.items.filter(it => it.answered).length
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0
            const isActive = activeIndex === gi
            return (
              <div key={gi}>
                <p className={`text-xs font-bold mb-1.5 ${isActive ? 'text-[var(--primary-hover)]' : 'text-gray-500'}`}>
                  {g.label} <span className="font-mono font-normal text-gray-400">· {answered}/{total}</span>
                </p>
                <div
                  className="h-1 rounded-full mb-2.5 overflow-hidden"
                  style={{ backgroundColor: 'var(--border-soft)' }}
                  role="progressbar"
                  aria-valuenow={answered}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-label={`${g.label}: ${answered}/${total} câu đã làm`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map(it => (
                    <QuestionNavButton
                      key={it.number}
                      number={it.number}
                      status={it.answered ? 'answered' : 'unanswered'}
                      onClick={() => { onJump(it.ref); onClose() }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
