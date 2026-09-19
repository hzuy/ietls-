/**
 * UserHistorySkeleton.jsx — Placeholder cho trang Lịch sử làm bài (/history)
 * Khớp 1:1 với cấu trúc danh sách lượt thi của học viên:
 *  - Filter card: 3 ô bộ lọc h-9
 *  - List card: Bo rounded-2xl, viền border-zinc-200, divide-y divide-zinc-100
 *  - Từng hàng: Skill badge bo viên thuốc rounded-full, title, stats câu đúng/band, nút Xem lại rounded-full
 */

export default function UserHistorySkeleton({ count = 5, showFilters = false }) {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Đang tải lịch sử làm bài"
      aria-busy="true"
    >
      {/* Khung bộ lọc (tùy chọn) */}
      {showFilters && (
        <div aria-hidden="true" className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-zinc-200/80 rounded-md animate-pulse" />
              <div className="h-9 w-full bg-zinc-100 rounded-lg border border-zinc-200 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-zinc-200/80 rounded-md animate-pulse" />
              <div className="h-9 w-full bg-zinc-100 rounded-lg border border-zinc-200 animate-pulse" />
            </div>
            <div>
              <div className="h-9 w-full bg-zinc-100 rounded-lg border border-zinc-200 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Danh sách các lượt thi */}
      <div aria-hidden="true" className="card-base rounded-2xl border border-zinc-200 bg-white overflow-hidden divide-y divide-zinc-100">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4"
          >
            {/* Cột trái: Skill badge + Title + Subtitle */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-zinc-200/80 rounded-full animate-pulse" />
                <div className="h-4 w-48 bg-zinc-200/90 rounded-md animate-pulse" />
              </div>
              <div className="h-3 w-32 bg-zinc-100 rounded-md animate-pulse ml-0.5" />
            </div>

            {/* Cột phải: Stat câu đúng + Band score + Date + Nút xem lại viên thuốc */}
            <div className="flex items-center gap-5 sm:gap-6 shrink-0">
              <div className="text-center space-y-1">
                <div className="h-4 w-12 bg-zinc-200/90 rounded-md animate-pulse mx-auto" />
                <div className="h-2.5 w-14 bg-zinc-100 rounded-full animate-pulse mx-auto" />
              </div>

              <div className="text-center space-y-1">
                <div className="h-4 w-8 bg-zinc-200/90 rounded-md animate-pulse mx-auto" />
                <div className="h-2.5 w-10 bg-zinc-100 rounded-full animate-pulse mx-auto" />
              </div>

              <div className="h-3.5 w-24 bg-zinc-100 rounded-full animate-pulse hidden md:block" />

              <div className="h-8 w-20 bg-zinc-200/90 rounded-full animate-pulse shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
