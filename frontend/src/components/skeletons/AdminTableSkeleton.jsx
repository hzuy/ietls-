/**
 * AdminTableSkeleton — skeleton chuẩn hóa cho các bảng dữ liệu Admin.
 *
 * Props:
 *   rows          {number}  Số dòng body (mặc định 8)
 *   cols          {number}  Số cột hiển thị (mặc định 5)
 *   firstColType  {string}  'avatar' | 'checkbox' | 'text' | 'thumbnail' (mặc định 'text')
 *   className     {string}  Class tuỳ chỉnh thêm cho container
 */
export default function AdminTableSkeleton({
  rows = 8,
  cols = 5,
  firstColType = 'text',
  className = '',
}) {
  const remainingColWidths = ['w-28', 'w-20', 'w-32', 'w-24', 'w-16']

  const renderHeaderFirstCol = () => {
    switch (firstColType) {
      case 'checkbox':
        return (
          <div className="w-10 shrink-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded bg-zinc-200" />
          </div>
        )
      case 'thumbnail':
        return (
          <div className="w-16 shrink-0">
            <div className="w-10 h-3 bg-zinc-200 rounded" />
          </div>
        )
      case 'avatar':
        return (
          <div className="w-48 sm:w-56 shrink-0">
            <div className="w-24 h-3 bg-zinc-200 rounded" />
          </div>
        )
      case 'text':
      default:
        return (
          <div className="w-32 shrink-0">
            <div className="w-20 h-3 bg-zinc-200 rounded" />
          </div>
        )
    }
  }

  const renderBodyFirstCol = () => {
    switch (firstColType) {
      case 'checkbox':
        return (
          <div className="w-10 shrink-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded bg-zinc-200" />
          </div>
        )
      case 'thumbnail':
        return (
          <div className="w-16 shrink-0">
            <div className="w-14 h-9 rounded-md bg-zinc-200 shrink-0" />
          </div>
        )
      case 'avatar':
        return (
          <div className="flex items-center gap-3 w-48 sm:w-56 shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3 w-28 bg-zinc-200 rounded" />
              <div className="h-2.5 w-36 bg-zinc-100 rounded" />
            </div>
          </div>
        )
      case 'text':
      default:
        return (
          <div className="w-32 shrink-0">
            <div className="w-24 h-4 rounded bg-zinc-200" />
          </div>
        )
    }
  }

  const extraColsCount = Math.max(0, cols - 2) // Trừ cột 1 và cột action cuối

  return (
    <div
      className={`border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs animate-pulse ${className}`.trim()}
    >
      {/* Fake Thead */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-5 py-3 flex items-center gap-4">
        {renderHeaderFirstCol()}

        {/* Cột thứ 2 nếu là checkbox (thường là User/Title) */}
        {firstColType === 'checkbox' && (
          <div className="w-40 shrink-0">
            <div className="w-24 h-3 bg-zinc-200 rounded" />
          </div>
        )}

        {Array.from({ length: extraColsCount }).map((_, c) => (
          <div
            key={c}
            className={`h-3 bg-zinc-200 rounded ${
              remainingColWidths[c % remainingColWidths.length]
            }`}
          />
        ))}

        <div className="h-3 w-16 bg-zinc-200 rounded ml-auto shrink-0" />
      </div>

      {/* Fake Tbody */}
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={`h-14 border-b border-zinc-100 last:border-b-0 px-5 flex items-center gap-4 ${
              r % 2 === 1 ? 'bg-zinc-50/30' : ''
            }`}
          >
            {renderBodyFirstCol()}

            {/* Cột thứ 2 nếu là checkbox */}
            {firstColType === 'checkbox' && (
              <div className="w-40 shrink-0 space-y-1.5">
                <div className="h-3 w-28 bg-zinc-200 rounded" />
                <div className="h-2.5 w-36 bg-zinc-100 rounded" />
              </div>
            )}

            {Array.from({ length: extraColsCount }).map((_, c) => (
              <div
                key={c}
                className={`h-3 bg-zinc-100 rounded ${
                  remainingColWidths[c % remainingColWidths.length]
                }`}
              />
            ))}

            <div className="h-7 w-16 rounded-full bg-zinc-100 ml-auto shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
