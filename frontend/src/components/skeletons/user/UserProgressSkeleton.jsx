/**
 * UserProgressSkeleton.jsx — Placeholder cho trang Phân tích tiến độ (/progress)
 * Thay thế 2 khối hộp xám rỗng lệch bố cục:
 *  - 1. Dải 4 thẻ thống kê tổng quan (Reading/Listening, Accuracy, Writing, Speaking)
 *  - 2. Card lớn phân tích chi tiết dạng bài với các thanh tiến độ bo viên thuốc
 */

export default function UserProgressSkeleton() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-label="Đang tải số liệu thống kê tiến độ"
      aria-busy="true"
    >
      {/* 1. Dải 4 Stat Cards */}
      <div aria-hidden="true" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200 bg-white p-5 h-[110px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-zinc-200/80 rounded-md animate-pulse" />
              <div className="w-4 h-4 rounded-full bg-zinc-100 animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-zinc-200/90 rounded-md animate-pulse" />
            <div className="h-3 w-28 bg-zinc-100 rounded-md animate-pulse" />
          </div>
        ))}
      </div>

      {/* 2. Card lớn Phân tích theo dạng bài */}
      <div aria-hidden="true" className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="h-6 w-56 bg-zinc-200/90 rounded-md animate-pulse" />
          <div className="h-6 w-24 bg-zinc-100 rounded-full animate-pulse" />
        </div>

        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-44 bg-zinc-200/80 rounded-md animate-pulse" />
                <div className="h-4 w-12 bg-zinc-200/90 rounded-md animate-pulse" />
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-200/90 animate-pulse"
                  style={{ width: `${Math.max(25, 80 - i * 12)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
