const countTokens = s => (String(s || '').match(/\[Q:\d+\]/g) || []).length

export function lineText(line) {
  if (!line) return ''
  const withTokens = line.contentWithTokens
  const content = line.content
  if (!withTokens) return content || ''
  if (!content) return withTokens
  if (countTokens(content) > countTokens(withTokens)) return content
  if (countTokens(content) === countTokens(withTokens) && content.length > withTokens.length && content.startsWith(withTokens.trimEnd())) return content
  return withTokens
}
