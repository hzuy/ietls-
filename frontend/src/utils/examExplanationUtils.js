/**
 * Utility functions for syncing and managing explanations in Cambridge Exams (Reading & Listening).
 */

// Nhóm câu hỏi mà đề bài nằm trong HÌNH ẢNH (bản đồ/sơ đồ). Từ khi Gemini vision
// được dùng để đọc ảnh, nhóm này ĐƯỢC giải thích bình thường — chỉ bị coi là
// "không hỗ trợ" khi nhóm chưa có ảnh đính kèm (không có căn cứ xác định vị trí).
export const EXAM_EXPLANATION_IMAGE_TYPES = new Set([
  'diagram_completion',
  'diagram_label',
  'map_diagram'
])

export const EXAM_EXPLANATION_SKIP_FAMILIES = new Set()

export function isExplanationUnsupportedGroup(group) {
  if (!group || typeof group !== 'object') return false
  const type = group.type || 'mcq'
  if (EXAM_EXPLANATION_SKIP_FAMILIES.has(type)) return true
  return EXAM_EXPLANATION_IMAGE_TYPES.has(type) && !group.imageUrl
}

export const EXAM_EXPLANATION_ATTENTION_STATUSES = new Set([
  'conflict_pending',
  'needs_regeneration',
  'possibly_stale'
])

export const INTERNAL_JARGON_PHRASES = Object.freeze([
  'nguoi dung nhap',
  'nguoi nhap',
  'dap an nguoi dung',
  'ngo nhan',
  'thu thach',
  'giao vien nhap',
  'he thong cung cap',
])

export function normalizeJargonText(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

const EXCLUDED_METADATA_KEYS = new Set([
  'teacher_note',
  'teacherFeedback',
  'feedbackHistory',
  'teacherKeptAnswer',
  'status',
  'statusHistory',
  'staleReason',
  'staleAt',
  'needsRegenerationReason',
  'id',
  'method',
  'provider',
  'model',
  'answer',
  'aiAnswer',
  'v',
  'createdAt',
  'updatedAt',
])

function extractLearnerTexts(val) {
  if (!val) return []
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) {
    return val.flatMap((item) => extractLearnerTexts(item))
  }
  if (typeof val === 'object') {
    const texts = []
    for (const [k, v] of Object.entries(val)) {
      if (!EXCLUDED_METADATA_KEYS.has(k)) {
        texts.push(...extractLearnerTexts(v))
      }
    }
    return texts
  }
  return []
}

export function containsInternalJargon(explanation) {
  if (!explanation || typeof explanation !== 'object') return false
  const texts = extractLearnerTexts(explanation)
  for (const text of texts) {
    const norm = normalizeJargonText(text)
    for (const phrase of INTERNAL_JARGON_PHRASES) {
      const normPhrase = normalizeJargonText(phrase)
      if (norm.includes(normPhrase)) {
        return true
      }
    }
  }
  return false
}

/**
 * Calculates explanation statistics for an exam form, passage, section, or question group.
 *
 * Rules (Requirement 3.3):
 * 1. Definitive counting for mcq_multi: 1 question record covers multiple question slots
 *    (e.g., Q21-Q22 = 2 slots). If the question record has an explanation, all covered slots
 *    are counted as explained.
 * 2. Groups whose đề bài nằm trong hình (diagram_completion, diagram_label, map_diagram)
 *    are only EXCLUDED from the denominator when the group has no image attached —
 *    AI reads the image via Gemini vision, so image groups are normally supported.
 * 3. Flags "cần chú ý" (hasAttention) ONLY when there are questions with:
 *    - 'conflict_pending' (teacher needs to review conflict)
 *    - 'needs_regeneration' (regeneration requested or failed validation)
 *    - 'possibly_stale' (exam content/answer changed after explanation generated)
 */
