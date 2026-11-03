const express = require('express')
const { sendServerError } = require('../../../lib/httpErrors')
const router = express.Router()
const prisma = require('../../../lib/prisma')
const authMiddleware = require('../../../middleware/auth')
const validate = require('../../../middleware/validate')
const { teacherOnly } = require('../../../lib/roles')
const { createSpeakingExamSchema } = require('../../../validators/adminExamValidator')
const { invalidate } = require('../../../lib/swrCache')
const { checkDuplicateExamTest } = require('./core')
const { logAuditEvent } = require('../../../lib/auditLog')
const { AUDIT_ACTIONS } = require('../../../lib/auditActions')
const { findTitleConflict } = require('../../../lib/titleConflict')

const { processSpeakingTts } = require('../../../services/ttsService')

// ─── CREATE SPEAKING EXAM ────────────────────────────────────────────────────
router.post('/exams/speaking', authMiddleware, teacherOnly, validate(createSpeakingExamSchema), async (req, res) => {
  try {
    const { title, part1, part2, part3, bookNumber, testNumber, seriesId } = req.body
    
    const existing = await prisma.exam.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, skill: 'speaking' } })
    if (existing) return res.status(409).json({ message: `Đã tồn tại đề Speaking có tên "${existing.title}". Vui lòng đặt tên khác.` })
    const normalizedConflict = await findTitleConflict(prisma.exam, title)
    if (normalizedConflict) return res.status(409).json({ message: 'Tên đề thi đã tồn tại trong kỹ năng này' })

    // BUG-08: Chặn trùng testNumber trong cùng seriesId và bookNumber
    if (seriesId && bookNumber && testNumber) {
      const isDup = await checkDuplicateExamTest({ seriesId, bookNumber, testNumber, skill: 'speaking' })
      if (isDup) {
        return res.status(409).json({ message: 'Đề thi với số Test này đã tồn tại trong cùng cuốn/bộ đề' })
      }
    }

    // Validate conflicts before generating audio or creating any content.
    await processSpeakingTts([part1, part2, part3])

    const exam = await prisma.exam.create({
      data: {
        title,
        skill: 'speaking',
        bookNumber: bookNumber ? parseInt(bookNumber) : null,
        testNumber: testNumber ? parseInt(testNumber) : null,
        seriesId: seriesId ? parseInt(seriesId) : null,
        speakingParts: {
          create: [1, 2, 3].map(num => {
            const part = num === 1 ? part1 : num === 2 ? part2 : part3
            const questions = (part?.questions || []).filter(q => typeof q === 'string' ? q.trim() : (q.questionText || '').trim())
            return {
              number: num,
              cueCard: part?.cueCard || null,
              introAudioUrl: part?.introAudioUrl || null,
              introTtsScript: part?.introTtsScript || null,
              questions: {
                create: questions.map((q, i) => {
                  if (typeof q === 'string') {
                    return { orderNum: i + 1, questionText: q }
                  }
                  return {
                    orderNum: i + 1,
                    questionText: q.questionText,
                    audioUrl: q.audioUrl || null,
                    ttsScript: q.ttsScript || null
                  }
                })
              }
            }
          })
        }
      },
      include: {
        speakingParts: { include: { questions: true } }
      }
    })

    invalidate('fulltests:')

    const questionCount = exam.speakingParts.reduce((sum, p) => sum + p.questions.length, 0)
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.EXAM_CREATE,
      entityType: 'Exam',
      entityId: exam.id,
      entityLabel: exam.title,
      metadata: { skill: 'speaking', partCount: exam.speakingParts.length, questionCount }
    })

    res.status(201).json(exam)
  } catch (error) {
    console.error(error)
    sendServerError(res, error, 'Lỗi tạo đề Speaking')
  }
})

module.exports = router
