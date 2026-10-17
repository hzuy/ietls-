import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, X, BookOpen, Loader2, Lightbulb } from 'lucide-react'

export default function ExplanationConflictModal({
  isOpen,
  onClose,
  conflicts = [],
  onConfirmResolve,
  isSubmitting = false,
}) {
  // choices: { [qNumber]: 'ai' | 'input' }
  const [choices, setChoices] = useState(() => {
    const init = {}
    conflicts.forEach(c => {
      init[c.number] = 'ai' // Default to AI's recommendation for convenience
    })
    return init
  })

  useEffect(() => {
    if (conflicts && conflicts.length) {
      const init = {}
      conflicts.forEach(c => {
        init[c.number] = 'ai'
      })
      setChoices(init)
    }
  }, [conflicts])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !conflicts.length) return null

  const setChoiceFor = (qNum, val) => {
    setChoices(prev => ({ ...prev, [qNum]: val }))
  }

  const handleApply = () => {
    onConfirmResolve(choices)
  }

  const modalElement = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl relative border border-zinc-100 flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">
                Phát hiện lệch đáp án ({conflicts.length} câu)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Hệ thống phát hiện dẫn chứng trong bài đọc không khớp với đáp án hiện tại. <span className="text-amber-700 font-semibold">Lưu ý: Chọn &quot;Cập nhật theo AI&quot; sẽ thay đổi đáp án đúng của câu trong đề thi.</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflicts List */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {conflicts.map((c) => {
            const currentChoice = choices[c.number] || 'ai'
            return (
              <div
                key={c.number}
                className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50/60 flex flex-col gap-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white">
                    Câu {c.number}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    {c.type}
                  </span>
                </div>

                {c.questionText && (
                  <p className="text-xs sm:text-sm font-medium text-zinc-800">
                    {c.questionText}
                  </p>
                )}

                {/* Compare answers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Human Input */}
                  <div
                    onClick={() => setChoiceFor(c.number, 'input')}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      currentChoice === 'input'
                        ? 'border-zinc-900 bg-white shadow-xs'
                        : 'border-zinc-200 bg-white/70 hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                        Đáp án bạn đã nhập:
                      </span>
                      <p className="text-sm font-bold text-zinc-900 mt-1 break-words">
                        {c.inputAnswer || '(Chưa nhập)'}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${currentChoice === 'input' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300'}`}>
                        {currentChoice === 'input' && <Check className="w-3 h-3" />}
                      </span>
                      Giữ đáp án này
                    </div>
                  </div>

                  {/* AI Recommendation */}
                  <div
                    onClick={() => setChoiceFor(c.number, 'ai')}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      currentChoice === 'ai'
                        ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                        : 'border-zinc-200 bg-white/70 hover:border-blue-200'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Đáp án gợi ý:
                      </span>
                      <p className="text-sm font-bold text-blue-900 mt-1 break-words">
                        {c.aiAnswer}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${currentChoice === 'ai' ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-300'}`}>
                        {currentChoice === 'ai' && <Check className="w-3 h-3" />}
                      </span>
                      Cập nhật theo AI
                    </div>
                    <span className="text-[11px] text-amber-700 font-medium mt-1">
                      (Sẽ đổi đáp án đúng của câu thành &quot;{c.aiAnswer}&quot;)
                    </span>
                  </div>
                </div>

                {/* Evidence snippet */}
                {c.evidence && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                    <strong className="font-semibold block mb-0.5 text-amber-950 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> Dẫn chứng AI tìm thấy trong bài:
                    </strong>
                    “{c.evidence}”
                  </div>
                )}

                {/* AI Reasoning & Counter-argument */}
                {c.reasoning && (
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs text-blue-900 leading-relaxed">
                    <strong className="font-semibold block mb-0.5 text-blue-950 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-blue-600" /> Lập luận & Phản biện của AI:
                    </strong>
                    {c.reasoning}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
          >
            Huỷ bỏ
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSubmitting ? 'Đang lưu...' : 'Xác nhận & Lưu giải thích'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalElement, document.body)
    : modalElement
}
