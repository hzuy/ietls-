'use strict'

const OPEN_TYPES = new Set(['fill_blank', 'short_answer', 'note_completion', 'table_completion', 'form_completion', 'sentence_completion', 'summary_completion', 'flow_chart_completion'])
const TOKENS = /\[Q:(\d+)\]/g
const blankNumbers = text => [...String(text || '').matchAll(TOKENS)].map(match => Number(match[1]))
const normalize = text => String(text || '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const sentence = text => normalize(text).replace(/[.!?;:,]+$/, '').trim()

function isSentenceMatch(expectedSentence, actualSentence) {
  const normExpected = sentence(expectedSentence)
  const normActual = sentence(actualSentence)
  if (!normExpected || !normActual) return false
  if (normExpected === normActual) return true

  // Match ignoring leading articles / initial word typos like "the", "a", "an", "he"
  const stripLeading = s => s.replace(/^(?:the|a|an|he)\s+/i, '').trim()
  if (stripLeading(normExpected) === stripLeading(normActual)) return true

  // High word overlap (>= 80%) for sentences with 3+ words, preventing false rejections from minor typos/variants
  const wordsExp = normExpected.split(/\s+/).filter(Boolean)
  const wordsAct = normActual.split(/\s+/).filter(Boolean)
  if (wordsExp.length >= 3 && wordsAct.length >= 3) {
    const actSet = new Set(wordsAct)
    const matchCount = wordsExp.filter(w => actSet.has(w)).length
    const ratio = matchCount / Math.max(wordsExp.length, wordsAct.length)
    if (ratio >= 0.8) return true
  }

  return false
}
const issue = (code, message, action = 'edit_source') => ({ code, message, action })
const isOpen = (q, group) => OPEN_TYPES.has(group?.type || q?.type)
const needsTarget = (q, group) => isOpen(q, group) || ((group?.type || q?.type) === 'drag_word_bank'
  && (group?.noteSections || []).some(section => (section.lines || []).some(line => blankNumbers(line.contentWithTokens || line.content).length)))

function fragment(text, number) {
  const matches = [...text.matchAll(TOKENS)]
  const target = matches.filter(match => Number(match[1]) === number)
  if (target.length !== 1) return null
  const current = target[0]
  const previous = matches.filter(match => match.index < current.index).at(-1)
  const next = matches.find(match => match.index > current.index)
  return { template: text.slice(previous ? previous.index + previous[0].length : 0, next ? next.index : text.length).trim(),
    fragment: Boolean(previous || next) }
}

function completionTarget(q, group = q?.group) {
  const number = Number(q?.number)
  const empty = { number, found: false, explicit: false, template: null, context: null, fragment: false }
  if (!needsTarget(q, group)) return { ...empty, applicable: false }
  const sections = group?.noteSections || []
  const matches = []
  let otherBlanks = false
  for (const section of sections) {
    const lines = (section.lines || []).flatMap(line => String(line.contentWithTokens || line.content || '').split(/\r?\n/))
    lines.forEach((line, index) => {
      const numbers = blankNumbers(line)
      if (numbers.length) otherBlanks = true
      if (!numbers.includes(number)) return
      const cells = line.split('|')
      for (const cell of cells) {
        if (!blankNumbers(cell).includes(number)) continue
        const target = fragment(cell, number)
        if (!target) { matches.push(null); continue }
        const safe = value => value && !blankNumbers(value).length ? value.trim() : ''
        const context = [safe(section.title), safe(lines[index - 1]), ...cells.filter(value => value !== cell).map(safe),
          target.template, safe(lines[index + 1])].filter(Boolean).join('\n')
        matches.push({ ...empty, applicable: true, found: true, explicit: true, ...target, context, source: 'notes' })
      }
    })
  }
  if (matches.length === 1 && matches[0]) return matches[0]
  if (matches.length) return { ...empty, applicable: true, reason: 'ambiguous' }

  let text = String(q?.questionText || '').trim()
  const numbers = blankNumbers(text)
  if (numbers.includes(number)) {
    const target = fragment(text, number)
    if (target) return { ...empty, applicable: true, found: true, explicit: true, ...target, context: target.template, source: 'question' }
  }
  if (!numbers.length && (text.match(/_{2,}/g) || []).length === 1) {
    text = text.replace(/_{2,}/, `[Q:${number}]`)
    return { ...empty, applicable: true, found: true, explicit: true, template: text, context: text, source: 'question' }
  }
  if (text && !numbers.length && !otherBlanks) return { ...empty, applicable: true, found: true, context: text, source: 'question' }
  return { ...empty, applicable: true, reason: 'missing' }
}

function answerVariants(answer) {
  return [...new Set(String(answer || '').split(/\s*[/|]\s*/).flatMap(value => {
    if (!value.includes('(')) return [value.trim()]
    return [value.replace(/\([^)]*\)/g, '').trim(), value.replace(/[()]/g, '').trim()]
  }).filter(Boolean))]
}

