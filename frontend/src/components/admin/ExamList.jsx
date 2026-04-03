import { useState, useEffect } from 'react'
import { formatBand } from '../../utils/ielts'
import {
  READING_Q_TYPES, LISTENING_Q_TYPES,
  TYPES_WITH_MCQ_OPTIONS, TYPES_WITH_DYNAMIC_OPTIONS, TYPES_WITH_IMAGE,
  ANSWER_PLACEHOLDER,
  inputCls, labelCls, btnSecondary, btnDanger,
} from './adminConstants'

function QuestionEditor({ question, questionIndex, onUpdate, onRemove, skill = 'reading' }) {
  const updateField = (field, val) => onUpdate(questionIndex, field, val)
  const updateOption = (oi, val) => {
    const opts = [...(question.options || [])]
    opts[oi] = val
    onUpdate(questionIndex, 'options', opts)
  }
  const addOption    = () => onUpdate(questionIndex, 'options', [...(question.options || []), ''])
  const removeOption = (oi) => onUpdate(questionIndex, 'options', (question.options || []).filter((_, i) => i !== oi))

  const types         = skill === 'listening' ? LISTENING_Q_TYPES : READING_Q_TYPES
  const isMcqOpts     = TYPES_WITH_MCQ_OPTIONS.includes(question.type)
  const isDynamicOpts = TYPES_WITH_DYNAMIC_OPTIONS.includes(question.type)
  const hasImage      = TYPES_WITH_IMAGE.includes(question.type)

  const handleTypeChange = (newType) => {
    const newOpts = TYPES_WITH_MCQ_OPTIONS.includes(newType)     ? ['', '', '', '']
                  : TYPES_WITH_DYNAMIC_OPTIONS.includes(newType) ? ['']
                  : null
    onUpdate(questionIndex, 'type', newType)
    onUpdate(questionIndex, 'options', newOpts)
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500">Câu {question.number}</span>
        <button type="button" onClick={() => onRemove(questionIndex)} className={btnDanger}>Xóa</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Loại câu hỏi</label>
          <select className={inputCls} value={question.type} onChange={e => handleTypeChange(e.target.value)}>
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Số thứ tự</label>
          <input type="number" className={inputCls} value={question.number}
            onChange={e => updateField('number', parseInt(e.target.value) || 1)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Nội dung câu hỏi</label>
        <textarea className={inputCls} rows={2} placeholder="Nhập câu hỏi / mệnh đề..."
          value={question.questionText} onChange={e => updateField('questionText', e.target.value)} />
      </div>

      {/* MCQ fixed A/B/C/D options */}
      {isMcqOpts && (
        <div>
          <label className={labelCls}>Các lựa chọn</label>
          <div className="grid grid-cols-2 gap-2">
            {(question.options || ['', '', '', '']).map((opt, oi) => (
              <input key={oi} className={inputCls}
                placeholder={`${String.fromCharCode(65 + oi)}. ...`}
                value={opt} onChange={e => updateOption(oi, e.target.value)} />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic options for matching types */}
      {isDynamicOpts && (
        <div>
          <label className={labelCls}>Danh sách lựa chọn</label>
          <div className="space-y-1.5">
            {(question.options || ['']).map((opt, oi) => (
              <div key={oi} className="flex gap-2 items-center">
                <input className={inputCls} placeholder={`Lựa chọn ${oi + 1}...`}
                  value={opt} onChange={e => updateOption(oi, e.target.value)} />
                <button type="button" onClick={() => removeOption(oi)}
                  className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0">✕</button>
              </div>
            ))}
            <button type="button" onClick={addOption}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Thêm lựa chọn</button>
          </div>
        </div>
      )}

      {/* Image URL for map/diagram */}
      {hasImage && (
        <div>
          <label className={labelCls}>URL hình ảnh (map/diagram)</label>
          <input className={inputCls} placeholder="https://... (để trống nếu chưa có)"
            value={question.imageUrl || ''} onChange={e => updateField('imageUrl', e.target.value)} />
        </div>
      )}

      <div>
        <label className={labelCls}>Đáp án đúng</label>
        <input className={`${inputCls} border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-blue-100`}
          placeholder={ANSWER_PLACEHOLDER[question.type] || 'Đáp án đúng'}
          value={question.correctAnswer} onChange={e => updateField('correctAnswer', e.target.value)} />
      </div>
    </div>
  )
}

function ExamList({ exams, skill, onDelete, onEdit, editingId, examSeries = [] }) {
  const [loadingId, setLoadingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSeries, setFilterSeries] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const getHasQuestions = (exam) => {
    switch (exam.skill) {
      case 'reading':   return exam.passages?.some(p => (p._count?.questionGroups ?? 0) > 0) ?? false
      case 'listening': return exam.listeningSections?.some(s => (s._count?.questionGroups ?? 0) > 0) ?? false
      case 'writing':   return (exam.writingTasks?.length ?? 0) > 0
      case 'speaking':  return exam.speakingParts?.some(p => (p._count?.questions ?? 0) > 0) ?? false
      default: return false
    }
  }

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

  const skillExams = exams.filter(e => e.skill === skill)

  const resetFilters = () => { setSearch(''); setFilterSeries(''); setFilterStatus('all'); setSortBy('newest') }

  const hasActiveFilter = search || filterSeries || filterStatus !== 'all' || sortBy !== 'newest'

  // Stats (always from all skillExams, not filtered)
  const totalAttempts = skillExams.reduce((s, e) => s + (e._count?.attempts ?? 0), 0)
  const examsWithScore = skillExams.filter(e => e.avgScore != null && e.avgScore > 0)
  const avgBand = examsWithScore.length > 0
    ? formatBand(examsWithScore.reduce((s, e) => s + e.avgScore, 0) / examsWithScore.length)
    : null
  const noQuestionsCount = skillExams.filter(e => !getHasQuestions(e)).length

  // Filter + sort
  let filtered = skillExams
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()))
    .filter(e => !filterSeries || e.seriesId?.toString() === filterSeries)
    .filter(e => {
      if (filterStatus === 'has_questions') return getHasQuestions(e)
      if (filterStatus === 'no_questions')  return !getHasQuestions(e)
      return true
    })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'oldest')   return new Date(a.createdAt) - new Date(b.createdAt)
    if (sortBy === 'name')     return a.title.localeCompare(b.title, 'vi')
    if (sortBy === 'attempts') return (b._count?.attempts ?? 0) - (a._count?.attempts ?? 0)
    if (sortBy === 'score')    return (b.avgScore ?? -1) - (a.avgScore ?? -1)
    return new Date(b.createdAt) - new Date(a.createdAt) // newest
  })

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
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
        {[
          { label: 'Tổng đề',         value: skillExams.length,        color: 'bg-blue-50 text-[#1a56db]' },
          { label: 'Tổng lượt làm',   value: totalAttempts,            color: 'bg-green-50 text-green-700' },
          { label: 'Band TB',          value: avgBand ?? '—',           color: 'bg-purple-50 text-purple-700' },
          { label: 'Chưa có câu hỏi', value: noQuestionsCount,         color: noQuestionsCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400' },
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
          className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white"
        />
        <select
          value={filterSeries}
          onChange={e => setFilterSeries(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white"
        >
          <option value="">Tất cả bộ đề</option>
          {examSeries.map(s => <option key={s.id} value={s.id.toString()}>{s.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="has_questions">Có câu hỏi</option>
          <option value="no_questions">Chưa có câu hỏi</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white"
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
        <p className="text-xs text-gray-400 mb-3">Hiển thị {filtered.length} / {skillExams.length} đề</p>
      )}

      {/* Exam list */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-8 text-sm">
          {skillExams.length === 0 ? 'Chưa có đề nào. Tạo đề đầu tiên!' : 'Không tìm thấy đề nào khớp với bộ lọc.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exam => {
            const isEditing = exam.id === editingId
            const isLoading = exam.id === loadingId
            return (
              <div key={exam.id}
                style={isEditing ? { background: '#eff6ff', borderLeft: '3px solid #1a56db' } : {}}
                className={`bg-white rounded-xl p-4 border flex items-center justify-between transition
                  ${isEditing ? 'border-[#bfdbfe]' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${isEditing ? 'text-[#1a56db]' : 'text-gray-800'}`}>
                        {exam.title}
                      </p>
                      {isEditing && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1a56db] text-white shrink-0">
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
                        🗓 {formatDate(exam.createdAt)}
                      </span>
                      <span className="text-xs text-gray-400">
                        📝 {exam._count?.attempts ?? 0} lượt làm
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

export { QuestionEditor }
export default ExamList
