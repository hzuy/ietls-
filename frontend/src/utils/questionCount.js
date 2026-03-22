/**
 * Returns array of { number, qId } for each answer slot in a group.
 * Uses qNumberStart..qNumberEnd as the authoritative range.
 * - Handles mcq_multi: 1 question record covers maxChoices slots
 * - Excludes stale questions (outside the range)
 */
export function getGroupSlots(group) {
  const slots = []
  const maxC = group.maxChoices || 2
  for (let n = group.qNumberStart; n <= group.qNumberEnd; n++) {
    let qId = null
    if (group.type === 'mcq_multi') {
      const qi = Math.floor((n - group.qNumberStart) / maxC)
      qId = group.questions?.[qi]?.id ?? null
    } else {
      qId = (group.questions || []).find(q => q.number === n)?.id ?? null
    }
    slots.push({ number: n, qId })
  }
  return slots
}

/**
 * Returns sorted, deduplicated array of { number, qId } for all slots in a listening section.
 */
export function getSectionSlots(section) {
  const direct = (section.questions || []).map(q => ({ number: q.number, qId: q.id }))
  const fromGroups = (section.questionGroups || []).flatMap(g => getGroupSlots(g))
  const seen = new Set()
  return [...direct, ...fromGroups]
    .filter(s => { if (seen.has(s.number)) return false; seen.add(s.number); return true })
    .sort((a, b) => a.number - b.number)
}

/**
 * Returns array of { number, qId } for all slots in a reading passage.
 */
export function getPassageSlots(passage) {
  if (passage.questionGroups && passage.questionGroups.length > 0) {
    return passage.questionGroups.flatMap(g => getGroupSlots(g))
  }
  return (passage.questions || []).map(q => ({ number: q.number, qId: q.id }))
}
