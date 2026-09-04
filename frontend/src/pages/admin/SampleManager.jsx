import { useState, useEffect, useRef } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useDraftPersistence } from '../../hooks/useDraftPersistence'
import { ConfirmDeleteModal, DraftBanner, DraftSavedHint, AdminListHeader, ThumbnailPicker } from '../../components/admin/contentPageUI'

import RichTextEditor from '../../components/RichTextEditor'
import {
  getWritingSamples, getWritingSample, createWritingSample, updateWritingSample, deleteWritingSample, uploadWritingSampleThumbnailFile,
  getSpeakingSamples, getSpeakingSample, createSpeakingSample, updateSpeakingSample, deleteSpeakingSample, uploadSpeakingSampleThumbnailFile,
} from '../../services/sampleService'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
const resolveImg = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

// ─── PER-KIND CONFIG ─────────────────────────────────────────────────────────
// Toàn bộ khác biệt giữa Writing Samples và Speaking Samples được gom vào đây.
// Phần còn lại của component (state, handlers, draft-safety, upload-hướng-a,
// modal/hover/layout đã chuẩn hoá) dùng chung nguyên vẹn cho cả 2 loại.
const CONFIG = {
  writing: {
    services: {
      list: getWritingSamples, get: getWritingSample,
      create: createWritingSample, update: updateWritingSample,
      remove: deleteWritingSample, uploadThumb: uploadWritingSampleThumbnailFile,
    },
    draftKeyPrefix: 'draft_writing_sample_',
    listTitle: 'Writing Samples',
    listSubtitle: 'Bài mẫu Writing — hiển thị trên trang chủ',
    addLabel: '+ Thêm mới',
    formTitleNew: 'Thêm Writing Sample mới',
    formTitleEdit: 'Chỉnh sửa Writing Sample',
    deleteTitle: 'Xóa bài Writing?',
    nameLabel: 'Tên bài',
    namePlaceholder: 'VD: Cambridge IELTS 19 — Task 1 Sample Answer',
    taskFieldLabel: 'Task',
    taskColHeader: 'Task / Dạng đề',
    tasks: [
      { value: '', label: '-- Task --' },
      { value: 'task1', label: 'Task 1' },
      { value: 'task2', label: 'Task 2' },
    ],
    taskLabels: { task1: 'Task 1', task2: 'Task 2' },
    examTypePlaceholder: {
      task1: 'VD: Bar chart, Line graph, Pie chart, Map, Process diagram...',
      task2: 'VD: Opinion essay, Discussion essay, Problem-solution...',
      '':    'VD: Bar chart, Opinion essay...',
    },
    showTags: false,
    tagPlaceholder: 'VD: Task 1, Band 8.0... (Enter để thêm)',
    contentPlaceholder: 'Nhập nội dung bài mẫu Writing...',
    tagChipClass: 'bg-blue-50 text-[#1D4ED8]',
    tagChipCloseClass: 'text-[#1D4ED8]',
    tagAddBtnClass: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    listChipStyle: { background: '#eff6ff', color: '#1D4ED8' },
  },
  speaking: {
    services: {
      list: getSpeakingSamples, get: getSpeakingSample,
      create: createSpeakingSample, update: updateSpeakingSample,
      remove: deleteSpeakingSample, uploadThumb: uploadSpeakingSampleThumbnailFile,
    },
    draftKeyPrefix: 'draft_speaking_sample_',
    listTitle: 'Speaking Samples',
    listSubtitle: 'Bài mẫu Speaking — hiển thị trên trang chủ',
    addLabel: '+ Thêm mới',
    formTitleNew: 'Thêm Speaking Sample mới',
    formTitleEdit: 'Chỉnh sửa Speaking Sample',
    deleteTitle: 'Xóa bài Speaking?',
    nameLabel: 'Tên chủ đề',
    namePlaceholder: 'VD: Topic: Technology — Sample Answer Band 8',
    taskFieldLabel: 'Part',
    taskColHeader: 'Part / Dạng đề',
    tasks: [
      { value: '', label: '-- Part --' },
      { value: 'task1', label: 'Part 1' },
      { value: 'task2', label: 'Part 2' },
      { value: 'task3', label: 'Part 3' },
    ],
    taskLabels: { task1: 'Part 1', task2: 'Part 2', task3: 'Part 3' },
    examTypePlaceholder: {
      task1: 'VD: Personal questions, Hobbies, Daily routine...',
      task2: 'VD: Describe a person, Describe a place, Describe an event...',
      task3: 'VD: Abstract discussion, Society, Technology, Environment...',
      '':    'VD: Describe a person, Abstract discussion...',
    },
    showTags: false,
    tagPlaceholder: 'VD: Part 2, Band 7.5... (Enter để thêm)',
    contentPlaceholder: 'Nhập nội dung bài mẫu Speaking (cue card, sample answer, tips...)',
    tagChipClass: 'bg-purple-50 text-purple-700',
    tagChipCloseClass: 'text-purple-700',
    tagAddBtnClass: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    listChipStyle: { background: '#f5f3ff', color: '#7c3aed' },
  },
}

