// MCQ (multi-select) correct-answer helpers.
//
// The stored format in the DB stays a comma-joined string of the correct option
// TEXTS (e.g. "A. Paris,C. Rome") — no schema/API change. But everything the
// editor does in between (which checkbox is ticked, toggling, removing an
// option) works on option INDEX, never on text matching. That keeps the UI
// correct even when two options look identical / differ only by hidden
// whitespace or Unicode lookalikes.

/**
 * Stored `correctAnswer` text  ->  array of option indices.
 * Each wanted text is matched to the FIRST option carrying that (trimmed) text
 * that has not already been claimed, so legacy rows that still contain
 * duplicate option texts resolve to distinct indices instead of collapsing.
 */
export function deriveCorrectIndices(correctAnswer, options) {
  const wanted = String(correctAnswer ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const opts = (options || []).map(o => String(o ?? '').trim())
  const claimed = new Set()
  const indices = []
  for (const w of wanted) {
    const i = opts.findIndex((o, idx) => o === w && !claimed.has(idx))
    if (i !== -1) {
      claimed.add(i)
      indices.push(i)
    }
  }
  return indices
}

/**
 * Array of option indices  ->  stored `correctAnswer` text.
 * Blank / missing options are dropped so an empty slot can never become a
 * "correct answer". Output is ordered by option position.
 */
export function correctAnswerFromIndices(indices, options) {
  return [...new Set(indices)]
    .sort((a, b) => a - b)
    .map(i => (options || [])[i])
    .filter(v => typeof v === 'string' && v.trim() !== '')
    .join(',')
}

/**
 * Shift a set of correct indices after the option at `removedIndex` is deleted:
 * drop it, and decrement every index that sat after it.
 */
export function reindexAfterRemoval(indices, removedIndex) {
  return indices
    .filter(i => i !== removedIndex)
    .map(i => (i > removedIndex ? i - 1 : i))
}
