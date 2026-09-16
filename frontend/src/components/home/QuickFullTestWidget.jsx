import { useState } from 'react'
import { X } from 'lucide-react'
import Modal from '../common/Modal'

export default function QuickFullTestWidget({ books, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">
        Lối tắt nhanh
      </h3>
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
        Vào phòng thi thử Full Test ngay lập tức.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-9 px-4 text-white text-sm font-medium rounded-full shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center leading-none"
        style={{ background: 'var(--primary)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
      >
        Vào thi thử Full Test
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Chọn đề Full Test" size="md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
            <h4 className="text-sm font-semibold text-zinc-900">
              Chọn cuốn đề Full Test
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
            {books.length === 0 ? (
              <p className="col-span-full text-xs text-zinc-500 text-center py-6">
                Chưa có dữ liệu đề thi.
              </p>
            ) : (
              books.map((book, i) => (
                <button
                  key={`${book.seriesId}-${book.bookNumber}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelect(book)
                    setOpen(false)
                  }}
                  className="text-left p-3 rounded-xl border border-zinc-200 hover:border-zinc-400 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-zinc-900 truncate">
                    {book.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {book.testCount} đề
                  </p>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
