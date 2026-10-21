/**
 * Utilities for Smart Draft Merging and Diff Detection
 * Ensures drafts saved in localStorage never inadvertently overwrite newer AI explanations
 * or database edits.
 *
 * Hai nguyên tắc an toàn:
 * 1. KHÔNG so sánh theo chỉ số mảng: nhóm câu hỏi / câu hỏi có thể được thêm vào DB sau
 *    khi nháp được lưu. Merge theo khóa (id) và giữ lại phần chỉ có ở DB.
 * 2. Khi nháp và DB khác nhau, ưu tiên bản có mốc thời gian MỚI HƠN
 *    (mốc lưu nháp so với `explanation.updatedAt` của DB) thay vì mặc định giữ DB.
 */

/**
 * Normalize an explanation object for value-based equality comparison.
 * Extracts meaningful content fields, ignoring volatile metadata.
 */
export function normalizeExplanation(exp) {
  if (!exp) return null
  if (typeof exp === 'string') {
    try {
      exp = JSON.parse(exp)
    } catch {
      return { text: exp.trim() }
    }
  }
  if (typeof exp !== 'object') return null

  const steps = exp.steps || {}
  const predict = String(steps.predict ?? '').trim()
  const locate = String(steps.locate ?? '').trim()
  const analyze = String(steps.analyze ?? '').trim()
  const conclude = String(steps.conclude ?? '').trim()
  const singleText = String(exp.explanation ?? exp.aiExplanation ?? exp.text ?? exp.content ?? '').trim()
  const status = String(exp.status ?? '').trim()

  const hasContent = predict || locate || analyze || conclude || singleText || status
  if (!hasContent) return null

  return {
    predict,
    locate,
    analyze,
    conclude,
    singleText,
    status,
    answer: String(exp.answer ?? '').trim(),
  }
}

/**
 * Compare two explanations based on actual educational content.
 * Returns true if both have essentially the same explanation content.
 */
export function isExplanationEqual(expA, expB) {
  const normA = normalizeExplanation(expA)
  const normB = normalizeExplanation(expB)

  if (!normA && !normB) return true
  if (!normA || !normB) return false

  return (
    normA.predict === normB.predict &&
    normA.locate === normB.locate &&
    normA.analyze === normB.analyze &&
    normA.conclude === normB.conclude &&
    normA.singleText === normB.singleText &&
    normA.status === normB.status &&
    normA.answer === normB.answer
  )
}

/** Chuyển mốc thời gian (number | ISO string | Date) sang timestamp ms, hoặc null. */
export function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const t = Date.parse(String(value))
  return Number.isNaN(t) ? null : t
}

/**
 * Mốc thời gian của bản nháp: ưu tiên số ms, sau đó tới chuỗi ISO.
 * Trả về null nếu không xác định được.
 */
function draftTimestamp(draftSavedAt) {
  return toTimestamp(draftSavedAt)
}

/**
 * Quyết định giữ bản nào cho một câu hỏi.
 *
 * - Nếu người dùng đã chọn rõ ('keep_db' | 'keep_draft') thì tôn trọng lựa chọn đó.
 * - Nếu chưa chọn: so sánh mốc lưu nháp với `explanation.updatedAt` của DB.
 *   + Nháp mới hơn  -> keep_draft
 *   + DB mới hơn    -> keep_db
 *   + Thiếu dữ liệu -> keep_db (an toàn: không ghi đè nội dung đã lưu trên hệ thống)
 */
function resolveQuestionChoice({ explicitChoice, draftSavedAt, dbExp }) {
  if (explicitChoice === 'keep_draft' || explicitChoice === 'keep_db') return explicitChoice

  const draftTs = draftTimestamp(draftSavedAt)
  const dbTs = toTimestamp(dbExp?.updatedAt)
  if (draftTs !== null && dbTs !== null) return draftTs > dbTs ? 'keep_draft' : 'keep_db'
  return 'keep_db'
}

/**
 * Extract map of explanations by question number from a form object (Practice or Exam).
 * Handles:
 * - Practice: `form.questionGroups`
 * - Exam Reading: `form.passages[].questionGroups`
 * - Exam Listening: `form.sections[].questionGroups`
 * Handles both group-level `explanations` map and question-level `explanation` objects.
 */
