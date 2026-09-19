/**
 * UserExamListSkeleton.jsx — Placeholder cho danh sách các bài test theo bộ (/full-test/:id)
 * Mô phỏng chính xác thẻ Test 1-4 dạng bento:
 *  - Bo góc rounded-2xl, viền border-zinc-200, padding 18px
 *  - Header: Tên Test (Test 1...) + Badge số lượng kỹ năng bo viên thuốc rounded-full
 *  - Hàng kỹ năng: 4 chip pills nhỏ bo rounded-full
 *  - Đáy: Nút bấm Làm bài bo viên thuốc h-9 w-full rounded-full
 * Triệt tiêu hoàn toàn Layout Shift giật >200px do thẻ bìa sách đứng trước đây.
 */

export default function UserExamListSkeleton({ count = 4, className = '' }) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${className}`.trim()}
      role="status"
      aria-label="Đang tải danh sách bài test"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-2xl border border-zinc-200 bg-white p-[18px] shadow-2xs flex flex-col justify-between"
          style={{ borderRadius: '1rem', minHeight: '142px' }}
        >
          {/* Header thẻ: Tên Test + Badge số kỹ năng */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="h-5 w-20 bg-zinc-200/90 rounded-md animate-pulse" />
            <div className="h-5 w-18 bg-zinc-100 rounded-full border border-zinc-200/70 animate-pulse" />
          </div>

          {/* Dải 4 chip pills kỹ năng R/L/W/S */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <div className="h-5 w-14 bg-zinc-100 rounded-full border border-zinc-200/60 animate-pulse" />
            <div className="h-5 w-14 bg-zinc-100 rounded-full border border-zinc-200/60 animate-pulse" />
            <div className="h-5 w-14 bg-zinc-100 rounded-full border border-zinc-200/60 animate-pulse" />
            <div className="h-5 w-14 bg-zinc-100 rounded-full border border-zinc-200/60 animate-pulse" />
          </div>

          {/* Nút bấm viên thuốc Làm bài */}
          <div className="w-full h-9 bg-zinc-100 rounded-full border border-zinc-200 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
