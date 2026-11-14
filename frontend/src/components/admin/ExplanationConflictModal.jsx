import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'

export default function ExplanationConflictModal({ isOpen, onClose, conflicts = [], onConfirmResolve, isSubmitting = false }) {
  const [choices, setChoices] = useState({})
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (isOpen) setChoices(Object.fromEntries(conflicts.map(row => [row.number, 'ai'])))
  }, [isOpen, conflicts])
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement
    dialogRef.current?.querySelector('input:checked')?.focus()
    return () => {
      if (previous?.isConnected && previous !== document.body) previous.focus()
      else document.querySelector(`[data-explanation-question="${Number(conflicts[0]?.number)}"]`)?.focus()
    }
  }, [isOpen, conflicts])
  if (!isOpen || !conflicts.length) return null
  const handleKeyDown = event => {
    if (event.key === 'Escape' && !isSubmitting) { event.stopPropagation(); onClose() }
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), summary')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={event => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <h3 id={titleId} className="m-0 text-base font-semibold text-zinc-900">Xác nhận đáp án ({conflicts.length} câu)</h3>
            <p className="mt-1 mb-0 text-xs leading-relaxed text-zinc-600">AI đề xuất đáp án khác đề. Đối chiếu và chọn đáp án muốn giữ.</p>
          </div>
          <button type="button" aria-label="Đóng xác nhận đáp án" onClick={onClose} disabled={isSubmitting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 disabled:opacity-50 cursor-pointer">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-200">
          {conflicts.map(row => <fieldset key={row.number} className="min-w-0 border-0 px-0 py-4">
            <legend className="float-left mb-2 w-full text-sm font-semibold text-zinc-900">Câu {row.number}</legend>
            {row.questionText && <p className="clear-both mt-0 mb-3 text-sm text-zinc-700 break-words">{row.questionText}</p>}
            <div className="clear-both grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[['input', 'Giữ đáp án đề', row.inputAnswer || 'Chưa có'], ['ai', 'Dùng đáp án AI', row.aiAnswer]].map(([value, label, answer]) =>
                <label key={value} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3 focus-within:outline-2 focus-within:outline-offset-2 ${
                  (choices[row.number] || 'ai') === value ? 'border-zinc-700 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'}`}>
                  <input type="radio" name={`answer-${titleId}-${row.number}`} value={value} checked={(choices[row.number] || 'ai') === value}
                    disabled={isSubmitting} onChange={() => setChoices(previous => ({ ...previous, [row.number]: value }))}
                    className="mt-0.5 accent-zinc-900" />
                  <span className="min-w-0 text-xs text-zinc-600">{label}<strong className="mt-1 block text-sm font-semibold text-zinc-900 break-words">{answer}</strong></span>
                </label>)}
            </div>
            {(row.evidence || row.teacher_note || row.reasoning) && <details className="mt-3 text-xs text-zinc-600">
              <summary className="min-h-9 cursor-pointer font-medium focus-visible:outline-2">Xem dẫn chứng và lý do</summary>
              {row.evidence && <blockquote className="mx-0 my-2 break-words leading-relaxed">“{row.evidence}”</blockquote>}
              {(row.teacher_note || row.reasoning) && <p className="mb-0 break-words leading-relaxed">{row.teacher_note || row.reasoning}</p>}
            </details>}
          </fieldset>)}
        </div>
        <div className="border-t border-zinc-200 pt-4">
          <p className="mt-0 mb-3 text-xs leading-relaxed text-zinc-600">Dùng đáp án AI sẽ đổi đáp án trong đề. Nếu giữ đáp án đề mà bằng chứng chưa phù hợp, lời giải sẽ được đánh dấu cần kiểm tra.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="min-h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 disabled:opacity-50 cursor-pointer">Hủy bỏ</button>
            <button type="button" disabled={isSubmitting} onClick={() => onConfirmResolve(Object.fromEntries(conflicts.map(row => [row.number, choices[row.number] || 'ai'])))}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer">
              {isSubmitting && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}
              {isSubmitting ? 'Đang lưu…' : 'Xác nhận & Lưu giải thích'}
            </button>
          </div>
        </div>
      </div>
    </div>, document.body,
  )
}