export function extractExplanationsMap(form) {
  const map = {}
  if (!form) return map

  for (const group of collectGroups(form)) {
    if (!group) continue
    const groupExps = group.explanations || {}
    for (const [k, v] of Object.entries(groupExps)) {
      const qNum = Number(k)
      if (qNum && v) map[qNum] = v
    }
    if (Array.isArray(group.questions)) {
      for (const q of group.questions) {
        const qNum = Number(q.number ?? q.questionNumber)
        if (qNum && q.explanation) {
          map[qNum] = q.explanation
        }
      }
    }
  }
  return map
}

/** Thu thập tất cả questionGroup từ form (Practice | Exam Reading | Exam Listening). */
function collectGroups(form) {
  const groups = []
  if (!form) return groups
  if (Array.isArray(form.questionGroups)) groups.push(...form.questionGroups)
  if (Array.isArray(form.passages)) {
    for (const p of form.passages) {
      if (Array.isArray(p?.questionGroups)) groups.push(...p.questionGroups)
    }
  }
  if (Array.isArray(form.sections)) {
    for (const s of form.sections) {
      if (Array.isArray(s?.questionGroups)) groups.push(...s.questionGroups)
    }
  }
  return groups
}

/**
 * Khóa nhận dạng của một nhóm câu hỏi.
 * Ưu tiên id thật; nếu không có id thì dùng chỉ số (chỉ để ghép cặp tương đối).
 */
function groupKey(group, index) {
  if (!group) return `idx:${index}`
  const raw = group.id ?? group.groupId ?? group._key ?? group.localId
  if (raw !== null && raw !== undefined && raw !== '') return `id:${raw}`
  return `idx:${index}`
}

function questionNumber(q) {
  return Number(q?.number ?? q?.questionNumber)
}

/**
 * Merge explanations + questions của MỘT nhóm.
 *
 * @param {object} draftGroup - nhóm trong bản nháp
 * @param {object|null} dbGroup - nhóm tương ứng trong DB (null nếu nhóm chỉ có trong nháp)
 * @param {object} dbExps - map giải thích DB theo số câu
 * @param {object} draftExps - map giải thích nháp theo số câu
 * @param {string|null} explicitChoice - 'keep_db' | 'keep_draft' | null
 * @param {number|string|null} draftSavedAt - mốc lưu nháp
 */
function mergeGroupExplanations(draftGroup, dbGroup, dbExps, draftExps, explicitChoice, draftSavedAt) {
  if (!draftGroup) return dbGroup
  const mergedExps = { ...(draftGroup.explanations || {}) }

  let mergedQuestions = draftGroup.questions
  if (Array.isArray(draftGroup.questions)) {
    mergedQuestions = draftGroup.questions.map((q) => {
      const qNum = questionNumber(q)
      if (!qNum) return q

      const dbExp = dbExps[qNum]
      const dExp = draftExps[qNum] || q.explanation

      let chosenExp = dExp
      if (dbExp && !dExp) {
        chosenExp = dbExp
      } else if (dbExp && dExp) {
        if (isExplanationEqual(dbExp, dExp)) {
          chosenExp = dbExp
        } else {
          const choice = resolveQuestionChoice({ explicitChoice, draftSavedAt, dbExp })
          chosenExp = choice === 'keep_draft' ? dExp : dbExp
        }
      }

      if (chosenExp) {
        mergedExps[qNum] = chosenExp
      }

      return {
        ...q,
        explanation: chosenExp || q.explanation,
      }
    })

    // Câu hỏi chỉ có ở DB (được thêm sau khi lưu nháp) -> phải giữ lại.
    if (dbGroup && Array.isArray(dbGroup.questions)) {
      const presentNumbers = new Set(mergedQuestions.map(questionNumber).filter(Boolean))
      for (const dbQ of dbGroup.questions) {
        const qNum = questionNumber(dbQ)
        if (!qNum || presentNumbers.has(qNum)) continue
        presentNumbers.add(qNum)
        mergedQuestions = [...mergedQuestions, dbQ]
      }
    }
  }

  // Giải thích chỉ có ở DB cho các câu đang có trong nhóm -> bổ sung.
  if (Array.isArray(mergedQuestions)) {
    for (const q of mergedQuestions) {
      const qNum = questionNumber(q)
      if (!qNum || mergedExps[qNum]) continue
      const dbExp = dbExps[qNum]
      if (dbExp) mergedExps[qNum] = dbExp
    }
  }

  return {
    ...draftGroup,
    questions: mergedQuestions,
    explanations: mergedExps,
  }
}

