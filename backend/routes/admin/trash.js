const express = require('express')
const { sendServerError } = require('../../lib/httpErrors')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const { teacherOrAdmin, adminOnly } = require('../../lib/roles')
const { invalidate } = require('../../lib/swrCache')
const { invalidateExamCaches } = require('../../utils/cache')
const { logAuditEvent } = require('../../lib/auditLog')
const { AUDIT_ACTIONS } = require('../../lib/auditActions')
const { purgeTrash, TrashPurgeError, RETENTION_DAYS } = require('../../services/trashPurgeService')
const { findTitleConflict } = require('../../lib/titleConflict')

// Khôi phục / xoá vĩnh viễn có thể đụng tới practice, sample lẫn exam/series →
// dọn hết cache list công khai cho chắc (thao tác này hiếm).
function invalidatePublicLists() {
  invalidate('practice:')
  invalidate('samples:')
  invalidate('fulltests:')
  invalidateExamCaches()
}

// The 4 real per-skill exam types. NOTE: 'exam_series' also begins with 'exam_',
// so it must be matched by an explicit branch — never by a startsWith('exam_') test.
const EXAM_SKILL_TYPES = ['exam_reading', 'exam_listening', 'exam_writing', 'exam_speaking']

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
    sendServerError(res, err, 'Lỗi server')
  }
})

