const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOnly } = require('../../lib/roles')
const { transcribeUploadSchema, bookCoverSchema } = require('../../validators/contentValidator')
const { uploadsDir, upload, imageUpload } = require('../../lib/adminUploads')
const { getGroqClient } = require('../../lib/groqClient')
const { invalidate } = require('../../lib/swrCache')
const {
  uploadAudio,
  uploadImage,
  uploadOptimizedCover,
  resolveAudioForTranscription,
} = require('../../services/storageService')

// ─── UPLOAD AUDIO ────────────────────────────────────────────────────────────
router.post('/upload-audio', authMiddleware, teacherOnly, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url: audioUrl, filename } = await uploadAudio(req.file, { subdir: 'audio', folder: 'audio' })
    res.json({ audioUrl, filename })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi upload audio', error: error.message })
  }
})

// ─── UPLOAD IMAGE ────────────────────────────────────────────────────────────
router.post('/upload-image', authMiddleware, teacherOnly, imageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url: imageUrl, filename } = await uploadImage(req.file, { subdir: 'questions', folder: 'questions' })
    res.json({ imageUrl, filename })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi upload ảnh', error: error.message })
  }
})

router.post('/exams/:id/cover', authMiddleware, teacherOnly, imageUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có file ảnh' })
    const { url: coverImageUrl } = await uploadOptimizedCover(req.file, {
      dir: path.join(uploadsDir, 'covers'),
      urlPrefix: '/uploads/covers',
      folder: 'covers',
    })
    const exam = await prisma.exam.update({
      where: { id: parseInt(req.params.id) },
      data: { coverImageUrl },
      select: { id: true, coverImageUrl: true }
    })
    invalidate('fulltests:')
    res.json(exam)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

// ─── TRANSCRIBE AUDIO (Groq Whisper) ────────────────────────────────────────
router.post('/transcribe', authMiddleware, teacherOnly, validate(transcribeUploadSchema), async (req, res) => {
  let audioResolution = null
  try {
    const { audioUrl } = req.body

    audioResolution = await resolveAudioForTranscription(audioUrl)
    const { filePath } = audioResolution

    if (process.env.NODE_ENV !== 'production') console.log('[Transcribe] Bắt đầu phiên âm:', path.basename(filePath))
    const groq = getGroqClient()
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
  } finally {
    if (audioResolution?.cleanup) audioResolution.cleanup()
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
    const { url: coverImageUrl } = await uploadOptimizedCover(req.file, {
      dir: path.join(uploadsDir, 'covers'),
      urlPrefix: '/uploads/covers',
      folder: 'covers',
    })
    await prisma.bookCover.upsert({
      where: { seriesId_bookNumber: { seriesId, bookNumber } },
      create: { seriesId, bookNumber, coverImageUrl },
      update: { coverImageUrl }
    })
    invalidate('fulltests:')
    res.json({ bookNumber, coverImageUrl })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lưu ảnh bìa', error: error.message })
  }
})

module.exports = router
