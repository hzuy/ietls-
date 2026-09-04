const express = require('express')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { createWritingExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')

// ─── CREATE WRITING EXAM ─────────────────────────────────────────────────────
router.post('/exams/writing', authMiddleware, teacherOnly, validate(createWritingExamSchema), async (req, res) => {
  try {
    const { title, task1, task2, bookNumber, testNumber, seriesId } = req.body
    // task1: { prompt, imageUrl }
    // task2: { prompt }

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'writing' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Writing có tên "${existing.title}". Vui lòng đặt tên khác.` })

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'writing',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        writingTasks: {
          create: [
            {
              number: 1,
              prompt: task1.prompt,
              imageUrl: task1.imageUrl || null,
              minWords: 150
            },
            {
              number: 2,
              prompt: task2.prompt,
              imageUrl: null,
              minWords: 250
            }
          ]
        }
      },
      include: { writingTasks: true }
    })

    invalidate('fulltests:')
    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi tạo đề Writing', error: error.message })
  }
})

module.exports = router
