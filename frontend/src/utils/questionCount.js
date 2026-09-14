/**
 * Returns array of { number, qId, isMultiChoice, multiIndex } for each answer slot in a group.
 * Uses qNumberStart..qNumberEnd as the authoritative range.
 * - Handles mcq_multi: 1 question record covers maxChoices slots
 * - Excludes stale questions (outside the range)
 */
export function getGroupSlots(group) {
  if (!group) return []
  const slots = []
  const maxC = group.maxChoices || 2
  const isMulti = group.type === 'mcq_multi'

  for (let n = group.qNumberStart; n <= group.qNumberEnd; n++) {
    let qId = null
    let multiIndex = 0
    if (isMulti) {
      const qi = Math.floor((n - group.qNumberStart) / maxC)
      multiIndex = (n - group.qNumberStart) % maxC
      qId = group.questions?.[qi]?.id ?? null
    } else {
      qId = (group.questions || []).find(q => q.number === n)?.id ?? null
    }
    slots.push({
      number: n,
      qId,
      isMultiChoice: isMulti,
      multiIndex
    })
  }
  return slots
}

/**
 * Returns sorted, deduplicated array of slots for all questions in a listening section.
 */
export function getSectionSlots(section) {
  if (!section) return []
  const direct = (section.questions || []).map(q => ({
    number: q.number,
    qId: q.id,
    isMultiChoice: false,
    multiIndex: 0
  }))
  const fromGroups = (section.questionGroups || []).flatMap(g => getGroupSlots(g))
  const seen = new Set()
  return [...direct, ...fromGroups]
    .filter(s => {
      if (seen.has(s.number)) return false
      seen.add(s.number)
      return true
    })
    .sort((a, b) => a.number - b.number)
}

/**
 * Returns sorted, deduplicated array of slots for all questions in a reading passage.
 * Gathers both direct questions and group slots, deduplicates, and sorts strictly ascending.
 */
export function getPassageSlots(passage) {
  if (!passage) return []
  const direct = (passage.questions || []).map(q => ({
    number: q.number,
    qId: q.id,
    isMultiChoice: false,
    multiIndex: 0
  }))
  const fromGroups = (passage.questionGroups || []).flatMap(g => getGroupSlots(g))
  const seen = new Set()
  return [...direct, ...fromGroups]
    .filter(s => {
      if (seen.has(s.number)) return false
      seen.add(s.number)
      return true
    })
    .sort((a, b) => a.number - b.number)
}

/**
 * Checks whether an answer slot has been completed by the student.
 * - For mcq_multi: counts as answered based on the number of actual choices ticked.
 *   (e.g., slot with multiIndex: 0 requires >= 1 choice; multiIndex: 1 requires >= 2 choices).
 * - For standard questions: requires non-empty string.
 */
export function isSlotAnswered(slot, answers) {
  if (!slot || !slot.qId || !answers) return false
  const val = answers[slot.qId]
  if (val == null || String(val).trim() === '') return false

  if (slot.isMultiChoice) {
    const selected = String(val).split(',').map(s => s.trim()).filter(Boolean)
    const needed = (slot.multiIndex ?? 0) + 1
    return selected.length >= needed
  }

  return true
}
