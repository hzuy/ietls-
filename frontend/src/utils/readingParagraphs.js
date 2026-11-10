// A blank line separates paragraphs; a single newline may just wrap a sentence.
export const readingParagraphs = text => String(text || '').replace(/\r\n?/g, '\n')
  .split(/\n[\t ]*\n+/).map(part => part.trim()).filter(Boolean)

export const needsParagraphLetters = type => ['matching_headings', 'matching_information', 'matching_paragraph'].includes(type)
export const paragraphLettersAlert = 'Vui lòng tích “Đoạn văn có ký hiệu chữ cái (A, B, C...)” trước khi thêm Matching Headings hoặc Matching Information.'

export const practiceParagraphLetters = groups => {
  const setting = (groups || []).find(g => typeof g.letteredParagraphs === 'boolean')
  return setting ? setting.letteredParagraphs : (groups || []).some(g => needsParagraphLetters(g.type))
}
