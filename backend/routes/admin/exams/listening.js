const express = require('express')
const { sendServerError } = require('../../../lib/httpErrors')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { createListeningExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')
const { checkDuplicateExamTest, groupCreateData } = require('./core')
const { logAuditEvent } = require('../../../lib/auditLog')
const { AUDIT_ACTIONS } = require('../../../lib/auditActions')
const { findTitleConflict } = require('../../../lib/titleConflict')

// ─── CREATE LISTENING EXAM ───────────────────────────────────────────────────
router.post('/exams/listening', authMiddleware, teacherOnly, validate(createListeningExamSchema), async (req, res) => {
  try {
    const { title, sections, bookNumber, testNumber, seriesId } = req.body

    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'listening' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Listening có tên "${existing.title}". Vui lòng đặt tên khác.` })
    const normalizedConflict = await findTitleConflict(prisma.exam, title)
    if (normalizedConflict) return res.status(409).json({ message: 'Tên đề thi đã tồn tại trong kỹ năng này' })

    // BUG-08: Chặn trùng testNumber trong cùng seriesId và bookNumber
    if (seriesId && bookNumber && testNumber) {
      const isDup = await checkDuplicateExamTest({ seriesId, bookNumber, testNumber, skill: 'listening' })
      if (isDup) {
        return res.status(409).json({ message: 'Đề thi với số Test này đã tồn tại trong cùng cuốn/bộ đề' })
      }
    }

    const buildGroupData = (group, index) => groupCreateData(group, index, 'listening')

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'listening',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        listeningSections: {
          create: sections.map(s => ({
            number: s.number,
            context: s.context || '',
            audioUrl: s.audioUrl || null,
            transcript: s.transcript || null,
            // Support old flat questions OR new questionGroups
            questions: s.questionGroups
              ? undefined
              : { create: (s.questions || []).map(q => ({
                  number: q.number, type: q.type, questionText: q.questionText,
                  options: q.options ? JSON.stringify(q.options) : null,
                  correctAnswer: q.correctAnswer, imageUrl: q.imageUrl || null
                })) },
            questionGroups: s.questionGroups
              ? { create: s.questionGroups.map((g, gi) => buildGroupData(g, gi)) }
              : undefined
          }))
        }
      }
    })

    invalidate('fulltests:')

    const questionCount = sections.reduce((sum, s) => {
      if (s.questionGroups) {
        return sum + s.questionGroups.reduce((gs, g) => gs + (g.questions || []).length, 0)
      }
      return sum + (s.questions || []).length
    }, 0)
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.EXAM_CREATE,
      entityType: 'Exam',
      entityId: exam.id,
      entityLabel: exam.title,
      metadata: { skill: 'listening', sectionCount: sections.length, questionCount }
    })

    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    sendServerError(res, error, 'Lỗi tạo đề Listening')
  }
})

module.exports = router
