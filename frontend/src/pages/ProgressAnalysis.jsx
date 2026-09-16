import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getErrorBreakdown,
  getTrendData,
  getWritingCriteria,
  getSpeakingCriteria,
  getAIAdvice,
} from '../services/statsService'
import Card from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
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
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-bg text-success-text border border-success-border">
        <TrendingUp className="w-3.5 h-3.5" />
        Đang tăng
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-error-bg text-error-text border border-error-border">
        <TrendingDown className="w-3.5 h-3.5" />
        Đang giảm
      </span>
    )
  }
  if (trend === 'stable') {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
        <Minus className="w-3.5 h-3.5" />
        Ổn định
      </span>
    )
  }
  // insufficient_data: render Info badge instead of arrow
  return (
    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
      <Info className="w-3.5 h-3.5" />
      Chưa đủ bài thi
    </span>
  )
}

export default function ProgressAnalysis() {
  const [skillFilter, setSkillFilter] = useState('all') // 'all' | 'reading' | 'listening' | 'writing' | 'speaking'
  const [breakdown, setBreakdown] = useState([])
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
      .then(([breakdownData, , writingData, speakingData]) => {
        setBreakdown(breakdownData || [])
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
  const overallAccuracy = totalQuestionsAll > 0 ? ((totalCorrectAll / totalQuestionsAll) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-zinc-900 font-sans">

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Top Header */}
        <div className="mb-8 anim-fade-up">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200">
                <BarChart3 className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200">
                Unified 4-Skills Analytics
              </span>
            </div>
            <PageHeader
              title="Phân tích Lỗi sai & Lộ trình 4 Kỹ năng"
              subtitle="Theo dõi chi tiết tiêu chí IELTS Reading, Listening, Writing và Speaking kèm cố vấn AI cá nhân hóa."
              titleClassName="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight"
            />
          </div>

          {/* Dedicated Skill Filter Toolbar (1 Single Row, No Wrap) */}
          <div className="mt-6 flex items-center overflow-x-auto pb-1 no-scrollbar">
            <div className="flex flex-nowrap items-center gap-1.5 p-1 bg-zinc-100 rounded-full border border-zinc-200 shrink-0">
              <button
                onClick={() => setSkillFilter('all')}
                className={`whitespace-nowrap px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition cursor-pointer ${
                  skillFilter === 'all'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                Tất cả kỹ năng
              </button>
              <button
                onClick={() => setSkillFilter('reading')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition cursor-pointer ${
                  skillFilter === 'reading'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <BookOpen className="w-4 h-4 text-zinc-700 shrink-0" />
                Reading
              </button>
              <button
                onClick={() => setSkillFilter('listening')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition cursor-pointer ${
                  skillFilter === 'listening'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <Headphones className="w-4 h-4 text-zinc-700 shrink-0" />
                Listening
              </button>
              <button
                onClick={() => setSkillFilter('writing')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition cursor-pointer ${
                  skillFilter === 'writing'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <PenTool className="w-4 h-4 text-zinc-700 shrink-0" />
                Writing
              </button>
              <button
                onClick={() => setSkillFilter('speaking')}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition cursor-pointer ${
                  skillFilter === 'speaking'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <Mic className="w-4 h-4 text-zinc-700 shrink-0" />
                Speaking
              </button>
            </div>
          </div>
        </div>

        {/* Global Loading State */}
        {loadingStats ? (
          <div className="space-y-6">
            <div className="h-32 bg-white rounded-2xl p-6 border border-zinc-200 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl p-6 border border-zinc-200 animate-pulse" />
          </div>
        ) : statsError ? (
          <div className="p-6 bg-error-bg border border-error-border rounded-2xl text-error-text text-sm font-medium flex items-center justify-between">
            <span>{statsError}</span>
            <button
              onClick={() => setSkillFilter(s => s)}
              className="px-5 h-9 bg-error text-white text-xs font-bold rounded-full hover:opacity-90 transition"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Metric Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-5">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Reading/Listening</span>
                <div className="text-2xl font-black text-zinc-900 mt-1 font-mono">{totalQuestionsAll} câu</div>
                <span className="text-xs text-zinc-500 mt-1 block">Đã ghi nhận trong log</span>
              </Card>
              <div className="bg-white p-5 rounded-2xl border border-success-border/80 shadow-xs bg-success-bg/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-success-text uppercase tracking-wider">Tỉ lệ đúng R/L</span>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <div className="text-2xl font-black text-success-text mt-1 font-mono">{overallAccuracy}%</div>
                <span className="text-xs text-success mt-1 font-semibold block">{totalCorrectAll} câu làm đúng</span>
              </div>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bài viết Writing</span>
                  <PenTool className="w-4 h-4 text-zinc-600" />
                </div>
                <div className="text-2xl font-black text-zinc-900 mt-1 font-mono">{writingCriteria[0]?.sampleCount || 0} bài</div>
                <span className="text-xs text-zinc-500 mt-1 font-medium block">Đã được AI chấm điểm</span>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bài nói Speaking</span>
                  <Mic className="w-4 h-4 text-zinc-600" />
                </div>
                <div className="text-2xl font-black text-zinc-900 mt-1 font-mono">{speakingCriteria[0]?.sampleCount || 0} bài</div>
                <span className="text-xs text-zinc-500 mt-1 font-medium block">Đã được AI chấm điểm</span>
              </Card>
            </div>

            {/* SECTION 1: Error Breakdown (Reading & Listening) */}
            {(skillFilter === 'all' || skillFilter === 'reading' || skillFilter === 'listening') && (
              <Card as="section" className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-zinc-900" />
                      {skillFilter === 'reading'
                        ? 'Thống kê Reading theo dạng bài'
                        : skillFilter === 'listening'
                        ? 'Thống kê Listening theo dạng bài'
                        : 'Thống kê Reading & Listening theo dạng bài'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Sắp xếp ưu tiên các dạng bài có tỉ lệ lỗi cao lên trước. Phân biệt câu <strong className="text-error font-semibold">Làm sai</strong> và câu <strong className="text-amber-600 font-semibold">Chưa kịp làm (Bỏ qua)</strong>.
                    </p>
                  </div>
                </div>

                {filteredBreakdown.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <BarChart3 className="w-10 h-10 text-zinc-300 mb-2" />
                    <h4 className="text-sm font-bold text-zinc-700">
                      {skillFilter === 'reading'
                        ? 'Chưa có dữ liệu làm bài Reading'
                        : skillFilter === 'listening'
                        ? 'Chưa có dữ liệu làm bài Listening'
                        : 'Chưa có dữ liệu làm bài Reading/Listening'}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">Hoàn thành một bài thi để xem thống kê theo dạng câu hỏi.</p>
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
                          className="p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800 border border-zinc-300"
                              >
                                {item.skillType}
                              </span>
                              <span className="font-bold text-zinc-900 text-sm">
                                {formatQuestionType(item.questionType)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-semibold">
                              <span className="text-zinc-500">Tổng: <strong>{item.total}</strong> câu</span>
                              <span className="text-error bg-error-bg border border-error-border px-2.5 py-0.5 rounded-full">
                                Tỉ lệ lỗi: <strong>{(item.errorRate * 100).toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden flex mb-2">
                            {correctPct > 0 && <div style={{ width: `${correctPct}%` }} className="bg-success" />}
                            {wrongPct > 0 && <div style={{ width: `${wrongPct}%` }} className="bg-error" />}
                            {skippedPct > 0 && <div style={{ width: `${skippedPct}%` }} className="bg-amber-400" />}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 font-medium">
                            <span>Đúng: <strong className="text-success-text">{item.correct}</strong></span>
                            <span>Làm sai: <strong className="text-error-text">{item.wrong}</strong></span>
                            <span>Bỏ qua: <strong className="text-amber-700">{item.skipped}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* SECTION 2: Writing Criteria Analysis */}
            {(skillFilter === 'all' || skillFilter === 'writing') && (
              <Card as="section" className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-zinc-700" />
                      Phân tích tiêu chí IELTS Writing (4 Criteria)
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Sắp xếp theo điểm trung bình tăng dần (tiêu chí yếu nhất được xếp lên trước).
                    </p>
                  </div>
                </div>

                {writingCriteria.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <PenTool className="w-10 h-10 text-zinc-300 mb-2" />
                    <h4 className="text-sm font-bold text-zinc-700">Chưa có bài Writing nào được chấm</h4>
                    <p className="text-xs text-zinc-500 mt-1">Hãy nộp bài viết đầu tiên để AI ghi nhận và phân tích điểm tiêu chí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {writingCriteria.map(item => (
                      <div
                        key={item.criterion}
                        className="p-5 rounded-2xl bg-zinc-50/70 border border-zinc-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 bg-zinc-200/80 px-2.5 py-0.5 rounded-full">
                                Writing Criteria
                              </span>
                              <h4 className="font-bold text-zinc-900 text-sm mt-1">
                                {formatCriterionName(item.criterion)}
                              </h4>
                            </div>
                            {renderTrendBadge(item.trend)}
                          </div>

                          <div className="flex items-baseline gap-2 my-3">
                            <span className="text-3xl font-black text-zinc-900 font-mono">{item.avgScore}</span>
                            <span className="text-xs text-zinc-500 font-medium">/ 9.0 Band (Trung bình {item.sampleCount} bài)</span>
                          </div>

                          <div className="text-xs text-zinc-600 font-medium mb-3">
                            Lần gần nhất: <strong className="text-zinc-900">{item.latestScore}</strong> Band
                          </div>

                          {item.latestComment && (
                            <div className="p-3 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-700 italic leading-relaxed">
                              "{item.latestComment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* SECTION 3: Speaking Criteria Analysis */}
            {(skillFilter === 'all' || skillFilter === 'speaking') && (
              <Card as="section" className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                      <Mic className="w-5 h-5 text-zinc-700" />
                      Phân tích tiêu chí IELTS Speaking (4 Criteria)
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Sắp xếp theo điểm trung bình tăng dần (tiêu chí yếu nhất được xếp lên trước).
                    </p>
                  </div>
                </div>

                {speakingCriteria.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center">
                    <Mic className="w-10 h-10 text-zinc-300 mb-2" />
                    <h4 className="text-sm font-bold text-zinc-700">Chưa có bài Speaking nào được chấm</h4>
                    <p className="text-xs text-zinc-500 mt-1">Hãy nộp bài nói đầu tiên để AI ghi nhận và phân tích điểm tiêu chí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {speakingCriteria.map(item => (
                      <div
                        key={item.criterion}
                        className="p-5 rounded-2xl bg-zinc-50/70 border border-zinc-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 bg-zinc-200/80 px-2.5 py-0.5 rounded-full">
                                Speaking Criteria
                              </span>
                              <h4 className="font-bold text-zinc-900 text-sm mt-1">
                                {formatCriterionName(item.criterion)}
                              </h4>
                            </div>
                            {renderTrendBadge(item.trend)}
                          </div>

                          <div className="flex items-baseline gap-2 my-3">
                            <span className="text-3xl font-black text-zinc-900 font-mono">{item.avgScore}</span>
                            <span className="text-xs text-zinc-500 font-medium">/ 9.0 Band (Trung bình {item.sampleCount} bài)</span>
                          </div>

                          <div className="text-xs text-zinc-600 font-medium mb-3">
                            Lần gần nhất: <strong className="text-zinc-900">{item.latestScore}</strong> Band
                          </div>

                          {item.latestComment && (
                            <div className="p-3 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-700 italic leading-relaxed">
                              "{item.latestComment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* SECTION 4: UNIFIED 4-SKILLS AI ADVISOR */}
            <section className="bg-zinc-900 rounded-2xl p-6 md:p-8 text-white shadow-xs border border-zinc-800">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 pb-6 border-b border-zinc-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
                      Unified AI Advisor (4 Skills)
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Cố vấn Học thuật AI Toàn diện</h2>
                  <p className="text-xs text-zinc-400 max-w-xl">
                    Nhấp vào nút bên dưới để AI phân tích chuyên sâu dữ liệu 4 kỹ năng và lập lộ trình ôn tập cá nhân hóa. <em>(Tối đa 5 lượt/ngày).</em>
                  </p>
                </div>

                <button
                  onClick={handleFetchAdvice}
                  disabled={aiLoading}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-full transition shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {aiLoading ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>AI đang đọc dữ liệu 4 kỹ năng...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Nhận nhận xét từ AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* AI Error Notification */}
              {aiError && (
                <div
                  className={`p-4 rounded-2xl border text-sm font-medium mb-6 ${
                    aiError.isRateLimit
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
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
                <div className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-800 animate-pulse space-y-4">
                  <div className="h-5 bg-zinc-800 rounded-full w-1/3" />
                  <div className="h-4 bg-zinc-800/60 rounded-full w-3/4" />
                  <div className="h-4 bg-zinc-800/60 rounded-full w-2/3" />
                </div>
              ) : aiResponse?.insufficientData ? (
                <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-300 text-sm">
                  <div className="flex items-center gap-2 font-bold mb-2 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Chưa đủ dữ liệu để AI nhận xét</span>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {aiResponse.message}
                  </p>
                </div>
              ) : aiResponse?.advice ? (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="p-5 md:p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm">
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Đánh giá Tổng quan 4 Kỹ năng
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-200 font-normal">
                      {aiResponse.advice.summary}
                    </p>
                  </div>

                  {/* 3 Skill Cards/Tabs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {/* Reading & Listening */}
                    <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm">
                      <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-zinc-400" />
                        Reading & Listening
                      </h4>

                      {!aiResponse.advice.skills?.reading_listening?.available ? (
                        <p className="text-xs text-zinc-500 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-zinc-300">
                              {aiResponse.advice.skills.reading_listening.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-zinc-300">
                              {aiResponse.advice.skills.reading_listening.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Writing */}
                    <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm">
                      <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <PenTool className="w-4 h-4 text-zinc-400" />
                        Writing
                      </h4>

                      {!aiResponse.advice.skills?.writing?.available ? (
                        <p className="text-xs text-zinc-500 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-zinc-300">
                              {aiResponse.advice.skills.writing.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-zinc-300">
                              {aiResponse.advice.skills.writing.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Speaking */}
                    <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm">
                      <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Mic className="w-4 h-4 text-zinc-400" />
                        Speaking
                      </h4>

                      {!aiResponse.advice.skills?.speaking?.available ? (
                        <p className="text-xs text-zinc-500 italic">Chưa đủ dữ liệu để đánh giá kỹ năng này.</p>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-emerald-400 block mb-1">Điểm mạnh:</span>
                            <ul className="space-y-1 text-zinc-300">
                              {aiResponse.advice.skills.speaking.strengths?.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-bold text-amber-400 block mb-1">Cần chú ý:</span>
                            <ul className="space-y-1 text-zinc-300">
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
                  <div className="p-5 md:p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm">
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-zinc-400" />
                      Lộ trình hành động khuyến nghị (Ưu tiên kỹ năng yếu nhất)
                    </h3>
                    <div className="space-y-2.5">
                      {aiResponse.advice.actionItems?.map((act, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs md:text-sm text-zinc-200">
                          <span className="w-6 h-6 rounded-full bg-zinc-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                            {i + 1}
                          </span>
                          <span className="mt-0.5 leading-relaxed">{act}</span>
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
