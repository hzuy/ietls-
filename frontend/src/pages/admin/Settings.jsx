import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminSettings, updateAdminSettings } from '../../services/adminService'
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
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getAdminSettings()
      .then(data => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(err => { if (err.response?.status === 403) navigate('/') })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAdminSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { alert('Lỗi lưu cài đặt') }
    finally { setSaving(false) }
  }

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  const inputCls  = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a56db] bg-white"
  const labelCls  = "block text-sm font-semibold text-gray-700 mb-1.5"
  const hintCls   = "text-xs text-gray-400 mt-1"

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Cài đặt hệ thống</h1>
          <p className="text-sm text-gray-400 mt-1">Cấu hình vận hành nền tảng IELTS</p>
        </div>

        {/* ── SECTION 1: Thông tin chung ─────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-800">Thông tin chung</h2>
            <p className="text-xs text-gray-400 mt-0.5">Hiển thị trên giao diện người dùng</p>
          </div>
          <div className="space-y-5">
            <div>
              <label className={labelCls}>Tên website</label>
              <input
                value={settings.site_name}
                onChange={e => set('site_name', e.target.value)}
                className={inputCls}
                placeholder="VD: IELTS Practice"
              />
            </div>
            <div>
              <label className={labelCls}>Thông báo hệ thống</label>
              <input
                value={settings.system_announcement}
                onChange={e => set('system_announcement', e.target.value)}
                className={inputCls}
                placeholder="Để trống nếu không có thông báo"
              />
              <p className={hintCls}>Hiển thị dưới dạng banner cho tất cả người dùng</p>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Thời gian làm bài ──────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-800">Thời gian làm bài</h2>
            <p className="text-xs text-gray-400 mt-0.5">Thời gian mặc định cho mỗi kỹ năng (đơn vị: phút)</p>
          </div>
          <div className="space-y-5">
            {[
              { key: 'reading_time',   label: 'Reading',   hint: 'Khuyến nghị: 60 phút' },
              { key: 'listening_time', label: 'Listening', hint: 'Khuyến nghị: 40 phút' },
              { key: 'writing_time',   label: 'Writing',   hint: 'Khuyến nghị: 60 phút' },
              { key: 'speaking_time',  label: 'Speaking',  hint: 'Khuyến nghị: 15 phút' },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input
                  type="number"
                  min="1"
                  value={settings[key]}
                  onChange={e => set(key, e.target.value)}
                  className={`${inputCls} max-w-xs`}
                />
                <p className={hintCls}>{hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Giới hạn thi ───────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-800">Giới hạn thi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Kiểm soát số lần học viên được làm mỗi đề</p>
          </div>
          <div>
            <label className={labelCls}>Số lần thi tối đa mỗi đề</label>
            <input
              type="number"
              min="0"
              value={settings.max_attempts_per_exam}
              onChange={e => set('max_attempts_per_exam', e.target.value)}
              className={`${inputCls} max-w-xs`}
            />
            <p className={hintCls}>Nhập 0 để không giới hạn số lần thi</p>
          </div>
        </section>

        {/* ── SECTION 4: Cài đặt AI chấm điểm ──────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-800">Cài đặt AI chấm điểm</h2>
            <p className="text-xs text-gray-400 mt-0.5">Prompt template gửi đến AI — đảm bảo yêu cầu trả về JSON hợp lệ</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className={labelCls}>Prompt template — Writing</label>
              <textarea
                value={settings.writing_prompt_template}
                onChange={e => set('writing_prompt_template', e.target.value)}
                rows={6}
                className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
              />
              <p className={hintCls}>Phải trả về JSON với các key: band, ta, cc, lr, gra, feedback</p>
            </div>
            <div>
              <label className={labelCls}>Prompt template — Speaking</label>
              <textarea
                value={settings.speaking_prompt_template}
                onChange={e => set('speaking_prompt_template', e.target.value)}
                rows={6}
                className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
              />
              <p className={hintCls}>Phải trả về JSON với các key: band, fc, lr, gra, pron, feedback</p>
            </div>
          </div>
        </section>

        {/* ── Save button ────────────────────────────────── */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-400">Nhấn lưu để áp dụng tất cả thay đổi</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#1a56db] text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60 min-w-[130px] text-center"
          >
            {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu tất cả'}
          </button>
        </div>

      </div>
    </AdminLayout>
  )
}
