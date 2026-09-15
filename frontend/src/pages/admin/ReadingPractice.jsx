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
import AdminGroupPreview from '../../components/practice/AdminGroupPreview'
import ImageWithFallback from '../../components/common/ImageWithFallback'
import Select from '../../components/admin/Select'

// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
function ReadingPracticePreviewModal({ form, showAnswers, setShowAnswers, onClose }) {
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
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-zinc-900">Xem trước — {form.title || 'Reading Practice'}</span>
            <button type="button" onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition font-medium">
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
              ? form.questionGroups.map((g, gi) => <AdminGroupPreview key={gi} group={g} showAnswers={showAnswers} />)
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
  const [addGroupType, setAddGroupType] = useState(READING_GROUP_TYPES[0].value)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
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
  }

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Vui lòng nhập tên bài', 'error'); return }
    if (form.questionGroups.length === 0) {
      showToast('Bài thi phải có ít nhất một nhóm câu hỏi', 'error')
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
    try {
      await deleteReadingPractice(id)
      setDelConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'practice'] })
    }
    catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
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

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={handleCancelOrBack} aria-label="Quay lại danh sách" className="text-zinc-500 hover:text-zinc-700 text-sm font-semibold transition">←</button>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
              {editing ? 'Chỉnh sửa bài Reading Practice' : 'Thêm bài Reading Practice mới'}
            </h1>
          </div>

          <DraftBanner draft={draftBanner}
            onRestore={() => { groupCollapse.setAll([]); setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />
          {!draftBanner && <DraftSavedHint at={draftSavedAt} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <label className={labelCls}>Tên bài <span className="text-red-500 font-normal">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Academic Reading — Nature and Wildlife"
                  className={inputCls} />
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <label className={labelCls}>Passage (nội dung bài đọc)</label>
                <textarea value={form.passage} onChange={e => setForm(f => ({ ...f, passage: e.target.value }))}
                  rows={14} placeholder="Nhập nội dung passage..."
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 resize-y font-mono bg-white text-zinc-900 placeholder:text-zinc-400"
                  style={{ lineHeight: 1.7 }} />
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelCls + ' mb-0'}>Nhóm câu hỏi</label>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-48"
                      ariaLabel="Loại nhóm câu hỏi"
                      value={addGroupType}
                      onChange={setAddGroupType}
                      options={READING_GROUP_TYPES}
                    />
                    <button type="button" onClick={handleAddGroup} className={btnPrimary + ' py-1.5 px-3'}>
                      + Thêm nhóm
                    </button>
                  </div>
                </div>
                {form.questionGroups.length > 1 && (
                  <div className="flex justify-end gap-2 mb-2 text-xs">
                    <button type="button" onClick={() => groupCollapse.setAll(form.questionGroups.map(g => g._id))}
                      className="text-zinc-500 hover:text-zinc-700 font-medium">Mở tất cả</button>
                    <span className="text-zinc-300">·</span>
                    <button type="button" onClick={() => groupCollapse.setAll([])}
                      className="text-zinc-500 hover:text-zinc-700 font-medium">Thu gọn tất cả</button>
                  </div>
                )}
                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-zinc-400 text-xs py-8 border-2 border-dashed border-zinc-200 rounded-xl">
                    Chưa có nhóm câu hỏi nào. Chọn loại và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  form.questionGroups.map((g, i) => (
                    <PracticeGroupCard
                      key={g._id || g.id || i}
                      skill="reading"
                      group={g}
                      expanded={groupCollapse.isExpanded(g._id)}
                      onToggle={() => groupCollapse.toggle(g._id)}
                      onChange={updated => handleGroupChange(i, updated)}
                      onRemove={() => handleGroupRemove(i)}
                      onMoveUp={() => handleGroupMove(i, -1)}
                      onMoveDown={() => handleGroupMove(i, 1)}
                      isFirst={i === 0}
                      isLast={i === form.questionGroups.length - 1}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs">
                <ThumbnailPicker
                  preview={form.thumbPreview}
                  onSelect={file => setForm(f => ({ ...f, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                  onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                  hint="jpg, png, webp — tối đa 5MB"
                />
              </div>

              <button type="button" onClick={() => setShowPreview(true)}
                className={btnSecondary + ' w-full text-center'}>
                👁 Xem trước nội dung đề
              </button>

              <div className="flex gap-2">
                <button type="button" onClick={handleCancelOrBack} className={btnSecondary + ' flex-1 justify-center'}>Hủy</button>
                <button onClick={handleSave} disabled={saving} className={btnPrimary + ' flex-1 justify-center'}>
                  {saving ? 'Đang lưu...' : 'Lưu bài'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showPreview && (
          <ReadingPracticePreviewModal
            form={form} showAnswers={showAnswers} setShowAnswers={setShowAnswers}
            onClose={() => { setShowPreview(false); setShowAnswers(false) }}
          />
        )}
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

        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {isPending && list.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">Đang tải...</div>
          ) : list.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">Chưa có bài nào. Bấm "+ Thêm mới" để bắt đầu.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Số câu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                    <td className="px-4 py-3">
                      <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f4f4f5', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageWithFallback
                          src={resolveImg(item.thumbnailUrl)}
                          alt={item.title || 'Thumbnail'}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-800">{item.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {(() => {
                        const count = item.questionCount ?? 0; const total = 40
                        const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f4f4f5'
                        const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#71717a'
                        return <span style={{ background: bg, color, borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{count}/{total}</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-slate-700 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 transition shadow-2xs cursor-pointer">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        open={!!delConfirm}
        title="Xóa bài đọc?"
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
      />
    </>
  )
}
