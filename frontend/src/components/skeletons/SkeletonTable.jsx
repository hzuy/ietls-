import SkeletonBase from './SkeletonBase'

/**
 * SkeletonTable — placeholder for multi-column data tables.
 * Used in: Attempts, Users, Staff, Accounts, Trash (admin).
 *
 * Props:
 *   rows   {number}  Number of body rows. Default 8.
 *   cols   {number}  Number of columns per row. Default 5.
 */
export default function SkeletonTable({ rows = 8, cols = 5 }) {
  // Column widths cycle to look natural (not all the same)
  const colWidths = ['w-36', 'w-20', 'w-24', 'w-16', 'w-20', 'w-16', 'w-12']

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      {/* Fake thead */}
      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBase
            key={c}
            className={`h-3 rounded ${colWidths[c % colWidths.length]}`}
          />
        ))}
      </div>

      {/* Fake tbody rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="border-b border-gray-50 px-5 py-3.5 flex items-center gap-4"
        >
          {Array.from({ length: cols }).map((_, c) => {
            // First column gets an avatar + text stack style
            if (c === 0) {
              return (
                <div key={c} className="flex items-center gap-3 flex-1 min-w-0">
                  <SkeletonBase className="w-8 h-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <SkeletonBase className="h-3 w-28 rounded" />
                    <SkeletonBase className="h-2.5 w-36 rounded" />
                  </div>
                </div>
              )
            }
            return (
              <SkeletonBase
                key={c}
                className={`h-3 rounded ${colWidths[c % colWidths.length]}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
