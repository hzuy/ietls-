import { splitChoiceAnswer } from './mcqAnswer'
import { containsInternalJargon } from './examExplanationUtils'

const LISTENING_FILL_TYPES = ['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label', 'form_completion', 'summary_completion', 'flow_chart_completion', 'sentence_completion', 'short_answer']

function formatType(type) {
  if (!type) return 'Unknown'
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function totalSlotsOf(groups) {
  return (groups || []).reduce((sum, g) => sum + Math.max(0, (g.qNumberEnd ?? 0) - (g.qNumberStart ?? 0) + 1), 0)
}

function isReadingCorrect(group, userAns, correctAns) {
  if (['mcq_multi', 'list_selection'].includes(group.type)) {
    const norm = s => s.split(',').map(x => x.trim()).filter(Boolean).sort().join(',')
    return norm(userAns) === norm(correctAns)
  }
  return correctAns.split('/').map(x => x.trim()).filter(Boolean).includes(userAns)
}

function isListeningCorrect(group, userRaw, correctRaw) {
  if (LISTENING_FILL_TYPES.includes(group.type)) {
    const alts = correctRaw.split('/').map(a => a.trim().toLowerCase()).filter(Boolean)
    return alts.length > 0 && alts.includes(userRaw.toLowerCase())
  }
  if (['mcq_multi', 'list_selection'].includes(group.type)) {
    const norm = s => s.split(',').map(x => x.trim()).filter(Boolean).sort().join(',')
    return norm(userRaw) === norm(correctRaw)
  }
  return userRaw.toLowerCase() === correctRaw.toLowerCase()
}

const VIETNAMESE_DIACRITICS_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const COMPLETION_TYPES = new Set(['note_completion', 'table_completion', 'fill_blank', 'short_answer', 'drag_word_bank'])

function sanitizeExplanationForLearner(exp, type) {
  if (!exp || typeof exp !== 'object') return exp
  const isCompletion = COMPLETION_TYPES.has(type)
  const res = { ...exp }
  if (!isCompletion) {
    delete res.translation
    delete res.full_sentence
  } else if (res.translation) {
    const hasDiacritic = VIETNAMESE_DIACRITICS_REGEX.test(res.translation)
    if (!hasDiacritic) {
      delete res.translation
    }
  }
  return res
}

export function gradePractice(skill, exam, answers = {}) {
  const groups = exam?.questions?.groups || []
  const questions = []
  const typeStats = {}

  groups.forEach(g => {
    const typeName = formatType(g.type)
    if (!typeStats[typeName]) typeStats[typeName] = { name: typeName, total: 0, correct: 0, wrong: 0, missed: 0 }

    ;(g.questions || []).forEach(q => {
      const key = skill === 'listening' ? q.number : (q.id ?? q.number)
      const given = String(answers[key] ?? '').trim()
      const expected = String(q.correctAnswer ?? '').trim()
      if (['mcq_multi', 'list_selection'].includes(g.type)) {
        let options = q.options
        if (typeof options === 'string') { try { options = JSON.parse(options) } catch { options = [] } }
        const normalizedOptions = (Array.isArray(options) ? options : []).map(o => String(o).trim().toLowerCase())
        const unique = s => [...new Set(splitChoiceAnswer(s.toLowerCase(), normalizedOptions))]
        const selected = unique(given), accepted = unique(expected)
        const labels = [...splitChoiceAnswer(expected, options), ...(Array.isArray(options) ? options : []), ...splitChoiceAnswer(given, options)].map(String).map(s => s.trim())
        const display = value => labels.find(s => s.toLowerCase() === value) || value
        const matches = selected.filter(x => accepted.includes(x))
        const picks = [...matches, ...selected.filter(x => !accepted.includes(x))]
        const remaining = accepted.filter(x => !matches.includes(x))
        const maxChoices = g.maxChoices || 2
        for (let i = 0; i < maxChoices; i++) {
          const status = i < matches.length ? 'correct' : picks[i] ? 'wrong' : 'missed'
          typeStats[typeName][status]++
          typeStats[typeName].total++
          questions.push({ number: q.number + i, grouped: false, type: g.type, status,
            userAnswer: display(picks[i] || ''), correctAnswer: display(i < matches.length ? matches[i] : remaining.shift() || ''),
            explanation: null })
        }
        return
      }
      const isCorrect = skill === 'listening'
        ? isListeningCorrect(g, given, expected)
        : isReadingCorrect(g, given.toLowerCase(), expected.toLowerCase())
      const status = given ? (isCorrect ? 'correct' : 'wrong') : 'missed'

      if (isCorrect) typeStats[typeName].correct++
      else if (given) typeStats[typeName].wrong++
      else typeStats[typeName].missed++
      typeStats[typeName].total++

      questions.push({
        number: q.number,
        grouped: false,
        status,
        userAnswer: skill === 'listening' ? given : (answers[key] || ''),
        correctAnswer: skill === 'listening' ? expected : q.correctAnswer,
        options: q.options || null,
        type: g.type || q.type,
        explanation: (() => {
          const exp = g.explanations?.[q.number] || null
          if (!exp) return null
          if (containsInternalJargon(exp)) return null
          if (exp.status && !['ai_generated', 'teacher_reviewed', 'teacher_edited'].includes(exp.status)) {
            return null
          }
          return sanitizeExplanationForLearner(exp, g.type || q.type)
        })(),
      })
    })
  })

  const result = {
    title: exam?.title,
    timeSpent: 0,
    bandScore: 0,
    questionTypes: Object.values(typeStats),
    sections: [{ number: 1, from: 1, to: totalSlotsOf(groups), questions }],
  }
  const correct = questions.filter(q => q.status === 'correct').length
  return { result, correct, total: questions.length }
}
