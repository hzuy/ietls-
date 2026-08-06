const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOnly } = require('../../lib/roles')
const { transcribeUploadSchema, bookCoverSchema } = require('../../validators/contentValidator')
const { uploadsDir, upload, imageUpload, groq } = require('../../lib/adminUploads')

// ─── UPLOAD AUDIO ────────────────────────────────────────────────────────────
router.post('/upload-audio', authMiddleware, teacherOnly, upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  const audioUrl = `/uploads/${req.file.filename}`
  res.json({ audioUrl, filename: req.file.filename })
})

// ─── UPLOAD IMAGE ────────────────────────────────────────────────────────────
router.post('/upload-image', authMiddleware, teacherOnly, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  const imageUrl = `/uploads/${req.file.filename}`
  res.json({ imageUrl, filename: req.file.filename })
})

router.post('/exams/:id/cover', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const coverImageUrl = `/uploads/${req.file.filename}`
    const exam = await prisma.exam.update({
      where: { id: parseInt(req.params.id) },
      data: { coverImageUrl },
      select: { id: true, coverImageUrl: true }
    })
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

// ─── TRANSCRIBE AUDIO (Groq Whisper) ────────────────────────────────────────
router.post('/transcribe', authMiddleware, teacherOnly, validate(transcribeUploadSchema), async (req, res) => {
  try {
    const { audioUrl } = req.body

    const filename = audioUrl.replace('/uploads/', '')
    const filePath = path.join(uploadsDir, filename)

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File audio không tồn tại trên server' })

    if (process.env.NODE_ENV !== 'production') console.log('[Transcribe] Bắt đầu phiên âm:', filename)
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      response_format: 'json',
      language: 'en',
      temperature: 0.0
    })

    const text = transcription.text || ''
    if (process.env.NODE_ENV !== 'production') console.log('[Transcribe] Xong, độ dài:', text.length)
    res.json({ transcript: text })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Transcribe] Lỗi:', error.message)
    res.status(500).json({ message: 'Lỗi phiên âm: ' + error.message })
  }
})

// ─── BOOK COVERS ─────────────────────────────────────────────────────────────
router.get('/book-covers', authMiddleware, async (req, res) => {
  try {
    const seriesId = parseInt(req.query.seriesId) || 1
    const covers = await prisma.bookCover.findMany({ where: { seriesId } })
    const map = {}
    for (const c of covers) map[c.bookNumber] = c.coverImageUrl
    res.json(map)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.post('/book-covers/:bookNumber', authMiddleware, teacherOnly, imageUpload.single('cover'), validate(bookCoverSchema), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const bookNumber = parseInt(req.params.bookNumber)
    const seriesId = parseInt(req.body.seriesId) || 1
    const coverImageUrl = `/uploads/${req.file.filename}`
    await prisma.bookCover.upsert({
      where: { seriesId_bookNumber: { seriesId, bookNumber } },
      create: { seriesId, bookNumber, coverImageUrl },
      update: { coverImageUrl }
    })
    res.json({ bookNumber, coverImageUrl })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

module.exports = router
