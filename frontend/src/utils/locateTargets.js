import { findRange } from './textMatch'

export function buildLocateSpec(explanation) {
  if (explanation?.v !== 2) return null
  const chunks = explanation.evidence?.chunks || []
  const parts = (explanation.evidence?.parts || [])
    .filter(p => p?.text)
    .map((p, i) => ({
      text: p.text,
      paragraph: Number.isInteger(p.paragraph) ? p.paragraph : null,
      chunks: chunks.filter(c => c?.text && (c.part == null || c.part === i)).map(c => c.text),
    }))
  const keywords = (explanation.locate?.keywords || []).filter(Boolean)
  const locateParagraph = Number.isInteger(explanation.locate?.paragraph) ? explanation.locate.paragraph : null
  if (!parts.length && !keywords.length) return null
  return { parts, keywords, locateParagraph }
}

export function resolveTargets(spec, texts) {
  if (!spec || !Array.isArray(texts) || texts.length === 0) return null
  const byIndex = {}
  const add = (i, text, kind) => {
    const list = (byIndex[i] ||= [])
    if (!list.some(m => m.text === text && m.kind === kind)) list.push({ text, kind })
  }
  const has = (i, text) => !!findRange(texts[i], text)
  // Ưu tiên đoạn được chỉ định (hint) rồi mới quét toàn bài — tránh việc câu trùng
  // chữ ở đoạn khác bị highlight sai chỗ.
  const find = (text, hint) => {
    if (Number.isInteger(hint) && hint >= 0 && hint < texts.length && has(hint, text)) return hint
    return texts.findIndex((_, i) => has(i, text))
  }

  for (const part of spec.parts) {
    const whole = find(part.text, part.paragraph)
    if (whole >= 0) {
      add(whole, part.text, 'evidence')
      continue
    }
    for (const chunk of part.chunks) {
      const i = find(chunk, part.paragraph)
      if (i >= 0) add(i, chunk, 'evidence')
    }
  }

  // Từ khóa luôn được gạch chân, kể cả khi không nằm trong đoạn evidence: trước đây
  // từ khóa bị bỏ qua trong trường hợp này nên nhiều câu "chỗ có gạch chân, chỗ không".
  const evidenceIdx = Object.keys(byIndex).map(Number)
  for (const k of spec.keywords) {
    let i = find(k, spec.locateParagraph)
    if (i < 0) i = evidenceIdx.find(idx => has(idx, k)) ?? -1
    if (i >= 0) add(i, k, 'keyword')
  }

  return Object.keys(byIndex).length ? byIndex : null
}