export function calculateExamExplanationStats(target) {
  const result = {
    totalSlots: 0,
    supportedSlots: 0,
    explainedSlots: 0,
    unsupportedSlots: 0,
    attentionSlots: 0,

    totalQuestions: 0,
    supportedQuestions: 0,
    explainedQuestions: 0,
    unsupportedQuestions: 0,
    attentionQuestions: 0,

    statusCounts: {
      ai_generated: 0,
      teacher_reviewed: 0,
      teacher_edited: 0,
      conflict_pending: 0,
      needs_regeneration: 0,
      possibly_stale: 0,
      none: 0,
      unsupported: 0
    },

    hasAttention: false,
    hasUnsupported: false,
    isFullyExplained: false,
    attentionReasons: []
  }

  if (!target || typeof target !== 'object') return result

  let groups = []
  if (Array.isArray(target.passages)) {
    groups = target.passages.flatMap(p => p.questionGroups || [])
  } else if (Array.isArray(target.sections)) {
    groups = target.sections.flatMap(s => s.questionGroups || [])
  } else if (Array.isArray(target.questionGroups)) {
    groups = target.questionGroups
  } else if (target.questions || target.type) {
    groups = [target]
  }

  for (const g of groups) {
    const gType = g.type || 'mcq'
    const isSkipped = isExplanationUnsupportedGroup(g)
    const isMulti = ['mcq_multi', 'list_selection'].includes(gType)

    const questions = Array.isArray(g.questions) ? g.questions : []
    const rawSpan = (Number.isFinite(g.qNumberStart) && Number.isFinite(g.qNumberEnd) && g.qNumberEnd >= g.qNumberStart)
      ? (g.qNumberEnd - g.qNumberStart + 1)
      : (isMulti ? (g.maxChoices || 2) * Math.max(1, questions.length) : questions.length)

    const groupSlotCount = Math.max(rawSpan, questions.length)
    result.totalSlots += groupSlotCount

    if (isSkipped) {
      const qCount = Math.max(1, questions.length)
      result.unsupportedSlots += groupSlotCount
      result.totalQuestions += qCount
      result.unsupportedQuestions += qCount
      result.statusCounts.unsupported += groupSlotCount
      result.hasUnsupported = true
      continue
    }

    if (isMulti) {
      const qCount = questions.length || 1
      result.totalQuestions += qCount
      result.supportedQuestions += qCount
      result.supportedSlots += groupSlotCount

      const slotsPerQ = Math.max(1, Math.round(groupSlotCount / qCount))

      if (questions.length === 0) {
        result.statusCounts.none += groupSlotCount
      } else {
        questions.forEach((q, idx) => {
          const qSlots = (idx === questions.length - 1)
            ? (groupSlotCount - slotsPerQ * (qCount - 1))
            : slotsPerQ

          const exp = q.explanation || g.explanations?.[q.number] || g.explanations?.[String(q.number)]
          if (exp && typeof exp === 'object') {
            result.explainedSlots += qSlots
            result.explainedQuestions += 1

            const status = exp.status || 'ai_generated'
            if (result.statusCounts[status] != null) {
              result.statusCounts[status] += qSlots
            } else {
              result.statusCounts.ai_generated += qSlots
            }

            if (EXAM_EXPLANATION_ATTENTION_STATUSES.has(status)) {
              result.attentionSlots += qSlots
              result.attentionQuestions += 1
            }
          } else {
            result.statusCounts.none += qSlots
          }
        })
      }
    } else {
      if (questions.length === 0) {
        result.totalQuestions += groupSlotCount
        result.supportedQuestions += groupSlotCount
        result.supportedSlots += groupSlotCount
        result.statusCounts.none += groupSlotCount
      } else {
        result.totalQuestions += questions.length
        result.supportedQuestions += questions.length
        result.supportedSlots += questions.length

        questions.forEach(q => {
          const exp = q.explanation || g.explanations?.[q.number] || g.explanations?.[String(q.number)]
          if (exp && typeof exp === 'object') {
            result.explainedSlots += 1
            result.explainedQuestions += 1

            const status = exp.status || 'ai_generated'
            if (result.statusCounts[status] != null) {
              result.statusCounts[status] += 1
            } else {
              result.statusCounts.ai_generated += 1
            }

            if (EXAM_EXPLANATION_ATTENTION_STATUSES.has(status)) {
              result.attentionSlots += 1
              result.attentionQuestions += 1
            }
          } else {
            result.statusCounts.none += 1
          }
        })
      }
    }
  }

  result.hasAttention = result.attentionSlots > 0
  result.isFullyExplained = result.supportedSlots > 0 && result.explainedSlots === result.supportedSlots

  if (result.statusCounts.conflict_pending > 0) {
    result.attentionReasons.push(`${result.statusCounts.conflict_pending} câu Chờ duyệt (Lệch)`)
  }
  if (result.statusCounts.needs_regeneration > 0) {
    result.attentionReasons.push(`${result.statusCounts.needs_regeneration} câu Cần sinh lại`)
  }
  if (result.statusCounts.possibly_stale > 0) {
    result.attentionReasons.push(`${result.statusCounts.possibly_stale} câu Có thể lỗi thời`)
  }

  return result
}

