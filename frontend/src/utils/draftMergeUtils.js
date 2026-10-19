/**
 * Utilities for Smart Draft Merging and Diff Detection
 * Ensures drafts saved in localStorage never inadvertently overwrite newer AI explanations
 * or database edits.
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

  const allGroups = []
  if (Array.isArray(form.questionGroups)) {
    allGroups.push(...form.questionGroups)
  }
  if (Array.isArray(form.passages)) {
    for (const p of form.passages) {
      if (Array.isArray(p?.questionGroups)) allGroups.push(...p.questionGroups)
    }
  }
  if (Array.isArray(form.sections)) {
    for (const s of form.sections) {
      if (Array.isArray(s?.questionGroups)) allGroups.push(...s.questionGroups)
    }
  }

  for (const group of allGroups) {
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

/**
 * Helper to merge an individual questionGroup's explanations
 */
function mergeGroupExplanations(draftGroup, dbExps, draftExps, resolutionChoice) {
  if (!draftGroup) return draftGroup
  const mergedExps = { ...(draftGroup.explanations || {}) }

  let mergedQuestions = draftGroup.questions
  if (Array.isArray(draftGroup.questions)) {
    mergedQuestions = draftGroup.questions.map((q) => {
      const qNum = Number(q.number ?? q.questionNumber)
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
          chosenExp = resolutionChoice === 'keep_draft' ? dExp : dbExp
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
  }

  for (const [k, dbExp] of Object.entries(dbExps)) {
    const qNum = Number(k)
    if (!qNum) continue
    const dExp = mergedExps[qNum]
    if (!dExp && dbExp) {
      mergedExps[qNum] = dbExp
    } else if (dExp && dbExp) {
      if (!isExplanationEqual(dExp, dbExp) && resolutionChoice === 'keep_db') {
        mergedExps[qNum] = dbExp
      }
    }
  }

  return {
    ...draftGroup,
    questions: mergedQuestions,
    explanations: mergedExps,
  }
}

/**
 * Analyze differences between localStorage draft and active DB form.
 *
 * @param {object} params
 * @param {object} params.draftData - Raw data stored in draft
 * @param {object} params.currentDbForm - Current form data loaded from DB
 * @returns {{
 *   draftExplanationCount: number,
 *   differentQuestionNumbers: number[],
 *   differentCount: number,
 *   dbHasNewerQuestions: number[],
 *   hasContentDifferences: boolean
 * }}
 */
export function analyzeDraftDifferences({ draftData, currentDbForm }) {
  if (!draftData) {
    return {
      draftExplanationCount: 0,
      differentQuestionNumbers: [],
      differentCount: 0,
      dbHasNewerQuestions: [],
      hasContentDifferences: false,
    }
  }

  const draftExps = extractExplanationsMap(draftData)
  const dbExps = extractExplanationsMap(currentDbForm)

  let draftExplanationCount = 0
  for (const exp of Object.values(draftExps)) {
    if (normalizeExplanation(exp)) draftExplanationCount++
  }

  const differentQuestionNumbers = []
  const dbHasNewerQuestions = []

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
      }
    }
  }

  differentQuestionNumbers.sort((a, b) => a - b)
  dbHasNewerQuestions.sort((a, b) => a - b)

  return {
    draftExplanationCount,
    differentQuestionNumbers,
    differentCount: differentQuestionNumbers.length,
    dbHasNewerQuestions,
    hasContentDifferences: differentQuestionNumbers.length > 0 || dbHasNewerQuestions.length > 0,
  }
}

/**
 * Smartly merge draft data into DB form without blindly overwriting DB explanations.
 *
 * @param {object} params
 * @param {object} params.draftData - Draft object from localStorage
 * @param {object} params.currentDbForm - Up-to-date form from DB
 * @param {'keep_db'|'keep_draft'} [params.resolutionChoice='keep_db'] - How to resolve differing explanations
 * @returns {object} Merged form ready for React state
 */
export function smartMergeDraft({ draftData, currentDbForm, resolutionChoice = 'keep_db' }) {
  if (!draftData) return currentDbForm

  const dbExps = extractExplanationsMap(currentDbForm)
  const draftExps = extractExplanationsMap(draftData)

  // Start with draft non-explanation content
  const merged = {
    ...currentDbForm,
    ...draftData,
  }

  // 1. Practice format: questionGroups
  if (Array.isArray(draftData.questionGroups)) {
    merged.questionGroups = draftData.questionGroups.map((draftGroup) =>
      mergeGroupExplanations(draftGroup, dbExps, draftExps, resolutionChoice)
    )
  }

  // 2. Exam Reading format: passages[].questionGroups
  if (Array.isArray(draftData.passages)) {
    merged.passages = draftData.passages.map((draftPassage) => {
      if (!draftPassage || !Array.isArray(draftPassage.questionGroups)) return draftPassage
      return {
        ...draftPassage,
        questionGroups: draftPassage.questionGroups.map((draftGroup) =>
          mergeGroupExplanations(draftGroup, dbExps, draftExps, resolutionChoice)
        ),
      }
    })
  }

  // 3. Exam Listening format: sections[].questionGroups
  if (Array.isArray(draftData.sections)) {
    merged.sections = draftData.sections.map((draftSection) => {
      if (!draftSection || !Array.isArray(draftSection.questionGroups)) return draftSection
      return {
        ...draftSection,
        questionGroups: draftSection.questionGroups.map((draftGroup) =>
          mergeGroupExplanations(draftGroup, dbExps, draftExps, resolutionChoice)
        ),
      }
    })
  }

  return merged
}
