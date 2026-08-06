import SkeletonBase from './SkeletonBase'

/**
 * SkeletonChart — placeholder for Dashboard / Analytics pages.
 * Layout: 4 stat cards in a row + 1 bar-chart area below.
 */
export default function SkeletonChart() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
            <SkeletonBase className="h-8 w-8 rounded-lg" />
            <SkeletonBase className="h-7 w-16 rounded" />
            <SkeletonBase className="h-3 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <SkeletonBase className="h-5 w-40 rounded mb-6" />
        {/* Bar chart skeleton */}
        <div className="flex items-end gap-3 h-40">
          {[60, 85, 45, 70, 90, 55, 75].map((h, i) => (
            <SkeletonBase
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        {/* X-axis labels */}
        <div className="flex gap-3 mt-3">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <SkeletonBase key={i} className="flex-1 h-3 rounded" />
          ))}
        </div>
      </div>

      {/* Second row — two side-by-side panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
            <SkeletonBase className="h-5 w-32 rounded mb-4" />
            {[80, 60, 40, 70, 50].map((w, j) => (
              <div key={j} className="flex items-center gap-3">
                <SkeletonBase className="h-3 w-20 rounded" />
                <SkeletonBase className="h-3 rounded flex-1" style={{ maxWidth: `${w}%` }} />
                <SkeletonBase className="h-3 w-8 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