/**
 * Normalizes form state to create a stable signature for detecting unsaved content edits.
 * Omits 'explanation' fields so AI updates or explanation status changes don't falsely mark teacher edits as dirty.
 */
export function normalizeFormForDirtyCheck(form) {
  if (!form) return ''
  try {
    const isReading = Array.isArray(form.passages)
    const isListening = Array.isArray(form.sections)

    if (isReading) {
      const cleanPassages = form.passages.map(p => ({
        id: p.id,
        number: p.number,
        title: p.title || '',
        subtitle: p.subtitle || '',
        body: p.body || '',
        letteredParagraphs: Boolean(p.letteredParagraphs),
        questionGroups: (p.questionGroups || []).map(g => ({
          id: g.id || g._id,
          type: g.type,
          instruction: g.instruction || '',
          imageUrl: g.imageUrl || '',
          canReuse: Boolean(g.canReuse),
          maxChoices: g.maxChoices,
          noteSections: g.noteSections,
          matchingOptions: g.matchingOptions,
          questions: (g.questions || []).map(q => ({
            id: q.id,
            number: q.number,
            questionText: q.questionText || '',
            hint: q.hint,
            options: q.options || [],
            correctAnswer: q.correctAnswer || ''
          }))
        }))
      }))
      return JSON.stringify({
        title: form.title || '',
        bookNumber: String(form.bookNumber || ''),
        testNumber: String(form.testNumber || ''),
        seriesId: String(form.seriesId || ''),
        passages: cleanPassages
      })
    }

    if (isListening) {
      const cleanSections = form.sections.map(s => ({
        id: s.id,
        number: s.number,
        context: s.context || '',
        audioUrl: s.audioUrl || '',
        transcript: s.transcript || '',
        questionGroups: (s.questionGroups || []).map(g => ({
          id: g.id || g._id,
          type: g.type,
          instruction: g.instruction || '',
          imageUrl: g.imageUrl || '',
          canReuse: Boolean(g.canReuse),
          maxChoices: g.maxChoices,
          noteSections: g.noteSections,
          matchingOptions: g.matchingOptions,
          questions: (g.questions || []).map(q => ({
            id: q.id,
            number: q.number,
            questionText: q.questionText || '',
            hint: q.hint,
            options: q.options || [],
            correctAnswer: q.correctAnswer || ''
          }))
        }))
      }))
      return JSON.stringify({
        title: form.title || '',
        bookNumber: String(form.bookNumber || ''),
        testNumber: String(form.testNumber || ''),
        seriesId: String(form.seriesId || ''),
        sections: cleanSections
      })
    }

    return JSON.stringify(form)
  } catch {
    return ''
  }
}

/**
 * Checks whether the current form has unsaved teacher content edits compared to pristine signature.
 */
export function isExamFormDirty(currentForm, pristineSig) {
  if (!pristineSig) return false
  return normalizeFormForDirtyCheck(currentForm) !== pristineSig
}

/**
 * Targeted merge of fresh exam explanation data into currentForm.
 *
 * Rules (Requirement 3.1):
 * 1. DOES NOT replace entire form state.
 * 2. Only merges `explanation` (and `correctAnswer` if resolved as 'ai' via conflict modal) per question ID.
 * 3. Keeps 100% of teacher's pending, unsaved modifications intact (passage text, questionText, options, answers).
 *
 * @param {object} currentForm - The current React state of the exam form
 * @param {object} freshExam - The fresh exam object returned from server (GET /admin/exams/:id)
 * @param {object} resolvedChoices - Map of { [qNum]: 'ai' | 'teacher' } from ExplanationConflictModal
 * @returns {object} Updated form state with explanations merged in
 */
