/** Suspense fallback dùng cho vùng nội dung Admin (`AdminLayout` Outlet) — triệt tiêu Layout Shift */
export default function AdminPageSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto w-full flex flex-col gap-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-zinc-200 rounded" />
        <div className="h-9 w-32 bg-zinc-100 rounded-md" />
      </div>

      {/* Filter / search bar placeholder */}
      <div className="flex items-center gap-3">
        <div className="h-9 flex-1 max-w-sm bg-zinc-100 rounded-md" />
        <div className="h-9 w-28 bg-zinc-100 rounded-md" />
        <div className="h-9 w-28 bg-zinc-100 rounded-md" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-xs">
        <div className="h-10 bg-zinc-50 border-b border-zinc-200 px-5 flex items-center gap-4">
          <div className="h-3 w-36 bg-zinc-200 rounded" />
          <div className="h-3 w-20 bg-zinc-200 rounded" />
          <div className="h-3 w-24 bg-zinc-200 rounded" />
          <div className="h-3 w-20 bg-zinc-200 rounded ml-auto" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={`h-12 flex items-center gap-4 px-5 ${
              i < 7 ? 'border-b border-zinc-100' : ''
            }`}
          >
            <div className="h-3.5 w-1/4 bg-zinc-100 rounded" />
            <div className="h-3.5 w-1/6 bg-zinc-100 rounded" />
            <div className="h-3.5 w-1/5 bg-zinc-100 rounded" />
            <div className="h-3.5 w-1/6 bg-zinc-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
