const express = require('express')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { createSpeakingExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')

// ─── CREATE SPEAKING EXAM ────────────────────────────────────────────────────
router.post('/exams/speaking', authMiddleware, teacherOnly, validate(createSpeakingExamSchema), async (req, res) => {
  try {
    const { title, part1, part2, part3, bookNumber, testNumber, seriesId } = req.body
    // part1: { questions: ['...', '...'] }
    // part2: { cueCard: '...', questions: ['...'] }
    // part3: { questions: ['...', '...'] }

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'speaking' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Speaking có tên "${existing.title}". Vui lòng đặt tên khác.` })

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'speaking',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        speakingParts: {
          create: [
            {
              number: 1,
              cueCard: part1.cueCard || null,
              questions: {
                create: part1.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            },
            {
              number: 2,
              cueCard: part2.cueCard || null,
              questions: {
                create: part2.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            },
            {
              number: 3,
              cueCard: part3.cueCard || null,
              questions: {
                create: part3.questions.filter(q => q.trim()).map((q, i) => ({
                  orderNum: i + 1,
                  questionText: q
                }))
              }
            }
          ]
        }
      },
      include: {
        speakingParts: { include: { questions: true } }
      }
    })

    invalidate('fulltests:')
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Speaking', error: error.message })
  }
})

module.exports = router
