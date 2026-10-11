const LISTENING_FILL_TYPES = ['note_completion', 'table_completion', 'drag_word_bank', 'diagram_label']

function formatType(type) {
  if (!type) return 'Unknown'
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function totalSlotsOf(groups) {
  return (groups || []).reduce((sum, g) => sum + Math.max(0, (g.qNumberEnd ?? 0) - (g.qNumberStart ?? 0) + 1), 0)
}

function isReadingCorrect(group, userAns, correctAns) {
  if (group.type === 'mcq_multi') {
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
  if (group.type === 'mcq_multi') {
    const norm = s => s.split(',').map(x => x.trim()).filter(Boolean).sort().join(',')
    return norm(userRaw) === norm(correctRaw)
  }
  return userRaw.toLowerCase() === correctRaw.toLowerCase()
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
        explanation: g.explanations?.[q.number] || null,
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
