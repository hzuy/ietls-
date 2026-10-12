import { useState } from 'react'
import { resolveImg } from '../../utils/media'
import AcademicCover from './AcademicCover'

/**
 * BookCard — Thẻ bìa sách bộ đề chuẩn hoá đồng bộ cho toàn hệ thống
 * (Home, FullTest, SeriesPage: Cambridge & Practice Plus).
 *
 * Props:
 *  - book: { title, seriesName, bookNumber, coverImageUrl, testCount, ... }
 *  - onClick: () => void
 *  - className: string
 */
export function formatAttempts(count) {
  const n = Number(count) || 0
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M lượt làm`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K lượt làm`
  }
  return `${n} lượt làm`
}

export default function BookCard({ book, onClick, className = '' }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = book.coverImageUrl && !imgError
  const hasTests = book.testCount == null || book.testCount > 0

  return (
    <div
      onClick={hasTests ? onClick : undefined}
      className={`group w-full max-w-[252px] flex flex-col transition-all duration-200 ${
        hasTests ? 'cursor-pointer' : 'opacity-80 cursor-not-allowed'
      } ${className}`}
    >
      {/* Book Cover — chuẩn tỷ lệ 3:2 kích thước 252x168 px, nền #E3E7ED */}
      <div className="w-full aspect-[3/2] rounded-xl overflow-hidden border border-zinc-200/90 bg-[#E3E7ED] dark:bg-zinc-800 shadow-2xs group-hover:shadow-md group-hover:border-zinc-400 transition-all duration-300 relative flex items-center justify-center">
        {hasImage ? (
          <img
            src={resolveImg(book.coverImageUrl)}
            alt={book.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <AcademicCover
            title={book.title}
            seriesName={book.seriesName || 'CAMBRIDGE'}
            volume={book.bookNumber}
            subtitle={hasTests ? `${book.testCount || 4} Full Tests` : 'Đang cập nhật'}
            skill="fullTest"
          />
        )}

        {/* Badge nếu chưa có bài test */}
        {!hasTests && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center p-2 z-10">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-zinc-900 text-white shadow-xs">
              Đang cập nhật
            </span>
          </div>
        )}
      </div>

      {/* Book Info — tên bộ đề, số lượng bài test thực tế và số lượt làm thực tế */}
      <div className="mt-2.5 text-left flex flex-col">
        <h3
          className="text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 transition-colors line-clamp-1"
          title={book.title}
        >
          {book.title}
        </h3>
        <p className="text-[13px] sm:text-[13.5px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
          <span>{book.testCount != null ? `${book.testCount} bài tests` : 'Đang cập nhật'}</span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span>{formatAttempts(book.attemptCount)}</span>
        </p>
        <div className="mt-1.5 text-[13px] sm:text-[13.5px] font-semibold text-rose-600 dark:text-rose-400 group-hover:text-rose-700 flex items-center gap-1">
          <span>Xem bài test</span>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5 font-bold">›</span>
        </div>
      </div>
    </div>
  )
}
