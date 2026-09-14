const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOnly } = require('../../lib/roles')
const { transcribeUploadSchema } = require('../../validators/contentValidator')
const { upload, imageUpload } = require('../../lib/adminUploads')
const { getGroqClient } = require('../../lib/groqClient')
const {
  uploadAudio,
  uploadImage,
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

module.exports = router
