'use strict'

class AnswerValidationError extends Error {}

const normalize = value => String(value ?? '').trim().toLowerCase()
// Commas inside a known option are content, not selection separators.
function splitChoiceAnswer(value, options = []) {
  const answer = String(value ?? '').trim()
  const fallback = () => answer.split(',').map(s => s.trim()).filter(Boolean)
  let raw = options
  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { raw = [] } }
  if (!answer || !Array.isArray(raw) || !raw.some(o => String(o).includes(','))) return fallback()
  const candidates = [...new Set(raw.map(o => String(o ?? '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const tokens = []
  let rest = answer
  while (rest) {
    const option = candidates.find(o => rest.toLowerCase().startsWith(o.toLowerCase()) && (!rest.slice(o.length).trimStart() || rest.slice(o.length).trimStart().startsWith(',')))
    if (!option) return fallback()
    tokens.push(option)
    rest = rest.slice(option.length).trimStart()
    if (rest) rest = rest.slice(1).trimStart()
  }
  return tokens
}
const choices = (value, options) => [...new Set(splitChoiceAnswer(value, options).map(normalize).filter(Boolean))]

function optionValues(raw) {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  return Array.isArray(raw) ? raw.filter(v => typeof v === 'string').map(normalize).filter(Boolean) : []
}

// Each distinct correct selection earns one slot. Never count repeated picks.
function scoreMultiChoice(value, correctAnswer, maxChoices = 2, options = null, { validate = true } = {}) {
  if (typeof value !== 'string') throw new AnswerValidationError('Đáp án phải là chuỗi')
  const limit = Number(maxChoices || 2)
  const expected = choices(correctAnswer, options)
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || expected.length > limit) {
    throw new Error('Invalid multiple-choice answer key')
  }
  const selected = choices(value, options)
  if (validate && selected.length > limit) throw new AnswerValidationError('Số lựa chọn vượt giới hạn cho phép')
  const opts = optionValues(options)
  // Older exams may store letter keys while options contain their display text.
  const allowed = opts.length && expected.every(c => /^[a-z]$/.test(c)) && !expected.every(c => opts.includes(c))
    ? opts.map((_, i) => String.fromCharCode(97 + i)) : opts
  if (validate && allowed.length && selected.some(c => !allowed.includes(c))) {
    throw new AnswerValidationError('Lựa chọn không thuộc câu hỏi')
  }
  const matches = selected.filter(c => expected.includes(c))
  return { selected, expected, matches, correct: matches.length, total: limit }
}

module.exports = { AnswerValidationError, scoreMultiChoice, choices, splitChoiceAnswer }
