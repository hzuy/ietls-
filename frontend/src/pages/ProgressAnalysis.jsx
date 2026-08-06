import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getErrorBreakdown,
  getTrendData,
  getWritingCriteria,
  getSpeakingCriteria,
  getAIAdvice,
} from '../services/statsService'
import Navbar from '../components/Navbar'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  RotateCcw,
  Info,
} from 'lucide-react'

// Helper: Format raw question type identifiers into clean human-readable names
function formatQuestionType(type) {
  if (!type) return 'Khác'
  const mapping = {
    true_false_ng: 'True / False / Not Given',
    yes_no_ng: 'Yes / No / Not Given',
    mcq: 'Multiple Choice (Đơn)',
    mcq_multi: 'Multiple Choice (Nhiều đáp án)',
    fill_blank: 'Fill in the Blanks',
    note_completion: 'Note Completion',
    table_completion: 'Table Completion',
    summary_completion: 'Summary Completion',
    matching_headings: 'Matching Headings',
    matching_information: 'Matching Information',
    matching_features: 'Matching Features',
    diagram_labeling: 'Diagram Labeling',
    drag_word_bank: 'Drag & Drop Word Bank',
    short_answer: 'Short Answer Questions',
  }
  return mapping[type] || type.replace(/_/g, ' ').toUpperCase()
}

// Helper: Format criterion keys to human readable labels
function formatCriterionName(key) {
  const mapping = {
    task_achievement: 'Task Achievement / Response',
    coherence_cohesion: 'Coherence & Cohesion',
    lexical_resource: 'Lexical Resource (Từ vựng)',
    grammatical_range: 'Grammatical Range & Accuracy (Ngữ pháp)',
    fluency: 'Fluency & Coherence (Trôi chảy & Mạch lạc)',
    vocabulary: 'Lexical Resource / Vocabulary (Từ vựng)',
    grammar: 'Grammatical Range & Accuracy (Ngữ pháp)',
    pronunciation: 'Pronunciation (Phát âm)',
  }
  return mapping[key] || key.replace(/_/g, ' ').toUpperCase()
}

// Helper: Render trend badge with proper icons (NO arrow for insufficient_data)
function renderTrendBadge(trend) {
  if (trend === 'up') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <TrendingUp className="w-3.5 h-3.5" />
        Đang tăng
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <TrendingDown className="w-3.5 h-3.5" />
        Đang giảm
      </span>
    )
  }
  if (trend === 'stable') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Minus className="w-3.5 h-3.5" />
        Ổn định
      </span>
    )
  }
  // insufficient_data: render Info badge instead of arrow
  return (
    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
      <Info className="w-3.5 h-3.5" />
      Chưa đủ bài thi
    </span>
  )
}