/**
 * Ghép danh sách nhóm theo khóa: giữ nhóm của DB, ưu tiên nội dung nháp cho nhóm trùng khóa,
 * bổ sung nhóm chỉ có trong nháp.
 */
function mergeGroupsByKey({ draftGroups, dbGroups, dbExps, draftExps, explicitChoice, draftSavedAt }) {
  const draftByKey = new Map()
  draftGroups.forEach((g, index) => {
    const key = groupKey(g, index)
    if (!draftByKey.has(key)) draftByKey.set(key, g)
  })

  const usedDraftKeys = new Set()
  const result = []

  dbGroups.forEach((dbGroup, index) => {
    const key = groupKey(dbGroup, index)
    const draftGroup = draftByKey.get(key)
    if (draftGroup) {
      usedDraftKeys.add(key)
      result.push(
        mergeGroupExplanations(draftGroup, dbGroup, dbExps, draftExps, explicitChoice, draftSavedAt)
      )
    } else {
      // Nhóm chỉ có ở DB -> giữ nguyên, không để bản nháp cũ xóa mất.
      result.push(dbGroup)
    }
  })

  draftGroups.forEach((draftGroup, index) => {
    const key = groupKey(draftGroup, index)
    if (usedDraftKeys.has(key)) return
    result.push(
      mergeGroupExplanations(draftGroup, null, dbExps, draftExps, explicitChoice, draftSavedAt)
    )
  })

  return result
}

/**
 * Analyze differences between localStorage draft and active DB form.
 *
 * @param {object} params
 * @param {object} params.draftData - Raw data stored in draft
 * @param {object} params.currentDbForm - Current form data loaded from DB
 * @param {number|string|null} [params.draftSavedAt] - Mốc lưu nháp (ms hoặc ISO)
 * @returns {{
 *   draftExplanationCount: number,
 *   differentQuestionNumbers: number[],
 *   differentCount: number,
 *   dbHasNewerQuestions: number[],
 *   draftMayBeNewer: number[],
 *   recommendedChoice: 'keep_db'|'keep_draft',
 *   hasContentDifferences: boolean
 * }}
 */
export function analyzeDraftDifferences({ draftData, currentDbForm, draftSavedAt = null }) {
  if (!draftData) {
    return {
      draftExplanationCount: 0,
      differentQuestionNumbers: [],
      differentCount: 0,
      dbHasNewerQuestions: [],
      draftMayBeNewer: [],
      recommendedChoice: 'keep_db',
      hasContentDifferences: false,
    }
  }

  const draftExps = extractExplanationsMap(draftData)
  const dbExps = extractExplanationsMap(currentDbForm)
  const draftTs = draftTimestamp(draftSavedAt)

  let draftExplanationCount = 0
  for (const exp of Object.values(draftExps)) {
    if (normalizeExplanation(exp)) draftExplanationCount++
  }

  const differentQuestionNumbers = []
  const dbHasNewerQuestions = []
  const draftMayBeNewer = []

  // Collect all question numbers present in either
  const allNumbers = new Set([
    ...Object.keys(draftExps).map(Number),
    ...Object.keys(dbExps).map(Number),
  ])

  for (const qNum of allNumbers) {
    if (!qNum) continue
    const dExp = draftExps[qNum]
    const dbExp = dbExps[qNum]

    const normDraft = normalizeExplanation(dExp)
    const normDb = normalizeExplanation(dbExp)

    if (normDb && !normDraft) {
      dbHasNewerQuestions.push(qNum)
    } else if (normDraft && !normDb) {
      differentQuestionNumbers.push(qNum)
    } else if (normDraft && normDb) {
      if (!isExplanationEqual(dExp, dbExp)) {
        differentQuestionNumbers.push(qNum)
        // So sánh mốc thời gian: nháp lưu sau lần cập nhật cuối của lời giải trong DB
        // => bản nháp có thể chứa chỉnh sửa mới hơn.
        const dbTs = toTimestamp(dbExp?.updatedAt)
        if (draftTs !== null && dbTs !== null && draftTs > dbTs) {
          draftMayBeNewer.push(qNum)
        }
      }
    }
  }

  differentQuestionNumbers.sort((a, b) => a - b)
  dbHasNewerQuestions.sort((a, b) => a - b)
  draftMayBeNewer.sort((a, b) => a - b)

  return {
    draftExplanationCount,
    differentQuestionNumbers,
    differentCount: differentQuestionNumbers.length,
    dbHasNewerQuestions,
    draftMayBeNewer,
    recommendedChoice: draftMayBeNewer.length > 0 && draftMayBeNewer.length >= differentQuestionNumbers.length / 2
      ? 'keep_draft'
      : 'keep_db',
    hasContentDifferences: differentQuestionNumbers.length > 0 || dbHasNewerQuestions.length > 0,
  }
}

