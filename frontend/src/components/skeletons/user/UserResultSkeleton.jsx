/**
 * UserResultSkeleton.jsx — Placeholder chuẩn hóa cho màn hình Kết quả bài thi
 * Dùng cho /reading/:id/result, /listening/:id/result và /full-test/result
 * Khớp 1:1 với kích thước container max-w-4xl, vòng tròn điểm số và lưới đáp án.
 */

export default function UserResultSkeleton() {
  return (
    <div
      className="min-h-screen bg-[var(--bg)] font-sans text-zinc-900"
      role="status"
      aria-label="Đang tải kết quả bài thi"
      aria-busy="true"
    >
      {/* 1. Sticky Header */}
      <div aria-hidden="true" className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <div className="w-8" />
        <div className="text-center space-y-1">
          <div className="h-4 w-36 bg-zinc-200/90 rounded-md animate-pulse mx-auto" />
          <div className="h-3 w-28 bg-zinc-100 rounded-md animate-pulse mx-auto" />
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-100 animate-pulse" />
      </div>

      {/* 2. Container nội dung max-w-4xl */}
      <div aria-hidden="true" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16 space-y-6">
        {/* Card 1: Score Card — Vòng tròn điểm + 3 badge stats */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-around gap-6">
          {/* Vòng tròn điểm số 88px */}
          <div className="w-[88px] h-[88px] rounded-full border-6 border-zinc-200 bg-zinc-100 flex items-center justify-center animate-pulse shrink-0">
            <div className="h-8 w-12 bg-zinc-200/90 rounded-md" />
          </div>

          {/* 3 stats đúng/sai/bỏ qua */}
          <div className="flex items-center gap-6 sm:gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 animate-pulse mx-auto" />
                <div className="h-3 w-12 bg-zinc-100 rounded-full animate-pulse mx-auto" />
              </div>
            ))}
          </div>

          {/* Nút hành động Làm lại / Xem lại */}
          <div className="h-9 w-32 bg-zinc-200/80 rounded-full animate-pulse" />
        </div>

        {/* Card 2: Question Type Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <div className="h-5 w-44 bg-zinc-200/90 rounded-md animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-zinc-50 rounded-xl border border-zinc-100 p-2.5 flex items-center justify-between">
                <div className="h-3.5 w-32 bg-zinc-200/80 rounded-md animate-pulse" />
                <div className="h-4 w-14 bg-zinc-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Danh sách đáp án chi tiết */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <div className="h-5 w-36 bg-zinc-200/90 rounded-md animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-9 bg-zinc-50 rounded-xl p-2 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-200/90 animate-pulse shrink-0" />
                <div className="h-3.5 w-24 bg-zinc-200/80 rounded-md animate-pulse" />
                <div className="h-3.5 w-20 bg-zinc-100 rounded-md animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
