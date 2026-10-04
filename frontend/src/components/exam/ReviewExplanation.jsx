import { X, Sparkles } from 'lucide-react'
import { findRange, normalizeText } from '../../utils/textMatch'

function StepCard({ index, total, title, children }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      <header className="flex items-center gap-3 mb-3">
        <span className="shrink-0 rounded-full bg-zinc-900 text-white text-[11px] font-bold tracking-wide px-2.5 py-1">
          STEP {String(index).padStart(2, '0')}
        </span>
        <h4 className="flex-1 min-w-0 font-semibold text-zinc-900 m-0" style={{ fontSize: 15 }}>{title}</h4>
        <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums">{index}/{total}</span>
      </header>
      <div className="flex flex-col gap-3 text-sm text-zinc-700 leading-relaxed">{children}</div>
    </section>
  )
}

function Chunk({ text, label, tone = 'default', highlight }) {
  const isBlank = tone === 'blank'
  let body = text
  if (highlight) {
    const range = findRange(text, highlight)
    if (range) {
      body = (
        <>
          {text.slice(0, range.start)}
          <span className="text-emerald-700 font-semibold underline decoration-emerald-500 decoration-2 underline-offset-4">
            {text.slice(range.start, range.end)}
          </span>
          {text.slice(range.end)}
        </>
      )
    }
  }
  return (
    <span className="inline-flex flex-col items-center gap-1 max-w-full align-bottom">
      {label && (
        <span
          className={`text-[11px] leading-tight px-1.5 py-0.5 rounded-md border text-center ${
            isBlank ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}
        >
          {label}
        </span>
      )}
      <span
        className={`px-2.5 py-1 rounded-full border text-sm text-zinc-900 break-words ${
          isBlank ? 'border-amber-300 bg-amber-50/60' : 'border-zinc-300 bg-white'
        }`}
      >
        {body}
      </span>
    </span>
  )
}

function Gap() {
  return <span className="self-end px-1 pb-1 text-zinc-400 text-sm select-none">(…)</span>
}

function ChunkRow({ children }) {
  return <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2.5">{children}</div>
}

function QuestionChunks({ chunks }) {
  return (
    <ChunkRow>
      {chunks.map((c, i) => (
        <Chunk key={i} text={c.text} label={c.label} tone={/_{2,}/.test(c.text) ? 'blank' : 'default'} />
      ))}
    </ChunkRow>
  )
}

function EvidencePart({ part, chunks, answer }) {
  const normPart = normalizeText(part.text)
  const placed = chunks
    .map(c => {
      const at = normPart.indexOf(normalizeText(c.text))
      return at === -1 ? null : { ...c, at, end: at + normalizeText(c.text).length }
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)

  if (!placed.length) {
    return <p className="m-0 italic text-zinc-600">“{part.text}”</p>
  }

  const nodes = []
  let cursor = 0
  placed.forEach((c, i) => {
    if (c.at < cursor) return
    if (normPart.slice(cursor, c.at).replace(/[\s,.;:]/g, '').length > 0) nodes.push(<Gap key={`g${i}`} />)
    nodes.push(<Chunk key={i} text={c.text} label={c.label} highlight={answer} />)
    cursor = c.end
  })
  if (normPart.slice(cursor).replace(/[\s,.;:]/g, '').length > 0) nodes.push(<Gap key="tail" />)
  return <ChunkRow>{nodes}</ChunkRow>
}

function ParagraphTag({ children }) {
  return (
    <span className="self-start inline-flex items-center rounded-md bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-semibold px-2 py-0.5">
      {children}
    </span>
  )
}

function V2Steps({ explanation: ex, paragraphLabel }) {
  const evidenceParts = ex.evidence?.parts || []
  const answer = ex.answer
  const steps = [
    {
      title: 'Phân tích câu hỏi và dự đoán',
      body: (
        <>
          {ex.question_chunks?.length > 0 && <QuestionChunks chunks={ex.question_chunks} />}
          <p className="m-0">{ex.predict}</p>
        </>
      ),
    },
    {
      title: 'Định vị thông tin liên quan',
      body: (
        <>
          {ex.locate?.note && <p className="m-0">{ex.locate.note}</p>}
          {(ex.locate?.paragraph != null || ex.locate?.keywords?.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {ex.locate?.paragraph != null && <ParagraphTag>{paragraphLabel(ex.locate.paragraph)}</ParagraphTag>}
              {(ex.locate?.keywords || []).map((k, i) => (
                <span key={i} className="text-zinc-900 font-medium">{k}</span>
              ))}
            </div>
          )}
        </>
      ),
    },
    {
      title: 'Đọc thông tin liên quan',
      body: evidenceParts.length > 0 ? (
        evidenceParts.map((part, pi) => (
          <div key={pi} className="flex flex-col gap-2">
            <ParagraphTag>{paragraphLabel(part.paragraph)}</ParagraphTag>
            <EvidencePart
              part={part}
              chunks={(ex.evidence.chunks || []).filter(c => (c.part ?? 0) === pi)}
              answer={answer}
            />
          </div>
        ))
      ) : (
        <p className="m-0 text-zinc-500 italic">Bài không có câu nào nói trực tiếp tới thông tin này.</p>
      ),
    },
    {
      title: 'Chọn đáp án',
      body: (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-sm font-semibold text-zinc-900">Đáp án phù hợp nhất:</span>
            <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-sm font-semibold text-emerald-700">{answer}</span>
          </div>
          {ex.full_sentence && (
            <p className="m-0">
              <span className="font-semibold text-zinc-900">Câu hoàn chỉnh: </span>
              {ex.full_sentence}
              {ex.translation && <span className="text-zinc-500"> ({ex.translation})</span>}
            </p>
          )}
          <p className="m-0">{ex.reasoning}</p>
          {ex.paraphrases?.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="m-0 font-semibold text-zinc-900">Đối chiếu paraphrasing:</p>
              {ex.paraphrases.map((p, i) => (
                <ChunkRow key={i}>
                  <Chunk text={p.question} label={p.question_label} />
                  <span className="self-end pb-1 text-zinc-400 font-semibold">⇔</span>
                  <Chunk text={p.passage} label={p.passage_label} />
                </ChunkRow>
              ))}
            </div>
          )}
          {ex.distractors?.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="m-0 font-semibold text-zinc-900">Những lựa chọn còn lại</p>
              {ex.distractors.map((d, i) => (
                <div key={i} className="flex gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
                  <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-red-50 border border-red-200 text-red-500 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 font-semibold text-zinc-900">{d.option}</p>
                    <p className="m-0 text-zinc-600">
                      {d.label && <span className="text-zinc-500">{d.label}: </span>}
                      {d.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ),
    },
  ]
  return steps.map((s, i) => (
    <StepCard key={i} index={i + 1} total={steps.length} title={s.title}>{s.body}</StepCard>
  ))
}

function LegacySteps({ explanation: ex }) {
  const steps = [
    { title: 'Câu hỏi kiểm tra điều gì', text: ex.restatement },
    { title: 'Đối chiếu với bài', text: ex.evidence },
    { title: 'Các bước suy luận', text: ex.reasoning },
    { title: 'Kết luận', text: ex.conclusion },
  ].filter(s => s.text)
  return steps.map((s, i) => (
    <StepCard key={i} index={i + 1} total={steps.length} title={s.title}>
      <p className="m-0">{s.text}</p>
    </StepCard>
  ))
}

export default function ReviewExplanation({ explanation, paragraphLabel = i => `Đoạn ${i + 1}` }) {
  if (!explanation) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-500">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
        Câu này chưa có giải thích chi tiết.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {explanation.v === 2
        ? <V2Steps explanation={explanation} paragraphLabel={paragraphLabel} />
        : <LegacySteps explanation={explanation} />}
    </div>
  )
}
