import SkeletonBase from './SkeletonBase'

/**
 * SkeletonCard — placeholder for thumbnail + title + meta cards.
 * Used in: ExamList, WritingSamples (admin), SpeakingSamples (admin).
 *
 * Props:
 *   count      {number}  Number of skeleton cards to render. Default 5.
 *   className  {string}  Extra classes on the wrapper grid.
 */
export default function SkeletonCard({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4 animate-pulse"
        >
          {/* Thumbnail */}
          <SkeletonBase className="shrink-0 w-14 h-10 rounded-lg" />

          {/* Text block */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <SkeletonBase className="h-4 w-2/5 rounded" />
              <SkeletonBase className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBase className="h-3 w-28 rounded" />
              <SkeletonBase className="h-3 w-20 rounded" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <SkeletonBase className="h-7 w-14 rounded-xl" />
            <SkeletonBase className="h-7 w-12 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