function sourceAnswerIssue(q, group = q?.group) {
  if (!isOpen(q, group) || !/\bfrom\s+(?:the\s+)?(?:reading\s+)?(?:passage|text)\b/i.test(group?.instruction || '')) return null
  // Audio and free-form answers are not subject to a passage-word restriction.
  if (q?.listeningSection || group?.section || q?.exam?.skill === 'listening') return null
  const source = normalize(q?.passage?.body || group?.passage?.body || '')
  if (!source) return null
  const allowed = answerVariants(q?.correctAnswer)
  const literal = allowed.some(value => {
    const escaped = normalize(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return escaped && new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(source)
  })
  return literal ? null : issue('ANSWER_NOT_IN_SOURCE', 'Đáp án đã lưu không có nguyên văn trong bài đọc theo yêu cầu đề. Kiểm tra lại đáp án hoặc dữ liệu đề.')
}

function targetIssue(payload, q, group = q?.group) {
  const target = completionTarget(q, group)
  if (!target.applicable) return null
  const sourceIssue = sourceAnswerIssue(q, group)
  if (sourceIssue) return sourceIssue
  if (payload?.no_support) return null
  if (!target.found) return issue('QUESTION_CONTEXT_MISSING', 'Chưa xác định được đúng chỗ trống của câu này. Kiểm tra nội dung câu hỏi và các nhãn [Q:n].')
  const texts = (payload?.question_chunks || []).map(chunk => String(chunk?.text || ''))
  const numbers = texts.flatMap(text => [...blankNumbers(text), ...[...text.matchAll(/\b(\d+)\.\s*_{2,}/g)].map(match => Number(match[1]))])
  if (numbers.some(number => number !== target.number)) return issue('QUESTION_CONTEXT_MISMATCH', 'Lời giải đang giải thích chỗ trống của câu khác. Tạo lại đúng câu này.', 'retry_generation')
  if (target.explicit && texts.length) {
    const canonical = text => normalize(String(text).replace(TOKENS, ' targetblank ')).replace(/\b\d+\.\s*_{2,}/g, ' targetblank ')
      .replace(/_{2,}/g, ' targetblank ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
    const template = canonical(target.template)
    if (texts.some(text => canonical(text) && !template.includes(canonical(text)))) return issue('QUESTION_CONTEXT_MISMATCH', 'Các cụm câu hỏi trong lời giải không thuộc chỗ trống đang chọn. Tạo lại đúng câu này.', 'retry_generation')
  }
  if (isOpen(q, group) && target.explicit && String(payload?.full_sentence || '').trim()) {
    const valid = answerVariants(q?.correctAnswer).some(answer => isSentenceMatch(target.template.replace(TOKENS, answer), payload.full_sentence))
    if (!valid) return issue('QUESTION_CONTEXT_MISMATCH', 'Câu hoàn chỉnh không khớp chỗ trống của câu đang chọn. Tạo lại đúng câu này.', 'retry_generation')
  }
  return null
}

function adminTargetView(projected, q, group = q?.group) {
  if (projected?.status === 'possibly_stale') return projected
  if (!projected || (!projected.hasDraft && !['conflict_pending', 'needs_regeneration'].includes(projected.status))) return projected
  const problem = projected.contentIssue?.code === 'ANSWER_MISMATCH' ? projected.contentIssue : targetIssue(projected, q, group)
  if (!problem) return projected
  return { ...projected, status: 'needs_regeneration', contentIssue: problem, validationIssue: problem.message,
    needsRegenerationReason: problem.message, canUse: false }
}

module.exports = { completionTarget, targetIssue, adminTargetView, sourceAnswerIssue }
