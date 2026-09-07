export function PreviewTokenLine({ content, questions, showAnswers, tokenNumMap = {} }) {
  const parts = (content || '').split(/(\[Q:\d+\])/)
  return (
    <p className="text-sm leading-8 text-slate-800">
      {parts.map((part, i) => {
        const match = part.match(/\[Q:(\d+)\]/)
        if (match) {
          const qNum = parseInt(match[1])
          const displayNum = tokenNumMap[qNum] ?? qNum
          const q = questions.find(q => q.number === qNum)
          const val = showAnswers ? (q?.correctAnswer || '') : ''
          return (
            <span key={i} className="inline-flex items-center gap-1 mx-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200 font-bold text-xs shrink-0">{displayNum}</span>
              <span className={`inline-block min-w-20 border-b-2 ${showAnswers ? 'border-zinc-900 text-zinc-900 font-semibold' : 'border-zinc-300 text-zinc-400'} px-1 text-sm text-center`}>
                {val || (showAnswers ? '?' : '___')}
              </span>
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export function buildTokenNumMap(group) {
  const map = {}
  let idx = 0
  ;(group.noteSections || []).forEach(ns => {
    ;(ns.lines || []).forEach(line => {
      const content = line.contentWithTokens || line.content || ''
      const tokens = [...content.matchAll(/\[Q:(\d+)\]/g)]
      tokens.forEach(m => {
        const num = parseInt(m[1])
        if (!(num in map)) { map[num] = group.qNumberStart + idx; idx++ }
      })
    })
  })
  return map
}
