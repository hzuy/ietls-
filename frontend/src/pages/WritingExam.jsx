import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getWritingExam, submitWritingExam, getWritingStatus, getFullTestStatus, getWritingMyResults, retryWritingGrading } from '../services/examService'
import { getAdminSettings } from '../services/adminService'
import { saveDraft, loadDraft, clearDraft, isDataEmpty } from '../services/draftService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBrowserHistoryGuard } from '../hooks/useBrowserHistoryGuard'
import { Clock, Sparkles, CheckCircle2, RotateCcw, AlertCircle, ChevronRight, X, History, ChevronDown, ChevronUp, FileQuestion } from 'lucide-react'
import { SkeletonExamPage } from '../components/skeletons'
import ExamErrorState from '../components/exam/ExamErrorState'
import InlineCorrections from '../components/exam/InlineCorrections'
import { isTaskComplete, countUnsubmitted } from '../utils/writingTasks'
import { toImgSrc, handleImgError } from '../utils/media'
import ExitConfirmModal from '../components/common/ExitConfirmModal'

const DEFAULT_WRITING_TIME = 60 * 60

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function wc(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const CRITERIA_LABELS = {
  task_achievement: 'Task Achievement',
  coherence_cohesion: 'Coherence & Cohesion',
  lexical_resource: 'Lexical Resource',
  grammatical_range: 'Grammatical Range & Accuracy',
}

function ImageLightbox({ src, onClose }) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div
      onClick={onClose}
      className="p-3 sm:p-6"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}
    >
      <button
        onClick={onClose}
        className="bg-white/15 hover:bg-white/25 transition-colors"
        style={{ position: 'fixed', top: 16, right: 20, zIndex: 10000, border: 'none', color: 'white', borderRadius: '50%', width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
      >✕</button>
      <img
        src={src}
        alt="Task visual fullsize"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }}
      />
    </div>
  )
}

const getScoreColorClass = (scoreStr, isBg = false) => {
  const s = parseFloat(scoreStr)
  if (isNaN(s)) return isBg ? 'bg-zinc-200 text-zinc-500' : 'text-zinc-500'
  if (s >= 8.0) return isBg ? 'bg-fuchsia-500 text-white' : 'text-fuchsia-600'
  if (s >= 7.0) return isBg ? 'bg-emerald-500 text-white' : 'text-emerald-600'
  if (s >= 5.5) return isBg ? 'bg-amber-400 text-amber-900' : 'text-amber-500'
  return isBg ? 'bg-zinc-200 text-zinc-600' : 'text-zinc-500'
}

const getHeroCircleClass = (scoreStr) => {
  const s = parseFloat(scoreStr)
  if (isNaN(s)) return 'bg-zinc-300 text-zinc-700'
  if (s >= 8.0) return 'bg-fuchsia-500 text-white'
  if (s >= 7.0) return 'bg-emerald-500 text-white'
  if (s >= 5.5) return 'bg-[#F59E0B] text-zinc-950'
  if (s >= 4.0) return 'bg-amber-300 text-amber-950'
  return 'bg-zinc-300 text-zinc-700'
}

const getHeroBadgeClass = (scoreStr) => {
  const s = parseFloat(scoreStr)
  if (isNaN(s)) return 'bg-zinc-200 text-zinc-700'
  if (s >= 8.0) return 'bg-fuchsia-200 text-fuchsia-950'
  if (s >= 7.0) return 'bg-emerald-200 text-emerald-950'
  if (s >= 5.5) return 'bg-[#FCD34D] text-zinc-950'
  if (s >= 4.0) return 'bg-amber-200 text-amber-950'
  return 'bg-zinc-200 text-zinc-700'
}
const roundIeltsScore = (num) => {
  if (isNaN(num)) return 0
  const whole = Math.floor(num)
  const frac = num - whole
  if (frac < 0.25) return whole + '.0'
  if (frac < 0.75) return whole + '.5'
  return (whole + 1) + '.0'
}