export default function ProgressAnalysis() {
  const [skillFilter, setSkillFilter] = useState('all') // 'all' | 'reading' | 'listening' | 'writing' | 'speaking'
  const [breakdown, setBreakdown] = useState([])
  const [trend, setTrend] = useState([])
  const [writingCriteria, setWritingCriteria] = useState([])
  const [speakingCriteria, setSpeakingCriteria] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState(null)

  // AI Advice states
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState(null)
  const [aiError, setAiError] = useState(null)

  // Fetch statistics ONCE on mount
  useEffect(() => {
    setLoadingStats(true)
    setStatsError(null)

    Promise.all([
      getErrorBreakdown(null),
      getTrendData(null, 10),
      getWritingCriteria(),
      getSpeakingCriteria(),
    ])
      .then(([breakdownData, trendData, writingData, speakingData]) => {
        setBreakdown(breakdownData || [])
        setTrend(trendData || [])
        setWritingCriteria(writingData || [])
        setSpeakingCriteria(speakingData || [])
      })
      .catch(err => {
        console.error('[Progress Analysis Error]', err)
        setStatsError('Không thể tải số liệu thống kê. Vui lòng thử lại sau.')
      })
      .finally(() => {
        setLoadingStats(false)
      })
  }, []) // Dependency array empty: fetch only ONCE on mount!

  // Client-side filtering for Reading/Listening breakdown items
  const filteredBreakdown = breakdown.filter(item => {
    if (skillFilter === 'reading') return item.skillType === 'reading'
    if (skillFilter === 'listening') return item.skillType === 'listening'
    return true
  })

  // Handle manual AI Advice request
  const handleFetchAdvice = async () => {
    setAiLoading(true)
    setAiError(null)

    try {
      const data = await getAIAdvice()
      setAiResponse(data)
    } catch (err) {
      if (err.response?.status === 429) {
        setAiError({
          isRateLimit: true,
          message: err.response?.data?.message || 'Bạn đã đạt giới hạn 5 lần xin nhận xét AI trong ngày. Vui lòng quay lại sau 24 giờ.',
        })
      } else {
        setAiError({
          isRateLimit: false,
          message: err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ AI. Vui lòng thử lại.',
        })
      }
    } finally {
      setAiLoading(false)
    }
  }

  // Calculate overall metrics for Reading/Listening
  const totalQuestionsAll = breakdown.reduce((sum, item) => sum + (item.total || 0), 0)
  const totalCorrectAll = breakdown.reduce((sum, item) => sum + (item.correct || 0), 0)
  const totalWrongAll = breakdown.reduce((sum, item) => sum + (item.wrong || 0), 0)
  const totalSkippedAll = breakdown.reduce((sum, item) => sum + (item.skipped || 0), 0)
  const overallAccuracy = totalQuestionsAll > 0 ? ((totalCorrectAll / totalQuestionsAll) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Top Header */}
        <div className="mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                <BarChart3 className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Unified 4-Skills Analytics
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Phân tích Lỗi sai & Lộ trình 4 Kỹ năng
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi chi tiết tiêu chí IELTS Reading, Listening, Writing và Speaking kèm cố vấn AI cá nhân hóa.
            </p>
          </div>

          {/* Dedicated Skill Filter Toolbar (1 Single Row, No Wrap) */}
          <div className="mt-6 flex items-center overflow-x-auto pb-1 no-scrollbar">
            <div className="flex flex-nowrap items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl border border-slate-300/60 shrink-0">
              <button
                onClick={() => setSkillFilter('all')}
                className={`whitespace-nowrap px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  skillFilter === 'all'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Tất cả kỹ năng
              </button>
              <button
                onClick={() => setSkillFilter('reading')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  skillFilter === 'reading'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                Reading
              </button>
              <button
                onClick={() => setSkillFilter('listening')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  skillFilter === 'listening'
                    ? 'bg-white text-purple-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Headphones className="w-4 h-4 text-purple-600 shrink-0" />
                Listening
              </button>
              <button
                onClick={() => setSkillFilter('writing')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  skillFilter === 'writing'
                    ? 'bg-white text-amber-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PenTool className="w-4 h-4 text-amber-600 shrink-0" />
                Writing
              </button>
              <button
                onClick={() => setSkillFilter('speaking')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  skillFilter === 'speaking'
                    ? 'bg-white text-rose-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Mic className="w-4 h-4 text-rose-600 shrink-0" />
                Speaking
              </button>
            </div>
          </div>
        </div>

        {/* Global Loading State */}
        {loadingStats ? (
          <div className="space-y-6">
            <div className="h-32 bg-white rounded-3xl p-6 border border-slate-200 animate-pulse" />
            <div className="h-64 bg-white rounded-3xl p-6 border border-slate-200 animate-pulse" />
          </div>
        ) : statsError ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 text-sm font-medium flex items-center justify-between">
            <span>{statsError}</span>
            <button
              onClick={() => setSkillFilter(s => s)}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Overview Metric Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reading/Listening</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{totalQuestionsAll} câu</div>
                <span className="text-xs text-slate-500 mt-1 block">Đã ghi nhận trong log</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm bg-emerald-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Tỉ lệ đúng R/L</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{overallAccuracy}%</div>
                <span className="text-xs text-emerald-600 mt-1 font-semibold block">{totalCorrectAll} câu làm đúng</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-sm bg-amber-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Bài viết Writing</span>
                  <PenTool className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-700 mt-1">{writingCriteria[0]?.sampleCount || 0} bài</div>
                <span className="text-xs text-amber-600 mt-1 font-semibold block">Đã được AI chấm điểm</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-sm bg-rose-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Bài nói Speaking</span>
                  <Mic className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-700 mt-1">{speakingCriteria[0]?.sampleCount || 0} bài</div>
                <span className="text-xs text-rose-600 mt-1 font-semibold block">Đã được AI chấm điểm</span>
              </div>
            </div>

            {/* SECTION 1: Error Breakdown (Reading & Listening) */}
            {(skillFilter === 'all' || skillFilter === 'reading' || skillFilter === 'listening') && (
              <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      {skillFilter === 'reading'
                        ? 'Thống kê Reading theo dạng bài'
                        : skillFilter === 'listening'
                        ? 'Thống kê Listening theo dạng bài'
                        : 'Thống kê Reading & Listening theo dạng bài'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Sắp xếp ưu tiên các dạng bài có tỉ lệ lỗi cao lên trước. Phân biệt câu <strong className="text-rose-600 font-semibold">Làm sai</strong> và câu <strong className="text-amber-600 font-semibold">Chưa kịp làm (Bỏ qua)</strong>.
                    </p>
                  </div>
                </div>

                {filteredBreakdown.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-400">
                      {skillFilter === 'reading'
                        ? 'Chưa có dữ liệu làm bài Reading.'
                        : skillFilter === 'listening'
                        ? 'Chưa có dữ liệu làm bài Listening.'
                        : 'Chưa có dữ liệu làm bài Reading/Listening.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBreakdown.map((item, index) => {
                      const correctPct = item.total > 0 ? (item.correct / item.total) * 100 : 0
                      const wrongPct = item.total > 0 ? (item.wrong / item.total) * 100 : 0
                      const skippedPct = item.total > 0 ? (item.skipped / item.total) * 100 : 0

                      return (
                        <div
                          key={`${item.skillType}-${item.questionType}-${index}`}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  item.skillType === 'reading'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {item.skillType}
                              </span>
                              <span className="font-bold text-slate-800 text-sm">
                                {formatQuestionType(item.questionType)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-semibold">
                              <span className="text-slate-500">Tổng: <strong>{item.total}</strong> câu</span>
                              <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                Tỉ lệ lỗi: <strong>{(item.errorRate * 100).toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex mb-2">
                            {correctPct > 0 && <div style={{ width: `${correctPct}%` }} className="bg-emerald-500" />}
                            {wrongPct > 0 && <div style={{ width: `${wrongPct}%` }} className="bg-rose-500" />}
                            {skippedPct > 0 && <div style={{ width: `${skippedPct}%` }} className="bg-amber-400" />}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
                            <span>Đúng: <strong className="text-emerald-700">{item.correct}</strong></span>
                            <span>Làm sai: <strong className="text-rose-700">{item.wrong}</strong></span>
                            <span>Bỏ qua: <strong className="text-amber-700">{item.skipped}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 2: Writing Criteria Analysis */}
            {(skillFilter === 'all' || skillFilter === 'writing') && (
              <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-amber-600" />
                      Phân tích tiêu chí IELTS Writing (4 Criteria)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Sắp xếp theo điểm trung bình tăng dần (tiêu chí yếu nhất được xếp lên trước).
                    </p>
                  </div>
                </div>

                {writingCriteria.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <PenTool className="w-10 h-10 text-amber-300 mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">Chưa có bài Writing nào được chấm</h4>
                    <p className="text-xs text-slate-500 mt-1">Hãy nộp bài viết đầu tiên để AI ghi nhận và phân tích điểm tiêu chí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {writingCriteria.map(item => (
                      <div
                        key={item.criterion}
                        className="p-5 rounded-2xl bg-amber-50/20 border border-amber-200/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                                Writing Criteria
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm mt-1">
                                {formatCriterionName(item.criterion)}
                              </h4>
                            </div>
                            {renderTrendBadge(item.trend)}
                          </div>

                          <div className="flex items-baseline gap-2 my-3">
                            <span className="text-3xl font-black text-amber-700">{item.avgScore}</span>
                            <span className="text-xs text-slate-500 font-semibold">/ 9.0 Band (Trung bình {item.sampleCount} bài)</span>
                          </div>

                          <div className="text-xs text-slate-600 font-medium mb-3">
                            Lần gần nhất: <strong className="text-slate-800">{item.latestScore}</strong> Band
                          </div>

                          {item.latestComment && (
                            <div className="p-3 rounded-xl bg-white border border-amber-200/50 text-xs text-slate-700 italic leading-relaxed">
                              "{item.latestComment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 3: Speaking Criteria Analysis */}
            {(skillFilter === 'all' || skillFilter === 'speaking') && (
              <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Mic className="w-5 h-5 text-rose-600" />
                      Phân tích tiêu chí IELTS Speaking (4 Criteria)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Sắp xếp theo điểm trung bình tăng dần (tiêu chí yếu nhất được xếp lên trước).
                    </p>
                  </div>
                </div>

                {speakingCriteria.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <Mic className="w-10 h-10 text-rose-300 mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">Chưa có bài Speaking nào được chấm</h4>
                    <p className="text-xs text-slate-500 mt-1">Hãy nộp bài nói đầu tiên để AI ghi nhận và phân tích điểm tiêu chí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {speakingCriteria.map(item => (
                      <div
                        key={item.criterion}
                        className="p-5 rounded-2xl bg-rose-50/20 border border-rose-200/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                                Speaking Criteria
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm mt-1">
                                {formatCriterionName(item.criterion)}
                              </h4>
                            </div>
                            {renderTrendBadge(item.trend)}
                          </div>

                          <div className="flex items-baseline gap-2 my-3">
                            <span className="text-3xl font-black text-rose-700">{item.avgScore}</span>
                            <span className="text-xs text-slate-500 font-semibold">/ 9.0 Band (Trung bình {item.sampleCount} bài)</span>
                          </div>

                          <div className="text-xs text-slate-600 font-medium mb-3">
                            Lần gần nhất: <strong className="text-slate-800">{item.latestScore}</strong> Band
                          </div>

                          {item.latestComment && (
                            <div className="p-3 rounded-xl bg-white border border-rose-200/50 text-xs text-slate-700 italic leading-relaxed">
                              "{item.latestComment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 4: UNIFIED 4-SKILLS AI ADVISOR */}
            <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-800/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 pb-6 border-b border-indigo-800/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-bounce" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-widest bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                      Unified AI Advisor (4 Skills)
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white">Cố vấn Học thuật AI Toàn diện</h2>
                  <p className="text-xs text-indigo-200 max-w-xl">
                    Nhấp vào nút bên dưới để AI phân tích chuyên sâu dữ liệu 4 kỹ năng và lập lộ trình ôn tập cá nhân hóa. <em>(Tối đa 5 lượt/ngày).</em>
                  </p>
                </div>

                <button
                  onClick={handleFetchAdvice}
                  disabled={aiLoading}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-sm font-extrabold rounded-2xl transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {aiLoading ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>AI đang đọc dữ liệu 4 kỹ năng...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ Nhận nhận xét từ AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* AI Error Notification */}
              {aiError && (
                <div
                  className={`p-5 rounded-2xl border text-sm font-medium mb-6 ${
                    aiError.isRateLimit
                      ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                      : 'bg-rose-500/15 border-rose-400/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 font-bold mb-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{aiError.isRateLimit ? 'Đạt giới hạn lượt dùng trong ngày' : 'Thông báo từ máy chủ'}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{aiError.message}</p>
                </div>
              )}

              {/* AI Response Display */}
              {aiLoading ? (
                <div className="p-8 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 animate-pulse space-y-4">
                  <div className="h-5 bg-indigo-800/40 rounded-lg w-1/3" />
                  <div className="h-4 bg-indigo-800/30 rounded-lg w-3/4" />
                  <div className="h-4 bg-indigo-800/30 rounded-lg w-2/3" />
                </div>
              ) : aiResponse?.insufficientData ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-sm">
                  <div className="flex items-center gap-2 font-bold mb-2 text-amber-300">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Chưa đủ dữ liệu để AI nhận xét</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {aiResponse.message}
                  </p>
                </div>
              ) : aiResponse?.advice ? (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="p-5 md:p-6 rounded-2xl bg-indigo-950/60 border border-indigo-700/50 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4" />
                      Đánh giá Tổng quan 4 Kỹ năng
                    </h3>
                    <p className="text-sm leading-relaxed text-indigo-100 font-medium">
                      {aiResponse.advice.summary}
                    </p>
                  </div>

                  {/* 3 Skill Cards/Tabs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Reading & Listening */}
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-blue-800/50 backdrop-blur-sm">
                      <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4" />
                        Reading & Listening
                      </h4>

                      {!aiResponse.advice.skills?.reading_listening?.available ? (
                        <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.reading_listening.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.reading_listening.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Writing */}
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-800/50 backdrop-blur-sm">
                      <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <PenTool className="w-4 h-4" />
                        Writing
                      </h4>

                      {!aiResponse.advice.skills?.writing?.available ? (
                        <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.writing.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.writing.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Speaking */}
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-rose-800/50 backdrop-blur-sm">
                      <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Mic className="w-4 h-4" />
                        Speaking
                      </h4>

                      {!aiResponse.advice.skills?.speaking?.available ? (
                        <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.speaking.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-slate-200">
                              {aiResponse.advice.skills.speaking.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Items Card */}
                  <div className="p-5 md:p-6 rounded-2xl bg-blue-950/60 border border-blue-700/50 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-blue-400" />
                      Lộ trình hành động khuyến nghị (Ưu tiên kỹ năng yếu nhất)
                    </h3>
                    <div className="space-y-2.5">
                      {aiResponse.advice.actionItems?.map((act, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-blue-900/40 border border-blue-800/40 text-xs md:text-sm text-blue-100">
                          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                            {i + 1}
                          </span>
                          <span className="mt-0.5">{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
