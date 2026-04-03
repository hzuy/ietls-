import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import {
  getListeningPracticeList, getListeningPractice,
  createListeningPractice, updateListeningPractice,
  deleteListeningPractice, uploadListeningThumbnail, uploadListeningAudio,
} from '../../services/practiceService'
import {
  resolveImg, recalcGroups,
  LISTENING_GROUP_TYPES, emptyListeningGroupOf,
  inputCls, labelCls, btnPrimary, btnSecondary,
  GROUP_TYPE_COLORS,
} from '../../utils/practiceConfig'
import TableCompletionEditor          from '../../components/practice/TableCompletionEditor'
import NoteCompletionEditor           from '../../components/practice/NoteCompletionEditor'
import SummaryCompletionEditorSimple  from '../../components/practice/SummaryCompletionEditorSimple'
import MCQGroupEditor                 from '../../components/practice/MCQGroupEditor'
import MatchingEditor                 from '../../components/practice/MatchingEditor'
import MatchingHeadingsEditor         from '../../components/practice/MatchingHeadingsEditor'
import DiagramLabelEditor             from '../../components/practice/DiagramLabelEditor'
import AdminGroupPreview              from '../../components/practice/AdminGroupPreview'

// ─── GROUP EDITOR ─────────────────────────────────────────────────────────────
function ListeningGroupEditor({ group, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const typeLabel = LISTENING_GROUP_TYPES.find(t => t.value === group.type)?.label || group.type

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GROUP_TYPE_COLORS[group.type] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500 font-medium">Câu {group.qNumberStart}–{group.qNumberEnd}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▲</button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 text-xs transition">▼</button>
          </div>
          <button type="button" onClick={onRemove}
            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-red-50">
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

        {group.type === 'note_completion' && (
          <NoteCompletionEditor group={group} onChange={onChange} />
        )}
        {group.type === 'table_completion' && (
          <TableCompletionEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'mcq' || group.type === 'mcq_multi') && (
          <MCQGroupEditor group={group} onChange={onChange} />
        )}
        {(group.type === 'matching' || group.type === 'map_diagram') && (
          <MatchingEditor group={group} onChange={onChange} />
        )}
        {group.type === 'drag_word_bank' && (
          <SummaryCompletionEditorSimple group={group} onChange={onChange} />
        )}
        {group.type === 'matching_drag' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={group.canReuse || false}
                onChange={e => onChange({ ...group, canReuse: e.target.checked })}
                className="accent-[#1a56db]" />
              <span className="text-xs text-gray-600 font-medium">Cho phép dùng lại đáp án (mỗi đáp án có thể khớp nhiều câu)</span>
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
              <span className="text-xs text-gray-600 font-medium">Cho phép dùng lại heading (heading có thể khớp nhiều đoạn)</span>
            </label>
            <MatchingHeadingsEditor group={group} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}

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
              className={`text-xs px-3 py-1 rounded-full font-semibold transition ${showAnswers ? 'bg-[#1a56db] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#bfdbfe] hover:text-[#1a56db]'}`}>
              {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition font-medium">
            ✕ Đóng
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          {form.context && (
            <p className="text-xs text-gray-500 italic mb-5 border-l-2 border-[#bfdbfe] pl-3">{form.context}</p>
          )}
          {form.questionGroups.length > 0
            ? form.questionGroups.map((g, gi) => <AdminGroupPreview key={gi} group={g} showAnswers={showAnswers} />)
            : <p className="text-sm text-gray-400 italic text-center mt-10">Chưa có câu hỏi</p>}
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

export default function ListeningPractice() {
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
  const [draftBanner, setDraftBanner] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const thumbRef = useRef()
  const audioRef = useRef()

  const DRAFT_KEY = 'draft_listening_practice'

  useEffect(() => {
    if (view !== 'form' || editing) return
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try { setDraftBanner({ data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(DRAFT_KEY) }
    } else { setDraftBanner(null) }
  }, [view, editing])

  useEffect(() => {
    if (view !== 'form') return
    if (!form.title && !form.context && form.questionGroups.length === 0) return
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      const now = new Date()
      setDraftSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }, 1000)
    return () => clearTimeout(timer)
  }, [form, view])

  const load = async () => {
    setLoading(true)
    try { setList(await getListeningPracticeList()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clearDraft = () => { localStorage.removeItem(DRAFT_KEY); setDraftBanner(null); setDraftSavedAt(null) }

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setView('form') }

  const openEdit = async (item) => {
    try {
      const data  = await getListeningPractice(item.id)
      const qData = data.questions
        ? (typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions)
        : { groups: [] }
      setForm({
        title: data.title || '',
        context: data.passage || '',
        audioUrl: data.audioUrl || null,
        audioFile: null,
        audioName: data.audioUrl ? data.audioUrl.split('/').pop() : null,
        questionGroups: qData.groups || [],
        thumbnailUrl: data.thumbnailUrl || null,
        thumbPreview: resolveImg(data.thumbnailUrl),
        thumbFile: null,
      })
      setEditing(data); setView('form')
    } catch { alert('Lỗi tải bài') }
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
    setForm(f => ({ ...f, questionGroups: [...f.questionGroups, emptyListeningGroupOf(addGroupType, lastEnd + 1)] }))
  }

  const handleThumbPick = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh phải nhỏ hơn 5MB'); return }
    setForm(f => ({ ...f, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Vui lòng nhập tên bài'); return }
    setSaving(true)
    try {
      const body = { title: form.title.trim(), passage: form.context, questions: { groups: form.questionGroups } }
      let id
      if (!editing) {
        const res = await createListeningPractice(body); id = res.id
      } else {
        await updateListeningPractice(editing.id, body); id = editing.id
      }
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        await uploadListeningThumbnail(id, fd)
      }
      if (form.audioFile) {
        const fd = new FormData(); fd.append('audio', form.audioFile)
        await uploadListeningAudio(id, fd)
      }
      clearDraft(); setView('list'); load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi lưu') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    try { await deleteListeningPractice(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { clearDraft(); setView('list') }} className="text-gray-500 hover:text-gray-700 text-xl font-bold transition">←</button>
            <h1 className="text-xl font-bold text-gray-800">
              {editing ? 'Chỉnh sửa bài Listening Practice' : 'Thêm bài Listening Practice mới'}
            </h1>
          </div>

          {draftBanner && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-yellow-700">📋 Bạn có bản nháp chưa lưu. Khôi phục không?</span>
              <div className="flex gap-2">
                <button onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 transition">Khôi phục</button>
                <button onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraftBanner(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 transition">Bỏ qua</button>
              </div>
            </div>
          )}
          {draftSavedAt && !draftBanner && (
            <div className="text-xs text-gray-400 mb-2">💾 Đã lưu nháp lúc {draftSavedAt}</div>
          )}

          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'start' }}>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className={labelCls}>Tên bài <span className="text-red-500 normal-case font-normal">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Listening — Section 1: Telephone Enquiry"
                  className={inputCls} />
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className={labelCls}>Mô tả tình huống (Context)</label>
                <textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                  rows={4} placeholder="VD: You will hear a conversation between a student and a library assistant..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-y"
                  style={{ lineHeight: 1.7 }} />
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <label className={labelCls + ' mb-0'}>Nhóm câu hỏi</label>
                  <div className="flex items-center gap-2">
                    <select value={addGroupType} onChange={e => setAddGroupType(e.target.value)}
                      className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white">
                      {LISTENING_GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={handleAddGroup} className={btnPrimary + ' py-1.5 px-3'}>
                      + Thêm nhóm
                    </button>
                  </div>
                </div>
                {form.questionGroups.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    Chưa có nhóm câu hỏi nào. Chọn loại và bấm "+ Thêm nhóm".
                  </div>
                ) : (
                  form.questionGroups.map((g, i) => (
                    <ListeningGroupEditor
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

            <div className="space-y-3" style={{ position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className={labelCls}>Ảnh bìa</label>
                {form.thumbPreview ? (
                  <div className="relative mb-2">
                    <img src={form.thumbPreview} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '16/9' }} />
                    <button onClick={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center border-2 border-white">×</button>
                  </div>
                ) : (
                  <button onClick={() => thumbRef.current.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 hover:border-blue-300 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-2 text-gray-400 text-sm cursor-pointer"
                    style={{ aspectRatio: '16/9' }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Chọn ảnh bìa
                  </button>
                )}
                <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleThumbPick} />
                <p className="text-xs text-gray-400 mt-1.5">jpg, png, webp — tối đa 5MB</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className={labelCls}>File Audio</label>
                {form.audioName || form.audioUrl ? (
                  <>
                    <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-200">
                      <span className="text-lg shrink-0">🎵</span>
                      <span className="text-xs text-green-700 flex-1 truncate">{form.audioName || 'Audio đã upload'}</span>
                      <button onClick={() => setForm(f => ({ ...f, audioFile: null, audioName: null, audioUrl: null }))}
                        className="text-red-400 hover:text-red-600 text-sm shrink-0">×</button>
                    </div>
                    {form.audioUrl && (
                      <audio controls
                        src={form.audioUrl.startsWith('http') ? form.audioUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${form.audioUrl}`}
                        className="w-full mt-2 rounded-lg" style={{ height: '40px' }} />
                    )}
                  </>
                ) : (
                  <button onClick={() => audioRef.current.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:border-blue-300 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-2 text-gray-400 text-sm cursor-pointer py-4">
                    <span className="text-2xl">🎵</span>
                    <span>Chọn file audio (mp3, m4a...)</span>
                  </button>
                )}
                <input ref={audioRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.aac" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) setForm(prev => ({ ...prev, audioFile: f, audioName: f.name })) }} />
              </div>

              <button type="button" onClick={() => setShowPreview(true)}
                className={btnSecondary + ' w-full text-center'}>
                👁 Xem trước nội dung đề
              </button>

              <div className="flex gap-2">
                <button onClick={() => { clearDraft(); setView('list') }} className={btnSecondary + ' flex-1 justify-center'}>Hủy</button>
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
      </AdminLayout>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Listening Practice</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bài luyện nghe riêng lẻ — hiển thị trên trang chủ</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition">+ Thêm mới</button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Chưa có bài nào.</div>
            : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-16">Ảnh</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên bài</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Audio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Câu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Ngày tạo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {resolveImg(item.thumbnailUrl)
                            ? <img src={resolveImg(item.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.title}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {item.audioUrl
                          ? <span className="text-xs text-green-600 font-medium">🎵 Có audio</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {(() => {
                          const count = item.questionCount ?? 0; const total = 40
                          const bg    = count === total ? '#dcfce7' : count > total ? '#fee2e2' : '#f1f5f9'
                          const color = count === total ? '#15803d' : count > total ? '#dc2626' : '#64748b'
                          return <span style={{ background: bg, color, borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{count}/{total}</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition">Sửa</button>
                          <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🗑️</div>
              <h3 className="font-bold text-gray-800">Xóa bài nghe?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">Hủy</button>
              <button onClick={() => handleDelete(delConfirm)} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
