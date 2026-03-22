const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

function getReadingBand(correct) {
  if (correct >= 39) return 9.0
  if (correct >= 37) return 8.5
  if (correct >= 35) return 8.0
  if (correct >= 33) return 7.5
  if (correct >= 30) return 7.0
  if (correct >= 27) return 6.5
  if (correct >= 23) return 6.0
  if (correct >= 19) return 5.5
  if (correct >= 15) return 5.0
  if (correct >= 13) return 4.5
  if (correct >= 10) return 4.0
  if (correct >= 8)  return 3.5
  if (correct >= 6)  return 3.0
  if (correct >= 4)  return 2.5
  return 0
}

// Danh sách đề Reading
router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { skill: 'reading' },
      select: {
        id: true, title: true, createdAt: true, coverImageUrl: true,
        passages: {
          select: {
            questions: { where: { groupId: null }, select: { id: true } },
            questionGroups: {
              select: {
                qNumberStart: true, qNumberEnd: true,
                questions: { select: { number: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    const result = exams.map(e => ({
      ...e,
      _count: {
        questions: e.passages.reduce((sum, p) => {
          const fromGroups = p.questionGroups.reduce((gs, g) => gs + (g.qNumberEnd - g.qNumberStart + 1), 0)
          return sum + p.questions.length + fromGroups
        }, 0)
      },
      passages: undefined
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Chi tiết 1 đề
router.get('/exams/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        passages: {
          orderBy: { number: 'asc' },
          include: {
            questions: { where: { groupId: null }, orderBy: { number: 'asc' } },
            questionGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                questions: { orderBy: { number: 'asc' } },
                noteSections: { orderBy: { sortOrder: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
                matchingOptions: { orderBy: { sortOrder: 'asc' } }
              }
            }
          }
        }
      }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Nộp bài
router.post('/exams/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { answers } = req.body // { questionId: userAnswer }
    const examId = parseInt(req.params.id)

    const passages = await prisma.passage.findMany({
      where: { examId },
      include: {
        questions: { where: { groupId: null } },
        questionGroups: { include: { questions: true } }
      }
    })

    let correct = 0
    let totalSlots = 0
    const result = []

    for (const p of passages) {
      for (const q of p.questions) {
        totalSlots++
        const userAnswer = (answers[q.id] || '').trim().toLowerCase()
        const acceptedAnswers = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
        const isCorrect = acceptedAnswers.includes(userAnswer)
        if (isCorrect) correct++
        result.push({ questionId: q.id, questionText: q.questionText, userAnswer: answers[q.id] || '', correctAnswer: q.correctAnswer, isCorrect })
      }
      for (const g of p.questionGroups) {
        totalSlots += g.qNumberEnd - g.qNumberStart + 1
        const maxC = g.maxChoices || 2
        const activeQs = g.type === 'mcq_multi'
          ? g.questions
          : g.questions.filter(q => q.number >= g.qNumberStart && q.number <= g.qNumberEnd)
        for (const q of activeQs) {
          const userAnswer = (answers[q.id] || '').trim().toLowerCase()
          const acceptedAnswers = q.correctAnswer.split('/').map(a => a.trim().toLowerCase())
          const isCorrect = acceptedAnswers.includes(userAnswer)
          if (isCorrect) correct += (g.type === 'mcq_multi' ? maxC : 1)
          result.push({ questionId: q.id, questionText: q.questionText, userAnswer: answers[q.id] || '', correctAnswer: q.correctAnswer, isCorrect })
        }
      }
    }

    const band = getReadingBand(correct)

    const attempt = await prisma.attempt.create({
      data: {
        userId: req.user.userId,
        examId,
        score: band,
        answers: JSON.stringify(answers),
        finishedAt: new Date()
      }
    })

    res.json({ score: band, correct, total: totalSlots, result, attemptId: attempt.id })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
