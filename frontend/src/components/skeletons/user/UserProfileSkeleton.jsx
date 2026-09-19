/**
 * UserProfileSkeleton.jsx — Placeholder chuẩn hóa cho trang Hồ sơ cá nhân (/profile)
 * Hỗ trợ 2 biến thể:
 *  - 'full'    : Khung toàn trang gồm Sidebar cá nhân + Form thông tin
 *  - 'results' : Tab kết quả học tập (3 stat cards + Card 4 thanh tiến độ kỹ năng)
 */

export default function UserProfileSkeleton({ variant = 'results' }) {
  if (variant === 'results') {
    return (
      <div
        className="flex flex-col gap-6"
        role="status"
        aria-label="Đang tải kết quả luyện thi"
        aria-busy="true"
      >
        {/* 3 stat cards */}
        <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card-base p-6 flex flex-col items-center justify-center h-[116px] rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="w-16 h-8 bg-zinc-200/90 animate-pulse rounded-md mb-2" />
              <div className="w-24 h-4 bg-zinc-100 animate-pulse rounded-full" />
            </div>
          ))}
        </div>

        {/* Card 4 thanh tiến độ kỹ năng R/L/W/S — Triệt tiêu giật layout từ 116px lên 420px */}
        <div aria-hidden="true" className="card-base p-8 rounded-2xl border border-zinc-200 bg-white">
          <div className="h-6 w-56 bg-zinc-200/90 rounded-md animate-pulse mb-6" />

          <div className="space-y-6">
            {['Reading', 'Listening', 'Writing', 'Speaking'].map((skill) => (
              <div key={skill} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="h-4 w-20 bg-zinc-200/80 rounded-md animate-pulse" />
                  <div className="h-5 w-8 bg-zinc-200/90 rounded-md animate-pulse" />
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full bg-zinc-200/90 animate-pulse w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Biến thể toàn trang (Sidebar + Content Form)
  return (
    <div
      className="app-container pt-6 pb-16 flex flex-col md:flex-row gap-8 items-start anim-fade-up"
      role="status"
      aria-label="Đang tải hồ sơ học tập"
      aria-busy="true"
    >
      {/* Sidebar cá nhân */}
      <div aria-hidden="true" className="w-full md:w-64 shrink-0 flex flex-col gap-4">
        {/* User Card */}
        <div className="card-base p-6 text-center rounded-2xl border border-zinc-200 bg-white">
          <div className="w-16 h-16 rounded-full bg-zinc-200/90 animate-pulse mx-auto mb-4" />
          <div className="h-5 w-28 bg-zinc-200/90 rounded-md animate-pulse mx-auto mb-2" />
          <div className="h-4 w-36 bg-zinc-100 rounded-full animate-pulse mx-auto mb-3" />
          <div className="h-5 w-20 bg-zinc-100 rounded-full border border-zinc-200/70 animate-pulse mx-auto" />
        </div>

        {/* Menu tabs */}
        <div className="card-base overflow-hidden flex flex-col rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-3">
              <div className="w-4 h-4 rounded-md bg-zinc-200/80 animate-pulse" />
              <div className="h-4 w-32 bg-zinc-100 animate-pulse rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Content chính (Form 3 ô PillInput) */}
      <div aria-hidden="true" className="flex-1 min-w-0">
        <div className="card-base p-8 rounded-2xl border border-zinc-200 bg-white">
          <div className="h-6 w-44 bg-zinc-200/90 rounded-md animate-pulse mb-6" />

          <div className="flex flex-col gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-24 bg-zinc-200/80 rounded-md animate-pulse" />
                <div className="h-10 w-full bg-zinc-100 rounded-full border border-zinc-200 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="h-10 w-32 bg-zinc-200/90 rounded-full animate-pulse mt-6" />
        </div>
      </div>
    </div>
  )
}
