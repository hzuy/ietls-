/**
 * UserCardGridSkeleton.jsx — Lưới placeholder chuẩn hóa cho các thẻ nội dung phía User
 * Hỗ trợ các tỷ lệ:
 *  - '3/4'   : Bộ đề Cambridge Academic / Practice Plus (/cambridge, /practice-plus)
 *  - '4/5'   : Phòng thi chuẩn hóa (/full-test)
 *  - '16/9'  : Thư viện bài mẫu Writing / Speaking (/writing-samples, /speaking-samples)
 *  - '160px' : Thẻ bài luyện tập kỹ năng Reading / Listening (/practice/reading, /practice/listening)
 *
 * Chuẩn User: Thẻ bo rounded-2xl, viền border-zinc-200, badge/chips bo viên thuốc rounded-full.
 * Triệt tiêu 100% Layout Shift (loại bỏ nút CTA to h-9 giả mạo).
 */

export default function UserCardGridSkeleton({
  count = 5,
  aspect = '3/4',
  gridClassName = '',
  hasPills = false,
  className = '',
}) {
  const getAspectClass = () => {
    switch (aspect) {
      case '3/4':
        return 'aspect-[3/4]'
      case '4/5':
        return 'aspect-[4/5]'
      case '16/9':
      case 'video':
        return 'aspect-video'
      case '160px':
        return 'h-40'
      default:
        return 'aspect-[3/4]'
    }
  }

  const defaultGrid =
    aspect === '16/9'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
      : aspect === '160px'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5'

  const aspectClass = getAspectClass()

  return (
    <div
      className={gridClassName || defaultGrid}
      role="status"
      aria-label="Đang tải danh sách bài thi"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`card-base flex flex-col overflow-hidden h-full rounded-2xl border border-zinc-200 bg-white ${className}`.trim()}
          style={{ borderRadius: '1rem' }}
        >
          {/* Thumbnail / Bìa sách */}
          <div className={`w-full bg-zinc-200/80 animate-pulse shrink-0 ${aspectClass} relative`}>
            {/* Nhãn overlay giả lập nếu là sách */}
            {(aspect === '3/4' || aspect === '4/5') && (
              <div className="absolute top-2.5 left-2.5 w-16 h-5 bg-zinc-300/70 rounded-full animate-pulse" />
            )}
          </div>

          {/* Body thẻ — padding 14px 16px chuẩn ContentCard */}
          <div className="p-4 flex flex-col flex-1 justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 bg-zinc-200/90 animate-pulse rounded-md w-4/5" />
              <div className="h-3.5 bg-zinc-100 animate-pulse rounded-md w-3/5" />
            </div>

            {/* Phần đáy card */}
            {hasPills ? (
              <div className="mt-auto flex items-center gap-2 pt-2">
                <div className="h-5 w-16 bg-zinc-100 animate-pulse rounded-full border border-zinc-200/60" />
                <div className="h-5 w-20 bg-zinc-100 animate-pulse rounded-full border border-zinc-200/60" />
              </div>
            ) : (
              <div className="mt-auto flex items-center justify-between pt-1">
                <div className="h-3.5 w-24 bg-zinc-100 animate-pulse rounded-full" />
                <div className="w-4 h-4 rounded-full bg-zinc-100 animate-pulse shrink-0" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
