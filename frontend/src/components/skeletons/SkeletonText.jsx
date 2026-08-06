import SkeletonBase from './SkeletonBase'

/**
 * SkeletonText — placeholder for text-heavy pages (detail/form views).
 * Used in: Profile, Settings, UserDetail, SampleDetailPage.
 *
 * Props:
 *   lines     {number}  Number of text lines. Default 6.
 *   withTitle {boolean} Show a large heading skeleton at top. Default true.
 *   className {string}  Extra classes on the wrapper.
 */
export default function SkeletonText({ lines = 6, withTitle = true, className = '' }) {
  // Widths vary to look like natural prose
  const lineWidths = ['w-full', 'w-5/6', 'w-full', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6', 'w-full']

  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      {withTitle && (
        <div className="space-y-3 pb-2">
          <SkeletonBase className="h-7 w-1/3 rounded-lg" />
          <SkeletonBase className="h-4 w-2/5 rounded" />
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBase
            key={i}
            className={`h-3.5 rounded ${lineWidths[i % lineWidths.length]}`}
          />
        ))}
      </div>
    </div>
  )
}
