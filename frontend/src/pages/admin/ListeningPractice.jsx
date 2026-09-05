import { useState, useEffect, useRef } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { useCollapsibleGroups } from '../../hooks/useCollapsibleGroups'
import { validateAudioFile } from '../../utils/fileValidation'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'
import { useToast } from '../../context/ToastContext'
import PracticeGroupCard from '../../components/admin/PracticeGroupCard'
import {
  getListeningPracticeList, getListeningPractice,
  createListeningPractice, updateListeningPractice,
  deleteListeningPractice, uploadListeningThumbnailFile, uploadListeningAudioFile,
} from '../../services/practiceService'
import {
  resolveImg, recalcGroups,
  LISTENING_GROUP_TYPES, emptyListeningGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
} from '../../utils/practiceConfig'
import AdminGroupPreview from '../../components/practice/AdminGroupPreview'

// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
function ListeningPracticePreviewModal({ form, showAnswers, setShowAnswers, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 800, height: '90vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3 bg-indigo-50 border-b border-indigo-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-indigo-800">Xem trước — {form.title || 'Listening Practice'}</span>
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
        <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
          {form.context && (
            <p className="text-xs text-slate-500 italic mb-5 border-l-2 border-[#bfdbfe] pl-3">{form.context}</p>
          )}
          {form.questionGroups.length > 0
            ? form.questionGroups.map((g, gi) => <AdminGroupPreview key={gi} group={g} showAnswers={showAnswers} />)
            : <p className="text-sm text-slate-400 italic text-center mt-10">Chưa có câu hỏi</p>}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', context: '',
  audioUrl: null, audioFile: null, audioName: null,
  questionGroups: [],
  thumbnailUrl: null, thumbPreview: null, thumbFile: null,
}

// Chữ ký nội dung form (bỏ thumbPreview/audioName — phái sinh) để phát hiện thay
// đổi chưa lưu (derive-snapshot, giống SampleManager).
const formSig = (f) => JSON.stringify([f.title, f.context, f.questionGroups, f.thumbnailUrl, !!f.thumbFile, f.audioUrl, !!f.audioFile])

export default function ListeningPractice() {
  const { showToast } = useToast()
  const [list, setList]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState('list')
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [delConfirm, setDelConfirm]   = useState(null)
  const [addGroupType, setAddGroupType] = useState(LISTENING_GROUP_TYPES[0].value)
  const [showPreview, setShowPreview] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  // BUG-13: Track unsaved changes (derive-snapshot: formSig(form) vs pristineRef)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')
  const audioRef = useRef()

  // BUG-13: Block navigation when form is dirty
  useUnsavedChanges(view === 'form' && isDirty)

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  // BUG-14: Draft auto-save (restore khi mở form, autosave 2s khi có thay đổi).
  const draftKey = `draft_listening_practice_${editing?.id || 'new'}`
  const { draftBanner, setDraftBanner, draftSavedAt, clearDraft } =
    useDraftPersistence(draftKey, form, { enabled: view === 'form', dirty: isDirty })

  // Thu gọn/bung từng nhóm câu hỏi (mặc định thu gọn khi mở đề).
  const groupCollapse = useCollapsibleGroups()

  const load = async () => {
    setLoading(true)
    try { setList(await getListeningPracticeList()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    groupCollapse.setAll([])
    setForm(EMPTY_FORM); setEditing(null); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    try {
      const data  = await getListeningPractice(item.id)
      const qData = data.questions
        ? (typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions)
        : { groups: [] }
      const next = {
        title: data.title || '',
        context: data.passage || '',
        audioUrl: data.audioUrl || null,
        audioFile: null,
        audioName: data.audioUrl ? data.audioUrl.split('/').pop() : null,
        questionGroups: qData.groups || [],
        thumbnailUrl: data.thumbnailUrl || null,
        thumbPreview: resolveImg(data.thumbnailUrl),
        thumbFile: null,
      }
      pristineRef.current = formSig(next)
      groupCollapse.setAll([])
      setForm(next)
      setEditing(data); setIsDirty(false); setView('form')
    } catch { showToast('Lỗi tải bài', 'error') }
  }

  const handleGroupChange = (i, updated) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.map((g, idx) => idx === i ? updated : g)) }))
  }
  const handleGroupRemove = (i) => {
    setForm(f => ({ ...f, questionGroups: recalcGroups(f.questionGroups.filter((_, idx) => idx !== i)) }))
  }
  const handleGroupMove = (i, dir) => {
    setForm(f => {
      const arr = [...f.questionGroups]; const j = i + dir
      if (j < 0 || j >= arr.length) return f
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...f, questionGroups: recalcGroups(arr) }
    })
  }
  const handleAddGroup = () => {
    const lastEnd = form.questionGroups.length > 0 ? form.questionGroups[form.questionGroups.length - 1].qNumberEnd : 0
    const newGroup = emptyListeningGroupOf(addGroupType, lastEnd + 1)
    setForm(f => ({ ...f, questionGroups: [...f.questionGroups, newGroup] }))
    groupCollapse.reveal(newGroup._id)
  }

  const handleAudioPick = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const v = validateAudioFile(file)
    if (!v.ok) { showToast(v.error, 'error'); e.target.value = ''; return }
    setForm(prev => ({ ...prev, audioFile: file, audioName: file.name }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Vui lòng nhập tên bài', 'error'); return }
    if (form.questionGroups.length === 0) {
      showToast('Bài thi phải có ít nhất một nhóm câu hỏi', 'error')
      return
    }
    // Audio "bắt buộc" mềm — cho lưu nháp ý tưởng, nhưng cảnh báo rõ hậu quả.
    if (!form.audioUrl && !form.audioFile) {
      if (!window.confirm('Bài Listening chưa có file audio. Học viên sẽ không nghe được và không làm được bài. Vẫn lưu?')) return
    }

    setSaving(true)
    try {
      // ── Bước 1: upload file mới (nếu có) TRƯỚC — record chỉ ghi khi file đã lên xong ──
      let thumbnailUrl = form.thumbnailUrl
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        try {
          thumbnailUrl = (await uploadListeningThumbnailFile(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      let audioUrl = form.audioUrl
      if (form.audioFile) {
        const fd = new FormData(); fd.append('audio', form.audioFile)
        try {
          audioUrl = (await uploadListeningAudioFile(fd)).url
        } catch (e) {
          showToast(e.response?.data?.message || 'Tải file audio lên thất bại. Bài chưa được lưu, vui lòng thử lại.', 'error')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = {
        title: form.title.trim(),
        passage: form.context,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: audioUrl || null,
        questions: form.questionGroups.map((group, index) => ({ ...group, orderIndex: index }))
      }
      if (!editing) await createListeningPractice(body)
      else await updateListeningPractice(editing.id, body)

      clearDraft(); setIsDirty(false); setView('list'); load()
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi lưu bài thi', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await deleteListeningPractice(id); setDelConfirm(null); load() }
    catch (err) { showToast(err.response?.data?.message || 'Lỗi xóa', 'error') }
  }

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setIsDirty(false); setView('list') }} aria-label="Quay lại danh sách" className="text-slate-500 hover:text-slate-700 text-xl font-bold transition">←</button>
            <h1 className="text-xl font-bold text-slate-800">
              {editing ? 'Chỉnh sửa bài Listening Practice' : 'Thêm bài Listening Practice mới'}
            </h1>
          </div>

          <DraftBanner draft={draftBanner}
            onRestore={() => { groupCollapse.setAll([]); setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />
          {!draftBanner && <DraftSavedHint at={draftSavedAt} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className={labelCls}>Tên bài <span className="text-red-500 font-normal">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Listening — Section 1: Telephone Enquiry"
                  className={inputCls} />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className={labelCls}>Mô tả tình huống (Context)</label>
                <textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                  rows={4} placeholder="VD: You will hear a conversation between a student and a library assistant..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-y"
                  style={{ lineHeight: 1.7 }} />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelCls + ' mb-0'}>Nhóm câu hỏi</label>
                  <div className="flex items-center gap-2">
                    <select value={addGroupType} onChange={e => setAddGroupType(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white">
                      {LISTENING_GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={handleAddGroup} className={btnPrimary + ' py-1.5 px-3'}>
                      + Thêm nhóm
                    </button>
                  </div>
                </div>
                {form.questionGroups.length > 1 && (
                  <div className="flex justify-end gap-2 mb-2 text-xs">
                    <button type="button" onClick={() => groupCollapse.setAll(form.questionGroups.map(g => g._id))}
                      className="text-slate-500 hover:text-slate-700 font-medium">Mở tất cả</button>
                    <span className="text-slate-300">·</span>
                    <button type="button" onClick={() => groupCollapse.setAll([])}
                      className="text-slate-500 hover:text-slate-700 font-medium">Thu gọn tất cả</button>
                  </div>
                )}
                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-lg">
                    Chưa có nhóm câu hỏi nào. Chọn loại và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  form.questionGroups.map((g, i) => (
                    <PracticeGroupCard
                      key={g._id || g.id || i}
                      skill="listening"
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
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <ThumbnailPicker
                  preview={form.thumbPreview}
                  onSelect={file => setForm(f => ({ ...f, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                  onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                  hint="jpg, png, webp — tối đa 5MB"
                />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className={labelCls}>File Audio</label>
                {form.audioName || form.audioUrl ? (
                  <>
                    <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-lg shrink-0">🎵</span>
                      <span className="text-xs text-green-700 flex-1 truncate">{form.audioName || 'Audio đã upload'}</span>
                      <button onClick={() => setForm(f => ({ ...f, audioFile: null, audioName: null, audioUrl: null }))}
                        aria-label="Xóa file audio"
                        className="text-blue-500 hover:text-blue-600 text-sm shrink-0">×</button>
                    </div>
                    {form.audioUrl && (
                      <audio controls
                        src={form.audioUrl.startsWith('http') ? form.audioUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${form.audioUrl}`}
                        className="w-full mt-2 rounded-lg" style={{ height: '40px' }} />
                    )}
                  </>
                ) : (
                  <button onClick={() => audioRef.current.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-2 text-slate-400 text-sm cursor-pointer py-4">
                    <span className="text-2xl">🎵</span>
                    <span>Chọn file audio (mp3, m4a...)</span>
                  </button>
                )}
                <input ref={audioRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.aac" className="hidden"
                  onChange={handleAudioPick} />
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
          <ListeningPracticePreviewModal
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
      <div className="p-6 max-w-5xl">
        <AdminListHeader
          title="Listening Practice"
          subtitle="Bài luyện nghe riêng lẻ — hiển thị trên trang chủ"
          onAdd={openAdd}
        />

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-slate-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">Chưa có bài nào.</div>
            : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-16">Ảnh</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Tên bài</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Audio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Câu</th>
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
                        {item.audioUrl
                          ? <span className="text-xs text-green-600 font-medium">🎵 Có audio</span>
                          : <span className="text-xs text-amber-600 font-medium">⚠ Thiếu audio</span>}
                      </td>
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
        title="Xóa bài nghe?"
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
      />
    </>
  )
}