/**
 * Smartly merge draft data into DB form without blindly overwriting DB explanations.
 *
 * - Nhóm câu hỏi / câu hỏi chỉ có trong DB luôn được giữ lại.
 * - Giải thích khác nhau được quyết định theo `resolutionChoice`; nếu không truyền
 *   (null) thì so sánh mốc lưu nháp với `explanation.updatedAt` của DB.
 *
 * @param {object} params
 * @param {object} params.draftData - Draft object from localStorage
 * @param {object} params.currentDbForm - Up-to-date form from DB
 * @param {'keep_db'|'keep_draft'|null} [params.resolutionChoice=null] - Cách xử lý giải thích khác nhau
 * @param {number|string|null} [params.draftSavedAt=null] - Mốc lưu nháp (dùng khi resolutionChoice = null)
 * @returns {object} Merged form ready for React state
 */
export function smartMergeDraft({
  draftData,
  currentDbForm,
  resolutionChoice = null,
  draftSavedAt = null,
}) {
  if (!draftData) return currentDbForm
  if (!currentDbForm) return draftData

  const dbExps = extractExplanationsMap(currentDbForm)
  const draftExps = extractExplanationsMap(draftData)
  const explicitChoice = resolutionChoice === 'keep_db' || resolutionChoice === 'keep_draft'
    ? resolutionChoice
    : null

  // Start with draft non-explanation content
  const merged = {
    ...currentDbForm,
    ...draftData,
  }

  const mergeList = (draftGroups, dbGroups) =>
    mergeGroupsByKey({
      draftGroups,
      dbGroups,
      dbExps,
      draftExps,
      explicitChoice,
      draftSavedAt,
    })

  // Ghép passages/sections theo khóa, giữ cả phần chỉ có ở DB.
  const mergeContainerList = (draftList, dbList) => {
    const usedDraftIndexes = new Set()
    const result = []

    dbList.forEach((dbItem, dbIndex) => {
      const draftIndex = draftList.findIndex((draftItem, i) =>
        draftItem?.id != null && dbItem?.id != null ? draftItem.id === dbItem.id : i === dbIndex
      )
      if (draftIndex === -1) {
        result.push(dbItem)
        return
      }
      usedDraftIndexes.add(draftIndex)
      const draftItem = draftList[draftIndex]
      if (!draftItem || !Array.isArray(draftItem.questionGroups)) {
        result.push(dbItem)
        return
      }
      result.push({
        ...draftItem,
        questionGroups: mergeList(
          draftItem.questionGroups,
          Array.isArray(dbItem?.questionGroups) ? dbItem.questionGroups : []
        ),
      })
    })

    draftList.forEach((draftItem, draftIndex) => {
      if (usedDraftIndexes.has(draftIndex)) return
      if (!draftItem || !Array.isArray(draftItem.questionGroups)) {
        result.push(draftItem)
        return
      }
      result.push({ ...draftItem, questionGroups: mergeList(draftItem.questionGroups, []) })
    })

    return result
  }

  // 1. Practice format: questionGroups
  if (Array.isArray(draftData.questionGroups)) {
    merged.questionGroups = mergeList(
      draftData.questionGroups,
      Array.isArray(currentDbForm.questionGroups) ? currentDbForm.questionGroups : []
    )
  }

  // 2. Exam Reading format: passages[].questionGroups
  if (Array.isArray(draftData.passages)) {
    merged.passages = mergeContainerList(
      draftData.passages,
      Array.isArray(currentDbForm.passages) ? currentDbForm.passages : []
    )
  }

  // 3. Exam Listening format: sections[].questionGroups
  if (Array.isArray(draftData.sections)) {
    merged.sections = mergeContainerList(
      draftData.sections,
      Array.isArray(currentDbForm.sections) ? currentDbForm.sections : []
    )
  }

  return merged
}
