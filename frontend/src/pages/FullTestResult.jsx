import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFullTestResult } from '../services/examService'
import Breadcrumb from '../components/common/Breadcrumb'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import useCountUp from '../hooks/useCountUp'
import { Headphones, BookOpen, PenTool, Mic, BarChart2, Clock, Sparkles, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react'
import { askAITutor } from '../components/common/AIChatbotDrawer'

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
  const countedOverallBand = useCountUp(data?.isComplete ? data.overallBand : undefined, { duration: 900, decimals: 1 })

  useEffect(() => {
    document.title = 'Kết quả bài thi | IELTS Pro'
    getFullTestResult(seriesId, bookNumber, testNumber)
      .then(data => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [seriesId, bookNumber, testNumber])

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-200 animate-pulse mb-4" />
          <div className="w-48 h-8 bg-zinc-200 animate-pulse rounded mb-3" />
          <div className="w-64 h-5 bg-zinc-200 animate-pulse rounded" />
        </div>
      </div>
      <div className="app-container section-py max-w-5xl flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col items-center shadow-xs">
            <div className="w-24 h-24 bg-zinc-200 animate-pulse rounded-full mb-4" />
            <div className="w-32 h-6 bg-zinc-200 animate-pulse rounded" />
          </div>
          <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-full h-8 bg-zinc-200 animate-pulse rounded" />
            ))}
          </div>
          <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col gap-3">
            <div className="w-full h-10 bg-zinc-200 animate-pulse rounded" />
            <div className="w-full h-10 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="app-container flex flex-col items-center justify-center py-32">
        <div className="text-center p-10 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col items-center max-w-md w-full">
          <div className="w-14 h-14 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-500">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Không thể kết nối</h2>
          <p className="text-sm text-zinc-600 mb-6 max-w-sm">Đã xảy ra sự cố khi tải dữ liệu bài thi. Vui lòng thử lại.</p>
          <button className="btn-primary w-full py-2.5 text-sm font-medium" onClick={() => navigate('/full-test')}>Quay lại Full Test</button>
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="app-container flex flex-col items-center justify-center py-32">
        <div className="text-center p-10 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col items-center max-w-md w-full">
          <div className="w-14 h-14 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-500">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Không tìm thấy kết quả bài thi</h2>
          <p className="text-sm text-zinc-600 mb-6 max-w-sm">Kết quả có thể đã bị xóa hoặc chưa được tạo.</p>
          <button className="btn-primary w-full h-9 rounded-full px-5 text-sm font-medium" onClick={() => navigate('/full-test')}>Quay lại Full Test</button>
        </div>
      </div>
    </div>
  )

  const testLabel = `${data.seriesName} — Test ${testNumber}`
  const completedCount = SKILL_ORDER.filter(s => data.skills[s]?.done).length

  const handleAskAITutor = () => {
    const scoresStr = SKILL_ORDER.map(s => `${SKILL_META[s].label}: ${data.skills[s]?.score ?? 'chưa làm'}`).join(', ')
    const prompt = data.isComplete
      ? `Tôi vừa hoàn thành bài Full Test IELTS (${testLabel}) với điểm Overall Band là ${data.overallBand} (${scoresStr}). Nhờ bạn phân tích điểm mạnh, điểm yếu và đưa ra kế hoạch học tập chi tiết để tôi bứt phá lên band điểm cao hơn nhé!`
      : `Tôi đang làm bài Full Test IELTS (${testLabel}), hiện đã hoàn thành ${completedCount}/4 kỹ năng (${scoresStr}). Bạn có thể tư vấn chiến lược làm bài và phân bổ thời gian hiệu quả cho các kỹ năng còn lại không?`
    askAITutor(prompt)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] font-sans text-zinc-900">
      <div className="bg-zinc-50/50 border-b border-zinc-200 pt-6 pb-2">
        <div className="app-container">
          <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Full Test', to: '/full-test' }, { label: 'Kết quả bài thi' }]} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-6 py-10 text-center anim-fade-up">
          <div className="w-13 h-13 rounded-2xl flex items-center justify-center text-zinc-900 mx-auto mb-3.5 bg-zinc-100 border border-zinc-200 shadow-xs">
            <BarChart2 className="w-6 h-6 stroke-[1.75]" />
          </div>
          <PageHeader
            title="Kết quả Full Test"
            subtitle={testLabel}
            titleClassName="text-2xl font-bold text-zinc-900 m-0 mb-1 tracking-tight"
            subtitleClassName="text-sm text-zinc-500 m-0"
          />
        </div>
      </div>

      <div className="app-container section-py max-w-5xl flex flex-col gap-8">

        {/* ── Bento Score Hero Card (3 Columns) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Bento Col 1: Overall Band & Status (lg:col-span-4) */}
          <Card className="lg:col-span-4 p-6 flex flex-col items-center justify-center text-center anim-fade-up delay-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
              Overall Band Score
            </span>
            {data.isComplete ? (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3" style={{ border: '4px solid var(--primary)' }}>
                  <span className="text-4xl font-extrabold font-mono text-zinc-900">
                    {countedOverallBand}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-bg text-success-text border border-success-border text-xs font-semibold anim-score-pop">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đủ 4 kỹ năng
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-3 text-zinc-400">
                  <Clock className="w-8 h-8 stroke-[1.75]" />
                </div>
                <div className="text-xl font-bold text-zinc-900 mb-1">Chưa hoàn thành</div>
                <p className="text-xs text-zinc-500 m-0">
                  Đã làm: <span className="font-bold text-zinc-800">{completedCount}/4</span> kỹ năng
                </p>
              </>
            )}
          </Card>

          {/* Bento Col 2: Breakdown per Skill (lg:col-span-5) */}
          <Card className="lg:col-span-5 p-6 flex flex-col justify-between anim-fade-up delay-2">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Chi tiết kỹ năng
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  {completedCount}/4 Đã nộp bài
                </span>
              </div>
              <div className="space-y-3">
                {SKILL_ORDER.map(skill => {
                  const s = data.skills[skill]
                  const m = SKILL_META[skill]
                  const done = s?.done
                  const score = s?.score
                  return (
                    <div key={skill} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `var(${m.bgVar})`, color: `var(${m.colorVar})` }}
                        >
                          <m.Icon className="w-3.5 h-3.5 stroke-[1.75]" />
                        </div>
                        <span className="font-semibold text-zinc-800">{m.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {done ? (
                          <span className="font-mono font-extrabold text-sm text-zinc-900">
                            Band {score ?? '–'}
                          </span>
                        ) : s?.available ? (
                          <span className="text-zinc-400 font-medium text-[11px]">Chưa làm</span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">Không có đề</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>Độ hoàn thiện bài thi</span>
              <span className="font-bold text-zinc-800 font-mono">{Math.round((completedCount / 4) * 100)}%</span>
            </div>
          </Card>

          {/* Bento Col 3: Quick Actions (lg:col-span-3) */}
          <Card className="lg:col-span-3 p-6 flex flex-col justify-center gap-2.5 anim-fade-up delay-3">
            <button
              type="button"
              onClick={handleAskAITutor}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Hỏi AI Tutor lộ trình
            </button>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium border border-zinc-200 hover:bg-zinc-100 text-zinc-900 transition-colors flex items-center justify-center gap-2 cursor-pointer bg-white shadow-xs"
            >
              <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
              Xem bảng phân tích
            </button>
            <button
              type="button"
              onClick={() => navigate('/full-test')}
              className="w-full h-9 px-4 rounded-full text-xs sm:text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
              Về trang Full Test
            </button>
          </Card>
        </div>

        {/* ── Per-skill Breakdown Cards ── */}
        <div>
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
            Bảng điểm chi tiết từng kỹ năng
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SKILL_ORDER.map(skill => {
              const s = data.skills[skill]
              const m = SKILL_META[skill]
              const available = s?.available
              const done = s?.done
              return (
                <div
                  key={skill}
                  className={`border rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all ${!done ? 'opacity-70 bg-zinc-50/80 border-dashed border-zinc-200' : 'bg-white'}`}
                  style={done ? { borderColor: `var(${m.borderVar})` } : undefined}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-9 h-9 rounded-xl border flex items-center justify-center"
                        style={{ background: `var(${m.bgVar})`, borderColor: `var(${m.borderVar})`, color: `var(${m.colorVar})` }}
                      >
                        <m.Icon className="w-4.5 h-4.5 stroke-[1.75]" />
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        {m.label}
                      </span>
                    </div>

                    <div className="mb-4">
                      {done ? (
                        <div className="text-3xl font-extrabold text-zinc-900 leading-none font-mono">
                          {s.score ?? '–'}
                        </div>
                      ) : available ? (
                        <p className="text-sm font-medium text-zinc-400 m-0">Chưa làm</p>
                      ) : (
                        <p className="text-xs italic text-zinc-400 m-0">Không có đề</p>
                      )}
                    </div>
                  </div>

                  {done && (
                    <button
                      type="button"
                      onClick={() => askAITutor(`Phân tích kết quả kỹ năng ${m.label} của tôi (Band ${s.score ?? '–'}) trong bài thi Full Test ${testLabel}. Tôi cần lưu ý những gì để nâng band?`)}
                      className="mt-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition cursor-pointer pt-3 border-t border-zinc-100"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Hỏi AI Tutor kỹ năng này
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <button
            onClick={() => navigate('/full-test')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition flex items-center gap-1 cursor-pointer"
          >
            ← Danh sách bài thi Full Test
          </button>
          <button
            onClick={() => navigate('/progress')}
            className="text-xs font-semibold text-zinc-900 hover:underline transition flex items-center gap-1 cursor-pointer"
          >
            Xem biểu đồ tiến độ năng lực <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  )
}

