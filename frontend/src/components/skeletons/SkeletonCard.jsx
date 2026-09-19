/**
 * SkeletonCard — shared placeholder card for thumbnail + title + meta.
 * Used in: Home, PracticeList, FullTest, SeriesPage.
 *
 * Props:
 *   count      {number}   Optional count of cards to render. Default 1.
 *   className  {string}   Extra classes on each card container.
 *   aspect     {string}   '16/9' (default, h-40) | '4/5' | '3/4' for portrait book cards.
 *   hasButton  {boolean}  Default false (ContentCard Đợt 3 không còn nút CTA to ở đáy).
 */
export default function SkeletonCard({ count, className = '', aspect = '16/9', hasButton = false }) {
  // Tailwind cần class arbitrary-value tĩnh trong source để generate
  const aspectClass =
    aspect === '4/5' ? 'aspect-[4/5]' : aspect === '3/4' ? 'aspect-[3/4]' : aspect === '16/9' ? 'aspect-video' : 'h-40'

  const renderCard = (key) => (
    <div
      key={key}
      className={`card-base flex flex-col overflow-hidden h-full rounded-2xl border border-zinc-200 bg-white ${className}`.trim()}
      style={{ borderRadius: '1rem' }}
      role="status"
      aria-busy="true"
    >
      {/* Thumbnail */}
      <div className={`w-full bg-zinc-200/80 animate-pulse shrink-0 ${aspectClass}`} />

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 bg-zinc-200/90 animate-pulse rounded-md w-full" />
          <div className="h-3.5 bg-zinc-100 animate-pulse rounded-md w-2/3" />
        </div>

        {hasButton ? (
          <div className="h-9 bg-zinc-100 animate-pulse rounded-full border border-zinc-200/80 mt-2" />
        ) : (
          <div className="mt-auto flex items-center justify-between pt-1">
            <div className="h-3.5 bg-zinc-100 animate-pulse rounded-full w-[50%]" />
            <div className="w-4 h-4 rounded-full bg-zinc-100 animate-pulse shrink-0" />
          </div>
        )}
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

