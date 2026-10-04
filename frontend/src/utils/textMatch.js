const QUOTES = /[‘’ʼ`'"“”]/
const DASHES = /[–—‑]/

function foldChar(ch) {
  if (QUOTES.test(ch)) return ''
  if (DASHES.test(ch)) return '-'
  if (/\s/.test(ch)) return ' '
  return ch.toLowerCase()
}

function buildIndex(text) {
  let folded = ''
  const map = []
  let lastSpace = true
  for (let i = 0; i < text.length; i++) {
    const f = foldChar(text[i])
    if (!f) continue
    if (f === ' ') {
      if (lastSpace) continue
      lastSpace = true
    } else {
      lastSpace = false
    }
    folded += f
    map.push(i)
  }
  return { folded, map }
}

export function normalizeText(text) {
  return buildIndex(String(text || '')).folded.trim()
}

export function findRange(text, phrase) {
  const target = normalizeText(phrase)
  if (!target) return null
  const { folded, map } = buildIndex(String(text || ''))
  const at = folded.indexOf(target)
  if (at === -1) return null
  const start = map[at]
  const end = map[at + target.length - 1] + 1
  return { start, end }
}

export function splitParagraphs(text) {
  return String(text || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean)
}
