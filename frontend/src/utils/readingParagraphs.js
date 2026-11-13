// A blank line separates paragraphs; a single newline may just wrap a sentence.
export const readingParagraphs = text => String(text || '').replace(/\r\n?/g, '\n')
  .split(/\n[\t ]*\n+/).map(part => part.trim()).filter(Boolean)

export const needsParagraphLetters = type => ['matching_headings', 'matching_information', 'matching_paragraph'].includes(type)
export const paragraphLettersAlert = 'Vui lòng tích “Đoạn văn có ký hiệu chữ cái (A, B, C...)” trước khi thêm Matching Headings hoặc Matching Information.'

export const practiceParagraphLetters = groups => {
  const setting = (groups || []).find(g => typeof g.letteredParagraphs === 'boolean')
  return setting ? setting.letteredParagraphs : (groups || []).some(g => needsParagraphLetters(g.type))
}

// Paragraph text belongs to the passage. Persist only its current letter choices,
// never a second copy of the prose that can become stale after editing.
export function paragraphMatchingOptions(passage, previous = []) {
  return readingParagraphs(passage).map((_, index) => {
    const letter = String.fromCharCode(65 + index)
    const option = { ...(previous || []).find(item => (item.letter ?? item.optionLetter) === letter), letter, text: '' }
    delete option.optionLetter
    delete option.optionText
    return option
  })
}

export function syncParagraphGroups(groups = [], passage = '', letteredParagraphs = false) {
  groups = groups || []
  if (!letteredParagraphs) return groups
  return groups.map(group => {
    if (group.type !== 'matching_information') return group
    const matchingOptions = paragraphMatchingOptions(passage, group.matchingOptions)
    return JSON.stringify(matchingOptions) === JSON.stringify(group.matchingOptions)
      ? group : { ...group, matchingOptions }
  })
}
