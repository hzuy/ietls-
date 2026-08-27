import { useState, useEffect, useRef } from 'react'

import { formatBand } from '../../utils/ielts'
import useDebounce from '../../hooks/useDebounce'
import { btnSecondary, btnDanger } from './adminConstants'

// Bản đồ tùy chọn sort (UI) → cặp { sortBy, sortOrder } gửi lên GET /admin/exams
const SORT_MAP = {
  newest:   { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest:   { sortBy: 'createdAt', sortOrder: 'asc' },
  name:     { sortBy: 'title',     sortOrder: 'asc' },
  attempts: { sortBy: 'attempts',  sortOrder: 'desc' },
  score:    { sortBy: 'score',     sortOrder: 'desc' },
}

function ExamList({ exams = [], skill, onDelete, onEdit, editingId, examSeries = [], paginationData, fetchExams, loading }) {
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
    const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f1f5f9'
    const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#64748b'
    return { text: `${count}/${total}`, bg, color }
  }

  const skillExams = (Array.isArray(exams) ? exams : []).filter(e => e.skill === skill || !e.skill)

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
          { label: 'Tổng đề',         value: stats ? stats.totalExams : '—',            color: 'bg-blue-50 text-[#1D4ED8]' },
          { label: 'Tổng lượt làm',   value: stats ? stats.totalAttempts : '—',         color: 'bg-green-50 text-green-700' },
          { label: 'Band TB',          value: stats && stats.avgBand != null ? formatBand(stats.avgBand) : '—', color: 'bg-purple-50 text-purple-700' },
          { label: 'Chưa có câu hỏi', value: stats ? stats.noQuestionsCount : '—',      color: (stats?.noQuestionsCount ?? 0) > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-3 ${card.color} border border-white`}>
            <div className="text-xl font-bold">{card.value}</div>
            <div className="text-xs mt-0.5 opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Tìm theo tên đề..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8] bg-white"
        />
        <select
          value={filterSeries}
          onChange={e => handleSeriesChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8] bg-white"
        >
          <option value="">Tất cả bộ đề</option>
          {examSeries.map(s => <option key={s.id} value={s.id.toString()}>{s.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8] bg-white"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="has_questions">Có câu hỏi</option>
          <option value="no_questions">Chưa có câu hỏi</option>
        </select>
        <select
          value={sortBy}
          onChange={e => handleSortChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1D4ED8] bg-white"
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
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition bg-white"
          >Reset</button>
        )}
      </div>

      {/* Result count */}
      {hasActiveFilter && (
        <p className="text-xs text-gray-400 mb-3">{totalCount} đề khớp bộ lọc · đang xem trang {currentPage}/{totalPages}</p>
      )}

      {/* Exam list */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-8 text-sm">
          {hasActiveFilter ? 'Không tìm thấy đề nào khớp với bộ lọc.' : 'Chưa có đề nào. Tạo đề đầu tiên!'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exam => {
            const isEditing = exam.id === editingId
            const isLoading = exam.id === loadingId
            return (
              <div key={exam.id}
                style={isEditing ? { background: '#eff6ff', borderLeft: '3px solid #1D4ED8' } : {}}
                className={`bg-white rounded-xl p-4 border flex items-center justify-between transition
                  ${isEditing ? 'border-[#bfdbfe]' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${isEditing ? 'text-[#1D4ED8]' : 'text-gray-800'}`}>
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
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
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
                      <span className="text-xs text-gray-400">
                        {formatDate(exam.createdAt)}
                      </span>
                      <span className="text-xs text-gray-400">
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
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Hiển thị trang <span className="font-semibold text-gray-700">{currentPage}</span> / <span className="font-semibold text-gray-700">{totalPages}</span> ({totalCount} đề)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Trang trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <h3 className="font-bold text-gray-800 text-base mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Bạn có chắc muốn xóa đề <span className="font-semibold text-gray-800">"{confirmDelete.title}"</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
              >Quay lại</button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition"
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
