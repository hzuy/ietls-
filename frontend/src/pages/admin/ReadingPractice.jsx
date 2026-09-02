import { useState, useEffect, useRef, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'
import {
  getReadingPracticeList, getReadingPractice,
  createReadingPractice, updateReadingPractice,
  deleteReadingPractice, uploadReadingThumbnailFile,
} from '../../services/practiceService'
import {
  resolveImg, recalcGroups,
  READING_GROUP_TYPES, emptyReadingGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
  GROUP_TYPE_COLORS,
} from '../../utils/practiceConfig'
import TrueFalseEditor         from '../../components/practice/TrueFalseEditor'
import TableCompletionEditor   from '../../components/practice/TableCompletionEditor'
import NoteCompletionEditor    from '../../components/practice/NoteCompletionEditor'
import SummaryCompletionEditor from '../../components/practice/SummaryCompletionEditor'
import MCQGroupEditor          from '../../components/practice/MCQGroupEditor'
import MatchingEditor          from '../../components/practice/MatchingEditor'
import MatchingHeadingsEditor  from '../../components/practice/MatchingHeadingsEditor'
import DiagramLabelEditor      from '../../components/practice/DiagramLabelEditor'
import AdminGroupPreview       from '../../components/practice/AdminGroupPreview'

// ─── GROUP EDITOR ─────────────────────────────────────────────────────────────
function ReadingGroupEditor({ group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const typeLabel = READING_GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GROUP_TYPE_COLORS[group.type] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-slate-500 font-medium">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-25 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-25 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-blue-500 hover:text-blue-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-blue-50">
            Xóa nhóm
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Instruction (hiển thị cho học sinh)</label>
          <textarea rows={2} className={`${inputCls} resize-none`}
            placeholder="Hướng dẫn làm bài..."
            value={group.instruction}
            onChange={e => onChange({ ...group, instruction: e.target.value })} />
        </div>

        {(group.type === 'true_false_ng' || group.type === 'yes_no_ng') && (
          <TrueFalseEditor group={group} onChange={onChange} />
        )}
        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_information' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1D4ED8]" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại chữ cái (mỗi đoạn có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1D4ED8]" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại đáp án (mỗi đáp án có thể khớp nhiều câu)</span>
            </label>
            <MatchingEditor group={group} onChange={onChange} />
          </div>
        )}
        {group.type === 'diagram_label' && (
          <DiagramLabelEditor group={group} onChange={onChange} />
        )}
        {group.type === 'matching_headings' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-green-600" />
              <span className="text-xs text-slate-600 font-medium">Cho phép dùng lại heading (heading có thể khớp nhiều đoạn)</span>
            </label>
            <MatchingHeadingsEditor group={group} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}

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
        <div className="flex items-center justify-between px-6 py-3 bg-indigo-50 border-b border-indigo-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-indigo-800">Xem trước — {form.title || 'Reading Practice'}</span>
            <button type="button" onClick={() => setShowAnswers(v => !v)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-[#1D4ED8] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#bfdbfe] hover:text-[#1D4ED8]'}`}>
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition font-medium">
            ✕ Đóng
          </button>
        </div>
        <div ref={containerRef} className="flex flex-1 overflow-hidden"
          style={{ userSelect: dragging ? 'none' : 'auto' }}>
          <div className="overflow-y-auto bg-white px-8 py-6" style={{ width: `${leftPct}%`, flexShrink: 0 }}>
            {form.passage
              ? <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">{form.passage}</p>
              : <p className="text-sm text-slate-400 italic">Chưa có nội dung passage</p>}
          </div>
          <div onMouseDown={onDividerMouseDown}
            style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: dragging ? '#3B82F6' : '#e5e7eb', transition: dragging ? 'none' : 'background 0.15s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = '#93c5fd' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = '#e5e7eb' }} />
          <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
            {form.questionGroups.length > 0
              ? form.questionGroups.map((g, gi) => <AdminGroupPreview key={gi} group={g} showAnswers={showAnswers} />)
              : <p className="text-sm text-slate-400 italic text-center mt-10">Chưa có câu hỏi</p>}
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
  const [list, setList]               = useState([])
  const [loading, setLoading]         = useState(true)
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

  const load = async () => {
    setLoading(true)
    try { setList(await getReadingPracticeList()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
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
      setForm(next)
      setEditing(data); setShowPreview(false); setIsDirty(false); setView('form')
    } catch { alert('Lỗi tải bài') }
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Vui lòng nhập tên bài'); return }
    if (form.questionGroups.length === 0) {
      alert('Bài thi phải có ít nhất một nhóm câu hỏi')
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
          alert(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.')
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

      clearDraft(); setIsDirty(false); setView('list'); load()
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu bài thi')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await deleteReadingPractice(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
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
    setForm(f => ({ ...f, questionGroups: [...f.questionGroups, emptyReadingGroupOf(addGroupType, lastEnd + 1)] }))
  }

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setIsDirty(false); setView('list') }} aria-label="Quay lại danh sách" className="text-slate-500 hover:text-slate-700 text-xl font-bold transition">←</button>
            <h1 className="text-xl font-bold text-slate-800">
              {editing ? 'Chỉnh sửa bài Reading Practice' : 'Thêm bài Reading Practice mới'}
            </h1>
          </div>

          <DraftBanner draft={draftBanner}
            onRestore={() => { setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />
          {!draftBanner && <DraftSavedHint at={draftSavedAt} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className={labelCls}>Tên bài <span className="text-red-500 font-normal">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Academic Reading — Nature and Wildlife"
                  className={inputCls} />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className={labelCls}>Passage (nội dung bài đọc)</label>
                <textarea value={form.passage} onChange={e => setForm(f => ({ ...f, passage: e.target.value }))}
                  rows={14} placeholder="Nhập nội dung passage..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-y font-mono"
                  style={{ lineHeight: 1.7 }} />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelCls + ' mb-0'}>Nhóm câu hỏi</label>
                  <div className="flex items-center gap-2">
                    <select value={addGroupType} onChange={e => setAddGroupType(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white">
                      {READING_GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={handleAddGroup} className={btnPrimary + ' py-1.5 px-3'}>
                      + Thêm nhóm
                    </button>
                  </div>
                </div>
                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-lg">
                    Chưa có nhóm câu hỏi nào. Chọn loại và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  form.questionGroups.map((g, i) => (
                    <ReadingGroupEditor
                      key={g._id || g.id || i}
                      group={g}
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
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
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
                <button onClick={() => setView('list')} className={btnSecondary + ' flex-1 justify-center'}>Hủy</button>
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
      </AdminLayout>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <AdminListHeader
          title="Reading Practice"
          subtitle="Bài luyện đọc riêng lẻ — hiển thị trên trang chủ"
          onAdd={openAdd}
        />

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Đang tải...</div>
          ) : list.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Chưa có bài nào. Bấm "+ Thêm mới" để bắt đầu.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Số câu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {resolveImg(item.thumbnailUrl)
                          ? <img src={resolveImg(item.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {(() => {
                        const count = item.questionCount ?? 0; const total = 40
                        const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f1f5f9'
                        const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#64748b'
                        return <span style={{ background: bg, color, borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{count}/{total}</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-red-500 hover:bg-blue-50 font-medium transition">Xóa</button>
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
    </AdminLayout>
  )
}
