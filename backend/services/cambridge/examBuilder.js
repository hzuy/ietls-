const prisma = require('../../lib/prisma')

async function createExamFromExtracted(skill, bookNumber, testNumber, title, data, seriesId) {
  const bn = bookNumber ? parseInt(bookNumber) : null
  const tn = testNumber ? parseInt(testNumber) : null
  const sid = seriesId ? parseInt(seriesId) : null

  if (skill === 'reading') {
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'reading', bookNumber: bn, testNumber: tn, seriesId: sid,
        passages: {
          create: (data.passages || []).map(p => ({
            number: p.number, title: p.title || '', body: p.body || '',
            questions: {
              create: (p.questions || []).map(q => ({
                number: q.number, type: q.type, questionText: q.questionText || '',
                options: q.options ? JSON.stringify(q.options) : null,
                correctAnswer: q.correctAnswer || '', imageUrl: q.imageUrl || null
              }))
            }
          }))
        }
      }
    })
    const totalQ = (data.passages || []).reduce((s, p) => s + (p.questions?.length || 0), 0)
    return { examId: exam.id, questionCount: totalQ }
  }

  if (skill === 'listening') {
    const exam = await prisma.exam.create({
      data: { title, skill: 'listening', bookNumber: bn, testNumber: tn, seriesId: sid }
    })
    let totalQ = 0
    for (const s of (data.sections || [])) {
      const section = await prisma.listeningSection.create({
        data: { examId: exam.id, number: s.number, context: s.context || '', audioUrl: null, transcript: s.transcript || '' }
      })
      for (const q of (s.questions || [])) {
        await prisma.question.create({
          data: {
            listeningSectionId: section.id, number: q.number, type: q.type,
            questionText: q.questionText || '',
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || '', imageUrl: q.imageUrl || null
          }
        })
        totalQ++
      }
    }
    return { examId: exam.id, questionCount: totalQ }
  }

  if (skill === 'writing') {
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'writing', bookNumber: bn, testNumber: tn, seriesId: sid,
        writingTasks: {
          create: [
            { number: 1, prompt: data.task1?.prompt || '', imageUrl: null, minWords: 150 },
            { number: 2, prompt: data.task2?.prompt || '', imageUrl: null, minWords: 250 }
          ]
        }
      }
    })
    return { examId: exam.id, questionCount: 2 }
  }

  if (skill === 'speaking') {
    const part3Questions = (data.part3?.topics || []).flatMap(t => [
      t.label?.trim() ? `##TOPIC##:${t.label.trim()}` : null,
      ...(t.questions || []).filter(q => q?.trim())
    ]).filter(Boolean)
    const exam = await prisma.exam.create({
      data: {
        title, skill: 'speaking', bookNumber: bn, testNumber: tn, seriesId: sid,
        speakingParts: {
          create: [
            { number: 1, cueCard: data.part1?.description || null, questions: { create: (data.part1?.questions || []).map((q, i) => ({ orderNum: i + 1, questionText: q })) } },
            { number: 2, cueCard: data.part2?.cueCard || null, questions: { create: (data.part2?.questions || []).map((q, i) => ({ orderNum: i + 1, questionText: q })) } },
            { number: 3, cueCard: data.part3?.description || null, questions: { create: part3Questions.map((q, i) => ({ orderNum: i + 1, questionText: q })) } }
          ]
        }
      }
    })
    const totalQ = (data.part1?.questions?.length || 0) + (data.part2?.questions?.length || 0) + part3Questions.length
    return { examId: exam.id, questionCount: totalQ }
  }

  throw new Error('Unknown skill: ' + skill)
}

module.exports = {
  createExamFromExtracted
}
