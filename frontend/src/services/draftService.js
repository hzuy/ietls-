/**
 * draftService.js
 * Manages in-progress exam drafts in localStorage.
 * Key format: draft_{userId}_{examId}_{skillType}
 */

const PREFIX = 'ielts_draft'

/**
 * Build a unique draft key.
 * @param {string|number} userId
 * @param {string|number} examId  — the DB exam id (e.g. reading exam id)
 * @param {string} skillType      — 'reading' | 'listening' | 'writing' | 'speaking'
 */
function draftKey(userId, examId, skillType) {
  return `${PREFIX}_${userId}_${examId}_${skillType}`
}

/**
 * Save a draft.
 * @param {{ userId, examId, skillType, answers, timeRemaining, savedAt }} data
 */
export function saveDraft({ userId, examId, skillType, answers, timeRemaining }) {
  if (!userId || !examId || !skillType) return
  const key = draftKey(userId, examId, skillType)
  const payload = {
    userId,
    examId,
    skillType,
    answers: answers || {},
    timeRemaining: timeRemaining ?? null,
    savedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    console.warn('[draftService] Failed to save draft:', e)
  }
}

/**
 * Load a draft.
 * @returns {object|null}
 */
export function loadDraft(userId, examId, skillType) {
  if (!userId || !examId || !skillType) return null
  try {
    const raw = localStorage.getItem(draftKey(userId, examId, skillType))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Delete a draft after submission.
 */
export function clearDraft(userId, examId, skillType) {
  if (!userId || !examId || !skillType) return
  try {
    localStorage.removeItem(draftKey(userId, examId, skillType))
  } catch {}
}

/**
 * Check if a draft exists and return minimal info { hasDraft, savedAt }.
 */
export function checkDraft(userId, examId, skillType) {
  const draft = loadDraft(userId, examId, skillType)
  if (!draft) return { hasDraft: false }
  const answerCount = Object.keys(draft.answers || {}).length
  return {
    hasDraft: answerCount > 0,
    savedAt: draft.savedAt,
    answerCount,
    timeRemaining: draft.timeRemaining,
  }
}
