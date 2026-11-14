// Merge only the server-confirmed explanation; preserve pending content edits.
export function withSavedExplanation(group, number, explanation) {
  return { ...group,
    questions: (group.questions || []).map(question => Number(question.number ?? question.questionNumber) === Number(number)
      ? { ...question, explanation } : question),
    explanations: { ...group.explanations, [number]: explanation },
  }
}

// Practice form signatures are arrays with questionGroups at a fixed position.
// Patch only this saved field in the baseline, never mark the entire form clean.
export function acknowledgePracticeExplanation(signature, groupsIndex, number, explanation) {
  try {
    const baseline = JSON.parse(signature)
    if (!Array.isArray(baseline?.[groupsIndex])) return signature
    baseline[groupsIndex] = baseline[groupsIndex].map(group =>
      (group.questions || []).some(question => Number(question.number ?? question.questionNumber) === Number(number))
        ? withSavedExplanation(group, number, explanation) : group)
    return JSON.stringify(baseline)
  } catch { return signature }
}