const renderCriterionComment = (comment, isGood) => {
  if (!comment) return <p className="text-xs text-zinc-400 italic">Chưa có nhận xét chi tiết.</p>

  const lines = comment.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    return (
      <ul className="space-y-1.5 mt-1.5">
        {lines.map((line, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[13px] text-zinc-600 leading-snug">
            <span className={isGood ? "text-emerald-500 shrink-0 mt-0.5 text-xs font-bold" : "text-amber-500 shrink-0 mt-0.5 text-xs font-bold"}>
              {isGood ? '✓' : '•'}
            </span>
            <span>{line.replace(/^[•\-\*✓]\s*/, '')}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex items-start gap-2 mt-1.5">
      <span className={isGood ? "text-emerald-500 shrink-0 mt-0.5 text-xs font-bold" : "text-amber-500 shrink-0 mt-0.5 text-xs font-bold"}>
        {isGood ? '✓' : '•'}
      </span>
      <p className="text-[13px] text-zinc-600 leading-relaxed m-0">{comment}</p>
    </div>
  )
}

function WritingTaskAccordion({ task, r, isCompleted, onRetake }) {
  const [openQ, setOpenQ] = useState(false);
  const [openA, setOpenA] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const [activeTab, setActiveTab] = useState('corrected'); // 'corrected' | 'original' | 'model'

  const paragraphCount = (r?.essayText || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).length;
  const wordCount = wc(r?.essayText || '');

  const getTaskScore = () => {
    if (r?.overall != null && !isNaN(parseFloat(r.overall))) {
      const val = parseFloat(r.overall);
      return val % 1 === 0 ? val.toFixed(1) : val.toString();
    }
    if (r?.criteria) {
      const scores = Object.values(r.criteria).map(c => parseFloat(c?.score || 0)).filter(s => s > 0);
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return roundIeltsScore(avg);
      }
    }
    return '–';
  };
  const taskScore = getTaskScore();

  const criteriaKeys = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range'];
  const criteriaList = criteriaKeys.map(key => {
    const crit = r?.criteria?.[key];
    let label = '';
    if (key === 'task_achievement') {
      label = task.number === 1 ? 'Task Achievement' : 'Task Response';
    } else if (key === 'coherence_cohesion') {
      label = 'Coherence and Cohesion';
    } else if (key === 'lexical_resource') {
      label = 'Lexical Resource';
    } else if (key === 'grammatical_range') {
      label = 'Grammatical Range';
    }
    const scoreNum = parseFloat(crit?.score || 0);
    const score = scoreNum > 0 ? (scoreNum % 1 === 0 ? scoreNum.toFixed(1) : scoreNum.toString()) : '–';
    return {
      key,
      label,
      score,
      scoreNum,
      summary: crit?.summary || crit?.comment || '',
      comment: crit?.comment || crit?.summary || '',
      strengths: Array.isArray(crit?.strengths) ? crit.strengths : [],
      weaknesses: Array.isArray(crit?.weaknesses) ? crit.weaknesses : [],
      how_to_improve: Array.isArray(crit?.how_to_improve) ? crit.how_to_improve : [],
    };
  });

  const errorCounts = useMemo(() => {
    const counts = { grammar: 0, vocabulary: 0, punctuation: 0, spelling: 0, upgrade: 0, other: 0 };
    const items = Array.isArray(r?.corrections) ? r.corrections : [];
    for (const c of items) {
      const t = c?.type;
      if (t === 'grammar') counts.grammar++;
      else if (t === 'vocabulary' || t === 'word_choice' || t === 'collocation') counts.vocabulary++;
      else if (t === 'punctuation') counts.punctuation++;
      else if (t === 'spelling') counts.spelling++;
      else if (t === 'upgrade') counts.upgrade++;
      else counts.other++;
    }
    return counts;
  }, [r?.corrections]);

  const realErrorsCount = useMemo(() => {
    const items = Array.isArray(r?.corrections) ? r.corrections : [];
    return items.filter(c => c?.type !== 'upgrade').length;
  }, [r?.corrections]);

  const upgradesCount = errorCounts.upgrade;
  const spellingPunctuationCount = errorCounts.spelling + errorCounts.punctuation;

  const improvementSuggestion = useMemo(() => {
    if (typeof r?.improvements === 'string' && r.improvements.trim()) return r.improvements.trim();
    if (Array.isArray(r?.improvements) && r.improvements.length > 0) return r.improvements.join('\n');
    if (typeof r?.feedback === 'string' && r.feedback.trim()) return r.feedback.trim();
    if (typeof r?.generalFeedback === 'string' && r.generalFeedback.trim()) return r.generalFeedback.trim();

    if (r?.criteria) {
      const sortedCrits = Object.values(r.criteria)
        .filter(c => c && c.comment)
        .sort((a, b) => parseFloat(a.score || 0) - parseFloat(b.score || 0));
      if (sortedCrits.length > 0 && sortedCrits[0].comment) {
        return sortedCrits[0].comment.replace(/^[•\-\*✓]\s*/gm, '').trim();
      }
    }
    return task.number === 1
      ? 'Bám sát biểu đồ và thêm từ nối giữa các đoạn.'
      : 'Phát triển luận điểm rõ ràng, bổ sung dẫn chứng và cân đối dung lượng giữa các đoạn.';
  }, [r, task.number]);

  return (
    <div className="flex flex-col mb-10 w-full font-sans">
      {/* Header Tab */}
      <div>
        <div className="bg-[#284A6A] text-white px-8 py-3 text-[17px] font-bold inline-block rounded-t-md tracking-wide">
          Task {task.number}
        </div>
      </div>

      {/* Accordions Container */}
      <div className="border border-zinc-200 border-t-0 rounded-b-md rounded-tr-md overflow-hidden bg-white shadow-sm">
        
        {/* Question Accordion */}
        <div className="border-b border-zinc-200">
          <button 
            type="button"
            onClick={() => setOpenQ(!openQ)}
            className={"w-full flex items-center justify-between px-6 py-4 text-left font-bold transition-colors cursor-pointer " + (openQ ? "bg-[#F49F2D] text-white" : "bg-white text-[#284A6A] hover:bg-zinc-50")}
          >
            <span className="text-[16px]">Question</span>
            {openQ ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {openQ && (
            <div className="p-6 border border-[#F49F2D] border-t-0 bg-white">
              <div className="text-sm text-zinc-600 mb-6 font-medium">
                You should spend about <span className="font-bold text-zinc-800">{task.number === 1 ? '20' : '40'} minutes</span> on this task.
                <br /><br />
                <p className="text-zinc-800 text-[14.5px] leading-relaxed whitespace-pre-line m-0 font-medium">
                  {task.prompt}
                </p>
                <br />
                You should write <span className="font-bold text-zinc-800">at least {task.number === 1 ? '150' : '250'} words.</span>
              </div>
              {task.imageUrl && (
                <div className="mt-6 flex justify-center">
                  <div
                    onClick={() => setLightbox(toImgSrc(task.imageUrl))}
                    className="relative cursor-pointer group max-w-full rounded-md overflow-hidden border border-zinc-200 shadow-sm"
                    title="Bấm để phóng to ảnh"
                  >
                    <img
                      src={toImgSrc(task.imageUrl)}
                      alt={`Hình ảnh minh họa Task ${task.number}`}
                      onError={handleImgError}
                      className="max-w-full block"
                    />
                    <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Phóng to
                    </div>
                  </div>
                </div>
              )}
              {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
            </div>
          )}
        </div>

        {/* Answer Accordion */}
        <div>
          <button 
            type="button"
            onClick={() => setOpenA(!openA)}
            className={"w-full flex items-center justify-between px-6 py-4 text-left font-bold transition-colors cursor-pointer " + (openA ? "bg-[#F49F2D] text-white" : "bg-white text-[#284A6A] hover:bg-zinc-50")}
          >
            <span className="text-[16px]">Answer</span>
            {openA ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {openA && (
            <div className="p-4 sm:p-6 lg:p-7 border border-[#F49F2D] border-t-0 bg-[#F8FAFC]">
              {isCompleted ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-stretch lg:min-h-[320px]">
                    {/* Cột trái: Khung bài viết với 3 tabs */}
                    <div className="relative bg-white rounded-2xl border border-zinc-200/90 shadow-2xs max-h-[60vh] lg:max-h-none overflow-hidden flex flex-col">
                      <div className="p-5 sm:p-6 lg:absolute lg:inset-0 flex flex-col min-h-0">
                        {/* Tab header */}
                        <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-zinc-100 shrink-0 overflow-x-auto custom-scrollbar">
                          <button
                            type="button"
                            onClick={() => setActiveTab('corrected')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                              activeTab === 'corrected'
                                ? 'bg-blue-50 text-blue-700 shadow-2xs'
                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            Đã sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('original')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                              activeTab === 'original'
                                ? 'bg-blue-50 text-blue-700 shadow-2xs'
                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            Bản gốc
                          </button>
                          {r?.model_essay?.paragraphs && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('model')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                                activeTab === 'model'
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                              }`}
                            >
                              Bài mẫu band {r.model_essay.target_band}
                            </button>
                          )}
                        </div>

                        {/* Vùng bài viết cuộn dọc */}
                        <div className="flex-1 min-h-0 overflow-y-auto pr-3 custom-scrollbar text-zinc-800 text-[15.5px] leading-[2.0]">
                          {activeTab === 'corrected' && (
                            <InlineCorrections text={r.essayText} corrections={r.corrections} />
                          )}
                          {activeTab === 'original' && (
                            <div className="whitespace-pre-wrap font-serif sm:font-sans">
                              {r.essayText}
                            </div>
                          )}
                          {activeTab === 'model' && r?.model_essay && (
                            <div className="space-y-4">
                              {r.model_essay.paragraphs.map((para, idx) => (
                                <p key={idx} className="m-0 leading-relaxed text-zinc-800 text-justify">
                                  {para}
                                </p>
                              ))}
                              {Array.isArray(r.model_essay.key_changes) && r.model_essay.key_changes.length > 0 && (
                                <div className="mt-6 pt-5 border-t border-zinc-200">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">
                                    Các thay đổi chính giúp nâng band
                                  </h4>
                                  <ul className="space-y-2 m-0 p-0 list-none">
                                    {r.model_essay.key_changes.map((item, idx) => (
                                      <li key={idx} className="text-xs text-zinc-700 bg-blue-50/60 border border-blue-100 rounded-xl p-3 leading-relaxed">
                                        <span className="font-bold text-blue-600 mr-1.5">•</span>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cột phải: Khung điểm và nhận xét */}
                    <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-2xs flex flex-col gap-4 h-auto">
                      {/* 1. Điểm số to & thông số đoạn/từ + ±0.5 */}
                      <div className="text-center pt-1">
                        <div className="text-5xl font-black text-zinc-900 tracking-tight leading-none">
                          {taskScore}
                        </div>
                        <div
                          title="Điểm do AI ước lượng, có thể chênh khoảng ±0.5 so với giám khảo thật."
                          className="text-[11px] font-bold text-zinc-400 mt-1 cursor-help select-none inline-block"
                        >
                          ±0.5
                        </div>
                        <div className="text-xs font-semibold text-zinc-500 mt-1">
                          Task {task.number} band score
                        </div>
                        <div className="mt-2.5">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
                            {paragraphCount} đoạn · {wordCount} từ
                          </span>
                        </div>
                      </div>

                      {/* 2. 4 tiêu chí với thanh tiến trình xanh */}
                      <div className="space-y-3 pt-1">
                        {criteriaList.map((critItem) => (
                          <div key={critItem.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                              <span>{critItem.label}</span>
                              <span className="font-extrabold">{critItem.score}</span>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-[#2563EB] h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.max(0, (critItem.scoreNum / 9) * 100))}%` }} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 3. Lỗi đã sửa & badges */}
                      <div className="pt-3 border-t border-zinc-100">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-xs font-bold text-zinc-800">
                            {realErrorsCount} lỗi đã sửa
                          </span>
                          {upgradesCount > 0 && (
                            <span className="text-xs font-semibold text-blue-600">
                              {upgradesCount} gợi ý nâng cấp
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto custom-scrollbar pb-1">
                          {errorCounts.grammar > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#DC2626] whitespace-nowrap shrink-0">
                              Ngữ pháp {errorCounts.grammar}
                            </span>
                          )}
                          {errorCounts.vocabulary > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] whitespace-nowrap shrink-0">
                              Từ vựng {errorCounts.vocabulary}
                            </span>
                          )}
                          {spellingPunctuationCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DBEAFE] text-[#2563EB] whitespace-nowrap shrink-0">
                              Chính tả và dấu câu {spellingPunctuationCount}
                            </span>
                          )}
                          {errorCounts.upgrade > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                              Nâng cấp {errorCounts.upgrade}
                            </span>
                          )}
                          {realErrorsCount === 0 && upgradesCount === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap shrink-0">
                              Không có lỗi nào
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4. Top priorities (thay cho Gợi ý cải thiện nếu có) */}
                      <div className="pt-3 border-t border-zinc-100">
                        <div className="text-xs font-bold text-zinc-900 mb-1.5">
                          {Array.isArray(r?.top_priorities) && r.top_priorities.length > 0 ? 'Ưu tiên cải thiện hàng đầu' : 'Gợi ý cải thiện'}
                        </div>
                        {Array.isArray(r?.top_priorities) && r.top_priorities.length > 0 ? (
                          <ol className="m-0 p-0 list-decimal list-inside space-y-1 text-xs text-zinc-600 leading-relaxed text-justify">
                            {r.top_priorities.slice(0, 3).map((pri, idx) => (
                              <li key={idx} className="font-medium">
                                {pri}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-xs text-zinc-600 leading-relaxed m-0 whitespace-pre-line text-justify">
                            {improvementSuggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 5. Khối Nhận xét chi tiết từng tiêu chí (nằm DƯỚI hai cột, rộng toàn khung) */}
                  <div className="w-full mt-8 pt-6 border-t border-zinc-200/90">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 m-0">
                        Nhận xét chi tiết
                      </h3>
                    </div>
                    {r?.overall_summary && (
                      <p className="text-xs text-zinc-600 leading-relaxed mb-5 bg-white p-4 rounded-xl border border-zinc-200/80 text-justify">
                        <strong className="text-zinc-800">Tổng kết: </strong>
                        {r.overall_summary}
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {criteriaList.map((critItem) => (
                        <div key={critItem.key} className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-2xs flex flex-col gap-3.5">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                            <span className="font-bold text-sm text-zinc-900">{critItem.label}</span>
                            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              Band {critItem.score}
                            </span>
                          </div>
                          {(critItem.summary || critItem.comment) && (
                            <p className="text-xs text-zinc-700 leading-relaxed m-0 text-justify">
                              {critItem.summary || critItem.comment}
                            </p>
                          )}
                          {/* Ưu điểm */}
                          {critItem.strengths && critItem.strengths.length > 0 && (
                            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Ưu điểm
                              </div>
                              <ul className="m-0 p-0 list-none space-y-1 text-xs text-emerald-900 leading-relaxed">
                                {critItem.strengths.map((str, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="font-bold text-emerald-600 shrink-0">•</span>
                                    <span>{str}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Nhược điểm */}
                          {critItem.weaknesses && critItem.weaknesses.length > 0 && (
                            <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                Nhược điểm
                              </div>
                              <ul className="m-0 p-0 list-none space-y-1 text-xs text-amber-900 leading-relaxed">
                                {critItem.weaknesses.map((w, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="font-bold text-amber-600 shrink-0">•</span>
                                    <span>{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Cách cải thiện */}
                          {critItem.how_to_improve && critItem.how_to_improve.length > 0 && (
                            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 mb-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                Cách cải thiện
                              </div>
                              <ul className="m-0 p-0 list-none space-y-1 text-xs text-blue-900 leading-relaxed">
                                {critItem.how_to_improve.map((h, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="font-bold text-blue-600 shrink-0">•</span>
                                    <span>{h}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-2xs">
                  <div className="mb-4 text-zinc-300">
                     <FileQuestion className="w-16 h-16 stroke-1" />
                  </div>
                  <h3 className="text-[#284A6A] text-[22px] font-bold mb-3">Want to add answer for this task?</h3>
                  <p className="text-zinc-600 text-[14px] max-w-lg mx-auto mb-8 leading-relaxed font-medium">
                    It looks like you haven't finished Task {task.number} essay. If you want to complete Task {task.number} and get evaluation for both tasks, you can retake the test and submit again.
                  </p>
                  <button 
                    onClick={onRetake}
                    className="bg-[#284A6A] hover:bg-[#1E3A54] text-white px-8 py-3 rounded-md font-bold transition-colors shadow-sm text-[15px] cursor-pointer"
                  >
                    Retake Test
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}


export default function WritingExam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resumeMode = searchParams.get('resume') === 'true'
  const viewResultMode = searchParams.get('viewResult') === 'true'
  const viewAttemptId = viewResultMode ? searchParams.get('attemptId') : null
  const viewFinishedAt = viewResultMode ? searchParams.get('finishedAt') : null
  const { user } = useAuth()
  const { showToast } = useToast()
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('exam')
  const [activeTask, setActiveTask] = useState(0)
  const [essays, setEssays] = useState({}) // { taskId: text }
  const [results, setResults] = useState({}) // { taskId: result }
  const [submittedTaskIds, setSubmittedTaskIds] = useState([]) // task đã nộp (kể cả phiên trước)
  const [submitting, setSubmitting] = useState(false)
  const [gradingTask, setGradingTask] = useState(null)
  const [gradingErrors, setGradingErrors] = useState({})
  const [retryingTask, setRetryingTask] = useState(null)
  const [confirmResubmitId, setConfirmResubmitId] = useState(null) // taskId đang chờ xác nhận "Nộp lại"
  const [hasPastResults, setHasPastResults] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WRITING_TIME)
  const [lightbox, setLightbox] = useState(null)
  const [fullTestStatus, setFullTestStatus] = useState(null)
  const pollTimerRef = useRef(null)

  // ── Hết giờ → tự động nộp ──────────────────────────────────────────────────
  const [timeUp, setTimeUp] = useState(false)
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(5)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoSubmitError, setAutoSubmitError] = useState(false)
  const autoSubmitDoneRef = useRef(false)

  // ── Layout mobile ──────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('prompt') // 'prompt' | 'writing'
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const writingTasks = exam?.writingTasks || []
  const allSubmitted = writingTasks.length > 0 && writingTasks.every(t => results[t.id])
  const isTaskDone = (tid) => isTaskComplete(tid, results, submittedTaskIds)

  const [lastSavedAt, setLastSavedAt] = useState(null) // mốc lưu nháp gần nhất — cho indicator header

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ── Autosave draft ─────────────────────────────────────────────────────────
  // Khai báo persistDraftNow TRƯỚC mọi chỗ dùng nó bên dưới (beforeunload effect,
  // useBrowserHistoryGuard) — const bị TDZ nếu tham chiếu trước khi khai báo.
  const autosaveRef = useRef(null)
  useEffect(() => {
    autosaveRef.current = {
      essays, submittedTaskIds, timeLeft,
      userId: user ? (user.id || user._id) : null,
    }
  })
  const persistDraftNow = useCallback(() => {
    const { essays, submittedTaskIds, timeLeft, userId } = autosaveRef.current
    if (!userId || !id) return
    const data = { essays, submittedTaskIds }
    // P3-2: đừng để data rỗng ghi đè một draft cũ không rỗng
    if (isDataEmpty(data)) {
      const existing = loadDraft(userId, id, 'writing')
      if (existing && !isDataEmpty(existing.data)) return
    }
    saveDraft({ userId, examId: id, skillType: 'writing', data, timeRemaining: timeLeft })
    setLastSavedAt(new Date())
  }, [id])
  useEffect(() => {
    if (phase !== 'exam') return
    const interval = setInterval(persistDraftNow, 30000)
    return () => clearInterval(interval)
  }, [phase, id, persistDraftNow])

  // Cảnh báo trình duyệt (beforeunload) khi thí sinh đóng tab/F5 trong lúc làm bài
  useEffect(() => {
    if (phase !== 'exam' || allSubmitted) return
    const handleBeforeUnload = (e) => {
      persistDraftNow()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase, allSubmitted, persistDraftNow])

  const exitPath = exam?.seriesId ? `/full-test/${exam.seriesId}?book=${exam.bookNumber}` : '/writing-samples'
  const { showModal: showExitModal, stay: stayInExam, leave: leaveExam } = useBrowserHistoryGuard(phase === 'exam' && !allSubmitted, persistDraftNow, exitPath)

  // Khi đã nộp hết cả 2 task (hoặc bài chỉ có 1 task và đã nộp) → clear draft
  useEffect(() => {
    if (!allSubmitted) return
    if (user) clearDraft(user.id || user._id, id, 'writing')
  }, [allSubmitted, user, id])

  const loadExam = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminSettings()
      .then(settings => {
        const mins = parseInt(settings.writing_time)
        if (!isNaN(mins) && mins > 0) { setTimeLeft(mins * 60) }
      })
      .catch(() => {})
    Promise.all([
      getWritingExam(id),
      getWritingMyResults(id, viewAttemptId).catch(() => []),
    ])
      .then(([data, myResults]) => {
        setExam(data)

        let draftEssays = null
        let draftIds = []
        let activeDraft = false
        if (user) {
          const userId = user.id || user._id
          const draft = loadDraft(userId, id, 'writing')
          // Cho phép resume tự động nếu có draft, kể cả không có ?resume=true
          if (draft?.data && !isDataEmpty(draft.data)) {
            draftEssays = draft.data.essays || {}
            draftIds = Array.isArray(draft.data.submittedTaskIds) ? draft.data.submittedTaskIds : []
            activeDraft = true
            setEssays(draftEssays)
            setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...draftIds])))
            if (draft.timeRemaining != null) setTimeLeft(draft.timeRemaining)
            if (draft.savedAt) setLastSavedAt(new Date(draft.savedAt))
          }
        }

        const restoredResults = {}
        const restoredIds = []
        const restoredErrors = {}
        if (Array.isArray(myResults)) {
          if (myResults.length > 0) setHasPastResults(true)
          for (const entry of myResults) {
            if (!entry || entry.taskId == null) continue
            // NẾU KHÔNG ở chế độ xem lại (viewResultMode),
            // CHỈ khôi phục kết quả của những task nằm trong draft (thuộc attempt hiện tại đang làm dở).
            // Nếu không có draft, bỏ qua toàn bộ kết quả cũ.
            if (!viewResultMode && (!activeDraft || !draftIds.includes(entry.taskId))) continue;

            if (entry.status === 'graded') {
              restoredResults[entry.taskId] = entry
              restoredIds.push(entry.taskId)
            } else if (entry.status === 'failed') {
              restoredErrors[entry.taskId] = { error: entry.error, answerId: entry.answerId }
            }
          }
        }
        if (restoredIds.length > 0) {
          setResults(prev => ({ ...restoredResults, ...prev }))
          setSubmittedTaskIds(prev => Array.from(new Set([...prev, ...restoredIds])))
        }
        if (Object.keys(restoredErrors).length > 0) {
          setGradingErrors(prev => ({ ...restoredErrors, ...prev }))
        }
        
        setPhase('exam')
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Không tìm thấy đề thi hoặc kết nối bị gián đoạn.')
      })
      .finally(() => setLoading(false))
  }, [id, resumeMode, user, viewAttemptId])

  useEffect(() => {
    document.title = 'Bài thi Writing | IELTS Pro'
    loadExam()
  }, [loadExam])

  useEffect(() => {
    if (!exam) return
    const allTasksDone = exam.writingTasks.every(t => results[t.id])
    if (allTasksDone && exam.writingTasks.length > 0) {
      getFullTestStatus(id)
        .then(data => { if (data.isComplete) setFullTestStatus(data) })
        .catch(() => {})
    }
  }, [results, exam])

  const handleBack = () => {
    if (exam?.seriesId) {
      navigate(`/full-test/${exam.seriesId}?book=${exam.bookNumber}`)
    } else {
      navigate('/writing')
    }
  }

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timeLeft])

  // Đồng hồ chạm 0 giữa lúc thi → lưu bản nháp cuối + bật modal chặn (một lần).
  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0) return
    if (timeUp || autoSubmitting || allSubmitted || autoSubmitDoneRef.current) return
    persistDraftNow()
    setTimeUp(true)
  }, [phase, timeLeft, timeUp, autoSubmitting, allSubmitted, persistDraftNow])


  // Đồng bộ mobileView theo task đang xem: đổi task → về 'prompt' (đọc đề trước);
  // task đã nộp / đang chấm → ép 'writing' để thấy card trạng thái thay vì bị che.
  // Deps KHÔNG có `essays` → gõ bài không làm effect chạy lại → toggle tay giữ nguyên.
  useEffect(() => {
    if (!exam) return
    const t = exam.writingTasks[activeTask]
    if (!t) return
    const done = !!results[t.id] || submittedTaskIds.includes(t.id)
    setMobileView(done || gradingTask === t.id ? 'writing' : 'prompt')
  }, [exam, activeTask, results, submittedTaskIds, gradingTask])

  const setEssay = (taskId, text) => setEssays(e => ({ ...e, [taskId]: text }))

  const clearTaskError = (taskId) => setGradingErrors(prev => {
    if (!(taskId in prev)) return prev
    const next = { ...prev }
    delete next[taskId]
    return next
  })

  const pollStatus = async (answerId, task, pollCount = 0) => {
    if (pollCount >= 60) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: 'Hết thời gian chờ chấm bài (90 giây). Vui lòng thử lại.', answerId } }))
      setGradingTask(null)
      setRetryingTask(null)
      return
    }

    try {
      const res = await getWritingStatus(answerId)
      if (res.status === 'graded') {
        setResults(prev => ({ ...prev, [task.id]: res }))
        setGradingTask(null)
        setRetryingTask(null)
        clearTaskError(task.id)
      } else if (res.status === 'failed') {
        setGradingErrors(prev => ({ ...prev, [task.id]: { error: res.error || 'Lỗi chấm bài AI', answerId: res.answerId ?? answerId } }))
        setGradingTask(null)
        setRetryingTask(null)
      } else {
        // Still pending or grading
        pollTimerRef.current = setTimeout(() => pollStatus(answerId, task, pollCount + 1), 1500)
      }
    } catch (err) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: err.response?.data?.message || 'Lỗi kiểm tra kết quả chấm', answerId } }))
      setGradingTask(null)
      setRetryingTask(null)
    }
  }

  const submitTask = async (task) => {
    const essay = essays[task.id] || ''
    if (wc(essay) < 50) { showToast('Bài viết cần ít nhất 50 từ!', 'error'); return }
    setSubmitting(true)
    clearTaskError(task.id)
    setGradingTask(task.id)
    try {
      const r = await submitWritingExam(id, task.id, essay)
      setSubmittedTaskIds(ids => ids.includes(task.id) ? ids : [...ids, task.id])
      
      const currentIndex = exam.writingTasks.findIndex(t => t.id === task.id)
      if (currentIndex >= 0 && currentIndex < exam.writingTasks.length - 1) {
        setActiveTask(currentIndex + 1)
      }
      
      setSubmitting(false) // Release global submitting lock immediately

      if (r.answerId && r.status === 'pending') {
        pollStatus(r.answerId, task)
      } else {
        setResults(prev => ({ ...prev, [task.id]: r }))
        setGradingTask(null)
      }
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: e.response?.data?.message || 'Lỗi nộp bài, thử lại nhé!' } }))
      setSubmitting(false)
      setGradingTask(null)
    }
  }

  // Chấm lại bài ĐÃ nộp (status='failed') từ essayText đã lưu — không cần viết lại.
  // Khác handleResubmit (Task 3): dùng khi lỗi hạ tầng AI, không phải muốn đổi nội dung.
  const retryTask = async (task) => {
    const entry = gradingErrors[task.id]
    if (!entry?.answerId || retryingTask) return
    setRetryingTask(task.id)
    setSubmitting(true)
    clearTaskError(task.id)
    setGradingTask(task.id)
    try {
      const r = await retryWritingGrading(entry.answerId)
      setSubmitting(false)
      pollStatus(r.answerId, task)
    } catch (e) {
      setGradingErrors(prev => ({ ...prev, [task.id]: { error: e.response?.data?.message || 'Lỗi chấm lại, thử lại nhé!', answerId: entry.answerId } }))
      setSubmitting(false)
      setGradingTask(null)
      setRetryingTask(null)
    }
  }

  // ── Auto-submit khi hết giờ ────────────────────────────────────────────────
  // Nộp mọi task chưa hoàn thành với cờ autoSubmit (backend bỏ qua gate 50 từ;
  // bài rỗng/quá ngắn → band 0 trả về ngay, không qua Groq). Tái dùng pollStatus
  // cho task ≥ 50 từ. Task đã xong (isTaskDone) không bị đụng. Chạy đúng 1 lần.
  const runAutoSubmit = useCallback(async () => {
    if (autoSubmitDoneRef.current) return
    autoSubmitDoneRef.current = true
    setTimeUp(false)
    setAutoSubmitError(false)
    setAutoSubmitting(true)
    persistDraftNow()
    for (const t of (exam?.writingTasks || [])) {
      if (isTaskComplete(t.id, results, submittedTaskIds)) continue
      try {
        const r = await submitWritingExam(id, t.id, essays[t.id] || '', true)
        setSubmittedTaskIds(ids => ids.includes(t.id) ? ids : [...ids, t.id])
        if (r.answerId && r.status === 'pending') {
          pollStatus(r.answerId, t)
        } else {
          setResults(prev => ({ ...prev, [t.id]: r }))
        }
      } catch {
        autoSubmitDoneRef.current = false // cho phép bấm "Thử lại"
        setAutoSubmitError(true)
      }
    }
  }, [exam, results, submittedTaskIds, essays, id, persistDraftNow])

  // Đếm ngược 5s trong modal hết giờ → tự kích hoạt nộp nếu user không bấm.
  // Tick + gọi runAutoSubmit đều nằm trong callback của interval (bất đồng bộ) để
  // không setState đồng bộ trong effect. Countdown luôn bắt đầu từ 5.
  useEffect(() => {
    if (!timeUp) return
    let n = 5
    const iv = setInterval(() => {
      n -= 1
      setAutoSubmitCountdown(n)
      if (n <= 0) { clearInterval(iv); runAutoSubmit() }
    }, 1000)
    return () => clearInterval(iv)
  }, [timeUp, runAutoSubmit])

  if (loading) return <SkeletonExamPage />
  if (error || !exam) {
    return (
      <ExamErrorState
        title="Không thể tải đề thi Writing"
        message={error || 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ bỏ.'}
        onRetry={loadExam}
        onBack={handleBack}
        backLabel="Quay lại danh sách"
      />
    )
  }

  const allDone = exam.writingTasks.every(t => results[t.id])


  // ── Result ────────────────────────────────────────────────────
  if (allDone || (viewAttemptId && exam.writingTasks.some(t => results[t.id]))) {
    const taskScores = exam.writingTasks.map(t => results[t.id]?.overall).filter(s => s != null)
    const avg = taskScores.length > 0 ? taskScores.reduce((a, b) => a + b, 0) / taskScores.length : 0
    const overallBand = Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2
    return (
      <div className="min-h-screen bg-zinc-50/50 text-zinc-600 font-sans">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3 flex items-center">
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <p className="font-bold text-sm text-zinc-900 m-0">
              Kết quả Writing — AI chấm bài
            </p>
            <p className="text-xs text-zinc-500 m-0">
              {exam.title}
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Đóng"
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold cursor-pointer flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
          <div className="flex flex-col gap-8">
            
            {/* ── Score Card Hero Section ── */}
            <div className="w-full max-w-6xl mx-auto rounded-[26px] border border-[#BFDBFE] bg-[#E0EDFF] p-6 sm:p-7 shadow-xs mb-8">
              {/* Row 1: Header (FULL TEST + Date on left, Retake button on right) */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3.5">
                  <span className="text-[#1D4ED8] font-bold text-sm tracking-wider uppercase">
                    FULL TEST
                  </span>
                  <span className="text-zinc-600 text-xs font-medium">
                    {(() => {
                      const firstResult = Object.values(results)[0];
                      const testDate = firstResult?.createdAt ? new Date(firstResult.createdAt) : new Date();
                      return testDate.toISOString().slice(0, 10) + ' | ' + testDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    })()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (user) {
                      clearDraft(user.id || user._id, id, 'writing')
                      saveDraft({
                        userId: user.id || user._id,
                        examId: id,
                        skillType: 'writing',
                        data: { essays: {}, submittedTaskIds: [], isRetake: true },
                        timeRemaining: DEFAULT_WRITING_TIME
                      })
                    }
                    window.location.href = window.location.pathname
                  }}
                  className="h-9 px-5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200/90 text-zinc-700 text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Thi lại</span>
                </button>
              </div>

              {/* Row 2: Big Overall Circle + Per-Task Scores */}
              <div className="flex items-center gap-5 sm:gap-7 mb-6">
                <div className="flex flex-col items-center shrink-0">
                  <div className={"w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-[26px] shadow-xs " + getHeroCircleClass(overallBand)}>
                    {overallBand}
                  </div>
                  {overallBand !== '–' && (
                    <span
                      className="text-[11px] text-zinc-500 font-medium cursor-help mt-1 leading-none text-center select-none"
                      title="Điểm do AI ước lượng, có thể chênh khoảng ±0.5 so với giám khảo thật."
                    >
                      ±0.5
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-5 sm:gap-7">
                  {exam.writingTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5">
                      <span className="text-xs sm:text-[13px] font-bold text-[#1D4ED8] tracking-wider uppercase">
                        TASK {t.number}
                      </span>
                      <div className="flex flex-col items-center">
                        <span className={"px-3.5 py-0.5 rounded-full text-xs sm:text-[13px] font-extrabold shadow-2xs " + getHeroBadgeClass(results[t.id]?.overall)}>
                          {results[t.id]?.overall ?? '–'}
                        </span>
                        {results[t.id]?.overall != null && results[t.id]?.overall !== '–' && (
                          <span
                            className="text-[10px] text-zinc-500 font-medium cursor-help mt-1 leading-none text-center select-none"
                            title="Điểm do AI ước lượng, có thể chênh khoảng ±0.5 so với giám khảo thật."
                          >
                            ±0.5
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: 4 Criteria White Pill Badges */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {(() => {
                  let totalTA = 0, totalCC = 0, totalLR = 0, totalGRA = 0;
                  let weightSum = 0;
                  exam.writingTasks.forEach(t => {
                     const r = results[t.id];
                     if (r && r.criteria) {
                        const weight = t.number === 2 ? 2 : 1;
                        totalTA += parseFloat(r.criteria.task_achievement?.score || 0) * weight;
                        totalCC += parseFloat(r.criteria.coherence_cohesion?.score || 0) * weight;
                        totalLR += parseFloat(r.criteria.lexical_resource?.score || 0) * weight;
                        totalGRA += parseFloat(r.criteria.grammatical_range?.score || 0) * weight;
                        weightSum += weight;
                     }
                  });
                  const avgTA = weightSum > 0 ? roundIeltsScore(totalTA / weightSum) : '–';
                  const avgCC = weightSum > 0 ? roundIeltsScore(totalCC / weightSum) : '–';
                  const avgLR = weightSum > 0 ? roundIeltsScore(totalLR / weightSum) : '–';
                  const avgGRA = weightSum > 0 ? roundIeltsScore(totalGRA / weightSum) : '–';
                  return (
                    <>
                      <span className="bg-white text-zinc-800 border border-zinc-200/80 px-4 py-1.5 rounded-full text-[13px] font-semibold shadow-2xs">
                        Task Achievement: {avgTA}
                      </span>
                      <span className="bg-white text-zinc-800 border border-zinc-200/80 px-4 py-1.5 rounded-full text-[13px] font-semibold shadow-2xs">
                        Coherence & Cohesion: {avgCC}
                      </span>
                      <span className="bg-white text-zinc-800 border border-zinc-200/80 px-4 py-1.5 rounded-full text-[13px] font-semibold shadow-2xs">
                        Lexical Resource: {avgLR}
                      </span>
                      <span className="bg-white text-zinc-800 border border-zinc-200/80 px-4 py-1.5 rounded-full text-[13px] font-semibold shadow-2xs">
                        Grammatical Range: {avgGRA}
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>
            {/* Per-task results */}
            {exam.writingTasks.map(task => {
              const r = results[task.id];
              const isCompleted = r && r.essayText && r.status === 'graded';
              
              const handleRetake = () => {
                if (user) {
                  clearDraft(user.id || user._id, id, 'writing')
                  saveDraft({
                    userId: user.id || user._id,
                    examId: id,
                    skillType: 'writing',
                    data: { essays: {}, submittedTaskIds: [], isRetake: true },
                    timeRemaining: DEFAULT_WRITING_TIME
                  })
                }
                window.location.href = window.location.pathname
              };

              return (
                <WritingTaskAccordion 
                  key={task.id} 
                  task={task} 
                  r={r} 
                  isCompleted={isCompleted} 
                  onRetake={handleRetake} 
                />
              )
            })}

          </div>
        </div>
      </div>
    )
  }

  // ── Exam ──────────────────────────────────────────────────────
  const task = exam.writingTasks[activeTask]
  const taskEssay = essays[task.id] || ''
  const words = wc(taskEssay)
  const minWords = task.minWords || (task.number === 1 ? 150 : 250)
  const taskDone = isTaskDone(task.id)
  const taskGradingError = gradingErrors[task.id] || null

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-zinc-50/50">
      {/* Header */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
            {exam.title}
          </span>
          {hasPastResults && !viewResultMode && !allDone && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.set('viewResult', 'true')
                navigate(`?${params.toString()}`, { replace: true })
                window.location.reload()
              }}
              className="ml-2 h-7 px-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <History className="w-3 h-3" />
              Xem kết quả cũ
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`tabular-nums text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              timeLeft < 300
                ? 'text-red-600 bg-red-50 border-red-200'
                : timeLeft < 600
                ? 'text-amber-600 bg-amber-50 border-amber-200'
                : 'text-zinc-700 bg-zinc-100 border-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {fmt(timeLeft)}
          </div>
        </div>
      </header>

      {/* Mobile view toggle — chỉ render trên mobile; state riêng, không đụng activeTask */}
      {isMobile && (
        <div className="flex flex-shrink-0 border-b border-zinc-200 bg-white">
          <button
            onClick={() => setMobileView('prompt')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'prompt' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Đề bài
          </button>
          <button
            onClick={() => setMobileView('writing')}
            className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${mobileView === 'writing' ? 'border-zinc-900 text-zinc-900 bg-zinc-100' : 'border-transparent text-zinc-500'}`}
          >
            Bài viết · {words} từ
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task prompt */}
        <div className={`overflow-y-auto bg-white p-6 border-r border-zinc-200 flex flex-col gap-5 ${isMobile ? (mobileView === 'prompt' ? 'w-full' : 'hidden') : 'w-2/5'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-bold text-sm flex items-center justify-center">{task.number}</div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Task {task.number}</span>
          </div>
          {task.imageUrl && (
            <div
              onClick={() => setLightbox(toImgSrc(task.imageUrl))}
              className="relative cursor-pointer inline-block w-full group border border-zinc-200 rounded-2xl overflow-hidden"
            >
              <img src={toImgSrc(task.imageUrl)} alt={`Hình ảnh minh họa Task ${task.number}`} className="w-full" />
              <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Phóng to
              </div>
            </div>
          )}
          {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
          <p className="text-zinc-700 text-sm leading-relaxed m-0 font-medium whitespace-pre-line">{task.prompt}</p>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Tối thiểu <span className="font-bold text-zinc-600">{minWords} từ</span></span>
            <span>Khuyến nghị: {task.number === 1 ? '20 phút' : '40 phút'}</span>
          </div>
        </div>

        {/* Right: Essay area */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-zinc-50/50 p-8 ${isMobile && mobileView !== 'writing' ? 'hidden' : ''}`}>
          {taskGradingError?.answerId && !results[task.id] ? (
            // Đã nộp NHƯNG bản chấm mới nhất bị lỗi (vd. model AI đổi/timeout) — vẫn còn
            // essayText đã lưu, cho chấm lại tại chỗ thay vì hiện "đã nộp" giả hoặc treo mãi.
            <div className="flex-1 bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full self-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-900 text-lg mb-1">Chấm bài Task {task.number} không thành công</p>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">{taskGradingError.error}</p>
              <button
                onClick={() => retryTask(task)}
                disabled={retryingTask === task.id}
                className="btn-primary h-9 px-4 rounded-full text-xs sm:text-sm font-medium shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {retryingTask === task.id ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Đang chấm lại...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Thử chấm điểm lại
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {taskGradingError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm shrink-0">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    Nộp bài không thành công: {taskGradingError.error}
                  </span>
                  <button
                    onClick={() => submitTask(task)}
                    className="exam-bar-btn ml-3 h-8 px-3.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử nộp lại
                  </button>
                </div>
              )}
              
              {/* Thông báo nhè nhẹ nếu đang chấm hoặc đã nộp ở góc trên của editor */}
              {(gradingTask === task.id || taskDone) && (
                <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shrink-0 ${taskDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {taskDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Task {task.number} đã được nộp! Kết quả chi tiết từ AI sẽ hiển thị sau khi hoàn thành tất cả các tasks.
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
                      AI đang chấm bài Task {task.number}... Vui lòng làm tiếp các task khác.
                    </>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden flex-1 flex flex-col">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bài viết Task {task.number}</span>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${words >= minWords ? 'bg-zinc-900 text-white' : words > 0 ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-500'}`}>
                    {words}/{minWords} từ
                  </span>
                </div>
                <textarea
                  className={`flex-1 p-8 text-zinc-800 text-sm leading-relaxed resize-none focus:outline-none font-normal ${(taskDone || gradingTask === task.id) ? 'bg-zinc-50/80 cursor-not-allowed opacity-80' : 'bg-white'}`}
                  placeholder={`Bắt đầu viết Task ${task.number} tại đây...`}
                  value={taskEssay}
                  readOnly={taskDone || gradingTask === task.id}
                  onChange={e => setEssay(task.id, e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-14 px-6 bg-white border-t border-zinc-200 flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Left/Middle: Task palette */}
        <div className="flex items-center gap-2">
          {exam.writingTasks.map((t, i) => {
            const done = isTaskDone(t.id)
            const active = activeTask === i
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTask(i)}
                className={`exam-bar-btn shrink-0 whitespace-nowrap h-9 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 leading-none transition-all cursor-pointer ${
                  done
                    ? 'bg-zinc-900 text-white border border-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 bg-white hover:border-zinc-400'
                } ${active ? 'ring-2 ring-zinc-900/20 font-semibold' : ''}`}
              >
                <span>Task {t.number}</span>
                {done && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            )
          })}
        </div>

        {/* Right: Submit button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => submitTask(task)}
            disabled={submitting || words < 50 || taskDone}
            className="exam-bar-btn whitespace-nowrap bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium h-9 px-5 rounded-full shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 leading-none"
          >
            {submitting ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Đang chấm điểm...
              </>
            ) : taskDone ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã nộp Task {task.number}
              </>
            ) : (
              `Nộp Task ${task.number}`
            )}
          </button>
        </div>
      </div>


      {/* Modal hết giờ — CHẶN, không đóng được bằng ESC / click nền */}
      {timeUp && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3 text-zinc-700">
              <Clock className="w-6 h-6 stroke-[2]" />
            </div>
            <h2 className="text-zinc-900 text-lg font-bold mb-2">Hết giờ làm bài</h2>
            <p className="text-zinc-600 text-sm leading-relaxed mb-6">
              Hệ thống sẽ nộp {countUnsubmitted(exam.writingTasks, results, submittedTaskIds)} task chưa hoàn thành của bạn.
            </p>
            <button
              onClick={() => runAutoSubmit()}
              className="w-full h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer font-medium text-sm inline-flex items-center justify-center leading-none"
            >
              Nộp bài ngay
            </button>
            <p className="text-zinc-400 text-xs mt-3">Tự động nộp sau {autoSubmitCountdown}s</p>
          </div>
        </div>
      )}

      {/* Overlay đang nộp & chấm — đè lên nhánh exam cho tới khi allDone */}
      {autoSubmitting && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
            {autoSubmitError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-600">
                  <AlertCircle className="w-6 h-6 stroke-[2]" />
                </div>
                <h2 className="text-zinc-900 text-lg font-bold mb-2">Nộp bài chưa hoàn tất</h2>
                <p className="text-zinc-600 text-sm leading-relaxed mb-6">Một số task chưa nộp được. Vui lòng thử lại.</p>
                <button
                  onClick={() => runAutoSubmit()}
                  className="w-full h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-colors cursor-pointer font-medium text-sm inline-flex items-center justify-center leading-none"
                >
                  Thử lại
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
                <h2 className="text-zinc-900 text-lg font-bold mb-2">Đang nộp &amp; chấm bài…</h2>
                <p className="text-zinc-600 text-sm leading-relaxed">Vui lòng chờ trong giây lát.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Exit confirmation modal — Back nút trình duyệt hoặc nút Header */}
      <ExitConfirmModal open={showExitModal} onStay={stayInExam} onLeave={() => leaveExam(exitPath)} />

      {/* Loading overlay khi nộp bài */}
      {(() => {
        const uncompletedCount = exam.writingTasks.filter(t => !isTaskComplete(t.id, results, submittedTaskIds)).length;
        const isSubmittingLastTask = submitting && uncompletedCount === 1;
        const hasGradingError = exam.writingTasks.some(t => gradingErrors[t.id]);
        const isPollingFinalResults = uncompletedCount === 0 && !allDone && !hasGradingError;
        if (isSubmittingLastTask || isPollingFinalResults) {
          return (
            <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-3 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <p className="text-sm font-medium text-zinc-700">Đang chấm điểm và tổng hợp kết quả...</p>
            </div>
          )
        }
        return null;
      })()}
    </div>
  )
}