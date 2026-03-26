import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/axios'
import AdminLayout from '../../components/AdminLayout'

const DEFAULT_SETTINGS = {
  site_name: 'IELTS Practice',
  system_announcement: '',
  reading_time: '60',
  listening_time: '40',
  writing_time: '60',
  speaking_time: '15',
  max_attempts_per_exam: '0',
  writing_prompt_template: `Chấm bài Writing IELTS sau theo thang điểm 0-9. Nhận xét theo 4 tiêu chí: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. Trả về JSON: {"band": <number>, "ta": <0-9>, "cc": <0-9>, "lr": <0-9>, "gra": <0-9>, "feedback": "<nhận xét chi tiết bằng tiếng Việt>"}`,
  speaking_prompt_template: `Chấm bài Speaking IELTS. Nhận xét theo 4 tiêu chí: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation. Trả về JSON: {"band": <number>, "fc": <0-9>, "lr": <0-9>, "gra": <0-9>, "pron": <0-9>, "feedback": "<nhận xét chi tiết bằng tiếng Việt>"}`,
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/settings')
      .then(r => setSettings({ ...DEFAULT_SETTINGS, ...r.data }))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/admin/settings', settings)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { alert('Lỗi lưu cài đặt') }
    finally { setSaving(false) }
  }

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db]"
  const labelCls = "text-xs font-medium text-gray-600 mb-1 block"

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Cài đặt hệ thống</h1>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#1a56db] text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
            {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu cài đặt'}
          </button>
        </div>

        {/* Display settings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Cài đặt hiển thị</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Tên website</label>
              <input value={settings.site_name} onChange={e => set('site_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Thông báo hệ thống (banner cho user)</label>
              <input value={settings.system_announcement} onChange={e => set('system_announcement', e.target.value)}
                placeholder="Để trống nếu không có thông báo"
                className={inputCls} />
            </div>
          </div>
        </div>

        {/* Exam time settings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Thời gian làm bài mặc định (phút)</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['reading_time', 'Reading'],
              ['listening_time', 'Listening'],
              ['writing_time', 'Writing'],
              ['speaking_time', 'Speaking'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input type="number" min="1" value={settings[key]} onChange={e => set(key, e.target.value)} className={inputCls} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className={labelCls}>Số lần thi tối đa mỗi đề (0 = không giới hạn)</label>
            <input type="number" min="0" value={settings.max_attempts_per_exam}
              onChange={e => set('max_attempts_per_exam', e.target.value)} className={`${inputCls} max-w-xs`} />
          </div>
        </div>

        {/* AI prompt templates */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Cài đặt AI chấm điểm</h2>
          <p className="text-xs text-gray-400 mb-4">Prompt template gửi đến AI. Đảm bảo yêu cầu trả về JSON hợp lệ.</p>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Prompt template Writing</label>
              <textarea
                value={settings.writing_prompt_template}
                onChange={e => set('writing_prompt_template', e.target.value)}
                rows={5}
                className={`${inputCls} resize-y font-mono text-xs`}
              />
            </div>
            <div>
              <label className={labelCls}>Prompt template Speaking</label>
              <textarea
                value={settings.speaking_prompt_template}
                onChange={e => set('speaking_prompt_template', e.target.value)}
                rows={5}
                className={`${inputCls} resize-y font-mono text-xs`}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
