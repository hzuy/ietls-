const express = require('express')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const { teacherOrAdmin } = require('../../lib/roles')

// The 4 real per-skill exam types. NOTE: 'exam_series' also begins with 'exam_',
// so it must be matched by an explicit branch — never by a startsWith('exam_') test.
const EXAM_SKILL_TYPES = ['exam_reading', 'exam_listening', 'exam_writing', 'exam_speaking']

// Cascade-safe hard delete for Exam records, wrapped in a single transaction so a
// mid-way failure never leaves an exam half-deleted.
//
// Auto-cascade FKs (handled by the DB): Exam→Passage→Question, Exam→ListeningSection→Question,
//   Exam→WritingTask, Exam→SpeakingPart→SpeakingQuestion, Attempt→QuestionAnswer.
// No-cascade FKs that must be cleared here first:
//   Attempt.examId, WritingAnswer.taskId, SpeakingAnswer.partId,
//   AnswerLog.questionId  (AnswerLog.attemptId is SetNull, but .questionId is Restrict —
//   leftover AnswerLog rows are what make the Question cascade blow up with a 500).
async function hardDeleteExams(examIds) {
  if (!examIds.length) return
  const [taskIds, partIds, questionIds] = await Promise.all([
    prisma.writingTask.findMany({ where: { examId: { in: examIds } }, select: { id: true } }).then(r => r.map(t => t.id)),
    prisma.speakingPart.findMany({ where: { examId: { in: examIds } }, select: { id: true } }).then(r => r.map(p => p.id)),
    prisma.question.findMany({
      where: {
        OR: [
          { passage: { examId: { in: examIds } } },
          { listeningSection: { examId: { in: examIds } } },
        ],
      },
      select: { id: true },
    }).then(r => r.map(q => q.id)),
  ])

  await prisma.$transaction(async (tx) => {
    if (questionIds.length) {
      await tx.answerLog.deleteMany({ where: { questionId: { in: questionIds } } })
    }
    await tx.attempt.deleteMany({ where: { examId: { in: examIds } } })
    if (taskIds.length) await tx.writingAnswer.deleteMany({ where: { taskId: { in: taskIds } } })
    if (partIds.length) await tx.speakingAnswer.deleteMany({ where: { partId: { in: partIds } } })
    await tx.exam.deleteMany({ where: { id: { in: examIds } } })
  })
}

