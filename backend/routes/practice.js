const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const prisma = require('../lib/prisma')

const router = express.Router()

// ─── Multer for thumbnails ────────────────────────────────────────────────────
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

// ─── Multer for audio (listening) ────────────────────────────────────────────
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

// ─── PUBLIC: list featured practice exams (home page) ────────────────────────
router.get('/reading', async (req, res) => {
  const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'reading', deletedAt: null },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, thumbnailUrl: true, createdAt: true, questions: true }
    })
    const result = rows.map(r => ({
      ...r,
      questionCount: r.questions ? (() => {
        try {
          const q = JSON.parse(r.questions)
          return (q.groups || []).reduce((s, g) => s + (g.qNumberEnd - g.qNumberStart + 1), 0)
        } catch { return 0 }
      })() : 0,
      questions: undefined
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/listening', async (req, res) => {
  const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'listening', deletedAt: null },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, thumbnailUrl: true, createdAt: true, questions: true }
    })
    const result = rows.map(r => ({
      ...r,
      questionCount: r.questions ? (() => {
        try {
          const q = JSON.parse(r.questions)
          return (q.groups || []).reduce((s, g) => s + (g.qNumberEnd - g.qNumberStart + 1), 0)
        } catch { return 0 }
      })() : 0,
      questions: undefined
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── AUTH: get detail (for exam taking) ──────────────────────────────────────
router.get('/reading/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...exam, questions: exam.questions ? JSON.parse(exam.questions) : null })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/listening/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...exam, questions: exam.questions ? JSON.parse(exam.questions) : null })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: list all ──────────────────────────────────────────────────────────
router.get('/admin/reading', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'reading', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, thumbnailUrl: true, createdAt: true, questions: true }
    })
    const result = rows.map(r => ({
      ...r,
      questionCount: r.questions ? (() => {
        try { return (JSON.parse(r.questions).groups || []).reduce((s, g) => s + (g.qNumberEnd - g.qNumberStart + 1), 0) }
        catch { return 0 }
      })() : 0,
      questions: undefined
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/admin/listening', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'listening', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, thumbnailUrl: true, audioUrl: true, createdAt: true, questions: true }
    })
    const result = rows.map(r => ({
      ...r,
      questionCount: r.questions ? (() => {
        try { return (JSON.parse(r.questions).groups || []).reduce((s, g) => s + (g.qNumberEnd - g.qNumberStart + 1), 0) }
        catch { return 0 }
      })() : 0,
      questions: undefined
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: get full detail for editing ──────────────────────────────────────
router.get('/admin/:skill/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json(exam)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: create ────────────────────────────────────────────────────────────
router.post('/admin/:skill', authMiddleware, teacherOrAdmin, async (req, res) => {
  const skill = req.params.skill // reading | listening
  if (!['reading', 'listening'].includes(skill))
    return res.status(400).json({ message: 'skill không hợp lệ' })
  try {
    const { title, passage, questions } = req.body
    if (!title?.trim()) return res.status(400).json({ message: 'Thiếu tiêu đề' })
    const exam = await prisma.practiceExam.create({
      data: {
        title: title.trim(), skill,
        passage: passage || null,
        questions: questions ? JSON.stringify(questions) : null
      }
    })
    res.status(201).json(exam)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo bài', error: err.message })
  }
})

// ─── ADMIN: update ────────────────────────────────────────────────────────────
router.put('/admin/:skill/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { title, passage, questions } = req.body
    const data = {}
    if (title !== undefined) data.title = title.trim()
    if (passage !== undefined) data.passage = passage
    if (questions !== undefined) data.questions = JSON.stringify(questions)
    const exam = await prisma.practiceExam.update({ where: { id }, data })
    res.json(exam)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: err.message })
  }
})

// ─── ADMIN: upload thumbnail ──────────────────────────────────────────────────
router.post('/admin/:skill/:id/thumbnail', authMiddleware, teacherOrAdmin,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`
      const exam = await prisma.practiceExam.update({
        where: { id: parseInt(req.params.id) },
        data: { thumbnailUrl },
        select: { id: true, thumbnailUrl: true }
      })
      res.json(exam)
    } catch (err) {
      res.status(500).json({ message: 'Lỗi upload', error: err.message })
    }
  }
)

// ─── ADMIN: upload audio (listening only) ────────────────────────────────────
router.post('/admin/listening/:id/audio', authMiddleware, teacherOrAdmin,
  audioUpload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const audioUrl = `/uploads/${req.file.filename}`
      const exam = await prisma.practiceExam.update({
        where: { id: parseInt(req.params.id) },
        data: { audioUrl },
        select: { id: true, audioUrl: true }
      })
      res.json(exam)
    } catch (err) {
      res.status(500).json({ message: 'Lỗi upload audio', error: err.message })
    }
  }
)

// ─── ADMIN: delete (soft) ─────────────────────────────────────────────────────
router.delete('/admin/:skill/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { deletedAt: new Date() }
    })
    res.json({ message: 'Đã xóa' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa', error: err.message })
  }
})

module.exports = router
