import { findRange } from './textMatch'

export function buildLocateSpec(explanation) {
  if (explanation?.v !== 2) return null
  const chunks = explanation.evidence?.chunks || []
  const parts = (explanation.evidence?.parts || [])
    .filter(p => p?.text)
    .map((p, i) => ({
      text: p.text,
      chunks: chunks.filter(c => c?.text && (c.part == null || c.part === i)).map(c => c.text),
    }))
  const keywords = (explanation.locate?.keywords || []).filter(Boolean)
  if (!parts.length && !keywords.length) return null
  return { parts, keywords }
}

export function resolveTargets(spec, texts) {
  if (!spec || !Array.isArray(texts) || texts.length === 0) return null
  const byIndex = {}
  const add = (i, text, kind) => (byIndex[i] ||= []).push({ text, kind })
  const has = (i, text) => !!findRange(texts[i], text)

  for (const part of spec.parts) {
    const whole = texts.findIndex((_, i) => has(i, part.text))
    if (whole >= 0) {
      add(whole, part.text, 'evidence')
      continue
    }
    for (const chunk of part.chunks) {
      const i = texts.findIndex((_, j) => has(j, chunk))
      if (i >= 0) add(i, chunk, 'evidence')
    }
  }

  const evidenceIdx = Object.keys(byIndex).map(Number)
  for (const k of spec.keywords) {
    const inEvidence = evidenceIdx.filter(i => has(i, k))
    if (inEvidence.length) {
      inEvidence.forEach(i => add(i, k, 'keyword'))
    } else if (!evidenceIdx.length) {
      const i = texts.findIndex((_, j) => has(j, k))
      if (i >= 0) add(i, k, 'keyword')
    }
  }

  return Object.keys(byIndex).length ? byIndex : null
}
