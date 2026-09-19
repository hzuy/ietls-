/**
 * AdminStatsSkeleton — dãy thẻ thống kê KPI 2/3/4 cột.
 *
 * Props:
 *   count      {number}  Số lượng thẻ thống kê (2, 3, 4...). Mặc định 4.
 *   className  {string}  Class tuỳ chỉnh thêm cho grid container.
 */
export default function AdminStatsSkeleton({ count = 4, className = '' }) {
  const getGridCols = () => {
    switch (count) {
      case 2:
        return 'grid-cols-2'
      case 3:
        return 'grid-cols-1 sm:grid-cols-3'
      case 4:
      default:
        return 'grid-cols-2 sm:grid-cols-4'
    }
  }

  return (
    <div className={`grid ${getGridCols()} gap-3 sm:gap-4 animate-pulse ${className}`.trim()}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs"
        >
          <div className="h-7 w-16 bg-zinc-200 rounded mb-2" />
          <div className="h-3.5 w-24 bg-zinc-100 rounded" />
        </div>
      ))}
    </div>
  )
}
