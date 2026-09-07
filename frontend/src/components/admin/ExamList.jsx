import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExams } from '../../services/examService'
import { formatBand } from '../../utils/ielts'
import useDebounce from '../../hooks/useDebounce'
import { btnSecondary, btnDanger } from './adminConstants'
import { SkeletonTable } from '../skeletons'
import { Star } from 'lucide-react'

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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterSeries, setFilterSeries] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const debouncedSearch = useDebounce(search, 400)
  const sort = SORT_MAP[sortBy] || SORT_MAP.newest
  const queryClient = useQueryClient()

  // Khi người dùng đổi skill hoặc filters (search, series, status, sort) -> tự động reset về trang 1
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filterSeries, filterStatus, sortBy, skill])

  // TanStack Query: Quản lý cache và nạp đề thi theo kỹ năng
  const { data: examsData, isPending: queryLoading, isError: queryError, refetch } = useQuery({
    queryKey: ['admin', 'exams', skill, { page, search: debouncedSearch, status: filterStatus, seriesId: filterSeries, sortBy: sort.sortBy, sortOrder: sort.sortOrder }],
    queryFn: () => getExams({
      skill,
      page,
      limit: 20,
      search: debouncedSearch,
      seriesId: filterSeries,
      status: filterStatus,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    }),
    staleTime: 1000 * 60 * 10, // Giữ fresh 10 phút
    gcTime: 1000 * 60 * 30,    // Giữ cache 30 phút
    placeholderData: (previousData) => previousData, // Giữ nguyên dữ liệu cũ khi đổi filter, không giật màn hình
    enabled: !!skill && (!exams || exams.length === 0),
  })

  const activeData = examsData || paginationData || (exams?.length ? { exams, total: exams.length, page: 1, pages: 1, stats: null } : null)
  const listExams = activeData?.exams || (Array.isArray(activeData) ? activeData : null) || exams || []
  const totalPages = activeData?.pages || paginationData?.pages || 1
  const currentPage = activeData?.page || paginationData?.page || page || 1
  const totalCount = activeData?.total ?? paginationData?.total ?? listExams.length
  // Số liệu tổng quan toàn DB (theo skill + bộ đề + tìm kiếm) — do backend tính,
  // không phải cộng dồn trên mảng exams (chỉ chứa dữ liệu trang hiện tại).
  const stats = activeData?.stats || paginationData?.stats || null

  const isCurrentLoading = (queryLoading && !activeData) || (loading && !exams?.length)
  const isCurrentError = queryError || error

  // Gọi API với bộ lọc hiện tại (hỗ trợ component cha truyền fetchExams)
  const runFetch = (overrides = {}) => {
    if (!fetchExams) return
    const s = SORT_MAP[sortBy] || SORT_MAP.newest
    fetchExams({
      page: 1,
      search: debouncedSearch,
      seriesId: filterSeries,
      status: filterStatus,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
      ...overrides,
    })
  }

  const getQuestionBadge = (exam) => {
    let count, total
    switch (exam.skill) {
      case 'reading':
      case 'listening':
        count = exam.questionCount ?? 0; total = 40; break
      case 'writing':
        count = exam.writingTasks?.length ?? 0; total = 2; break
      case 'speaking': {
        count = (exam.speakingParts || []).filter(p => {
          const qCount = p._count?.questions ?? (Array.isArray(p.questions) ? p.questions.length : 0)
          const hasCueCard = typeof p.cueCard === 'string' && p.cueCard.trim() !== ''
          const partNum = Number(p.number ?? p.partNumber)

          // Part 1: kiểm tra số lượng câu hỏi hoặc mô tả / cueCard
          if (partNum === 1) {
            return qCount > 0 || hasCueCard
          }
          // Part 2: kiểm tra cueCard (cueCard?.trim() !== '') hoặc câu hỏi (questions.length > 0)
          if (partNum === 2) {
            return hasCueCard || qCount > 0
          }
          // Part 3: có ít nhất 1 câu hỏi con hoặc cueCard / topics thảo luận
          if (partNum === 3) {
            if (qCount > 0 || hasCueCard) return true
            if (Array.isArray(p.topics)) {
              return p.topics.some(t => Array.isArray(t.questions) && t.questions.some(q => typeof q === 'string' && q.trim() !== ''))
            }
            return false
          }
          // Fallback khi không có p.number (VD: dữ liệu legacy hoặc mock test)
          return hasCueCard || qCount > 0
        }).length
        total = 3
        break
      }
      default: return null
    }
    const over  = count > total
    const bg    = count === total ? '#dcfce7' : over ? '#fee2e2' : '#f1f5f9'
    const color = count === total ? '#15803d' : over ? '#dc2626' : '#64748b'
    return { text: `${count}/${total}`, bg, color, title: over ? 'Số câu vượt chuẩn — kiểm tra dữ liệu' : undefined }
  }

  // Backend đã lọc theo skill; giữ guard nhẹ phòng dữ liệu bất thường.
  const skillExams = (Array.isArray(listExams) ? listExams : []).filter(e => !skill || e.skill === skill)

  const resetFilters = () => {
    setSearch('')
    setFilterSeries('')
    setFilterStatus('all')
    setSortBy('newest')
    setPage(1)
    if (fetchExams) fetchExams({ page: 1, search: '', seriesId: '', status: 'all', sortBy: 'createdAt', sortOrder: 'desc' })
  }

  const handleSeriesChange = (val) => {
    setFilterSeries(val)
    setPage(1)
    runFetch({ seriesId: val })
  }

  const handleStatusChange = (val) => {
    setFilterStatus(val)
    setPage(1)
    runFetch({ status: val })
  }

  const handleSortChange = (val) => {
    setSortBy(val)
    setPage(1)
    const s = SORT_MAP[val] || SORT_MAP.newest
    runFetch({ sortBy: s.sortBy, sortOrder: s.sortOrder })
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
      runFetch({ page: newPage })
    }
  }

  const hasActiveFilter = search || filterSeries || filterStatus !== 'all' || sortBy !== 'newest'

  // Lọc + sắp xếp do backend đảm nhiệm — `listExams` đã là đúng trang, đúng thứ tự.
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
    queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'examCounts'] })
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
          { label: 'Tổng đề',         value: stats ? stats.totalExams : '—' },
          { label: 'Tổng lượt làm',   value: stats ? stats.totalAttempts : '—' },
          { label: 'Band TB',          value: stats && stats.avgBand != null ? formatBand(stats.avgBand) : '—' },
          { label: 'Chưa có câu hỏi', value: stats ? stats.noQuestionsCount : '—' },
        ].map(card => (
          <div key={card.label} className="rounded-lg p-3 bg-white border border-zinc-200 shadow-2xs">
            <div className="text-xl font-bold text-zinc-900">{card.value}</div>
            <div className="text-xs mt-0.5 text-zinc-500">{card.label}</div>
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
          className="flex-1 min-w-[160px] px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-400"
        />
        <label htmlFor="examlist-series" className="sr-only">Lọc theo bộ đề</label>
        <select
          id="examlist-series"
          value={filterSeries}
          onChange={e => handleSeriesChange(e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-zinc-900"
        >
          <option value="">Tất cả bộ đề</option>
          {examSeries.map(s => <option key={s.id} value={s.id.toString()}>{s.name}</option>)}
        </select>
        <label htmlFor="examlist-status" className="sr-only">Lọc theo trạng thái câu hỏi</label>
        <select
          id="examlist-status"
          value={filterStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-zinc-900"
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
          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-zinc-900"
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
            className="px-3 py-2 text-xs font-medium border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 transition bg-white"
          >Reset</button>
        )}
      </div>

      {/* Result count */}
      {hasActiveFilter && (
        <p className="text-[11px] text-zinc-500 mb-3">{totalCount} đề khớp bộ lọc · đang xem trang {currentPage}/{totalPages}</p>
      )}

      {/* Exam list */}
      {isCurrentError ? (
        <div className="text-center py-10 text-xs">
          <p className="text-rose-600 font-medium">Không tải được danh sách.</p>
          <button
            type="button"
            onClick={() => {
              if (fetchExams) runFetch()
              else refetch?.()
            }}
            className="mt-3 px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition text-xs"
          >Thử lại</button>
        </div>
      ) : isCurrentLoading && filtered.length === 0 ? (
        <SkeletonTable rows={6} cols={3} />
      ) : filtered.length === 0 ? (
        <div className="text-center text-zinc-400 py-8 text-xs">
          {hasActiveFilter ? 'Không tìm thấy đề nào khớp với bộ lọc.' : 'Chưa có đề nào. Tạo đề đầu tiên!'}
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity ${isCurrentLoading && filtered.length === 0 ? 'opacity-60 pointer-events-none' : ''}`}>
          {filtered.map(exam => {
            const isEditing = exam.id === editingId
            const isLoading = exam.id === loadingId
            return (
              <div key={exam.id}
                style={isEditing ? { background: '#f4f4f5', borderLeft: '3px solid #18181b' } : {}}
                className={`bg-white rounded-lg p-4 border flex items-center justify-between transition
                  ${isEditing ? 'border-zinc-400' : 'border-zinc-200 hover:border-zinc-300'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${isEditing ? 'text-zinc-900 font-bold' : 'text-zinc-800'}`}>
                        {exam.title}
                      </p>
                      {isEditing && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 text-white shrink-0">
                          Đang chỉnh sửa
                        </span>
                      )}
                      {(() => {
                        const badge = getQuestionBadge(exam)
                        if (!badge) return null
                        return (
                          <span title={badge.title} style={{ background: badge.bg, color: badge.color, borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                            {badge.text}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {exam.bookNumber && exam.testNumber && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/60">
                          Cambridge {exam.bookNumber} · Test {exam.testNumber}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-500">
                        {formatDate(exam.createdAt)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {exam._count?.attempts ?? 0} lượt làm
                      </span>
                      {exam.avgScore != null && exam.avgScore > 0 && (
                        <span className="text-[11px] text-zinc-700 font-medium bg-zinc-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Star className="w-3 h-3 fill-zinc-600 text-zinc-600 shrink-0" />
                          <span>Band {formatBand(exam.avgScore)} TB</span>
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

      {/* Footer / Pagination Controls */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-4 border-t border-zinc-200">
          <span className="text-xs text-zinc-500">
            Hiển thị <span className="font-semibold text-zinc-800">{filtered.length}</span> trên tổng số <span className="font-semibold text-zinc-800">{totalCount}</span> đề thi
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isCurrentLoading}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
              >
                ← Trang trước
              </button>
              <span className="text-xs text-zinc-500 px-1 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isCurrentLoading}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
              >
                Trang sau →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
        >
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="examlist-delete-title"
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm border border-zinc-200"
          >
            <h3 id="examlist-delete-title" className="font-semibold text-zinc-900 text-sm mb-2">Xác nhận xóa</h3>
            <p className="text-xs text-zinc-600 leading-relaxed mb-6">
              Bạn có chắc muốn xóa đề <span className="font-medium text-zinc-900">"{confirmDelete.title}"</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition shadow-2xs"
              >Quay lại</button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-3.5 py-2 rounded-lg text-white text-xs font-medium bg-red-600 hover:bg-red-700 transition shadow-xs"
              >Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ExamList
