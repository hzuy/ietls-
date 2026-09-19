/**
 * UserHomeSkeleton.jsx — Placeholder toàn trang cho Trang chủ (Home.jsx)
 * Khớp 1:1 với cấu trúc Đợt 3 mới nhất:
 *  - 1. Hero light với nút bấm bo viên thuốc
 *  - 2. Dải tiến độ: Thẻ resume/bắt đầu + 3 widget ngang (streak, band, quick fulltest)
 *  - 3. Lưới sách Cambridge 6 ô aspect-[3/4]
 *  - 4. Lưới khám phá 4 ô kỹ năng bo rounded-2xl
 */

export default function UserHomeSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col"
      role="status"
      aria-label="Đang tải dữ liệu trang chủ"
      aria-busy="true"
    >
      {/* 1. Hero Section */}
      <section aria-hidden="true" className="relative overflow-hidden border-b border-zinc-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-2xl w-full">
            <div className="h-8 w-3/4 bg-zinc-200/90 rounded-xl animate-pulse mb-3" />
            <div className="h-4 w-full bg-zinc-100 rounded-md animate-pulse mb-2" />
            <div className="h-4 w-2/3 bg-zinc-100 rounded-md animate-pulse mb-6" />

            {/* 2 nút bấm bo viên thuốc */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-9 w-44 bg-zinc-200/80 rounded-full animate-pulse" />
              <div className="h-9 w-36 bg-zinc-100 rounded-full border border-zinc-200 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Nội dung chính 1 cột */}
      <main aria-hidden="true" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-9">
        {/* Dải tiến độ: Card lớn + 3 widgets */}
        <section className="flex flex-col gap-4">
          <div className="p-5 sm:p-6 rounded-2xl border border-zinc-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-48 bg-zinc-200/90 rounded-md animate-pulse" />
              <div className="h-3.5 w-72 bg-zinc-100 rounded-md animate-pulse" />
            </div>
            <div className="h-9 w-36 bg-zinc-200/80 rounded-full animate-pulse shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 bg-white p-4 h-[130px] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 bg-zinc-200/80 rounded-md animate-pulse" />
                  <div className="w-4 h-4 rounded-full bg-zinc-100 animate-pulse" />
                </div>
                <div className="h-7 w-20 bg-zinc-200/90 rounded-md animate-pulse" />
                <div className="h-2 w-full bg-zinc-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        {/* Section 1: Bộ đề Cambridge Academic (Lưới 6 cuốn) */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <div className="h-5 w-44 bg-zinc-200/90 rounded-md animate-pulse" />
              <div className="h-7 w-48 bg-zinc-100 rounded-full border border-zinc-200 animate-pulse hidden sm:block" />
            </div>
            <div className="h-4 w-32 bg-zinc-100 rounded-full animate-pulse" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col">
                <div className="w-full aspect-[3/4] bg-zinc-200/80 rounded-xl animate-pulse" />
                <div className="h-3.5 bg-zinc-200/90 rounded-md mt-2.5 w-3/4 animate-pulse" />
                <div className="h-3 bg-zinc-100 rounded-md mt-1.5 w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Khám phá thêm 4 ô kỹ năng */}
        <section className="flex flex-col gap-4">
          <div className="pb-3 border-b border-zinc-200">
            <div className="h-5 w-36 bg-zinc-200/90 rounded-md animate-pulse" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl border border-zinc-200 bg-white flex flex-col justify-between h-[180px]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-24 bg-zinc-100 rounded-full animate-pulse" />
                    <div className="h-3.5 w-16 bg-zinc-100 rounded-full animate-pulse" />
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-100 shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-28 bg-zinc-200/80 rounded-md animate-pulse" />
                      <div className="h-3 w-full bg-zinc-100 rounded-md animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="h-3.5 w-24 bg-zinc-100 rounded-full animate-pulse pt-2" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
