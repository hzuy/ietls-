'use strict'

const TYPES = new Set(['grammar', 'vocabulary', 'spelling', 'punctuation', 'word_choice', 'coherence'])
const MAX_CORRECTIONS = 40
const MAX_ORIGINAL_LENGTH = 120

function isPunctuationOrCasingOnly(a, b) {
  const normA = String(a || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”\s]+/g, '')
  const normB = String(b || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”\s]+/g, '')
  return normA === normB
}

function normalizeBrAm(word) {
  if (typeof word !== 'string') return ''
  let s = word.trim().toLowerCase()
  s = s.replace(/isation\b/gi, 'ization')
  s = s.replace(/ise\b/gi, 'ize')
  s = s.replace(/our\b/gi, 'or')
  s = s.replace(/re\b/gi, 'er')
  s = s.replace(/yse\b/gi, 'yze')
  s = s.replace(/ogue\b/gi, 'og')
  return s
}

function isBritishAmericanVariant(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const normA = normalizeBrAm(a)
  const normB = normalizeBrAm(b)
  return normA.length > 0 && normA === normB
}

function isExcessiveRewrite(original, corrected) {
  const oWords = String(original || '').trim().split(/\s+/).filter(Boolean)
  const cWords = String(corrected || '').trim().split(/\s+/).filter(Boolean)
  // Nếu cụm gốc ngắn (<= 4 từ) nhưng câu sửa dài gấp hơn 2 lần và >= 7 từ -> viết lại văn mẫu
  if (oWords.length <= 4 && cWords.length >= 7 && cWords.length > oWords.length * 2) {
    return true
  }
  return false
}

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

function sanitizeCorrections(raw, texts, { indexMap, isSpeaking = false } = {}) {
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

    // Trong Speaking, loại bỏ hoàn toàn lỗi dấu câu (văn nói không có dấu câu)
    if (isSpeaking && item.type === 'punctuation') continue

    // Loại bỏ lỗi chỉ khác dấu câu hoặc chữ hoa/thường (vd "food" -> "food,", "month" -> "month.")
    if (isPunctuationOrCasingOnly(original, corrected)) continue

    // Loại bỏ biến thể chính tả Anh-Anh / Anh-Mỹ (vd colour -> color)
    if (isBritishAmericanVariant(original, corrected)) continue

    // Trong Speaking, loại bỏ việc viết lại cả câu văn mẫu (rewriting / ghostwriting)
    if (isSpeaking && isExcessiveRewrite(original, corrected)) continue

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
    if (isPunctuationOrCasingOnly(trimmed.original, trimmed.corrected)) continue
    if (isBritishAmericanVariant(trimmed.original, trimmed.corrected)) continue
    if (isSpeaking && isExcessiveRewrite(trimmed.original, trimmed.corrected)) continue
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

module.exports = {
  sanitizeCorrections,
  TYPES,
  MAX_CORRECTIONS,
  isPunctuationOrCasingOnly,
  isBritishAmericanVariant,
  isExcessiveRewrite
}
