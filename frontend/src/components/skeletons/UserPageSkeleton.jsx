/**
 * UserPageSkeleton.jsx — Suspense fallback cấp trang cho khu vực User
 * Thiết kế 1 cột mượt mà theo chuẩn Soft Academic Design của IELTSPro:
 *  - Không vẽ header giả h-16 (tránh giật chớp tắt khi Navbar thật của UserLayout đã có sẵn)
 *  - Bo góc rounded-2xl cho các khối card, rounded-full cho pills/tags
 *  - Tông xám sáng êm dịu bg-zinc-100 / bg-zinc-200/80
 */
export default function UserPageSkeleton() {
  return (
    <div
      className="min-h-screen bg-[var(--bg)] flex flex-col anim-fade-up"
      role="status"
      aria-label="Đang nạp trang..."
      aria-busy="true"
    >
      <div aria-hidden="true" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col gap-8">
        {/* Khung Hero banner */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4">
          <div className="h-7 w-2/5 bg-zinc-200/90 rounded-xl animate-pulse" />
          <div className="h-4 w-3/5 bg-zinc-100 rounded-md animate-pulse" />
          <div className="flex items-center gap-3 pt-2">
            <div className="h-9 w-40 bg-zinc-200/80 rounded-full animate-pulse" />
            <div className="h-9 w-32 bg-zinc-100 rounded-full border border-zinc-200 animate-pulse" />
          </div>
        </div>

        {/* Khung Dải thống kê 3 widget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[120px] rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-zinc-200/80 rounded-md animate-pulse" />
                <div className="w-4 h-4 rounded-full bg-zinc-100 animate-pulse" />
              </div>
              <div className="h-7 w-16 bg-zinc-200/90 rounded-md animate-pulse" />
              <div className="h-2 w-full bg-zinc-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>

        {/* Khung Lưới đề thi / bài học */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
            <div className="h-5 w-44 bg-zinc-200/90 rounded-md animate-pulse" />
            <div className="h-4 w-28 bg-zinc-100 rounded-full animate-pulse" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col"
              >
                <div className="w-full aspect-[3/4] bg-zinc-200/80 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-zinc-200/90 rounded-md w-4/5 animate-pulse" />
                  <div className="h-3 bg-zinc-100 rounded-md w-3/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
