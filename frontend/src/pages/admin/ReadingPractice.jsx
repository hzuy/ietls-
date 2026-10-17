import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnsavedChanges, NAV_LEAVE_MSG } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { useCollapsibleGroups } from '../../hooks/useCollapsibleGroups'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'
import { useToast } from '../../context/ToastContext'
import PracticeGroupCard from '../../components/admin/PracticeGroupCard'
import {
  getReadingPracticeList, getReadingPractice,
  createReadingPractice, updateReadingPractice,
  deleteReadingPractice, uploadReadingThumbnailFile,
} from '../../services/practiceService'
import {
  resolveImg, recalcGroups,
  READING_GROUP_TYPES, emptyReadingGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
} from '../../utils/practiceConfig'
import { Eye, BookOpen, Loader2 } from 'lucide-react'
import AdminGroupPreview from '../../components/practice/AdminGroupPreview'
import ImageWithFallback from '../../components/common/ImageWithFallback'
import Select from '../../components/admin/Select'
import { AdminTableSkeleton } from '../../components/skeletons'
import api from '../../utils/axios'
import ExplanationConflictModal from '../../components/admin/ExplanationConflictModal'
import OverwriteProtectedConfirmModal from '../../components/admin/OverwriteProtectedConfirmModal'
import { showAlert } from '../../utils/alertUtils'
import { validatePracticeReading, formatValidationAlert } from '../../utils/questionValidation'

// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
function ReadingPracticePreviewModal({ form, showAnswers, setShowAnswers, showExplanations, setShowExplanations, onClose }) {
  const [leftPct, setLeftPct] = useState(50)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const container = containerRef.current
    if (!container) return
    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect()
      setLeftPct(Math.min(75, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '95vw', height: '90vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900">Xem trước — {form.title || 'Reading Practice'}</span>
            <button type="button" onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition cursor-pointer ${showAnswers ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
            <button type="button" onClick={() => setShowExplanations(v => {
              const next = !v
              if (next) setShowAnswers(true)
              return next
            })}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition cursor-pointer ${showExplanations ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {showExplanations ? 'Ẩn giải thích' : 'Hiện giải thích'}
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition font-medium cursor-pointer">
            ✕ Đóng
          </button>
        </div>
        <div ref={containerRef} className="flex flex-1 overflow-hidden"
          style={{ userSelect: dragging ? 'none' : 'auto' }}>
          <div className="overflow-y-auto bg-white px-8 py-6" style={{ width: `${leftPct}%`, flexShrink: 0 }}>
            {form.passage
              ? <p className="text-sm text-zinc-700 leading-7 whitespace-pre-wrap">{form.passage}</p>
              : <p className="text-sm text-zinc-400 italic">Chưa có nội dung passage</p>}
          </div>
          <div onMouseDown={onDividerMouseDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: dragging ? '#18181b' : '#e4e4e7', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#a1a1aa' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e4e4e7' }} />
          <div className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-6">
            {form.questionGroups.length > 0
              ? form.questionGroups.map((g, gi) => <AdminGroupPreview key={gi} group={g} showAnswers={showAnswers} showExplanations={showExplanations} />)
              : <p className="text-sm text-zinc-400 italic text-center mt-10">Chưa có câu hỏi</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', passage: '', questionGroups: [],
  thumbnailUrl: null, thumbPreview: null, thumbFile: null,
}

// Chữ ký nội dung form (bỏ thumbPreview — chỉ là blob/URL phái sinh) để phát hiện
// thay đổi chưa lưu (derive-snapshot, giống SampleManager).
const formSig = (f) => JSON.stringify([f.title, f.passage, f.questionGroups, f.thumbnailUrl, !!f.thumbFile])

export default function ReadingPractice() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: list = [], isPending } = useQuery({
    queryKey: ['admin', 'practice', 'reading'],
    queryFn: getReadingPracticeList,
    placeholderData: (prev) => prev,
  })
  const [view, setView]               = useState('list')
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [delConfirm, setDelConfirm]   = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const [addGroupType, setAddGroupType] = useState(READING_GROUP_TYPES[0].value)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [showExplanations, setShowExplanations] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiConflicts, setAiConflicts] = useState([])
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [overwriteModalOpen, setOverwriteModalOpen] = useState(false)
  const [protectedStats, setProtectedStats] = useState({ reviewedCount: 0, editedCount: 0 })
  // BUG-13: Track unsaved changes (derive-snapshot: formSig(form) vs pristineRef)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')

  // BUG-13: Block navigation when dirty (view === 'form' with changes)
  useUnsavedChanges(view === 'form' && isDirty)

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  // BUG-14: Draft auto-save (restore khi mở form, autosave 2s khi có thay đổi).
  const draftKey = `draft_reading_practice_${editing?.id || 'new'}`
  const { draftBanner, setDraftBanner, draftSavedAt, clearDraft } =
    useDraftPersistence(draftKey, form, { enabled: view === 'form', dirty: isDirty })

  // Thu gọn/bung từng nhóm câu hỏi (mặc định thu gọn khi mở đề).
  const groupCollapse = useCollapsibleGroups()

  const handleCancelOrBack = () => {
    if (isDirty && !window.confirm(NAV_LEAVE_MSG)) return
    setIsDirty(false)
    setView('list')
  }

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    groupCollapse.setAll([])
    setForm(EMPTY_FORM); setEditing(null); setShowPreview(false); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    if (loadingEditId !== null) return
    setLoadingEditId(item.id)
    try {
      const data  = await getReadingPractice(item.id)
      const qData = data.questions
        ? (typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions)
        : { groups: [] }
      const next = {
        title: data.title, passage: data.passage || '',
        questionGroups: qData.groups || [],
        thumbnailUrl: data.thumbnailUrl,
        thumbPreview: resolveImg(data.thumbnailUrl),
        thumbFile: null,
      }
      pristineRef.current = formSig(next)
      groupCollapse.setAll([])
      setForm(next)
      setEditing(data); setShowPreview(false); setIsDirty(false); setView('form')
    } catch { showToast('Lỗi tải bài', 'error') }
    finally { setLoadingEditId(null) }
  }

  const handleSave = async () => {
    const val = validatePracticeReading(form)
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể lưu bài Reading Practice', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin đề bài và đáp án đúng', 'error')
      return
    }

    setSaving(true)
    try {
      // ── Bước 1: upload ảnh mới (nếu có) TRƯỚC — record chỉ ghi khi file đã lên xong ──
      let thumbnailUrl = form.thumbnailUrl
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        try {
          thumbnailUrl = (await uploadReadingThumbnailFile(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = {
        title: form.title.trim(),
        passage: form.passage,
        thumbnailUrl: thumbnailUrl || null,
        questions: form.questionGroups.map((group, index) => ({ ...group, orderIndex: index }))
      }
      if (!editing) await createReadingPractice(body)
      else await updateReadingPractice(editing.id, body)

      clearDraft(); setIsDirty(false); setView('list')
      queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi lưu bài thi', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteReadingPractice(id)
      setDelConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
    }
    catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
    finally { setDeleting(false) }
  }

  const handleGroupChange = (i, updated) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.map((g, idx) => idx === i ? updated : g)) }))
  }
  const handleGroupRemove = (i) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.filter((_, idx) => idx !== i)) }))
  }
  const handleGroupMove = (i, dir) => {
    const arr = [...form.questionGroups]; const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setForm(f => ({ ...f, questionGroups: recalcGroups(arr) }))
  }
  const handleAddGroup = () => {
    const lastEnd = form.questionGroups.length > 0 ? form.questionGroups[form.questionGroups.length - 1].qNumberEnd : 0
    const newGroup = emptyReadingGroupOf(addGroupType, lastEnd + 1)
    setForm(f => ({ ...f, questionGroups: [...f.questionGroups, newGroup] }))
    groupCollapse.reveal(newGroup._id)
  }

  const countProtectedQuestions = () => {
    let reviewedCount = 0
    let editedCount = 0
    for (const g of form.questionGroups || []) {
      const byNumber = g.explanations || {}
      for (const exp of Object.values(byNumber)) {
        if (exp?.status === 'teacher_reviewed') reviewedCount++
        if (exp?.status === 'teacher_edited') editedCount++
      }
    }
    return { reviewedCount, editedCount }
  }

  const handleStartGenerateAI = () => {
    if (!editing?.id) {
      showToast('Vui lòng lưu bài thi trước khi tạo giải thích bằng AI', 'info')
      return
    }
    const val = validatePracticeReading(form)
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin đề bài và đáp án đúng', 'error')
      return
    }
    const stats = countProtectedQuestions()
    if (stats.reviewedCount + stats.editedCount > 0) {
      setProtectedStats(stats)
      setOverwriteModalOpen(true)
    } else {
      handleGenerateAI({ overwriteProtected: false })
    }
  }

  const handleGenerateAI = async ({ resolveChoices = {}, overwriteProtected = false } = {}) => {
    if (!editing?.id) {
      showToast('Vui lòng lưu bài thi trước khi tạo giải thích bằng AI', 'info')
      return
    }
    const val = validatePracticeReading(form)
    if (!val.isValid) {
      const alertMsg = formatValidationAlert('Không thể tạo giải thích bằng AI', val.errors)
      showAlert(alertMsg, 'error')
      showToast(val.errors[0] || 'Vui lòng điền đầy đủ thông tin đề bài và đáp án đúng', 'error')
      return
    }
    setGeneratingAI(true)
    showToast('Đang kết nối AI để phân tích và tạo lời giải thích...', 'info')
    try {
      // Tự động đồng bộ các thay đổi mới nhất lên server nếu form đang có chỉnh sửa
      if (isDirty) {
        let thumbnailUrl = form.thumbnailUrl
        if (form.thumbFile) {
          const fd = new FormData()
          fd.append('thumbnail', form.thumbFile)
          try {
            thumbnailUrl = (await uploadReadingThumbnailFile(fd)).url
          } catch { /* giữ URL cũ nếu lỗi ảnh */ }
        }
        const body = {
          title: form.title.trim(),
          passage: form.passage,
          thumbnailUrl: thumbnailUrl || null,
          questions: form.questionGroups.map((group, index) => ({ ...group, orderIndex: index }))
        }
        await updateReadingPractice(editing.id, body)
        setIsDirty(false)
        pristineRef.current = formSig(form)
      }

      const res = await api.post(`/practice/admin/reading/${editing.id}/generate-explanations`, {
        force: true,
        overwriteProtected,
        resolveChoices,
      })
      if (res.data?.hasConflicts) {
        setAiConflicts(res.data.conflicts || [])
        setConflictModalOpen(true)
        showToast('AI phát hiện đáp án có sự khác biệt so với bài đọc. Vui lòng kiểm tra!', 'warning')
      } else {
        showToast(res.data?.message || 'Đã tạo giải thích 4 bước thành công!', 'success')
        setConflictModalOpen(false)
        queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
        try {
          const fresh = await getReadingPractice(editing.id)
          const qData = typeof fresh.questions === 'string'
            ? JSON.parse(fresh.questions)
            : (fresh.questions || {})
          if (Array.isArray(qData.groups)) {
            setForm(f => ({ ...f, questionGroups: qData.groups }))
            pristineRef.current = formSig({ ...form, questionGroups: qData.groups })
          }
        } catch { /* ignore refresh error */ }
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể tạo giải thích bằng AI', 'error')
    } finally {
      setGeneratingAI(false)
    }
  }

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <>
        <div className="p-4 sm:p-6 max-w-[1520px] mx-auto">
          {/* Top Bar: Tiêu đề + Bộ nút thao tác chính (Sticky top) */}
          <div className="sticky top-0 z-20 bg-zinc-50/95 backdrop-blur-xs py-3.5 mb-5 border-b border-zinc-200 -mx-4 sm:-mx-6 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelOrBack}
                aria-label="Quay lại danh sách"
                className="w-8 h-8 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 flex items-center justify-center text-sm font-semibold transition cursor-pointer shadow-2xs"
              >
                ←
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                  {editing ? 'Chỉnh sửa bài Reading Practice' : 'Thêm bài Reading Practice mới'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-zinc-500 font-medium">
                    {form.questionGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0)} câu hỏi · {form.questionGroups.length} nhóm
                  </span>
                  {!draftBanner && <DraftSavedHint at={draftSavedAt} />}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={handleStartGenerateAI}
                  disabled={generatingAI}
                  className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="AI giải thích 4 bước cho bài đọc"
                >
                  {generatingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" /> : <BookOpen className="w-3.5 h-3.5 text-zinc-600" />}
                  <span className="hidden sm:inline">AI giải thích</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                aria-label="Xem trước nội dung đề"
                className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Xem trước</span>
              </button>
              <button
                type="button"
                onClick={handleCancelOrBack}
                className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-semibold transition shadow-2xs flex items-center justify-center cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang lưu...' : 'Lưu bài'}
              </button>
            </div>
          </div>

          <DraftBanner draft={draftBanner}
            onRestore={() => { groupCollapse.setAll([]); setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />

          {/* Grid 2 cột: Cột trái (Bài đọc & Thông tin), Cột phải (Nhóm câu hỏi) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── CỘT TRÁI (5/12): THÔNG TIN BÀI & PASSAGE BÀI ĐỌC (Sticky) ── */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-[74px] lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto pr-0.5">
              {/* Card 1: Tên bài & Thumbnail */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs space-y-3.5">
                <div>
                  <label className={labelCls}>Tên bài đọc <span className="text-red-500 font-normal">*</span></label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="VD: Academic Reading — Nature and Wildlife"
                    className={inputCls}
                  />
                </div>

                <div className="pt-1">
                  <ThumbnailPicker
                    preview={form.thumbPreview}
                    onSelect={file => setForm(f => ({ ...f, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                    onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                    hint="jpg, png, webp — tối đa 5MB"
                  />
                </div>
              </div>

              {/* Card 2: Passage (Bài đọc) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Passage (nội dung bài đọc)</label>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {form.passage ? form.passage.trim().split(/\s+/).filter(Boolean).length : 0} từ
                  </span>
                </div>
                <textarea
                  value={form.passage}
                  onChange={e => setForm(f => ({ ...f, passage: e.target.value }))}
                  placeholder="Nhập hoặc dán nội dung bài đọc (Passage) tại đây..."
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 resize-y font-mono bg-white text-zinc-900 placeholder:text-zinc-400 min-h-[320px] lg:h-[calc(100vh-450px)] lg:min-h-[280px]"
                  style={{ lineHeight: 1.7 }}
                />
              </div>
            </div>

            {/* ── CỘT PHẢI (7/12): NHÓM CÂU HỎI & CÂU HỎI ── */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs">
                {/* Header thêm nhóm câu hỏi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100">
                  <div>
                    <label className={labelCls + ' mb-0 text-sm font-bold text-zinc-900'}>Nhóm câu hỏi</label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Thêm và cấu hình các dạng câu hỏi cho bài đọc
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-52 sm:w-60"
                      ariaLabel="Loại nhóm câu hỏi"
                      value={addGroupType}
                      onChange={setAddGroupType}
                      options={READING_GROUP_TYPES}
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className={btnPrimary + ' h-9 py-0 px-4 text-xs font-semibold shrink-0 cursor-pointer flex items-center justify-center rounded-xl shadow-xs'}
                    >
                      + Thêm nhóm
                    </button>
                  </div>
                </div>

                {form.questionGroups.length > 0 && (
                  <div className="flex items-center justify-between mb-3 text-xs px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-700">
                        Danh sách nhóm câu hỏi
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                        {form.questionGroups.length} nhóm · {form.questionGroups.reduce((acc, g) => acc + (g.questions?.length || 0), 0)} câu
                      </span>
                    </div>
                    {form.questionGroups.length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => groupCollapse.setAll(form.questionGroups.map(g => g._id))}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                        >
                          Mở tất cả
                        </button>
                        <span className="text-zinc-300">·</span>
                        <button
                          type="button"
                          onClick={() => groupCollapse.setAll([])}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                        >
                          Thu gọn tất cả
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-zinc-400 text-xs py-14 border-2 border-dashed border-zinc-200 rounded-xl">
                    Chưa có nhóm câu hỏi nào. Chọn loại câu hỏi ở trên và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.questionGroups.map((g, i) => (
                      <PracticeGroupCard
                        key={g._id || g.id || i}
                        skill="reading"
                        group={g}
                        examId={editing?.id}
                        passage={form.passage}
                        expanded={groupCollapse.isExpanded(g._id)}
                        onToggle={() => groupCollapse.toggle(g._id)}
                        onChange={updated => handleGroupChange(i, updated)}
                        onRemove={() => handleGroupRemove(i)}
                        onMoveUp={() => handleGroupMove(i, -1)}
                        onMoveDown={() => handleGroupMove(i, 1)}
                        isFirst={i === 0}
                        isLast={i === form.questionGroups.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showPreview && (
          <ReadingPracticePreviewModal
            form={form}
            showAnswers={showAnswers}
            setShowAnswers={setShowAnswers}
            showExplanations={showExplanations}
            setShowExplanations={setShowExplanations}
            onClose={() => { setShowPreview(false); setShowAnswers(false); setShowExplanations(false) }}
          />
        )}

        <ExplanationConflictModal
          isOpen={conflictModalOpen}
          onClose={() => setConflictModalOpen(false)}
          conflicts={aiConflicts}
          isSubmitting={generatingAI}
          onConfirmResolve={(choices) => handleGenerateAI({ resolveChoices: choices, overwriteProtected: false })}
        />

        <OverwriteProtectedConfirmModal
          isOpen={overwriteModalOpen}
          onClose={() => setOverwriteModalOpen(false)}
          reviewedCount={protectedStats.reviewedCount}
          editedCount={protectedStats.editedCount}
          isSubmitting={generatingAI}
          onConfirm={({ overwriteProtected }) => {
            setOverwriteModalOpen(false)
            handleGenerateAI({ overwriteProtected })
          }}
        />
      </>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
        <AdminListHeader
          title="Reading Practice"
          subtitle="Bài luyện đọc riêng lẻ — hiển thị trên trang chủ"
          onAdd={openAdd}
        />

        {isPending && list.length === 0 ? (
          <AdminTableSkeleton firstColType="thumbnail" rows={6} cols={5} />
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            {list.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-400">Chưa có bài nào. Bấm "+ Thêm mới" để bắt đầu.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="rtable w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-16">Ảnh</th>
                  <th className="min-w-[10rem] px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Số câu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                    <td className="rt-thumb px-4 py-3">
                      <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageWithFallback
                          src={resolveImg(item.thumbnailUrl)}
                          alt={item.title || 'Thumbnail'}
                        />
                      </div>
                    </td>
                    <td className="rt-main px-4 py-3 text-sm font-medium text-zinc-800">{item.title}</td>
                    <td data-label="Số câu" className="px-4 py-3 hidden sm:table-cell">
                      {(() => {
                        const count = item.questionCount ?? 0; const total = 40
                        const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f4f4f5'
                        const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#71717a'
                        return <span style={{ background: bg, color, borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{count}/{total}</span>
                      })()}
                    </td>
                    <td data-label="Ngày tạo" className="px-4 py-3 text-sm text-zinc-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="rt-actions px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} disabled={loadingEditId !== null} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} disabled={loadingEditId !== null} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!delConfirm}
        title="Xóa bài đọc?"
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
        loading={deleting}
      />

      <ExplanationConflictModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflicts={aiConflicts}
        isSubmitting={generatingAI}
        onConfirmResolve={(choices) => handleGenerateAI(choices)}
      />
    </>
  )
}
