import { useState, useEffect, useRef } from 'react'

import { formatBand } from '../../utils/ielts'
import useDebounce from '../../hooks/useDebounce'
import { btnSecondary, btnDanger } from './adminConstants'
import { SkeletonTable } from '../skeletons'

// Bản đồ tùy chọn sort (UI) → cặp { sortBy, sortOrder } gửi lên GET /admin/exams
const SORT_MAP = {
  newest:   { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest:   { sortBy: 'createdAt', sortOrder: 'asc' },
  name:     { sortBy: 'title',     sortOrder: 'asc' },
  attempts: { sortBy: 'attempts',  sortOrder: 'desc' },
  score:    { sortBy: 'score',     sortOrder: 'desc' },
}

function ExamList({ exams = [], skill, onDelete, onEdit, editingId, examSeries = [], paginationData, fetchExams, loading, error }) {
  const [loadingId, setLoadingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSeries, setFilterSeries] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const debouncedSearch = useDebounce(search, 400)
  const isInitialMount = useRef(true)

  const totalPages = paginationData?.pages || 1
  const currentPage = paginationData?.page || 1
  const totalCount = paginationData?.total || exams.length
  // Số liệu tổng quan toàn DB (theo skill + bộ đề + tìm kiếm) — do backend tính,
  // không phải cộng dồn trên mảng exams (chỉ chứa dữ liệu trang hiện tại).
  const stats = paginationData?.stats || null

  // Gọi API với bộ lọc hiện tại; `overrides` cho phép truyền giá trị state mới
  // ngay khi vừa setState (React setState là bất đồng bộ).
  const runFetch = (overrides = {}) => {
    if (!fetchExams) return
    const sort = SORT_MAP[sortBy] || SORT_MAP.newest
    fetchExams({
      page: 1,
      search: debouncedSearch,
      seriesId: filterSeries,
      status: filterStatus,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      ...overrides,
    })
  }

  // Chỉ theo dõi debouncedSearch. Các bộ lọc khác (bộ đề / trạng thái / sắp xếp)
  // đã tự gọi API trong handler của chúng — không đưa vào deps để tránh fetch kép.
  // runFetch() đọc state hiện tại tại thời điểm effect chạy (sau commit) nên không bị stale.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    runFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const getQuestionBadge = (exam) => {
    let count, total
    switch (exam.skill) {
      case 'reading':
      case 'listening':
        count = exam.questionCount ?? 0; total = 40; break
      case 'writing':
        count = exam.writingTasks?.length ?? 0; total = 2; break
      case 'speaking':
        count = (exam.speakingParts || []).filter(p => (p._count?.questions ?? 0) > 0).length; total = 3; break
      default: return null
    }
    const over  = count > total
    const bg    = count === total ? '#dcfce7' : over ? '#fee2e2' : '#f1f5f9'
    const color = count === total ? '#15803d' : over ? '#dc2626' : '#64748b'
    return { text: `${count}/${total}`, bg, color, title: over ? 'Số câu vượt chuẩn — kiểm tra dữ liệu' : undefined }
  }

  // Backend đã lọc theo skill; giữ guard nhẹ phòng dữ liệu bất thường.
  const skillExams = (Array.isArray(exams) ? exams : []).filter(e => e.skill === skill)

  const resetFilters = () => {
    setSearch('')
    setFilterSeries('')
    setFilterStatus('all')
    setSortBy('newest')
    if (fetchExams) fetchExams({ page: 1, search: '', seriesId: '', status: 'all', sortBy: 'createdAt', sortOrder: 'desc' })
  }

  const handleSeriesChange = (val) => {
    setFilterSeries(val)
    runFetch({ seriesId: val })
  }

  const handleStatusChange = (val) => {
    setFilterStatus(val)
    runFetch({ status: val })
  }

  const handleSortChange = (val) => {
    setSortBy(val)
    const sort = SORT_MAP[val] || SORT_MAP.newest
    runFetch({ sortBy: sort.sortBy, sortOrder: sort.sortOrder })
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      runFetch({ page: newPage })
    }
  }

  const hasActiveFilter = search || filterSeries || filterStatus !== 'all' || sortBy !== 'newest'

  // Lọc + sắp xếp do backend đảm nhiệm — `exams` đã là đúng trang, đúng thứ tự.
  const filtered = skillExams

  useEffect(() => {
    if (!confirmDelete) return
    const handler = (e) => { if (e.key === 'Escape') setConfirmDelete(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [confirmDelete])

  const handleEdit = async (exam) => {
    setLoadingId(exam.id)
    const t0 = Date.now()
    await onEdit(exam.id)
    const elapsed = Date.now() - t0
    if (elapsed < 300) await new Promise(r => setTimeout(r, 300 - elapsed))
    setLoadingId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setConfirmDelete(null)
    await onDelete(id)
  }

  const anyLoading = loadingId !== null

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }

  return (
    <>
      {/* Stats cards — số liệu toàn DB theo skill/bộ đề/tìm kiếm (từ backend) */}
      <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
        {[
          { label: 'Tổng đề',         value: stats ? stats.totalExams : '—',            color: 'bg-blue-50 text-blue-700' },
          { label: 'Tổng lượt làm',   value: stats ? stats.totalAttempts : '—',         color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Band TB',          value: stats && stats.avgBand != null ? formatBand(stats.avgBand) : '—', color: 'bg-slate-50 text-slate-700' },
          { label: 'Chưa có câu hỏi', value: stats ? stats.noQuestionsCount : '—',      color: (stats?.noQuestionsCount ?? 0) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400' },
        ].map(card => (
          <div key={card.label} className={`rounded-lg p-3 ${card.color} border border-slate-200/60`}>
            <div className="text-xl font-bold">{card.value}</div>
            <div className="text-xs mt-0.5 opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <label htmlFor="examlist-search" className="sr-only">Tìm theo tên đề</label>
        <input
          id="examlist-search"
          type="text"
          placeholder="Tìm theo tên đề..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
        />
        <label htmlFor="examlist-series" className="sr-only">Lọc theo bộ đề</label>
        <select
          id="examlist-series"
          value={filterSeries}
          onChange={e => handleSeriesChange(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
        >
          <option value="">Tất cả bộ đề</option>
          {examSeries.map(s => <option key={s.id} value={s.id.toString()}>{s.name}</option>)}
        </select>
        <label htmlFor="examlist-status" className="sr-only">Lọc theo trạng thái câu hỏi</label>
        <select
          id="examlist-status"
          value={filterStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="has_questions">Có câu hỏi</option>
          <option value="no_questions">Chưa có câu hỏi</option>
        </select>
        <label htmlFor="examlist-sort" className="sr-only">Sắp xếp</label>
        <select
          id="examlist-sort"
          value={sortBy}
          onChange={e => handleSortChange(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#1D4ED8] bg-white"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="name">Tên A→Z</option>
          <option value="attempts">Nhiều lượt làm</option>
          <option value="score">Band cao nhất</option>
        </select>
        {hasActiveFilter && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition bg-white"
          >Reset</button>
        )}
      </div>

      {/* Result count */}
      {hasActiveFilter && (
        <p className="text-xs text-slate-400 mb-3">{totalCount} đề khớp bộ lọc · đang xem trang {currentPage}/{totalPages}</p>
      )}

      {/* Exam list */}
      {error ? (
        <div className="text-center py-10 text-sm">
          <p className="text-rose-600 font-medium">Không tải được danh sách.</p>
          <button
            type="button"
            onClick={() => runFetch()}
            className="mt-3 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
          >Thử lại</button>
        </div>
      ) : loading && filtered.length === 0 ? (
        <SkeletonTable rows={6} cols={3} />
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-8 text-sm">
          {hasActiveFilter ? 'Không tìm thấy đề nào khớp với bộ lọc.' : 'Chưa có đề nào. Tạo đề đầu tiên!'}
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
          {filtered.map(exam => {
            const isEditing = exam.id === editingId
            const isLoading = exam.id === loadingId
            return (
              <div key={exam.id}
                style={isEditing ? { background: '#eff6ff', borderLeft: '3px solid #1D4ED8' } : {}}
                className={`bg-white rounded-lg p-4 border flex items-center justify-between transition
                  ${isEditing ? 'border-[#bfdbfe]' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${isEditing ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>
                        {exam.title}
                      </p>
                      {isEditing && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1D4ED8] text-white shrink-0">
                          Đang chỉnh sửa
                        </span>
                      )}
                      {(() => {
                        const badge = getQuestionBadge(exam)
                        if (!badge) return null
                        return (
                          <span title={badge.title} style={{ background: badge.bg, color: badge.color, borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            {badge.text}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {exam.bookNumber && exam.testNumber && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Cambridge {exam.bookNumber} · Test {exam.testNumber}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatDate(exam.createdAt)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {exam._count?.attempts ?? 0} lượt làm
                      </span>
                      {exam.avgScore != null && exam.avgScore > 0 && (
                        <span className="text-xs text-purple-600 font-medium">
                          ★ Band {formatBand(exam.avgScore)} TB
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => !anyLoading && handleEdit(exam)}
                    disabled={anyLoading}
                    className={btnSecondary + ' text-xs min-w-[72px] justify-center flex items-center gap-1.5'}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                        </svg>
                        Đang tải...
                      </>
                    ) : 'Sửa'}
                  </button>
                  <button
                    onClick={() => !anyLoading && setConfirmDelete({ id: exam.id, title: exam.title })}
                    disabled={anyLoading}
                    className={btnDanger}
                  >Xóa</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Hiển thị trang <span className="font-semibold text-slate-700">{currentPage}</span> / <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} đề)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Trang trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Trang sau →
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45"
        >
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="examlist-delete-title"
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"
          >
            <h3 id="examlist-delete-title" className="font-bold text-slate-800 text-base mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Bạn có chắc muốn xóa đề <span className="font-semibold text-slate-800">"{confirmDelete.title}"</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
              >Quay lại</button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-white text-sm font-bold transition"
                style={{ background: '#dc2626' }}
              >Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ExamList
