const TTL_MS = 30 * 60 * 1000

const keyOf = (skill, examId) => `submitted:${skill}:${examId}`

export function markSubmitted(skill, examId, exitPath) {
  try {
    sessionStorage.setItem(keyOf(skill, examId), JSON.stringify({ at: Date.now(), exitPath }))
  } catch {
    return
  }
}

export function clearSubmitted(skill, examId) {
  try {
    sessionStorage.removeItem(keyOf(skill, examId))
  } catch {
    return
  }
}

export function peekSubmittedExit(skill, examId) {
  try {
    const raw = sessionStorage.getItem(keyOf(skill, examId))
    if (!raw) return null
    const { at, exitPath } = JSON.parse(raw)
    return Date.now() - at < TTL_MS ? exitPath || null : null
  } catch {
    return null
  }
}

export function examExitPath(exam, skill) {
  return exam?.seriesId ? `/full-test/${exam.seriesId}?book=${exam.bookNumber}` : `/practice/${skill}`
}
