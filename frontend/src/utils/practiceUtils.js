// Normalize practice group data: add optionLetter/optionText aliases (practice saves as letter/text)
// and ensure q.id exists (practice JSON questions don't have DB ids — use q.number as fallback)
export function normalizeGroup(g) {
  return {
    ...g,
    matchingOptions: (g.matchingOptions || []).map(mo => ({
      ...mo,
      optionLetter: mo.optionLetter ?? mo.letter ?? '',
      optionText: mo.optionText ?? mo.text ?? '',
    })),
    questions: (g.questions || []).map(q => ({
      ...q,
      id: q.id ?? q.number,
    })),
  }
}

export function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function buildListeningTokenMap(group) {
  const map = {}
  let idx = 0
  ;(group.noteSections || []).forEach(ns => {
    ;(ns.lines || []).forEach(line => {
      const content = line.content || ''
      const tokens = [...content.matchAll(/\[Q:(\d+)\]/g)]
      tokens.forEach(m => {
        const num = parseInt(m[1])
        if (!(num in map)) { map[num] = group.qNumberStart + idx; idx++ }
      })
    })
  })
  return map
}
