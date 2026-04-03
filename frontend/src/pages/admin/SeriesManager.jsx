import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { getAdminSeriesList, getAdminExamsList, createSeries, updateSeries, deleteSeries, uploadSeriesThumbnail } from '../../services/seriesService'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const TYPES = [{ value: 'academic', label: 'Academic' }, { value: 'general', label: 'General Training' }]
const SKILLS = ['reading', 'listening', 'writing', 'speaking']
const SKILL_LABELS = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }
const EMPTY_FORM = { name: '', description: '', type: 'academic', thumbFile: null, thumbPreview: null, thumbnailUrl: null, tests: [] }

export default function SeriesManager() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const [allExams, setAllExams] = useState([])
  const thumbRef = useRef()

  const load = async () => {
    setLoading(true)
    try { setList(await getAdminSeriesList()) } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    getAdminExamsList().then(data => setAllExams(data)).catch(() => {})
  }, [])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, tests: [{ testNumber: 1, exams: {} }] })
    setEditing(null); setView('form')
  }

  const openEdit = async (item) => {
    try {
      const data = (await getAdminSeriesList()).find(s => s.id === item.id)
      if (!data) return
      // Build tests structure from data.exams
      const testMap = {}
      for (const se of data.exams || []) {
        if (!testMap[se.testNumber]) testMap[se.testNumber] = { testNumber: se.testNumber, exams: {} }
        testMap[se.testNumber].exams[se.exam.skill] = se.exam.id
      }
      const tests = Object.values(testMap).sort((a, b) => a.testNumber - b.testNumber)
      setForm({
        name: data.name, description: data.description || '', type: data.type || 'academic',
        thumbFile: null, thumbPreview: resolveImg(data.thumbnailUrl), thumbnailUrl: data.thumbnailUrl,
        tests: tests.length ? tests : [{ testNumber: 1, exams: {} }]
      })
      setEditing(data); setView('form')
    } catch { alert('Lỗi tải') }
  }

  const addTest = () => {
    const maxNum = form.tests.length ? Math.max(...form.tests.map(t => t.testNumber)) : 0
    setForm(f => ({ ...f, tests: [...f.tests, { testNumber: maxNum + 1, exams: {} }] }))
  }

  const removeTest = (idx) => setForm(f => ({ ...f, tests: f.tests.filter((_, i) => i !== idx) }))

  const setExamForTest = (testIdx, skill, examId) => {
    setForm(f => {
      const tests = [...f.tests]
      tests[testIdx] = { ...tests[testIdx], exams: { ...tests[testIdx].exams, [skill]: examId ? parseInt(examId) : undefined } }
      return { ...f, tests }
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Vui lòng nhập tên bộ đề'); return }
    setSaving(true)
    try {
      // Build exams array
      const exams = []
      for (const test of form.tests) {
        for (const skill of SKILLS) {
          if (test.exams[skill]) {
            exams.push({ examId: test.exams[skill], testNumber: test.testNumber })
          }
        }
      }
      const body = { name: form.name.trim(), description: form.description, type: form.type, exams }
      let id
      if (!editing) { const res = await createSeries(body); id = res.id }
      else { await updateSeries(editing.id, body); id = editing.id }
      if (form.thumbFile) {
        const fd = new FormData(); fd.append('thumbnail', form.thumbFile)
        await uploadSeriesThumbnail(id, fd)
      }
      setView('list'); load()
    } catch (err) { alert(err.response?.data?.message || 'Lỗi lưu') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    try { await deleteSeries(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  const examsBySkill = (skill) => allExams.filter(e => e.skill === skill)

  if (view === 'form') {
    return (
      <AdminLayout>
        <div className="p-6 max-w-4xl">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setView('list')} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
            <h1 className="text-xl font-bold text-gray-800">{editing ? 'Chỉnh sửa bộ đề' : 'Tạo bộ đề mới'}</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Basic info */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tên bộ đề <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="VD: Cambridge IELTS 19"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mô tả</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Mô tả ngắn về bộ đề..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Loại</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400">
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Test slots */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <label className="text-xs font-semibold text-gray-600">Các bài test</label>
                  <button onClick={addTest} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100">+ Thêm test</button>
                </div>
                {form.tests.map((test, idx) => (
                  <div key={idx} style={{ marginBottom: 16, padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>Test</span>
                        <input
                          type="number" min="1" value={test.testNumber}
                          onChange={e => setForm(f => { const tests = [...f.tests]; tests[idx] = { ...tests[idx], testNumber: parseInt(e.target.value) || 1 }; return { ...f, tests } })}
                          style={{ width: 56, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'center' }}
                        />
                      </div>
                      <button onClick={() => removeTest(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                    {SKILLS.map(skill => (
                      <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', width: 72, flexShrink: 0 }}>{SKILL_LABELS[skill]}</span>
                        <select
                          value={test.exams[skill] || ''}
                          onChange={e => setExamForTest(idx, skill, e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-400"
                        >
                          <option value="">-- Chọn đề --</option>
                          {examsBySkill(skill).map(e => (
                            <option key={e.id} value={e.id}>
                              [{e.id}] {e.title}{e.bookNumber ? ` (Cam${e.bookNumber} T${e.testNumber})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
                {form.tests.length === 0 && (
                  <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>Chưa có test nào. Bấm "+ Thêm test".</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
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
                <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files[0]; if (f) setForm(prev => ({ ...prev, thumbFile: f, thumbPreview: URL.createObjectURL(f) })) }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setView('list')} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">Hủy</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a56db] text-white text-sm font-bold hover:bg-[#1d4ed8] transition disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
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
          <div><h1 className="text-xl font-bold text-gray-800">Quản lý bộ đề</h1><p className="text-sm text-gray-500 mt-0.5">Tạo và quản lý các bộ đề Full Test</p></div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition">+ Tạo bộ đề mới</button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Chưa có bộ đề nào.</div>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên bộ đề</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Số test</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Hành động</th>
                </tr></thead>
                <tbody>
                  {list.map(item => {
                    const testCount = [...new Set((item.exams || []).map(e => e.testNumber))].length
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {resolveImg(item.thumbnailUrl)
                              ? <img src={resolveImg(item.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: 18 }}>📚</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1a56db', borderRadius: 4, padding: '2px 6px' }}>
                            {item.type === 'general' ? 'General' : 'Academic'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{testCount} test</td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition">Sửa</button>
                            <button onClick={() => setDelConfirm(item.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition">Xóa</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🗑️</div><h3 className="font-bold text-gray-800">Xóa bộ đề?</h3></div>
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
