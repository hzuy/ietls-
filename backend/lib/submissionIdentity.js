// Compare the submitted snapshot without depending on object property order.
function sameSubmissionAnswers(stored, incoming) {
  try {
    const previous = typeof stored === 'string' ? JSON.parse(stored) : stored
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return false
    const keys = Object.keys(previous).sort()
    const nextKeys = Object.keys(incoming).sort()
    return keys.length === nextKeys.length && keys.every((key, index) => key === nextKeys[index] && previous[key] === incoming[key])
  } catch { return false }
}

module.exports = { sameSubmissionAnswers }