export function mergeExamExplanations(currentForm, freshExam, resolvedChoices = {}) {
  if (!currentForm || !freshExam) return currentForm

  // Build lookup map: question id -> server question object
  const serverQuestionMap = new Map()
  const registerServerQ = (q) => {
    if (q && q.id != null) {
      serverQuestionMap.set(q.id, q)
    }
  }

  // Reading passages
  if (Array.isArray(freshExam.passages)) {
    freshExam.passages.forEach(p => {
      p.questions?.forEach(registerServerQ)
      p.questionGroups?.forEach(g => g.questions?.forEach(registerServerQ))
    })
  }

  // Listening sections
  if (Array.isArray(freshExam.listeningSections)) {
    freshExam.listeningSections.forEach(s => {
      s.questions?.forEach(registerServerQ)
      s.questionGroups?.forEach(g => g.questions?.forEach(registerServerQ))
    })
  }

  const isReading = Array.isArray(currentForm.passages)
  const isListening = Array.isArray(currentForm.sections)

  const mergeQuestionList = (questions = []) => {
    return questions.map(q => {
      if (!q.id || !serverQuestionMap.has(q.id)) {
        // Newly added question or unmatched: keep untouched
        return q
      }
      const freshQ = serverQuestionMap.get(q.id)
      const updated = { ...q }

      // 1. Merge explanation
      if (freshQ.explanation !== undefined) {
        updated.explanation = freshQ.explanation
      }

      // 2. Merge correctAnswer ONLY IF choice is explicitly 'ai'
      const qNum = q.number
      const choice = resolvedChoices[qNum] || resolvedChoices[String(qNum)]
      if (choice === 'ai' && freshQ.correctAnswer) {
        updated.correctAnswer = freshQ.correctAnswer
      }

      return updated
    })
  }

  const mergeGroup = (group) => {
    const updatedQuestions = mergeQuestionList(group.questions || [])

    // Synchronize group.explanations dictionary
    const nextExplanations = { ...(group.explanations || {}) }
    updatedQuestions.forEach(q => {
      if (q.explanation) {
        nextExplanations[q.number] = q.explanation
      }
    })

    return {
      ...group,
      questions: updatedQuestions,
      explanations: nextExplanations
    }
  }

  if (isReading) {
    const nextPassages = currentForm.passages.map(p => ({
      ...p,
      questions: p.questions ? mergeQuestionList(p.questions) : p.questions,
      questionGroups: (p.questionGroups || []).map(mergeGroup)
    }))
    return { ...currentForm, passages: nextPassages }
  }

  if (isListening) {
    const nextSections = currentForm.sections.map(s => ({
      ...s,
      questions: s.questions ? mergeQuestionList(s.questions) : s.questions,
      questionGroups: (s.questionGroups || []).map(mergeGroup)
    }))
    return { ...currentForm, sections: nextSections }
  }

  return currentForm
}

/**
 * Executes a chunked, timed loop for generating AI explanations.
 * Keeps running requests with remaining question numbers until finished or aborted.
 *
 * @param {object} params
 * @param {Function} params.fetchChunk - async (payload, { signal }) => response.data
 * @param {object} params.basePayload - { force, overwriteProtected, resolveChoices }
 * @param {AbortSignal} [params.signal] - AbortSignal for user cancellation
 * @param {Function} [params.onProgress] - ({ current, total, remainingCount, data }) => void
 * @param {Function} [params.onChunkSuccess] - async (chunkData) => void (e.g. sync form/draft)
 * @returns {Promise<{
 *   ok: boolean,
 *   hasConflicts: boolean,
 *   conflicts: Array,
 *   totalGenerated: number,
 *   totalQuestions: number,
 *   cancelled: boolean,
 *   errors: Array
 * }>}
 */
