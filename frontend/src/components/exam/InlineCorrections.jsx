import { useEffect, useMemo, useRef, useState } from 'react'

const TYPE_LABELS = {
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  word_choice: 'Dùng từ',
  spelling: 'Chính tả',
  punctuation: 'Dấu câu',
  coherence: 'Mạch lạc',
}

function validCorrections(text, corrections) {
  if (!text || !Array.isArray(corrections)) return []
  const sorted = corrections
    .filter(c => Number.isInteger(c?.start) && Number.isInteger(c?.end) && c.start >= 0 && c.end <= text.length && c.end > c.start && text.slice(c.start, c.end) === c.original)
    .sort((a, b) => a.start - b.start)
  const out = []
  for (const c of sorted) {
    if (out.length && c.start < out[out.length - 1].end) continue
    out.push(c)
  }
  return out
}

export function CorrectionSummary({ count }) {
  if (!count) return null
  return (
    <p className="m-0 mb-3 text-xs text-zinc-500">
      Đã sửa <strong className="text-zinc-800">{count}</strong> lỗi. Bấm vào từng chỗ sửa để xem giải thích.
    </p>
  )
}

export default function InlineCorrections({ text, corrections, className = '' }) {
  const [openStart, setOpenStart] = useState(null)
  const [shift, setShift] = useState(0)
  const rootRef = useRef(null)
  const items = useMemo(() => validCorrections(text, corrections), [text, corrections])

  useEffect(() => {
    if (openStart == null) return
    const onDown = e => { if (!rootRef.current?.contains(e.target)) setOpenStart(null) }
    const onKey = e => { if (e.key === 'Escape') setOpenStart(null) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [openStart])

  const nodes = []
  let cursor = 0
  for (const c of items) {
    if (c.start > cursor) nodes.push(text.slice(cursor, c.start))
    const open = openStart === c.start
    const label = TYPE_LABELS[c.type] || 'Lỗi'
    nodes.push(
      <span key={c.start} className="relative">
        <button
          type="button"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const width = Math.min(288, window.innerWidth - 32)
            setShift(Math.min(0, window.innerWidth - 16 - (rect.left + width)))
            setOpenStart(open ? null : c.start)
          }}
          aria-expanded={open}
          aria-label={`${label}: sửa "${c.original}" thành "${c.corrected}"`}
          className="inline p-0 m-0 border-0 bg-transparent text-left cursor-pointer align-baseline"
          style={{ font: 'inherit', lineHeight: 'inherit' }}
        >
          <del className="rounded px-0.5 bg-red-100 text-red-700 decoration-red-500 decoration-2">{c.original}</del>
          {c.corrected && (
            <ins className="ml-1 rounded px-0.5 bg-emerald-100 text-emerald-800 no-underline">{c.corrected}</ins>
          )}
        </button>
        {open && (
          <span
            role="tooltip"
            style={{ left: shift }}
            className="absolute top-full z-30 mt-1.5 block w-72 max-w-[calc(100vw-32px)] rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg whitespace-normal"
          >
            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</span>
            <span className="mt-1 block text-sm leading-snug text-zinc-800">
              <del className="text-red-600">{c.original}</del>
              {c.corrected ? <> → <span className="font-semibold text-emerald-700">{c.corrected}</span></> : null}
            </span>
            {c.explanation && <span className="mt-1.5 block text-[13px] leading-relaxed text-zinc-600">{c.explanation}</span>}
          </span>
        )}
      </span>
    )
    cursor = c.end
  }
  if (cursor < (text || '').length) nodes.push(text.slice(cursor))

  return (
    <div ref={rootRef} className={`whitespace-pre-wrap ${className}`}>
      {nodes}
    </div>
  )
}
