const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOnly } = require('../../lib/roles')
const { transcribeUploadSchema } = require('../../validators/contentValidator')
const { upload, imageUpload } = require('../../lib/adminUploads')
const { transcribeAudio } = require('../../services/deepgramService')
const {
  uploadAudio,
  uploadImage,
  resolveAudioForTranscription,
} = require('../../services/storageService')

// ─── UPLOAD AUDIO ────────────────────────────────────────────────────────────
router.post('/upload-audio', authMiddleware, teacherOnly, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  if (req.file.size < 4096) {
    try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path) } catch {}
    return res.status(400).json({ message: 'File audio quá nhỏ hoặc bị hỏng (dung lượng dưới 4KB). Vui lòng chọn file audio hợp lệ.' })
  }
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

// ─── TRANSCRIBE AUDIO (Deepgram) ───────────────────────────────────────────
router.post('/transcribe', authMiddleware, teacherOnly, validate(transcribeUploadSchema), async (req, res) => {
  let audioResolution = null
  try {
    const { audioUrl } = req.body

    audioResolution = await resolveAudioForTranscription(audioUrl)
    const { filePath } = audioResolution

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath)
      if (stat.size < 4096) {
        return res.status(400).json({
          message: 'File audio quá nhỏ (dưới 4KB) hoặc bị hỏng, không chứa dữ liệu âm thanh hợp lệ.'
        })
      }
    }

    if (process.env.NODE_ENV !== 'production') console.log('[Transcribe] Bắt đầu phiên âm Deepgram:', path.basename(filePath))
    
    // Call deepgramService which now supports absolute paths
    const utterances = await transcribeAudio(filePath)
    
    if (process.env.NODE_ENV !== 'production') console.log('[Transcribe] Xong, độ dài script:', utterances.length)
    res.json({ transcript: utterances })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Transcribe] Lỗi:', error.message)
    let userMsg = error.message
    if (userMsg.includes('failed to process audio') || userMsg.includes('corrupt or unsupported data')) {
      userMsg = 'File audio bị hỏng hoặc không đúng định dạng âm thanh chuẩn. Vui lòng kiểm tra lại file audio.'
    }
    res.status(500).json({ message: 'Lỗi phiên âm: ' + userMsg })
  } finally {
    if (audioResolution?.cleanup) audioResolution.cleanup()
  }
})

module.exports = router