// ─── TRASH COUNT (lightweight — for sidebar badge) ───────────────────────────
router.get('/trash/count', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const where = { deletedAt: { not: null } }
    const [practices, writings, speakings, exams, examSeriesList, books] = await Promise.all([
      prisma.practiceExam.count({ where }),
      prisma.writingSample.count({ where }),
      prisma.speakingSample.count({ where }),
      prisma.exam.count({ where }),
      prisma.examSeries.count({ where }),
      prisma.bookCover.count({ where }),
    ])
    res.json({ count: practices + writings + speakings + exams + examSeriesList + books })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/trash', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const take = Math.min(parseInt(limit) || 50, 100)
    const skip = (Math.max(parseInt(page), 1) - 1) * take
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const softWhere = { deletedAt: { not: null } }
    const expiredWhere = { deletedAt: { not: null, lt: thirtyDaysAgo } }

    // BUG-28: Auto-purge items older than 30 days — fire-and-forget, do NOT await
    ;(async () => {
      try {
        await Promise.all([
          prisma.practiceExam.deleteMany({ where: expiredWhere }),
          prisma.writingSample.deleteMany({ where: expiredWhere }),
          prisma.speakingSample.deleteMany({ where: expiredWhere }),
          prisma.examSeries.deleteMany({ where: expiredWhere }),
          prisma.bookCover.deleteMany({ where: expiredWhere }),
        ])
        const expiredExams = await prisma.exam.findMany({ where: expiredWhere, select: { id: true } })
        await hardDeleteExams(expiredExams.map(e => e.id))
      } catch (e) {
        console.error(`[${new Date().toISOString()}] [Trash] Tác vụ "Auto-delete trash sau 30 ngày" bị lỗi:`, e.message || e)
      }
    })()


    const [practices, writings, speakings, exams, examSeriesList, books] = await Promise.all([
      prisma.practiceExam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
      prisma.writingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
      prisma.speakingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
      prisma.exam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, coverImageUrl: true, seriesId: true, bookNumber: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
      prisma.examSeries.findMany({
        where: softWhere,
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
      prisma.bookCover.findMany({
        where: softWhere,
        select: { id: true, seriesId: true, bookNumber: true, coverImageUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take, skip,
      }),
    ])

    // Enrich books with seriesName
    const seriesIds = [...new Set(books.map(b => b.seriesId))]
    let seriesNameMap = {}
    if (seriesIds.length) {
      const seriesRows = await prisma.examSeries.findMany({
        where: { id: { in: seriesIds } },
        select: { id: true, name: true }
      })
      for (const s of seriesRows) seriesNameMap[s.id] = s.name
    }

    const items = [
      ...practices.map(r => ({ ...r, type: r.skill === 'reading' ? 'reading_practice' : 'listening_practice' })),
      ...writings.map(r => ({ ...r, type: 'writing_sample' })),
      ...speakings.map(r => ({ ...r, type: 'speaking_sample' })),
      ...exams.map(r => ({ ...r, thumbnailUrl: r.coverImageUrl, type: `exam_${r.skill}` })),
      ...examSeriesList.map(r => ({ ...r, title: r.name, type: 'exam_series' })),
      ...books.map(r => ({ ...r, title: `Cuốn ${r.bookNumber} — ${seriesNameMap[r.seriesId] || 'Bộ đề'}`, thumbnailUrl: r.coverImageUrl, type: 'book' })),
    ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))

    res.json({ items, page: parseInt(page), limit: take })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.post('/trash/:type/:id/restore', authMiddleware, teacherOrAdmin, async (req, res) => {
  const { type, id } = req.params
  const numId = parseInt(id)
  try {
    if (type === 'reading_practice' || type === 'listening_practice') {
      await prisma.practiceExam.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'writing_sample') {
      await prisma.writingSample.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'speaking_sample') {
      await prisma.speakingSample.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (EXAM_SKILL_TYPES.includes(type)) {
      await prisma.exam.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'exam_series') {
      await prisma.examSeries.update({ where: { id: numId }, data: { deletedAt: null } })
    } else if (type === 'book') {
      // Restore BookCover + all exams in this book
      const book = await prisma.bookCover.findUnique({ where: { id: numId }, select: { seriesId: true, bookNumber: true } })
      if (book) {
        await Promise.all([
          prisma.bookCover.update({ where: { id: numId }, data: { deletedAt: null } }),
          prisma.exam.updateMany({ where: { seriesId: book.seriesId, bookNumber: book.bookNumber }, data: { deletedAt: null } }),
        ])
      }
    } else {
      return res.status(400).json({ message: 'Loại không hợp lệ' })
    }
    res.json({ message: 'Đã khôi phục' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khôi phục', error: err.message })
  }
})

router.delete('/trash/purge', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const where = { deletedAt: { not: null } }
    await Promise.all([
      prisma.practiceExam.deleteMany({ where }),
      prisma.writingSample.deleteMany({ where }),
      prisma.speakingSample.deleteMany({ where }),
      prisma.examSeries.deleteMany({ where }),
      prisma.bookCover.deleteMany({ where }),
    ])
    const allExams = await prisma.exam.findMany({ where, select: { id: true } })
    await hardDeleteExams(allExams.map(e => e.id))
    res.json({ message: 'Đã dọn sạch thùng rác' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi dọn rác', error: err.message })
  }
})

router.delete('/trash/:type/:id/permanent', authMiddleware, teacherOrAdmin, async (req, res) => {
  const { type, id } = req.params
  const numId = parseInt(id)
  try {
    if (type === 'reading_practice' || type === 'listening_practice') {
      await prisma.practiceExam.delete({ where: { id: numId } })
    } else if (type === 'writing_sample') {
      await prisma.writingSample.delete({ where: { id: numId } })
    } else if (type === 'speaking_sample') {
      await prisma.speakingSample.delete({ where: { id: numId } })
    } else if (EXAM_SKILL_TYPES.includes(type)) {
      await hardDeleteExams([numId])
    } else if (type === 'exam_series') {
      // A trashed series can still own LIVE books/exams — soft-deleting a series
      // never touches its children. Permanently deleting it now would cascade-drop
      // the BookCovers and orphan the live Exams (seriesId → null). Refuse until the
      // children are dealt with.
      const [liveBooks, liveExams] = await Promise.all([
        prisma.bookCover.count({ where: { seriesId: numId, deletedAt: null } }),
        prisma.exam.count({ where: { seriesId: numId, deletedAt: null } }),
      ])
      const liveTotal = liveBooks + liveExams
      if (liveTotal > 0) {
        return res.status(409).json({
          message: `Bộ đề còn ${liveTotal} đề/cuốn đang hoạt động — vui lòng xóa các mục con trước khi xóa vĩnh viễn bộ đề này.`,
        })
      }
      await prisma.examSeries.delete({ where: { id: numId } })
    } else if (type === 'book') {
      const book = await prisma.bookCover.findUnique({ where: { id: numId }, select: { seriesId: true, bookNumber: true } })
      if (book) {
        const bookExams = await prisma.exam.findMany({ where: { seriesId: book.seriesId, bookNumber: book.bookNumber }, select: { id: true } })
        await hardDeleteExams(bookExams.map(e => e.id))
        await prisma.bookCover.delete({ where: { id: numId } })
      }
    } else {
      return res.status(400).json({ message: 'Loại không hợp lệ' })
    }
    res.json({ message: 'Đã xóa vĩnh viễn' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa vĩnh viễn', error: err.message })
  }
})

module.exports = router