const EMPTY_FORM = { title: '', level: '', examType: '', content: '', tagInput: '', tags: [], thumbnailUrl: null, thumbPreview: null, thumbFile: null }

// Chữ ký nội dung form (bỏ qua tagInput — chỉ là buffer gõ dở) để phát hiện thay đổi chưa lưu.
const formSig = (f) => JSON.stringify([f.title, f.level, f.examType, f.content, f.tags, f.thumbnailUrl, !!f.thumbFile])

export default function SampleManager({ kind }) {
  const cfg = CONFIG[kind]
  const svc = cfg.services
  const formatTask = (level) => cfg.taskLabels[level] || level || ''

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const pristineRef = useRef('')

  // Cảnh báo đóng tab / F5 khi form có thay đổi chưa lưu (in-app nav xử lý ở AdminLayout).
  useUnsavedChanges(view === 'form' && isDirty)

  // isDirty = form hiện tại khác snapshot lúc mở form (openAdd/openEdit đặt lại pristineRef).
  useEffect(() => {
    if (view !== 'form') return
    setIsDirty(formSig(form) !== pristineRef.current)
  }, [form, view])

  // BUG-14: Draft auto-save (restore khi mở form, autosave 2s khi có thay đổi).
  const draftKey = `${cfg.draftKeyPrefix}${editing?.id || 'new'}`
  const { draftBanner, setDraftBanner, draftSavedAt, clearDraft } =
    useDraftPersistence(draftKey, form, { enabled: view === 'form', dirty: isDirty })

  const load = async () => {
    setLoading(true)
    try { setList(await svc.list()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    pristineRef.current = formSig(EMPTY_FORM)
    setForm(EMPTY_FORM); setEditing(null); setIsDirty(false); setView('form')
  }

  const openEdit = async (item) => {
    try {
      const data = await svc.get(item.id)
      const next = { title: data.title, level: data.level || '', examType: data.examType || '', content: data.content || '', tagInput: '', tags: cfg.showTags ? (data.tags || []) : [], thumbnailUrl: data.thumbnailUrl, thumbPreview: resolveImg(data.thumbnailUrl), thumbFile: null }
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
          thumbnailUrl = (await svc.uploadThumb(fd)).url
        } catch (e) {
          alert(e.response?.data?.message || 'Tải ảnh bìa lên thất bại. Bài chưa được lưu, vui lòng thử lại.')
          return
        }
      }

      // ── Bước 2: ghi record với URL đã có sẵn ──
      const body = {
        title: form.title.trim(), level: form.level || null, examType: form.examType.trim() || null,
        content: form.content, thumbnailUrl: thumbnailUrl || null,
        ...(cfg.showTags ? { tags: form.tags } : {}),
      }
      if (!editing) await svc.create(body)
      else await svc.update(editing.id, body)

      setIsDirty(false); clearDraft(); setView('list'); load()
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await svc.remove(id); setDelConfirm(null); load() }
    catch (err) { alert(err.response?.data?.message || 'Lỗi xóa') }
  }

  if (view === 'form') {
    return (
        <div className="p-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} aria-label="Quay lại danh sách" className="text-slate-500 hover:text-slate-700 text-xl font-bold transition">←</button>
            <h1 className="text-xl font-bold text-slate-800">{editing ? cfg.formTitleEdit : cfg.formTitleNew}</h1>
          </div>

          {/* BUG-14: Draft banner */}
          <DraftBanner draft={draftBanner}
            onRestore={() => { setForm(draftBanner.data); setDraftBanner(null) }}
            onDismiss={clearDraft} />
          {!draftBanner && <DraftSavedHint at={draftSavedAt} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex flex-col gap-4">
              {/* Basic info */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{cfg.nameLabel} <span className="text-red-500 font-normal">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={cfg.namePlaceholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{cfg.taskFieldLabel}</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value, examType: '' }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                    {cfg.tasks.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="mb-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dạng đề</label>
                  <input value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                    placeholder={cfg.examTypePlaceholder[form.level] || cfg.examTypePlaceholder['']}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
                {/* Tags */}
                {cfg.showTags && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map(t => (
                        <span key={t} className={`inline-flex items-center gap-1 ${cfg.tagChipClass} rounded-full px-2.5 py-0.5 text-xs font-medium`}>
                          {t}
                          <button onClick={() => removeTag(t)} aria-label={`Xóa tag ${t}`} className={`bg-transparent border-0 cursor-pointer ${cfg.tagChipCloseClass} text-sm leading-none`}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                        placeholder={cfg.tagPlaceholder}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                      <button onClick={addTag} className={`px-3 py-2 rounded-lg ${cfg.tagAddBtnClass} text-sm font-semibold`}>+ Thêm</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rich text content */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Nội dung bài mẫu</label>
                <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))}
                  maxHeight={520}
                  placeholder={cfg.contentPlaceholder} />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <ThumbnailPicker
                  preview={form.thumbPreview}
                  onSelect={file => setForm(prev => ({ ...prev, thumbFile: file, thumbPreview: URL.createObjectURL(file) }))}
                  onClear={() => setForm(f => ({ ...f, thumbFile: null, thumbPreview: null, thumbnailUrl: null }))}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView('list')} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium">Hủy</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[#1D4ED8] text-white text-sm font-bold hover:bg-[#1e40af] transition disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
    )
  }

  return (
    <>
      <div className="p-6 max-w-5xl">
        <AdminListHeader title={cfg.listTitle} subtitle={cfg.listSubtitle} onAdd={openAdd} addLabel={cfg.addLabel} />
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải...</div>
            : list.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Chưa có bài mẫu nào.</div>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-16">Ảnh</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên bài</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">{cfg.taskColHeader}</th>
                  {cfg.showTags && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Tags</th>}
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
                            <span style={{ fontSize: 11, background: cfg.listChipStyle.background, color: cfg.listChipStyle.color, borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                              {formatTask(item.level)}
                            </span>
                          )}
                          {item.examType && (
                            <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 4, padding: '1px 7px', border: '1px solid #e2e8f0' }}>
                              {item.examType}
                            </span>
                          )}
                        </div>
                      </td>
                      {cfg.showTags && <td className="px-4 py-3 hidden sm:table-cell"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{(item.tags || []).map(t => <span key={t} style={{ fontSize: 11, background: cfg.listChipStyle.background, color: cfg.listChipStyle.color, borderRadius: 4, padding: '1px 6px' }}>{t}</span>)}</div></td>}
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
      <ConfirmDeleteModal
        open={!!delConfirm}
        title={cfg.deleteTitle}
        onCancel={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
      />
    </>
  )
}
