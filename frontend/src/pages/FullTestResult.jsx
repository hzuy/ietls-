import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/axios'
import Navbar from '../components/Navbar'

const SKILL_META = {
  listening: { label: 'Listening', icon: '🎧' },
  reading:   { label: 'Reading',   icon: '📖' },
  writing:   { label: 'Writing',   icon: '✍️' },
  speaking:  { label: 'Speaking',  icon: '🎤' },
}
const SKILL_ORDER = ['listening', 'reading', 'writing', 'speaking']

export default function FullTestResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const seriesId  = searchParams.get('seriesId')
  const bookNumber = searchParams.get('bookNumber')
  const testNumber = searchParams.get('testNumber')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/full-test/result?seriesId=${seriesId}&bookNumber=${bookNumber}&testNumber=${testNumber}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [seriesId, bookNumber, testNumber])

  if (loading) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-400">Đang tải...</div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />
      <div className="flex items-center justify-center py-32 text-gray-500">Không tìm thấy kết quả.</div>
    </div>
  )

  const testLabel = `${data.seriesName} — Test ${testNumber}`
  const completedCount = SKILL_ORDER.filter(s => data.skills[s]?.done).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-2xl mx-auto px-6 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            📊
          </div>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#1e3a5f' }}>Kết quả Full Test</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>{testLabel}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Overall Band */}
        {data.isComplete ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm" style={{ border: '2px solid #bfdbfe' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>Overall Band Score</p>
            <div className="text-8xl font-extrabold mb-3" style={{ color: '#1a56db' }}>{data.overallBand}</div>
            <p className="text-sm" style={{ color: '#64748b' }}>
              {SKILL_ORDER.map(s => `${SKILL_META[s].label}: ${data.skills[s]?.score ?? '–'}`).join(' · ')}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm" style={{ border: '1px solid #fde68a' }}>
            <p className="text-4xl mb-3">⏳</p>
            <p className="font-bold text-gray-700 mb-1">Chưa hoàn thành đủ 4 kỹ năng</p>
            <p className="text-sm text-gray-400">Đã làm: {completedCount}/4 kỹ năng</p>
          </div>
        )}

        {/* Per-skill breakdown */}
        <div className="grid grid-cols-2 gap-4">
          {SKILL_ORDER.map(skill => {
            const s = data.skills[skill]
            const m = SKILL_META[skill]
            const available = s?.available
            const done = s?.done
            return (
              <div
                key={skill}
                className="bg-white rounded-2xl p-6 text-center shadow-sm"
                style={{ border: done ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}
              >
                <div className="text-2xl mb-2">{m.icon}</div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: done ? '#1a56db' : '#94a3b8' }}>
                  {m.label}
                </p>
                {done ? (
                  <div className="text-4xl font-extrabold" style={{ color: '#1a56db' }}>
                    {s.score ?? '–'}
                  </div>
                ) : available ? (
                  <p className="text-sm text-gray-400">Chưa làm</p>
                ) : (
                  <p className="text-xs italic text-gray-300">Không có đề</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/full-test')}
            className="w-full py-3 rounded-xl font-bold text-white transition-all"
            style={{ backgroundColor: '#1a56db' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
          >
            ← Về trang Full Test
          </button>
        </div>
      </div>
    </div>
  )
}
