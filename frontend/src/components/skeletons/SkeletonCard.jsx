/**
 * SkeletonCard — shared placeholder card for thumbnail + title + meta + button.
 * Used in: Home, PracticeList, FullTest, SeriesPage.
 *
 * Props:
 *   count      {number}  Optional count of cards to render. Default 1.
 *   className  {string}  Extra classes on each card container.
 *   aspect     {string}  '16/9' (default, h-40) | '4/5' | '3/4' for portrait book cards.
 */
export default function SkeletonCard({ count, className = '', aspect = '16/9' }) {
  // Tailwind cần class arbitrary-value tĩnh trong source để generate — không nội suy
  // `aspect-[${aspect}]` được, nên liệt kê tường minh từng tỉ lệ đang thực sự dùng.
  const aspectClass = aspect === '4/5' ? 'aspect-[4/5]' : aspect === '3/4' ? 'aspect-[3/4]' : 'h-40'

  const renderCard = (key) => (
    <div
      key={key}
      className={`card-base flex flex-col overflow-hidden h-full ${className}`}
    >
      {/* Thumbnail */}
      <div className={`w-full bg-slate-200 animate-pulse shrink-0 ${aspectClass}`} />

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="h-4 bg-slate-200 animate-pulse rounded w-full" />
        <div className="h-3 bg-slate-200 animate-pulse rounded w-2/3" />
        <div className="h-4 bg-slate-200 animate-pulse rounded w-[55%] mt-auto" />
        <div className="h-9 bg-slate-200 animate-pulse rounded-xl mt-2" />
      </div>
    </div>
  )

  if (count && count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => renderCard(i))}
      </>
    )
  }

  return renderCard(undefined)
}
