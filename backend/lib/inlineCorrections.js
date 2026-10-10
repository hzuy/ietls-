'use strict'

const TYPES = new Set(['grammar', 'vocabulary', 'spelling', 'punctuation', 'word_choice', 'coherence'])
const MAX_CORRECTIONS = 40
const MAX_ORIGINAL_LENGTH = 120

function locate(text, original, cursor) {
  let at = text.indexOf(original, cursor)
  if (at >= 0) return { at, original }
  const lower = text.toLowerCase()
  const needle = original.toLowerCase()
  at = lower.indexOf(needle, cursor)
  if (at < 0) at = lower.indexOf(needle)
  if (at < 0) return null
  return { at, original: text.slice(at, at + original.length) }
}

function trimSharedWords(original, corrected) {
  const o = original.split(' ')
  const c = corrected ? corrected.split(' ') : []
  if (o.join(' ') !== original) return { offset: 0, original, corrected }
  let pre = 0
  while (pre < o.length - 1 && pre < c.length && o[pre] === c[pre]) pre++
  let suf = 0
  while (suf < o.length - 1 - pre && suf < c.length - pre && o[o.length - 1 - suf] === c[c.length - 1 - suf]) suf++
  const offset = pre ? o.slice(0, pre).join(' ').length + 1 : 0
  return { offset, original: o.slice(pre, o.length - suf).join(' '), corrected: c.slice(pre, c.length - suf).join(' ') }
}

function sanitizeCorrections(raw, texts, { indexMap } = {}) {
  if (!Array.isArray(raw) || !Array.isArray(texts)) return []
  const cursors = {}
  const taken = {}
  const out = []
  for (const item of raw) {
    if (out.length >= MAX_CORRECTIONS) break
    if (!item || typeof item !== 'object') continue
    const original = String(item.original || '').trim()
    const corrected = String(item.corrected ?? '').trim()
    if (!original || original.length > MAX_ORIGINAL_LENGTH || original === corrected) continue

    let answer = 0
    if (indexMap) {
      const n = parseInt(item.answer, 10)
      if (!Number.isFinite(n) || indexMap[n - 1] == null) continue
      answer = indexMap[n - 1]
    }
    const text = texts[answer]
    if (typeof text !== 'string' || !text) continue

    const found = locate(text, original, cursors[answer] || 0)
    if (!found) continue
    const trimmed = trimSharedWords(found.original, corrected)
    if (!trimmed.original || trimmed.original === trimmed.corrected) continue
    const start = found.at + trimmed.offset
    const end = start + trimmed.original.length
    const ranges = taken[answer] || (taken[answer] = [])
    if (ranges.some(r => start < r.end && end > r.start)) continue
    ranges.push({ start, end })
    cursors[answer] = found.at + found.original.length

    const type = TYPES.has(item.type) ? item.type : 'grammar'
    out.push({
      answer,
      start,
      end,
      original: trimmed.original,
      corrected: trimmed.corrected,
      type,
      explanation: String(item.explanation || '').trim().slice(0, 400),
    })
  }
  return out.sort((a, b) => a.answer - b.answer || a.start - b.start)
}

module.exports = { sanitizeCorrections, TYPES, MAX_CORRECTIONS }