export async function executeTimedAIGenerationLoop({
  fetchChunk,
  basePayload = {},
  signal = null,
  onProgress = null,
  onChunkSuccess = null,
  maxIterations = 20,
}) {
  let remainingNumbers = null
  let totalQuestions = null
  let totalGenerated = 0
  const accumulatedConflicts = []
  const accumulatedErrors = []
  const accumulatedNeedsRetry = []
  let isCancelled = false

  let iteration = 0
  let noProgressCount = 0
  let prevRemainingCount = null

  while (iteration < maxIterations) {
    iteration++

    if (signal?.aborted) {
      isCancelled = true
      break
    }

    const payload = {
      ...basePayload,
      questionNumbers: remainingNumbers,
    }

    let res
    try {
      res = await fetchChunk(payload, { signal })
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        isCancelled = true
        break
      }
      // 3.3(d): 409 hiển thị thông báo tiếng Việt và không lặp tiếp
      if (err?.response?.status === 409 || err?.status === 409) {
        const conflictMsg = err?.response?.data?.message || 'Hệ thống đang tạo giải thích AI cho đề thi này ở phiên khác. Vui lòng chờ vài giây rồi thử lại.'
        accumulatedErrors.push({
          status: 409,
          message: conflictMsg,
        })
        break
      }
      accumulatedErrors.push({
        status: err?.response?.status || 500,
        message: err?.response?.data?.message || err?.message || 'Lỗi khi gọi AI giải thích',
      })
      break
    }

    const data = res?.data || res
    if (!data) break

    if (totalQuestions === null && typeof data.totalQuestions === 'number') {
      totalQuestions = data.totalQuestions
    }

    const currentGenerated = data.generatedCount || 0
    totalGenerated += currentGenerated

    if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
      accumulatedConflicts.push(...data.conflicts)
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      accumulatedErrors.push(...data.errors)
    }

    // 3.3(e): Thu thập danh sách "cần thử lại" từ Phần 1
    if (Array.isArray(data.needsRetryQuestions) && data.needsRetryQuestions.length > 0) {
      for (const nr of data.needsRetryQuestions) {
        const exists = accumulatedNeedsRetry.some(item => (typeof item === 'object' ? item.number : item) === (typeof nr === 'object' ? nr.number : nr))
        if (!exists) accumulatedNeedsRetry.push(nr)
      }
    }

    // 3.3(c): Nếu backend không trả remainingQuestionNumbers (bản backend cũ trong lúc deploy) thì coi là đã xong, không lặp, không lỗi
    if (data.remainingQuestionNumbers === undefined) {
      if (typeof onProgress === 'function') {
        onProgress({
          current: totalQuestions !== null ? totalQuestions : totalGenerated,
          total: totalQuestions !== null ? totalQuestions : totalGenerated,
          remainingCount: 0,
          needsRetryCount: accumulatedNeedsRetry.length,
          needsRetryQuestions: accumulatedNeedsRetry,
          data,
        })
      }
      if (typeof onChunkSuccess === 'function') {
        try {
          await onChunkSuccess(data)
        } catch (chunkErr) {
          console.error('[CHUNK_SYNC_ERROR]', chunkErr)
        }
      }
      break
    }

    const remaining = Array.isArray(data.remainingQuestionNumbers)
      ? data.remainingQuestionNumbers
      : []

    const remainingCount = remaining.length
    const currentCompleted = totalQuestions !== null ? (totalQuestions - remainingCount) : totalGenerated

    // 3.3(a): Chặn vòng lặp vô hạn: nếu 2 request liên tiếp không sinh thêm câu nào và remainingQuestionNumbers không giảm -> dừng và báo lỗi tiếng Việt
    if (currentGenerated === 0 && prevRemainingCount !== null && remainingCount >= prevRemainingCount) {
      noProgressCount++
      if (noProgressCount >= 2) {
        accumulatedErrors.push({
          message: 'AI không phản hồi hoặc không có tiến triển, các câu đã sinh được giữ lại an toàn.',
        })
        break
      }
    } else {
      noProgressCount = 0
    }
    prevRemainingCount = remainingCount

    if (typeof onProgress === 'function') {
      onProgress({
        current: Math.max(0, currentCompleted),
        total: totalQuestions !== null ? totalQuestions : totalGenerated,
        remainingCount,
        needsRetryCount: accumulatedNeedsRetry.length,
        needsRetryQuestions: accumulatedNeedsRetry,
        data,
      })
    }

    if (typeof onChunkSuccess === 'function') {
      try {
        await onChunkSuccess(data)
      } catch (chunkErr) {
        console.error('[CHUNK_SYNC_ERROR]', chunkErr)
      }
    }

    if (remaining.length === 0 || signal?.aborted) {
      if (signal?.aborted) isCancelled = true
      break
    }

    remainingNumbers = remaining
  }

  // 3.3(b): Giới hạn tối đa số vòng (20 vòng)
  if (iteration >= maxIterations && remainingNumbers && remainingNumbers.length > 0) {
    accumulatedErrors.push({
      message: `Đã đạt giới hạn tối đa ${maxIterations} vòng gọi AI. Các câu đã sinh được giữ lại, vui lòng thử lại sau cho các câu còn lại.`,
    })
  }

  return {
    ok: accumulatedErrors.length === 0,
    hasConflicts: accumulatedConflicts.length > 0,
    conflicts: accumulatedConflicts,
    needsRetryQuestions: accumulatedNeedsRetry,
    needsRetryCount: accumulatedNeedsRetry.length,
    totalGenerated,
    totalQuestions: totalQuestions || totalGenerated,
    cancelled: isCancelled,
    errors: accumulatedErrors,
  }
}
