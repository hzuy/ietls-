/**
 * AdminAnalyticsSkeleton — skeleton layout cho trang Thống kê & Phân tích (Analytics/Dashboard).
 * Bao gồm: 3 thẻ KPI (h-[88px]), AreaChart 2/3 (h-[250px]), Doughnut 1/3 (h-[250px]), bảng kỹ năng.
 */
export default function AdminAnalyticsSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto w-full animate-pulse space-y-6">
      {/* Header + Dropdown filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-7 w-52 bg-zinc-200 rounded" />
          <div className="h-3.5 w-64 bg-zinc-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-zinc-100 rounded-md border border-zinc-200" />
      </div>

      {/* 3 Thẻ KPI lớn */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[88px] rounded-2xl bg-white border border-zinc-200 p-4 shadow-xs flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-20 bg-zinc-200 rounded" />
              <div className="h-3 w-32 bg-zinc-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Khung biểu đồ: AreaChart (2/3) + Doughnut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[250px] rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 bg-zinc-200 rounded" />
            <div className="h-3 w-24 bg-zinc-100 rounded" />
          </div>
          <div className="h-36 w-full bg-zinc-100/70 rounded-xl flex items-end px-4 pb-2 gap-2">
            {[30, 50, 40, 70, 60, 85, 45, 90, 65, 80].map((h, idx) => (
              <div
                key={idx}
                className="flex-1 bg-zinc-200 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 h-[250px] rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs flex flex-col items-center justify-between">
          <div className="h-4 w-36 bg-zinc-200 rounded self-start" />
          <div className="w-28 h-28 rounded-full border-8 border-zinc-200/80 bg-transparent my-auto" />
          <div className="flex justify-center gap-3 w-full">
            <div className="h-3 w-14 bg-zinc-100 rounded" />
            <div className="h-3 w-14 bg-zinc-100 rounded" />
            <div className="h-3 w-14 bg-zinc-100 rounded" />
          </div>
        </div>
      </div>

      {/* Bảng phân tích kỹ năng bên dưới */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-44 bg-zinc-200 rounded" />
          <div className="h-3 w-24 bg-zinc-100 rounded" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-11 bg-zinc-50/80 border border-zinc-100 rounded-xl flex items-center px-4 gap-4"
            >
              <div className="h-3.5 w-24 bg-zinc-200 rounded" />
              <div className="h-3 w-16 bg-zinc-100 rounded" />
              <div className="h-2.5 flex-1 bg-zinc-200 rounded-full max-w-xs ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
