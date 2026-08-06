import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFullTestResult } from '../services/examService'
import Navbar from '../components/Navbar'
import Breadcrumb from '../components/common/Breadcrumb'
import { Headphones, BookOpen, PenTool, Mic } from 'lucide-react'

const SKILL_META = {
  listening: { label: 'Listening', Icon: Headphones, colorVar: '--skill-l-color', bgVar: '--skill-l-bg', borderVar: '--skill-l-border' },
  reading:   { label: 'Reading',   Icon: BookOpen,   colorVar: '--skill-r-color', bgVar: '--skill-r-bg', borderVar: '--skill-r-border' },
  writing:   { label: 'Writing',   Icon: PenTool,    colorVar: '--skill-w-color', bgVar: '--skill-w-bg', borderVar: '--skill-w-border' },
  speaking:  { label: 'Speaking',  Icon: Mic,        colorVar: '--skill-s-color', bgVar: '--skill-s-bg', borderVar: '--skill-s-border' },
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
  const [error, setError] = useState(false)

  useEffect(() => {
    document.title = 'Kết quả bài thi | IELTS Pro'
    getFullTestResult(seriesId, bookNumber, testNumber)
      .then(data => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [seriesId, bookNumber, testNumber])

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-200 animate-pulse mb-4" />
          <div className="w-48 h-8 bg-slate-200 animate-pulse rounded mb-3" />
          <div className="w-64 h-5 bg-slate-200 animate-pulse rounded" />
        </div>
      </div>
      <div className="app-container section-py max-w-3xl flex flex-col gap-8">
        <div className="card-base p-10 flex flex-col items-center border-t-4 border-t-slate-200">
          <div className="w-32 h-3 bg-slate-200 animate-pulse rounded mb-8" />
          <div className="w-32 h-24 bg-slate-200 animate-pulse rounded mb-8" />
          <div className="w-48 h-4 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-base p-6 flex flex-col items-center">
              <div className="w-8 h-8 bg-slate-200 animate-pulse rounded mb-4" />
              <div className="w-20 h-3 bg-slate-200 animate-pulse rounded mb-6" />
              <div className="w-16 h-10 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="app-container flex flex-col items-center justify-center py-32">
        <div className="text-center p-12 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h2 className="text-[20px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không thể kết nối</h2>
          <p className="text-[14px] text-slate-600 mb-8 max-w-sm" style={{ fontFamily: 'var(--font-body)' }}>Đã xảy ra sự cố khi tải dữ liệu bài thi. Vui lòng thử lại.</p>
          <button className="btn-primary w-full py-3.5 text-[14px] font-bold" onClick={() => navigate('/full-test')}>Quay lại Full Test</button>
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="app-container flex flex-col items-center justify-center py-32">
        <div className="text-center p-12 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-6 text-slate-400">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h2 className="text-[20px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Không tìm thấy kết quả bài thi</h2>
          <p className="text-[14px] text-slate-600 mb-8 max-w-sm" style={{ fontFamily: 'var(--font-body)' }}>Kết quả có thể đã bị xóa hoặc chưa được tạo.</p>
          <button className="btn-primary w-full py-3.5 text-[14px] font-bold" onClick={() => navigate('/full-test')}>Quay lại Full Test</button>
        </div>
      </div>
    </div>
  )

  const testLabel = `${data.seriesName} — Test ${testNumber}`
  const completedCount = SKILL_ORDER.filter(s => data.skills[s]?.done).length

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="bg-slate-50 border-b border-slate-200 pt-6 pb-2">
        <div className="app-container">
          <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Full Test', to: '/full-test' }, { label: 'Kết quả bài thi' }]} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] mx-auto mb-4 bg-slate-50 border border-slate-200 shadow-sm">
            📊
          </div>
          <h1 className="text-[28px] font-bold text-slate-900 m-0 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Kết quả Full Test</h1>
          <p className="text-[15px] text-slate-600 m-0" style={{ fontFamily: 'var(--font-body)' }}>{testLabel}</p>
        </div>
      </div>

      <div className="app-container section-py max-w-3xl flex flex-col gap-8">

        {/* Overall Band */}
        {data.isComplete ? (
          <div className="card-base p-10 text-center border-t-4 border-t-[#0B2345]">
            <p className="text-[12px] font-bold tracking-widest uppercase text-slate-500 mb-4" style={{ fontFamily: 'var(--font-body)' }}>Overall Band Score</p>
            <div className="text-[96px] font-extrabold text-[#0B2345] leading-none mb-6" style={{ fontFamily: 'var(--font-mono)' }}>{data.overallBand}</div>
            <p className="text-[15px] font-medium text-slate-600 m-0" style={{ fontFamily: 'var(--font-body)' }}>
              {SKILL_ORDER.map(s => `${SKILL_META[s].label}: ${data.skills[s]?.score ?? '–'}`).join(' · ')}
            </p>
          </div>
        ) : (
          <div className="card-base p-10 text-center">
            <p className="text-[48px] mb-4">⏳</p>
            <p className="font-bold text-[18px] text-slate-900 mb-2" style={{ fontFamily: 'var(--font-body)' }}>Chưa hoàn thành đủ 4 kỹ năng</p>
            <p className="text-[15px] text-slate-600 m-0" style={{ fontFamily: 'var(--font-body)' }}>Đã làm: <span className="font-bold text-slate-900">{completedCount}/4</span> kỹ năng</p>
          </div>
        )}

        {/* Per-skill breakdown */}
        <div className="grid grid-cols-2 gap-6">
          {SKILL_ORDER.map(skill => {
            const s = data.skills[skill]
            const m = SKILL_META[skill]
            const available = s?.available
            const done = s?.done
            return (
              <div
                key={skill}
                className={`card-base p-6 text-center ${!done ? 'opacity-70 bg-slate-50' : 'bg-white'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-600">
                  <m.Icon className="w-5 h-5 text-slate-600 stroke-[1.75]" />
                </div>
                <p className="text-[12px] font-bold tracking-widest uppercase text-slate-500 mb-4" style={{ fontFamily: 'var(--font-body)' }}>
                  {m.label}
                </p>
                {done ? (
                  <div className="text-[40px] font-extrabold text-[#0B2345] leading-none" style={{ fontFamily: 'var(--font-mono)' }}>
                    {s.score ?? '–'}
                  </div>
                ) : available ? (
                  <p className="text-[15px] font-medium text-slate-500 m-0" style={{ fontFamily: 'var(--font-body)' }}>Chưa làm</p>
                ) : (
                  <p className="text-[13px] italic text-slate-400 m-0" style={{ fontFamily: 'var(--font-body)' }}>Không có đề</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => navigate('/full-test')}
            className="btn-primary w-full py-3.5 text-[15px] font-bold"
          >
            ← Về trang Full Test
          </button>
        </div>
      </div>
    </div>
  )
}
