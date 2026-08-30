/**
 * draftService.js
 * Manages in-progress exam drafts in localStorage.
 * Key format: ielts_draft_{userId}_{examId}_{skillType}
 *
 * `data` là payload tuỳ kỹ năng:
 *   reading / listening → { [questionId]: answer }
 *   writing             → { essays: { [taskId]: text }, submittedTaskIds: number[] }
 *   speaking            → { transcripts: { [partId]: text }, submittedPartIds: number[] }
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
 * Có phải "rỗng thực sự" không — không chứa nội dung gì đáng lưu.
 * Đệ quy để xử lý được cả map phẳng (reading/listening) lẫn shape lồng
 * (writing: { essays, submittedTaskIds } / speaking: { transcripts, submittedPartIds }).
 */
export function isDataEmpty(data) {
  if (data == null) return true
  if (typeof data === 'string') return data.trim() === ''
  if (Array.isArray(data)) return data.every(isDataEmpty)
  if (typeof data === 'object') {
    const values = Object.values(data)
    return values.length === 0 || values.every(isDataEmpty)
  }
  return false // number / boolean → coi là có nội dung
}

/**
 * Save a draft.
 * @param {{ userId, examId, skillType, data, timeRemaining }} payload
 */
export function saveDraft({ userId, examId, skillType, data, timeRemaining }) {
  if (!userId || !examId || !skillType) return
  const key = draftKey(userId, examId, skillType)
  const payload = {
    userId,
    examId,
    skillType,
    data: data || {},
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
    const draft = raw ? JSON.parse(raw) : null
    // Backward-compat: drafts lưu trước khi đổi field `answers` → `data`
    if (draft && draft.data === undefined && draft.answers !== undefined) {
      draft.data = draft.answers
    }
    return draft
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
 * Check if a draft exists with real content. Returns { hasDraft, savedAt, timeRemaining }.
 */
export function checkDraft(userId, examId, skillType) {
  const draft = loadDraft(userId, examId, skillType)
  if (!draft || isDataEmpty(draft.data)) return { hasDraft: false }
  return {
    hasDraft: true,
    savedAt: draft.savedAt,
    timeRemaining: draft.timeRemaining,
  }
}
