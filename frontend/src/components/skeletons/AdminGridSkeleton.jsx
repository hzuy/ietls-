/**
 * AdminGridSkeleton — skeleton lưới các bộ đề Cambridge / thẻ card nội dung.
 * Thay thế đoạn text "Đang tải..." tại CambridgeTab.jsx.
 *
 * Props:
 *   count      {number}  Số lượng thẻ (mặc định 6).
 *   cols       {number}  Số cột (2 hoặc 3). Mặc định 3.
 *   className  {string}  Class tuỳ chỉnh thêm.
 */
export default function AdminGridSkeleton({ count = 6, cols = 3, className = '' }) {
  const gridCls = cols === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'

  return (
    <div className={`grid ${gridCls} gap-4 animate-pulse ${className}`.trim()}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3 min-h-[120px]"
        >
          {/* Card title & subtitle */}
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-zinc-200 rounded" />
            <div className="h-3 w-20 bg-zinc-100 rounded" />
          </div>

          {/* Action buttons placeholder */}
          <div className="flex gap-2 mt-auto pt-2">
            <div className="flex-1 h-8 rounded-lg bg-zinc-100" />
            <div className="w-16 h-8 rounded-lg bg-zinc-100" />
            <div className="w-14 h-8 rounded-lg bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
