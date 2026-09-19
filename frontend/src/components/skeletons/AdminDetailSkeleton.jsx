/**
 * AdminDetailSkeleton — khung chi tiết học viên 2 cột (Card Profile + Lịch sử/Stats).
 * Thay thế vòng xoay spinner đơn điệu tại UserDetail.jsx.
 */
export default function AdminDetailSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto w-full animate-pulse space-y-6">
      {/* Nút quay lại */}
      <div className="h-4 w-20 bg-zinc-200 rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Card Profile học viên */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-200" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <div className="h-5 w-36 bg-zinc-200 rounded" />
            <div className="h-3.5 w-48 bg-zinc-100 rounded" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="h-6 w-16 bg-zinc-100 rounded-full" />
            <div className="h-6 w-20 bg-zinc-100 rounded-full" />
          </div>
          <div className="w-full pt-4 border-t border-zinc-100 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-zinc-100 rounded" />
              <div className="h-3.5 w-24 bg-zinc-200 rounded" />
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <div className="h-8 w-20 bg-zinc-100 rounded-full" />
              <div className="h-8 w-20 bg-zinc-100 rounded-full" />
              <div className="h-8 w-16 bg-zinc-100 rounded-full" />
            </div>
          </div>
        </div>

        {/* Cột phải: Thống kê kỹ năng & Bảng lịch sử bài thi */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dãy thẻ stats 5 ô */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs"
              >
                <div className="h-6 w-12 bg-zinc-200 rounded mb-1.5" />
                <div className="h-3 w-20 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>

          {/* Bảng lịch sử thi gần nhất */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="h-12 bg-zinc-50 border-b border-zinc-200 px-5 flex items-center justify-between">
              <div className="h-4 w-28 bg-zinc-200 rounded" />
              <div className="h-3 w-32 bg-zinc-100 rounded" />
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 border-b border-zinc-100 last:border-b-0 px-5 flex items-center gap-4"
              >
                <div className="h-3.5 w-1/3 bg-zinc-200 rounded" />
                <div className="h-3.5 w-1/4 bg-zinc-100 rounded" />
                <div className="h-3.5 w-1/6 bg-zinc-100 rounded" />
                <div className="h-3.5 w-1/6 bg-zinc-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
