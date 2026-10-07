const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const attempts = await prisma.attempt.findMany({
    where: { totalCount: null }
  })
  console.log(`Found ${attempts.length} attempts to backfill.`)

  for (const attempt of attempts) {
    if (!attempt.answers) continue;
    try {
      const answers = JSON.parse(attempt.answers)
      let correct = 0
      let total = 0
      
      const exam = await prisma.exam.findUnique({
        where: { id: attempt.examId },
        include: {
          passages: { include: { questions: true, questionGroups: { include: { questions: true } } } },
          listeningSections: { include: { questions: true, questionGroups: { include: { questions: true } } } }
        }
      })
      
      if (!exam) continue;

      if (exam.skill === 'reading') {
        for (const p of exam.passages) {
          for (const q of p.questions) {
            total++
            const userAnswer = (answers[q.id] || '').trim().toLowerCase()
            const acceptedAnswers = (q.correctAnswer || '').split('/').map(a => a.trim().toLowerCase())
            if (acceptedAnswers.includes(userAnswer)) correct++
          }
          for (const g of p.questionGroups) {
            total += g.qNumberEnd - g.qNumberStart + 1
            const maxC = g.maxChoices || 2
            const activeQs = g.type === 'mcq_multi' ? g.questions : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)
            for (const q of activeQs) {
              const userAnswerStr = answers[q.id] || ''
              if (g.type === 'mcq_multi') {
                const userArr = userAnswerStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
                const correctArr = (q.correctAnswer || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
                let matchCount = 0
                for (const ua of userArr) {
                  if (correctArr.includes(ua)) matchCount++
                }
                correct += matchCount
              } else {
                const userAnswer = userAnswerStr.trim().toLowerCase()
                const acceptedAnswers = (q.correctAnswer || '').split('/').map(a => a.trim().toLowerCase())
                if (acceptedAnswers.includes(userAnswer)) correct++
              }
            }
          }
        }
      } else if (exam.skill === 'listening') {
        for (const s of exam.listeningSections) {
          for (const q of s.questions) {
            total++
            const userAnswer = (answers[q.id] || '').trim().toLowerCase()
            const acceptedAnswers = (q.correctAnswer || '').split('/').map(a => a.trim().toLowerCase())
            if (acceptedAnswers.includes(userAnswer)) correct++
          }
          for (const g of s.questionGroups) {
            total += g.qNumberEnd - g.qNumberStart + 1
            const maxC = g.maxChoices || 2
            const activeQs = g.type === 'mcq_multi' ? g.questions : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)
            for (const q of activeQs) {
              const userAnswerStr = answers[q.id] || ''
              if (g.type === 'mcq_multi') {
                const userArr = userAnswerStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
                const correctArr = (q.correctAnswer || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
                let matchCount = 0
                for (const ua of userArr) {
                  if (correctArr.includes(ua)) matchCount++
                }
                correct += matchCount
              } else {
                const userAnswer = userAnswerStr.trim().toLowerCase()
                const acceptedAnswers = (q.correctAnswer || '').split('/').map(a => a.trim().toLowerCase())
                if (acceptedAnswers.includes(userAnswer)) correct++
              }
            }
          }
        }
      }

      if (total > 0) {
        await prisma.attempt.update({
          where: { id: attempt.id },
          data: { correctCount: correct, totalCount: total }
        })
        console.log(`Updated attempt ${attempt.id}: ${correct}/${total}`)
      }
    } catch (e) {
      console.error(`Failed to process attempt ${attempt.id}:`, e)
    }
  }
}
main().finally(() => prisma.$disconnect())
