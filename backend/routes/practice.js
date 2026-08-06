const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const prisma = require('../lib/prisma')
const { createPracticeSchema, updatePracticeSchema } = require('../validators/contentValidator')

const router = express.Router()

// ─── Multer setup ─────────────────────────────────────────────────────────────
const thumbDir = path.join(__dirname, '..', 'uploads', 'thumbnails')
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true })

const thumbStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, thumbDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname).toLowerCase())
  }
})
const thumbUpload = multer({
  storage: thumbStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Chỉ chấp nhận jpg/png/webp'))
  },
  limits: { fileSize: 5 * 1024 * 1024 }
})

const audioDir = path.join(__dirname, '..', 'uploads')
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, audioDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname).toLowerCase())
  }
})
const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Chỉ chấp nhận file audio'))
  },
  limits: { fileSize: 100 * 1024 * 1024 }
})

const teacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher')
    return res.status(403).json({ message: 'Không có quyền' })
  next()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getQuestionCount(exam) {
  if (exam.questions?.length > 0) {
    return exam.questions.reduce((s, pq) => {
      try {
        const group = JSON.parse(pq.content)
        return s + (group.qNumberEnd - group.qNumberStart + 1)
      } catch { return s }
    }, 0)
  }
  return 0
}

// ─── PUBLIC: list ─────────────────────────────────────────────────────────────
router.get('/reading', async (req, res) => {
  const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'reading', deletedAt: null },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
      include: { questions: { select: { content: true } } }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

router.get('/listening', async (req, res) => {
  const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'listening', deletedAt: null },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
      include: { questions: { select: { content: true } } }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

// ─── AUTH: detail ─────────────────────────────────────────────────────────────
router.get('/reading/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    const groups = (exam.questions || []).map(pq => JSON.parse(pq.content))
    res.json({ ...exam, questions: { groups } })
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

router.get('/listening/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    const groups = (exam.questions || []).map(pq => JSON.parse(pq.content))
    res.json({ ...exam, questions: { groups } })
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

// ─── ADMIN: list ──────────────────────────────────────────────────────────────
router.get('/admin/reading', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'reading', deletedAt: null },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { questions: { select: { content: true } } }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

router.get('/admin/listening', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'listening', deletedAt: null },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { questions: { select: { content: true } } }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

// ─── ADMIN: detail for editing ────────────────────────────────────────────────
router.get('/admin/:skill/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    
    // Map to JSON for editor
    const groups = (exam.questions || []).map(pq => JSON.parse(pq.content))
    res.json({ ...exam, questions: JSON.stringify({ groups }) })
  } catch (err) { res.status(500).json({ message: 'Lỗi server', error: err.message }) }
})

// ─── ADMIN: create (FIXED) ────────────────────────────────────────────────────
router.post('/admin/:skill', authMiddleware, teacherOrAdmin, validate(createPracticeSchema), async (req, res) => {
  const { skill } = req.params
  const { title, level, thumbnailUrl, audioUrl, passage, questions } = req.body

  try {
    const exam = await prisma.practiceExam.create({
      data: {
        title: title.trim(),
        skill,
        level: level || null,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: skill === "listening" ? audioUrl : null,
        passage: passage || null,
        isNormalized: true,
        // ✅ CORRECT: Relation is now named 'questions'
        questions: {
          create: (questions || []).map((q, index) => ({
            content: typeof q === 'string' ? q : JSON.stringify(q),
            correctAnswer: q.correctAnswer || '',
            options: q.options ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options)) : null,
            orderNum: q.orderIndex !== undefined ? q.orderIndex : index,
            type: q.type || 'group'
          }))
        }
      },
      include: {
        questions: true
      }
    })

    res.status(201).json(exam)
  } catch (error) {
    console.error("CREATE PRACTICE ERROR:", error)
    return res.status(500).json({ message: error.message })
  }
})

// ─── ADMIN: update (FIXED) ────────────────────────────────────────────────────
router.put('/admin/:skill/:id', authMiddleware, teacherOrAdmin, validate(updatePracticeSchema), async (req, res) => {
  const { id } = req.params
  const { title, level, thumbnailUrl, audioUrl, passage, questions } = req.body

  try {
    await prisma.$transaction(async (tx) => {
      const updateData = { isNormalized: true }
      if (title !== undefined) updateData.title = title.trim()
      if (level !== undefined) updateData.level = level
      if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
      if (passage !== undefined) updateData.passage = passage
      if (audioUrl !== undefined) updateData.audioUrl = audioUrl

      // ✅ Update main record and manage relation
      await tx.practiceExam.update({
        where: { id: parseInt(id) },
        data: {
          ...updateData,
          questions: questions !== undefined && Array.isArray(questions) ? {
            deleteMany: {},
            create: questions.map((q, index) => ({
              content: typeof q === 'string' ? q : JSON.stringify(q),
              correctAnswer: q.correctAnswer || '',
              options: q.options ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options)) : null,
              orderNum: q.orderIndex !== undefined ? q.orderIndex : index,
              type: q.type || 'group'
            }))
          } : undefined
        }
      })
    })

    res.json({ ok: true })
  } catch (error) {
    console.error("UPDATE PRACTICE ERROR:", error)
    return res.status(500).json({ message: error.message })
  }
})

// ─── ADMIN: upload thumbnail ──────────────────────────────────────────────────
router.post('/admin/:skill/:id/thumbnail', authMiddleware, teacherOrAdmin, thumbUpload.single('thumbnail'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`
    const exam = await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { thumbnailUrl },
      select: { id: true, thumbnailUrl: true }
    })
    res.json(exam)
  } catch (err) { res.status(500).json({ message: 'Lỗi upload', error: err.message }) }
})

// ─── ADMIN: upload audio (listening only) ────────────────────────────────────
router.post('/admin/listening/:id/audio', authMiddleware, teacherOrAdmin, audioUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const audioUrl = `/uploads/${req.file.filename}`
    const exam = await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { audioUrl },
      select: { id: true, audioUrl: true }
    })
    res.json(exam)
  } catch (err) { res.status(500).json({ message: 'Lỗi upload audio', error: err.message }) }
})

// ─── ADMIN: delete (soft) ─────────────────────────────────────────────────────
router.delete('/admin/:skill/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { deletedAt: new Date() }
    })
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ message: 'Lỗi xóa', error: err.message }) }
})

module.exports = router
