const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const prisma = require('../lib/prisma')
const { invalidate } = require('../lib/swrCache')
const { getSampleListCached } = require('../lib/publicContent')
const { resizeUploadedCover } = require('../lib/imageResize')
const { createSampleSchema, updateSampleSchema } = require('../validators/contentValidator')
const { sanitizeRichText } = require('../lib/sanitizeHtml')

const router = express.Router()

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
    else cb(Object.assign(new Error('Chỉ chấp nhận ảnh jpg/png/webp'), { code: 'INVALID_FILE_TYPE' }))
  },
  limits: { fileSize: 5 * 1024 * 1024 }
})

const teacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher')
    return res.status(403).json({ message: 'Không có quyền' })
  next()
}

// ─── PUBLIC: list samples (home page) ────────────────────────────────────────
// Fetcher + SWR cache nằm ở lib/publicContent.js (chia sẻ cache với /api/home).
function makeSampleListHandler(skill) {
  return async (req, res) => {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
    try {
      res.json(await getSampleListCached(skill, limit))
    } catch (err) {
      res.status(500).json({ message: 'Lỗi server', error: err.message })
    }
  }
}

router.get('/writing', makeSampleListHandler('writing'))
router.get('/speaking', makeSampleListHandler('speaking'))

// ─── PUBLIC: detail ───────────────────────────────────────────────────────────
router.get('/writing/:id', async (req, res) => {
  try {
    const s = await prisma.writingSample.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/speaking/:id', async (req, res) => {
  try {
    const s = await prisma.speakingSample.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { parts: { include: { questions: { orderBy: { orderNum: 'asc' } } }, orderBy: { partNumber: 'asc' } } }
    })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: list all ──────────────────────────────────────────────────────────
router.get('/admin/writing', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.writingSample.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, level: true, examType: true, thumbnailUrl: true, tags: true, createdAt: true }
    })
    res.json(rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })))
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/admin/speaking', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const rows = await prisma.speakingSample.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, level: true, examType: true, thumbnailUrl: true, tags: true, createdAt: true }
    })
    res.json(rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })))
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: get full detail ───────────────────────────────────────────────────
router.get('/admin/writing/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const s = await prisma.writingSample.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

router.get('/admin/speaking/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const s = await prisma.speakingSample.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { parts: { include: { questions: { orderBy: { orderNum: 'asc' } } }, orderBy: { partNumber: 'asc' } } }
    })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── ADMIN: create ────────────────────────────────────────────────────────────
router.post('/admin/writing', authMiddleware, teacherOrAdmin, validate(createSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    const s = await prisma.writingSample.create({
      data: { title: title.trim(), level: level || null, examType: examType || null, content: sanitizeRichText(content) || null, thumbnailUrl: thumbnailUrl || null, tags: tags ? JSON.stringify(tags) : null }
    })
    invalidate('samples:')
    res.status(201).json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo', error: err.message })
  }
})

router.post('/admin/speaking', authMiddleware, teacherOrAdmin, validate(createSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    const s = await prisma.speakingSample.create({
      data: { title: title.trim(), level: level || null, examType: examType || null, content: sanitizeRichText(content) || null, thumbnailUrl: thumbnailUrl || null, tags: tags ? JSON.stringify(tags) : null }
    })
    invalidate('samples:')
    res.status(201).json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo', error: err.message })
  }
})

// ─── ADMIN: update ────────────────────────────────────────────────────────────
router.put('/admin/writing/:id', authMiddleware, teacherOrAdmin, validate(updateSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    const data = {}
    if (title !== undefined) data.title = title.trim()
    if (level !== undefined) data.level = level || null
    if (examType !== undefined) data.examType = examType || null
    if (content !== undefined) data.content = sanitizeRichText(content)
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl
    if (tags !== undefined) data.tags = JSON.stringify(tags)
    const s = await prisma.writingSample.update({ where: { id: parseInt(req.params.id) }, data })
    invalidate('samples:')
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: err.message })
  }
})

router.put('/admin/speaking/:id', authMiddleware, teacherOrAdmin, validate(updateSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    const data = {}
    if (title !== undefined) data.title = title.trim()
    if (level !== undefined) data.level = level || null
    if (examType !== undefined) data.examType = examType || null
    if (content !== undefined) data.content = sanitizeRichText(content)
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl
    if (tags !== undefined) data.tags = JSON.stringify(tags)
    const s = await prisma.speakingSample.update({ where: { id: parseInt(req.params.id) }, data })
    invalidate('samples:')
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: err.message })
  }
})

// ─── ADMIN: upload thumbnail file → trả URL (KHÔNG gắn record) ────────────────
// Dùng khi tạo mới: upload trước, lấy URL, rồi mới ghi record → upload fail thì
// không có record mồ côi thiếu ảnh. Tái dùng thumbUpload (5MB, jpg/png/webp)
// giống endpoint /:id/thumbnail bên dưới.
const uploadThumbToUrl = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  const { url } = await resizeUploadedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails' })
  res.json({ url })
}
router.post('/admin/writing/upload-thumbnail', authMiddleware, teacherOrAdmin, thumbUpload.single('thumbnail'), uploadThumbToUrl)
router.post('/admin/speaking/upload-thumbnail', authMiddleware, teacherOrAdmin, thumbUpload.single('thumbnail'), uploadThumbToUrl)

// ─── ADMIN: upload thumbnail (gắn thẳng vào record :id — giữ cho tương thích) ──
router.post('/admin/writing/:id/thumbnail', authMiddleware, teacherOrAdmin,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const { url: thumbnailUrl } = await resizeUploadedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails' })
      const s = await prisma.writingSample.update({
        where: { id: parseInt(req.params.id) }, data: { thumbnailUrl }, select: { id: true, thumbnailUrl: true }
      })
      invalidate('samples:')
      res.json(s)
    } catch (err) { res.status(500).json({ message: 'Lỗi upload', error: err.message }) }
  }
)

router.post('/admin/speaking/:id/thumbnail', authMiddleware, teacherOrAdmin,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const { url: thumbnailUrl } = await resizeUploadedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails' })
      const s = await prisma.speakingSample.update({
        where: { id: parseInt(req.params.id) }, data: { thumbnailUrl }, select: { id: true, thumbnailUrl: true }
      })
      invalidate('samples:')
      res.json(s)
    } catch (err) { res.status(500).json({ message: 'Lỗi upload', error: err.message }) }
  }
)

// ─── ADMIN: delete (soft) ─────────────────────────────────────────────────────
router.delete('/admin/writing/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    await prisma.writingSample.update({ where: { id: parseInt(req.params.id) }, data: { deletedAt: new Date() } })
    invalidate('samples:')
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ message: 'Lỗi xóa', error: err.message }) }
})

router.delete('/admin/speaking/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    await prisma.speakingSample.update({ where: { id: parseInt(req.params.id) }, data: { deletedAt: new Date() } })
    invalidate('samples:')
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ message: 'Lỗi xóa', error: err.message }) }
})

module.exports = router
