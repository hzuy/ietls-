const express = require('express')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOnly } = require('../../lib/roles')
const { examSeriesSchema, updateBookNumberSchema } = require('../../validators/contentValidator')
const { imageUpload } = require('../../lib/adminUploads')
const { getOrRevalidate, invalidate } = require('../../lib/swrCache')

// TTL cho /full-tests (trang chủ). Nội dung đổi khi admin thêm/sửa/xoá đề hoặc
// series/book/cover — mọi route đó gọi invalidate('fulltests:').
const FULL_TESTS_TTL = 120 * 1000

// ─── GET FULL TESTS (grouped by bookNumber + testNumber) ─────────────────────
// Query + logic group GIỮ NGUYÊN, chỉ bọc SWR cache (chỉ 1 biến thể, không param).
async function buildFullTests() {
  const [exams, covers, series] = await Promise.all([
    prisma.exam.findMany({
      where: { bookNumber: { not: null }, testNumber: { not: null }, deletedAt: null },
      select: { id: true, title: true, skill: true, bookNumber: true, testNumber: true, seriesId: true },
      orderBy: [{ seriesId: 'asc' }, { bookNumber: 'asc' }, { testNumber: 'asc' }, { skill: 'asc' }]
    }),
    prisma.bookCover.findMany({ where: { deletedAt: null } }),
    prisma.examSeries.findMany({ where: { deletedAt: null } })
  ])

  const seriesMap = {}
  for (const s of series) seriesMap[s.id] = s.name

  const coverMap = {}
  for (const c of covers) {
    // Key cover by seriesId and bookNumber to avoid collisions
    coverMap[`${c.seriesId}-${c.bookNumber}`] = c.coverImageUrl
  }

  const grouped = {}
  for (const e of exams) {
    // Key by seriesId, bookNumber, and testNumber for unique identification
    const key = `${e.seriesId}-${e.bookNumber}-${e.testNumber}`
    if (!grouped[key]) {
      grouped[key] = {
        seriesId: e.seriesId,
        seriesName: seriesMap[e.seriesId] || 'IELTS',
        bookNumber: e.bookNumber,
        testNumber: e.testNumber,
        exams: {},
        coverImageUrl: coverMap[`${e.seriesId}-${e.bookNumber}`] || null
      }
    }
    grouped[key].exams[e.skill] = { id: e.id, title: e.title }
  }
  return Object.values(grouped)
}

router.get('/full-tests', async (req, res) => {
  try {
    const data = await getOrRevalidate('fulltests:home', buildFullTests, FULL_TESTS_TTL)
    res.json(data)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── EXAM SERIES CRUD ─────────────────────────────────────────────────────────
router.get('/exam-series', authMiddleware, async (req, res) => {
  try {
    const series = await prisma.examSeries.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { bookCovers: { where: { deletedAt: null } } } } }
    })
    res.json(series)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series', authMiddleware, teacherOnly, validate(examSeriesSchema), async (req, res) => {
  try {
    const { name } = req.body
    const s = await prisma.examSeries.create({ data: { name: name.trim() } })
    res.json(s)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/exam-series/:id', authMiddleware, teacherOnly, validate(examSeriesSchema), async (req, res) => {
  try {
    const { name } = req.body
    const s = await prisma.examSeries.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim() }
    })
    invalidate('fulltests:')
    res.json(s)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/exam-series/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.examSeries.update({ where: { id }, data: { deletedAt: new Date() } })
    invalidate('fulltests:')
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/exam-series/:id/books', authMiddleware, async (req, res) => {
  try {
    const books = await prisma.bookCover.findMany({
      where: { seriesId: parseInt(req.params.id), deletedAt: null },
      orderBy: { bookNumber: 'asc' }
    })
    res.json(books)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series/:id/books', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id)
    const max = await prisma.bookCover.findFirst({
      where: { seriesId, deletedAt: null },
      orderBy: { bookNumber: 'desc' }
    })
    const nextNumber = (max?.bookNumber || 0) + 1
    const book = await prisma.bookCover.create({ data: { seriesId, bookNumber: nextNumber } })
    invalidate('fulltests:')
    res.json(book)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.put('/exam-series/:seriesId/books/:bookNumber', authMiddleware, teacherOnly, validate(updateBookNumberSchema), async (req, res) => {
  try {
    const seriesId = parseInt(req.params.seriesId)
    const oldNumber = parseInt(req.params.bookNumber)
    const newNumber = parseInt(req.body.bookNumber)
    if (newNumber === oldNumber) return res.json({ ok: true })
    // Update BookCover
    await prisma.bookCover.updateMany({ where: { seriesId, bookNumber: oldNumber }, data: { bookNumber: newNumber } })
    // Update associated Exams
    await prisma.exam.updateMany({ where: { seriesId, bookNumber: oldNumber }, data: { bookNumber: newNumber } })
    invalidate('fulltests:')
    res.json({ ok: true, bookNumber: newNumber })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.delete('/exam-series/:seriesId/books/:bookNumber', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.seriesId)
    const bookNumber = parseInt(req.params.bookNumber)
    const now = new Date()
    // Soft-delete all exams in this book
    await prisma.exam.updateMany({ where: { seriesId, bookNumber, deletedAt: null }, data: { deletedAt: now } })
    // Soft-delete the book cover
    await prisma.bookCover.updateMany({ where: { seriesId, bookNumber }, data: { deletedAt: now } })
    invalidate('fulltests:')
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/exam-series/:seriesId/covers/:bookNumber', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const seriesId = parseInt(req.params.seriesId)
    const bookNumber = parseInt(req.params.bookNumber)
    const coverImageUrl = `/uploads/${req.file.filename}`
    await prisma.bookCover.upsert({
      where: { seriesId_bookNumber: { seriesId, bookNumber } },
      create: { seriesId, bookNumber, coverImageUrl },
      update: { coverImageUrl }
    })
    invalidate('fulltests:')
    res.json({ seriesId, bookNumber, coverImageUrl })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

module.exports = router
