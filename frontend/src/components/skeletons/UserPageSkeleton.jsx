/** Suspense fallback dùng cho các route phía User — mô phỏng bố cục 2 cột của Trang chủ. */
export default function UserPageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-zinc-950">
      <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột chính */}
          <div className="lg:col-span-8 flex flex-col gap-9">
            {/* Hero card giả lập */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 animate-pulse">
              <div className="h-4 w-40 bg-zinc-100 dark:bg-zinc-800 rounded mb-3" />
              <div className="h-6 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full" />
            </div>

            {/* Danh sách thẻ bài thi */}
            <div className="flex flex-col gap-4">
              <div className="h-5 w-48 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-[145px] sm:w-[160px] shrink-0">
                    <div className="w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                    <div className="h-3.5 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded mt-2.5 animate-pulse" />
                    <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded mt-1.5 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Cột widget */}
          <aside className="lg:col-span-4 flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 animate-pulse"
              >
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-3.5" />
                <div className="h-8 w-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}
