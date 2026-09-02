import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { validateImageFile } from '../../utils/fileValidation'

import RichTextEditor from '../../components/RichTextEditor'
import { getWritingSamples, getWritingSample, createWritingSample, updateWritingSample, deleteWritingSample, uploadWritingSampleThumbnailFile } from '../../services/sampleService'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const TASKS = [
  { value: '', label: '-- Task --' },
  { value: 'task1', label: 'Task 1' },
  { value: 'task2', label: 'Task 2' },
]

const TASK_LABELS = { task1: 'Task 1', task2: 'Task 2' }

const EXAM_TYPE_PLACEHOLDER = {
  task1: 'VD: Bar chart, Line graph, Pie chart, Map, Process diagram...',
  task2: 'VD: Opinion essay, Discussion essay, Problem-solution...',
  '':    'VD: Bar chart, Opinion essay...',
}

const EMPTY_FORM = { title: '', level: '', examType: '', content: '', tagInput: '', tags: [], thumbnailUrl: null, thumbPreview: null, thumbFile: null }

// Chữ ký nội dung form (bỏ qua tagInput — chỉ là buffer gõ dở) để phát hiện thay đổi chưa lưu.
const formSig = (f) => JSON.stringify([f.title, f.level, f.examType, f.content, f.tags, f.thumbnailUrl, !!f.thumbFile])

