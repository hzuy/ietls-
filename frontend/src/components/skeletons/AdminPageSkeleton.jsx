/** Suspense fallback dùng cho vùng nội dung Admin (`AdminLayout` Outlet) — dashboard / bảng dữ liệu. */
export default function AdminPageSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="h-9 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-9 flex-1 max-w-sm bg-zinc-100 dark:bg-zinc-800 rounded-md" />
        <div className="h-9 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
        <div className="h-9 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="h-10 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-12 flex items-center gap-4 px-4 ${
              i < 4 ? 'border-b border-zinc-100 dark:border-zinc-800/80' : ''
            }`}
          >
            <div className="h-3.5 w-1/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-3.5 w-1/6 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-3.5 w-1/5 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-3.5 w-1/6 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
