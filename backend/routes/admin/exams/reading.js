const express = require('express')
const { sendServerError } = require('../../../lib/httpErrors')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { createReadingExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')
const { checkDuplicateExamTest, groupCreateData } = require('./core')
const { logAuditEvent } = require('../../../lib/auditLog')
const { AUDIT_ACTIONS } = require('../../../lib/auditActions')
const { findTitleConflict } = require('../../../lib/titleConflict')

// ─── CREATE READING EXAM ─────────────────────────────────────────────────────
router.post('/exams/reading', authMiddleware, teacherOnly, validate(createReadingExamSchema), async (req, res) => {
  try {
    const { title, passages, bookNumber, testNumber, seriesId } = req.body

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'reading' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Reading có tên "${existing.title}". Vui lòng đặt tên khác.` })
    const normalizedConflict = await findTitleConflict(prisma.exam, title)
    if (normalizedConflict) return res.status(409).json({ message: 'Tên đề thi đã tồn tại trong kỹ năng này' })

    // BUG-08: Chặn trùng testNumber trong cùng seriesId và bookNumber
    if (seriesId && bookNumber && testNumber) {
      const isDup = await checkDuplicateExamTest({ seriesId, bookNumber, testNumber, skill: 'reading' })
      if (isDup) {
        return res.status(409).json({ message: 'Đề thi với số Test này đã tồn tại trong cùng cuốn/bộ đề' })
      }
    }

    const buildReadingGroupData = (group, index) => groupCreateData(group, index, 'reading')

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'reading',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        passages: {
          create: passages.map(p => ({
            number: p.number,
            title: p.title,
            subtitle: p.subtitle || null,
            letteredParagraphs: p.letteredParagraphs || false,
            body: p.body,
            questionGroups: p.questionGroups
              ? { create: p.questionGroups.map((g, gi) => buildReadingGroupData(g, gi)) }
              : undefined,
            questions: p.questions
              ? { create: (p.questions || []).map(q => ({
                  number: q.number,
                  type: q.type,
                  questionText: q.questionText,
                  options: q.options ? JSON.stringify(q.options) : null,
                  correctAnswer: q.correctAnswer,
                  imageUrl: q.imageUrl || null
                })) }
              : undefined
          }))
        }
      },
      include: {
        passages: { include: { questions: true, questionGroups: true } }
      }
    })

    invalidate('fulltests:')

    const questionCount = passages.reduce((sum, p) => {
      const groupQuestions = (p.questionGroups || []).reduce((gs, g) => gs + (g.questions || []).length, 0)
      return sum + (p.questions || []).length + groupQuestions
    }, 0)
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.EXAM_CREATE,
      entityType: 'Exam',
      entityId: exam.id,
      entityLabel: exam.title,
      metadata: { skill: 'reading', passageCount: passages.length, questionCount }
    })

    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    sendServerError(res, error, 'Lỗi tạo đề Reading')
  }
})

module.exports = router