export default function WritingSamples() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  // BUG-14: Draft auto-save state
  const [draftBanner, setDraftBanner] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')
  const thumbRef = useRef()

  // Cảnh báo đóng tab / F5 khi form có thay đổi chưa lưu (in-app nav xử lý ở AdminLayout — Bước 3).
  useUnsavedChanges(view === 'form' && isDirty)

  // Escape đóng modal xác nhận xoá (port từ pattern preview modal Reading/Listening)
  useEffect(() => {
    if (!delConfirm) return
    const h = (e) => { if (e.key === 'Escape') setDelConfirm(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [delConfirm])

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  const getDraftKey = () => `draft_writing_sample_${editing?.id || 'new'}`

  // BUG-14: Restore draft on form open
  useEffect(() => {
    if (view !== 'form') return
    const key = getDraftKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      try { setDraftBanner({ data: JSON.parse(saved) }) }
      catch { localStorage.removeItem(key) }
    } else { setDraftBanner(null) }
  }, [view, editing?.id])

  // BUG-14: Auto-save draft with 2s debounce
  useEffect(() => {
    if (view !== 'form') return
    if (!form.title && !form.content) return
    const key = getDraftKey()
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      setDraftSavedAt(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)
    }, 2000)
    return () => clearTimeout(timer)
  }, [form, view, editing?.id])

  const load = async () => {
    setLoading(true)
    try { setList(await getWritingSamples()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clearDraft = () => { localStorage.removeItem(getDraftKey()); setDraftBanner(null); setDraftSavedAt(null) }

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    setForm(EMPTY_FORM); setEditing(null); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    try {
      const data = await getWritingSample(item.id)
      const next = { title: data.title, level: data.level || '', examType: data.examType || '', content: data.content || '', tagInput: '', tags: data.tags || [], thumbnailUrl: data.thumbnailUrl, thumbPreview: resolveImg(data.thumbnailUrl), thumbFile: null }
      pristineRef.current = formSig(next)
      setForm(next)
      setEditing(data); setIsDirty(false); setView('form')
    } catch { alert('Lỗi tải') }
  }

  const addTag = () => {
    const t = form.tagInput.trim()
    if (!t || form.tags.includes(t)) { setForm(f => ({ ...f, tagInput: '' })); return }
    setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
  }

  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))

  const handleThumbPick = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const v = validateImageFile(file)
    if (!v.ok) { alert(v.error); e.target.value = ''; return }
    setForm(prev => ({ ...prev, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Vui lòng nhập tên bài'); return }
    // BUG-15: Validate content not empty
    const plainContent = form.content.replace(/<[^>]*>/g, '').trim()
    if (!plainContent) { alert('Vui lòng nhập nội dung bài mẫu'); return }
    setSaving(true)
    try {
      // ── Bước 1: upload ảnh mới (nếu có) TRƯỚC — record chỉ ghi khi file đã lên xong ──
      let thumbnailUrl = form.thumbnailUrl
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        try {
          thumbnailUrl = (await uploadWritingSampleThumbnailFile(fd)).url
        } catch (e) {
          alert(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = { title: form.title.trim(), level: form.level || null, examType: form.examType.trim() || null, content: form.content, thumbnailUrl: thumbnailUrl || null, tags: form.tags }
      if (!editing) await createWritingSample(body)
      else await updateWritingSample(editing.id, body)

      setIsDirty(false); setView('list'); clearDraft(); load()
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await deleteWritingSample(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  if (view === 'form') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} aria-label="Quay lại danh sách" className="text-slate-500 hover:text-slate-700 text-xl font-bold transition">←</button>
            <h1 className="text-xl font-bold text-slate-800">{editing ? 'Chỉnh sửa Writing Sample' : 'Thêm Writing Sample mới'}</h1>
          </div>

          {/* BUG-14: Draft banner */}
          {draftBanner && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-yellow-700">📋 Bạn có bản nháp chưa lưu. Khôi phục không?</span>
              <div className="flex gap-2">
                <button onClick={() => { setForm(draftBanner.data); setDraftBanner(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 transition">Khôi phục</button>
                <button onClick={() => { clearDraft(); setDraftBanner(null) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition">Bỏ qua</button>
              </div>
            </div>
          )}
          {draftSavedAt && !draftBanner && (
            <div className="text-xs text-slate-400 mb-2">💾 Đã lưu nháp lúc {draftSavedAt}</div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex flex-col gap-4">
              {/* Basic info */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên bài <span className="text-red-500 font-normal">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="VD: Cambridge IELTS 19 — Task 1 Sample Answer"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Task</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value, examType: '' }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                    {TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dạng đề</label>
                  <input value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                    placeholder={EXAM_TYPE_PLACEHOLDER[form.level] || EXAM_TYPE_PLACEHOLDER['']}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-blue-50 text-[#1D4ED8] rounded-full px-2.5 py-0.5 text-xs font-medium">
                        {t}
                        <button onClick={() => removeTag(t)} aria-label={`Xóa tag ${t}`} className="bg-transparent border-0 cursor-pointer text-[#1D4ED8] text-sm leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                      placeholder="VD: Task 1, Band 8.0... (Enter để thêm)"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                    <button onClick={addTag} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100">+ Thêm</button>
                  </div>
                </div>
              </div>

              {/* Rich text content */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Nội dung bài mẫu</label>
                <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))}
                  maxHeight={520}
                  placeholder="Nhập nội dung bài mẫu Writing..." />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Ảnh bìa</label>
                {form.thumbPreview ? (
                  <div className="relative mb-1.5">
                    <img src={form.thumbPreview} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '16/9' }} />
                    <button onClick={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                      aria-label="Xóa ảnh bìa"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#ef4444] text-white text-sm flex items-center justify-center border-0 cursor-pointer">×</button>
                  </div>
                ) : (
                  <button onClick={() => thumbRef.current.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-1.5 text-slate-400 text-[13px] cursor-pointer"
                    style={{ aspectRatio: '16/9' }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Chọn ảnh bìa
                  </button>
                )}
                <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleThumbPick} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView('list')} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium">Hủy</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[#1D4ED8] text-white text-sm font-bold hover:bg-[#1e40af] transition disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-gray-800">Writing Samples</h1><p className="text-sm text-gray-500 mt-0.5">Bài mẫu Writing — hiển thị trên trang chủ</p></div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-[#1e40af] transition">+ Thêm mới</button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Chưa có bài mẫu nào.</div>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Task / Dạng đề</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Hành động</th>
                </tr></thead>
                <tbody>
                  {list.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3"><div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{resolveImg(item.thumbnailUrl) ? <img src={resolveImg(item.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/></svg>}</div></td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.title}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {item.level && (
                            <span style={{ fontSize: 11, background: '#eff6ff', color: '#1D4ED8', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                              {TASK_LABELS[item.level] || item.level}
                            </span>
                          )}
                          {item.examType && (
                            <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 4, padding: '1px 7px', border: '1px solid #e2e8f0' }}>
                              {item.examType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{(item.tags || []).map(t => <span key={t} style={{ fontSize: 11, background: '#eff6ff', color: '#1D4ED8', borderRadius: 4, padding: '1px 6px' }}>{t}</span>)}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-red-500 hover:bg-blue-50 font-medium transition">Xóa</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="del-confirm-title" className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-xl">🗑️</div><h3 id="del-confirm-title" className="font-bold text-gray-800">Xóa bài Writing?</h3></div>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">Hủy</button>
              <button onClick={() => handleDelete(delConfirm)} className="px-4 py-2 rounded-xl bg-[#dc2626] text-white text-sm font-bold hover:bg-[#b91c1c] transition">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
