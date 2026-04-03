import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import RichTextEditor from '../../components/RichTextEditor'
import { getSpeakingSamples, getSpeakingSample, createSpeakingSample, updateSpeakingSample, deleteSpeakingSample, uploadSpeakingSampleThumbnail } from '../../services/sampleService'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const TASKS = [
  { value: '', label: '-- Task --' },
  { value: 'task1', label: 'Task 1' },
  { value: 'task2', label: 'Task 2' },
  { value: 'task3', label: 'Task 3' },
]

const TASK_LABELS = { task1: 'Task 1', task2: 'Task 2', task3: 'Task 3' }

const EXAM_TYPE_PLACEHOLDER = {
  task1: 'VD: Personal questions, Hobbies, Daily routine...',
  task2: 'VD: Describe a person, Describe a place, Describe an event...',
  task3: 'VD: Abstract discussion, Society, Technology, Environment...',
  '':    'VD: Describe a person, Abstract discussion...',
}

const EMPTY_FORM = { title: '', level: '', examType: '', content: '', tagInput: '', tags: [], thumbnailUrl: null, thumbPreview: null, thumbFile: null }

export default function SpeakingSamples() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const thumbRef = useRef()

  const load = async () => {
    setLoading(true)
    try { setList(await getSpeakingSamples()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setView('form') }

  const openEdit = async (item) => {
    try {
      const data = await getSpeakingSample(item.id)
      setForm({ title: data.title, level: data.level || '', examType: data.examType || '', content: data.content || '', tagInput: '', tags: data.tags || [], thumbnailUrl: data.thumbnailUrl, thumbPreview: resolveImg(data.thumbnailUrl), thumbFile: null })
      setEditing(data); setView('form')
    } catch { alert('Lỗi tải') }
  }

  const addTag = () => {
    const t = form.tagInput.trim()
    if (!t || form.tags.includes(t)) { setForm(f => ({ ...f, tagInput: '' })); return }
    setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('Vui lòng nhập tên bài'); return }
    setSaving(true)
    try {
      const body = { title: form.title.trim(), level: form.level || null, examType: form.examType.trim() || null, content: form.content, tags: form.tags }
      let id
      if (!editing) { const res = await createSpeakingSample(body); id = res.id }
      else { await updateSpeakingSample(editing.id, body); id = editing.id }
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        await uploadSpeakingSampleThumbnail(id, fd)
      }
      setView('list'); load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi lưu') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    try { await deleteSpeakingSample(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  if (view === 'form') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-4xl">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setView('list')} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
            <h1 className="text-xl font-bold text-gray-800">{editing ? 'Chỉnh sửa Speaking Sample' : 'Thêm Speaking Sample mới'}</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tên chủ đề <span className="text-red-500">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="VD: Topic: Technology — Sample Answer Band 8"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Task</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value, examType: '' }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400">
                    {TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Dạng đề</label>
                  <input value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                    placeholder={EXAM_TYPE_PLACEHOLDER[form.level] || EXAM_TYPE_PLACEHOLDER['']}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {form.tags.map(t => (
                      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f3ff', color: '#7c3aed', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                        {t}<button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 14 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                      placeholder="VD: Part 2, Band 7.5... (Enter để thêm)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                    <button onClick={addTag} className="px-3 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-semibold hover:bg-purple-100">+ Thêm</button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Nội dung bài mẫu</label>
                <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))}
                  placeholder="Nhập nội dung bài mẫu Speaking (cue card, sample answer, tips...)" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Ảnh bìa</label>
                {form.thumbPreview ? (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <img src={form.thumbPreview} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8 }} />
                    <button onClick={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                      style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => thumbRef.current.click()} style={{ width: '100%', aspectRatio: '16/9', border: '2px dashed #e2e8f0', borderRadius: 8, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Chọn ảnh bìa
                  </button>
                )}
                <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) setForm(prev => ({ ...prev, thumbFile: f, thumbPreview: URL.createObjectURL(f) })) }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setView('list')} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">Hủy</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a56db] text-white text-sm font-bold hover:bg-[#1d4ed8] transition disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
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
          <div><h1 className="text-xl font-bold text-gray-800">Speaking Samples</h1><p className="text-sm text-gray-500 mt-0.5">Bài mẫu Speaking — hiển thị trên trang chủ</p></div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition">+ Thêm mới</button>
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
                            <span style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
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
                      <td className="px-4 py-3 hidden sm:table-cell"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{(item.tags || []).map(t => <span key={t} style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', borderRadius: 4, padding: '1px 6px' }}>{t}</span>)}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition">Sửa</button>
                        <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition">Xóa</button>
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
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🗑️</div><h3 className="font-bold text-gray-800">Xóa bài Speaking?</h3></div>
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