router.get('/trash', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const softWhere = { deletedAt: { not: null } }
    const [practices, writings, speakings, exams, examSeriesList, books] = await Promise.all([
      prisma.practiceExam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.writingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.speakingSample.findMany({
        where: softWhere,
        select: { id: true, title: true, thumbnailUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.exam.findMany({
        where: softWhere,
        select: { id: true, title: true, skill: true, coverImageUrl: true, seriesId: true, bookNumber: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.examSeries.findMany({
        where: softWhere,
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.bookCover.findMany({
        where: softWhere,
        select: { id: true, seriesId: true, bookNumber: true, coverImageUrl: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
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

    res.json({ items, page: 1, limit: items.length, total: items.length, pages: 1 })
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

router.post('/trash/:type/:id/restore', authMiddleware, teacherOrAdmin, async (req, res) => {
  const { type, id } = req.params
  const numId = parseInt(id)
  try {
    let entityType = null
    let entityLabel = null
    const metadata = { type }
    if (type === 'reading_practice' || type === 'listening_practice') {
      const skill = type === 'reading_practice' ? 'reading' : 'listening'
      const current = await prisma.practiceExam.findUnique({ where: { id: numId }, select: { title: true } })
      if (current && await findTitleConflict(prisma.practiceExam, current.title, { skill }, numId)) {
        return res.status(409).json({ message: 'Đã có bài luyện tập cùng tên; đổi tên xung đột trước khi khôi phục' })
      }
      const updated = await prisma.practiceExam.update({ where: { id: numId }, data: { deletedAt: null }, select: { title: true } })
      entityType = 'PracticeExam'
      entityLabel = updated.title
    } else if (type === 'writing_sample') {
      const current = await prisma.writingSample.findUnique({ where: { id: numId }, select: { title: true } })
      if (current && await findTitleConflict(prisma.writingSample, current.title, {}, numId)) return res.status(409).json({ message: 'Đã có bài mẫu Writing cùng tên; đổi tên xung đột trước khi khôi phục' })
      const updated = await prisma.writingSample.update({ where: { id: numId }, data: { deletedAt: null }, select: { title: true } })
      entityType = 'WritingSample'
      entityLabel = updated.title
    } else if (type === 'speaking_sample') {
      const current = await prisma.speakingSample.findUnique({ where: { id: numId }, select: { title: true } })
      if (current && await findTitleConflict(prisma.speakingSample, current.title, {}, numId)) return res.status(409).json({ message: 'Đã có bài mẫu Speaking cùng tên; đổi tên xung đột trước khi khôi phục' })
      const updated = await prisma.speakingSample.update({ where: { id: numId }, data: { deletedAt: null }, select: { title: true } })
      entityType = 'SpeakingSample'
      entityLabel = updated.title
    } else if (EXAM_SKILL_TYPES.includes(type)) {
      const current = await prisma.exam.findUnique({ where: { id: numId }, select: { title: true, skill: true } })
      if (current && await findTitleConflict(prisma.exam, current.title, { skill: current.skill }, numId)) return res.status(409).json({ message: 'Đã có đề cùng tên trong kỹ năng này; đổi tên xung đột trước khi khôi phục' })
      const updated = await prisma.exam.update({ where: { id: numId }, data: { deletedAt: null }, select: { title: true } })
      entityType = 'Exam'
      entityLabel = updated.title
    } else if (type === 'exam_series') {
      const series = await prisma.examSeries.findUnique({ where: { id: numId }, select: { name: true, deletedAt: true } })
      if (!series) return res.status(404).json({ message: 'Không tìm thấy bộ đề' })
      if (await findTitleConflict(prisma.examSeries, series.name, {}, numId, 'name')) return res.status(409).json({ message: 'Đã có bộ đề cùng tên; đổi tên xung đột trước khi khôi phục' })
      await prisma.$transaction(async tx => {
        await tx.examSeries.update({ where: { id: numId }, data: { deletedAt: null } })
        if (series.deletedAt) {
          await tx.bookCover.updateMany({ where: { seriesId: numId, deletedAt: series.deletedAt }, data: { deletedAt: null } })
          await tx.exam.updateMany({ where: { seriesId: numId, deletedAt: series.deletedAt }, data: { deletedAt: null } })
        }
      })
      entityType = 'ExamSeries'
      entityLabel = series.name
    } else if (type === 'book') {
      // Restore the BookCover + only the exams that were soft-deleted *together with it*
      // (deleteBook stamps the cover and its exams with the same timestamp). Exams that
      // had been deleted independently earlier keep an older deletedAt and must stay in
      // the trash.
      const book = await prisma.bookCover.findUnique({
        where: { id: numId },
        select: { seriesId: true, bookNumber: true, deletedAt: true, series: { select: { name: true } } }
      })
      entityType = 'BookCover'
      if (book) {
        const examsResult = await prisma.$transaction(async tx => {
          await tx.bookCover.update({ where: { id: numId }, data: { deletedAt: null } })
          return tx.exam.updateMany({
            where: {
              seriesId: book.seriesId,
              bookNumber: book.bookNumber,
              deletedAt: book.deletedAt,
            },
            data: { deletedAt: null },
          })
        })
        entityLabel = `Cuốn ${book.bookNumber} — ${book.series?.name || 'Bộ đề'}`
        metadata.restoredExamsCount = examsResult.count
      }
    } else {
      return res.status(400).json({ message: 'Loại không hợp lệ' })
    }
    invalidatePublicLists()
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.TRASH_RESTORE,
      entityType,
      entityId: numId,
      entityLabel,
      metadata
    })
    res.json({ message: 'Đã khôi phục' })
  } catch (err) {
    sendServerError(res, err, 'Lỗi khôi phục')
  }
})

// Permanent deletion is explicit and admin-only. All variants share one
// serializable transaction and parent/child safeguards.
function sendPurgeError(res, error, fallback) {
  if (error instanceof TrashPurgeError) {
    return res.status(error.status).json({ code: error.code, message: error.message })
  }
  return sendServerError(res, error, fallback)
}

router.delete('/trash/purge', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await purgeTrash()
    invalidatePublicLists()
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.TRASH_PURGE_ALL,
      entityType: 'Trash',
      metadata: result.counts,
    })
    res.json({ message: 'Đã dọn sạch thùng rác', counts: result.counts })
  } catch (error) {
    sendPurgeError(res, error, 'Lỗi dọn rác')
  }
})

// 30-day retention remains available as an explicit admin action; GET /trash
// must never schedule permanent writes as a side effect of viewing the list.
router.delete('/trash/purge-expired', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await purgeTrash({ expiredOnly: true })
    if (Object.values(result.counts).some(count => count > 0)) {
      invalidatePublicLists()
      await logAuditEvent(req, {
        action: AUDIT_ACTIONS.TRASH_AUTO_PURGE,
        entityType: 'Trash',
        metadata: { ...result.counts, trigger: 'admin', retentionDays: RETENTION_DAYS },
      })
    }
    res.json({ message: 'Đã dọn các mục quá hạn 30 ngày', counts: result.counts })
  } catch (error) {
    sendPurgeError(res, error, 'Lỗi dọn các mục quá hạn')
  }
})

router.delete('/trash/:type/:id/permanent', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rawId = req.params.id
    const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN
    const result = await purgeTrash({ type: req.params.type, id })
    invalidatePublicLists()
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.TRASH_PURGE_ONE,
      entityType: result.entityType,
      entityId: result.entityId,
      entityLabel: result.entityLabel,
    })
    res.json({ message: 'Đã xóa vĩnh viễn' })
  } catch (error) {
    sendPurgeError(res, error, 'Lỗi xóa vĩnh viễn')
  }
})

module.exports = router
