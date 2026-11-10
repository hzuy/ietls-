'use strict'

const { AnswerValidationError, scoreMultiChoice, splitChoiceAnswer } = require('./multiChoice')
const LISTENING_FILL_TYPES = new Set(['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label', 'form_completion', 'summary_completion', 'flow_chart_completion', 'sentence_completion', 'short_answer'])

function gradePractice(skill, exam, groups, answers) {
  const questions = [], types = {}, known = new Set(), slots = new Set()
  let correct = 0, total = 0
  function add(number, type, given, expected, status, explanation) {
    if (slots.has(number)) throw new Error('Overlapping practice question slots')
    slots.add(number)
    const name = (type || 'unknown').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    const stats = types[name] ||= { name, total: 0, correct: 0, wrong: 0, missed: 0 }
    stats.total++; stats[status]++; total++
    if (status === 'correct') correct++
    questions.push({ number, type, grouped: false, status, userAnswer: given, correctAnswer: expected, explanation: explanation || null })
  }
  for (const g of groups) {
    for (const q of g.questions || []) {
      const key = String(skill === 'listening' ? q.number : (q.id ?? q.number))
      known.add(key)
      const given = (answers[key] ?? '').trim(), expected = String(q.correctAnswer ?? '').trim()
      const explanation = g.explanations?.[q.number]
      if (['mcq_multi', 'list_selection'].includes(g.type)) {
        const scored = scoreMultiChoice(given, expected, g.maxChoices, q.options)
        // Comparisons are case-insensitive; review controls need the original
        // option/key text to select the same checkbox that the learner chose.
        let options = q.options
        if (typeof options === 'string') { try { options = JSON.parse(options) } catch { options = [] } }
        const labels = [...splitChoiceAnswer(expected, options), ...(Array.isArray(options) ? options : []), ...splitChoiceAnswer(given, options)].map(String).map(s => s.trim())
        const display = value => labels.find(s => s.toLowerCase() === value) || value
        const picks = [...scored.matches, ...scored.selected.filter(c => !scored.expected.includes(c))]
        const remaining = scored.expected.filter(c => !scored.matches.includes(c))
        for (let i = 0; i < scored.total; i++) {
          const n = Number(q.number) + i
          if (g.qNumberStart != null && (n < g.qNumberStart || n > g.qNumberEnd)) throw new Error('Invalid practice multiple-choice slots')
          const status = i < scored.matches.length ? 'correct' : picks[i] ? 'wrong' : 'missed'
          add(n, g.type, display(picks[i] || ''), display(i < scored.matches.length ? scored.matches[i] : remaining.shift() || ''), status, explanation)
        }
      } else {
        const alts = expected.toLowerCase().split('/').map(s => s.trim()).filter(Boolean)
        // Preserve existing Listening single-choice semantics; slash alternatives
        // apply to completion types, and to all existing Reading single answers.
        const accepted = skill !== 'listening' || LISTENING_FILL_TYPES.has(g.type) ? alts : [expected.toLowerCase()].filter(Boolean)
        const ok = Boolean(given) && accepted.includes(given.toLowerCase())
        add(q.number, g.type || q.type, given, expected, given ? ok ? 'correct' : 'wrong' : 'missed', explanation)
      }
    }
  }
  if (Object.keys(answers).some(k => !known.has(k))) throw new AnswerValidationError('Câu trả lời không thuộc bài luyện tập')
  return { correct, total, result: { title: exam.title, timeSpent: 0, bandScore: 0, questionTypes: Object.values(types), sections: [{ number: 1, from: questions.length ? Math.min(...slots) : 1, to: questions.length ? Math.max(...slots) : 0, questions }] } }
}

module.exports = { gradePractice }
