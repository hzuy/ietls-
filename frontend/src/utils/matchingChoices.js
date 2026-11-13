// Option content is author-defined; letters follow the visible list order.
// Remap by the old key so an explicit deletion cannot shift an answer to a
// different category. Existing question identity and metadata are preserved.
export function relabelMatchingChoices(group, options = group.matchingOptions || []) {
  const optionKey = option => option.letter || option.optionLetter
  const originalKeys = new Set((group.matchingOptions || []).map(optionKey).filter(Boolean))
  const unresolved = new Set((group.questions || []).map(question => question.correctAnswer).filter(answer => answer && !originalKeys.has(answer)))
  const letters = new Map()
  let index = 0
  const matchingOptions = options.map(option => {
    // A dangling legacy answer must remain visibly invalid; assigning its key
    // to a newly relabeled choice would silently give that answer a new meaning.
    while (unresolved.has(String.fromCharCode(65 + index))) index++
    const letter = String.fromCharCode(65 + index++)
    const oldKey = optionKey(option)
    if (oldKey) letters.set(oldKey, letter)
    const next = { ...option, letter, text: option.text ?? option.optionText ?? '' }
    delete next.optionLetter
    delete next.optionText
    return next
  })
  const removed = new Set([...originalKeys].filter(letter => !letters.has(letter)))
  return { ...group, matchingOptions, questions: (group.questions || []).map(question => ({
    ...question, correctAnswer: question.correctAnswer ? letters.get(question.correctAnswer) ?? (removed.has(question.correctAnswer) ? '' : question.correctAnswer) : question.correctAnswer,
  })) }
}
