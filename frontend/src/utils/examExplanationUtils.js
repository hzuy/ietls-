/**
 * Utility functions for syncing and managing explanations in Cambridge Exams (Reading & Listening).
 */

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
          noteSections: g.noteSections,
          matchingOptions: g.matchingOptions,
          questions: (g.questions || []).map(q => ({
            id: q.id,
            number: q.number,
            questionText: q.questionText || '',
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
