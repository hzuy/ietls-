import { useState } from 'react'
import { ChevronDown, Sparkles, MapPin, AlertCircle } from 'lucide-react'

// Cấu trúc mới cho AI Explanation:
// {
//   paraphrasing: [{ questionWord: "...", passageWord: "..." }, ...],
//   step1_analysis: [{ type: "Subject", text: "...", color: "blue" }, ...],
//   evidence_locator: { passageIndex: 0, paragraphIndex: 2, textToHighlight: "..." },
//   traps: ["...", "..."],
//   detailed_explanation: "..."
// }

export default function ExplanationPanel({ reviewInfo, explanation: rawExplanation, onLocate }) {
  const [open, setOpen] = useState(false)
  
  const explanation = reviewInfo?.explanation || rawExplanation
  if (!explanation && !reviewInfo) return null
  
  const isNewFormat = explanation?.paraphrasing || explanation?.step1_analysis || explanation?.detailed_explanation
  
  return (
    <div className="w-full pl-8 sm:pl-10 pb-2">
      <div className="flex items-center flex-wrap gap-2 mt-1">
        {reviewInfo && (
          <div className="flex items-center gap-2 mr-2 bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-full shadow-xs">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              reviewInfo.status === 'correct' ? 'bg-green-100 text-green-700' :
              reviewInfo.status === 'missed' ? 'bg-zinc-200 text-zinc-600' :
              'bg-red-100 text-red-700'
            }`}>
              {reviewInfo.number ? `${reviewInfo.number}. ` : ''}
              {reviewInfo.status === 'correct' ? 'Đúng' : reviewInfo.status === 'missed' ? 'Chưa làm' : 'Sai'}
            </span>
            <div className="text-[11px] font-bold flex items-center gap-1.5">
               <span className={reviewInfo.status === 'correct' ? 'text-green-600' : reviewInfo.status === 'missed' ? 'text-zinc-400' : 'text-red-600 line-through'}>
                 {reviewInfo.userAnswer || '(Trống)'}
               </span>
               {reviewInfo.status !== 'correct' && (
                 <>
                   <span className="text-zinc-400">→</span>
                   <span className="text-green-600">{reviewInfo.correctAnswer}</span>
                 </>
               )}
            </div>
          </div>
        )}

        {explanation && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 cursor-pointer bg-transparent border-none px-0 py-0.5"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{open ? 'Ẩn giải thích' : 'Xem giải thích chi tiết'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}

        {isNewFormat && explanation.evidence_locator && (
          <button
            type="button"
            onClick={() => onLocate && onLocate(explanation.evidence_locator)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer shadow-2xs transition"
          >
            <MapPin className="w-3 h-3 text-indigo-500" />
            Định vị
          </button>
        )}
      </div>

      {open && (
        <div
          className="mt-2 mb-1 rounded-xl border p-4 flex flex-col gap-4 anim-fade-up shadow-2xs"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          {isNewFormat ? (
            <>
              {/* Phân tích cấu trúc câu hỏi */}
              {explanation.step1_analysis && explanation.step1_analysis.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Phân tích câu hỏi</p>
                  <div className="flex flex-wrap gap-2">
                    {explanation.step1_analysis.map((item, idx) => {
                      // Map color to tailwind classes
                      let colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      if (item.color === 'blue') colorClasses = 'bg-blue-50 text-blue-700 border-blue-200'
                      else if (item.color === 'green') colorClasses = 'bg-green-50 text-green-700 border-green-200'
                      else if (item.color === 'purple') colorClasses = 'bg-purple-50 text-purple-700 border-purple-200'
                      else if (item.color === 'orange') colorClasses = 'bg-orange-50 text-orange-700 border-orange-200'
                      
                      return (
                        <div key={idx} className={`border px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${colorClasses}`}>
                          <span className="opacity-70 text-[10px] uppercase font-bold">{item.type}:</span>
                          <span>{item.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Bảng Paraphrasing (Từ khóa) */}
              {explanation.paraphrasing && explanation.paraphrasing.length > 0 && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 overflow-hidden">
                  <div className="bg-indigo-100/50 px-3 py-1.5 border-b border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Từ khóa Paraphrase
                  </div>
                  <div className="p-3 grid gap-2">
                    {explanation.paraphrasing.map((pair, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 bg-white border border-zinc-200 rounded-full px-3 py-1 text-zinc-700 font-medium text-center truncate shadow-xs">
                          {pair.questionWord}
                        </span>
                        <span className="text-zinc-300 font-bold shrink-0">≈</span>
                        <span className="flex-1 bg-white border border-indigo-200 rounded-full px-3 py-1 text-indigo-700 font-medium text-center truncate shadow-xs">
                          {pair.passageWord}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phân tích Bẫy (Traps) */}
              {explanation.traps && explanation.traps.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Bẫy cần lưu ý
                  </p>
                  <ul className="m-0 pl-5 text-xs text-rose-800 space-y-1.5">
                    {explanation.traps.map((trap, idx) => (
                      <li key={idx} className="leading-relaxed">{trap}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Giải thích chi tiết */}
              {explanation.detailed_explanation && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Kết luận</p>
                  <p className="text-xs text-zinc-700 leading-relaxed m-0 whitespace-pre-wrap">
                    {explanation.detailed_explanation}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Chuẩn cũ (Listening / old data) */
            <>
              {[
                { key: 'restatement', label: 'Câu hỏi kiểm tra điều gì' },
                { key: 'evidence', label: 'Đối chiếu với đoạn văn / bài nghe', accent: true },
                { key: 'reasoning', label: 'Các bước suy luận' },
                { key: 'conclusion', label: 'Kết luận' },
              ].map(({ key, label, accent }) => {
                const text = explanation[key]
                if (!text) return null
                return (
                  <div
                    key={key}
                    className={accent ? 'rounded-lg px-2.5 py-2' : ''}
                    style={accent ? { background: 'var(--info-bg)', border: '1px solid var(--info-border)' } : undefined}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider m-0 mb-1"
                      style={{ color: accent ? 'var(--info-text)' : 'var(--subtle)' }}
                    >
                      {label}
                    </p>
                    <p className="text-xs leading-relaxed m-0" style={{ color: accent ? 'var(--info-text)' : 'var(--muted)' }}>
                      {text}
                    </p>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
