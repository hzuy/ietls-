const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const prisma = require('../lib/prisma')
const { invalidate } = require('../lib/swrCache')
const { getSampleListCached, getSamplePageCached } = require('../lib/publicContent')
const { uploadOptimizedCover } = require('../services/storageService')
const { createSampleSchema, updateSampleSchema } = require('../validators/contentValidator')
const { sanitizeRichText } = require('../lib/sanitizeHtml')
const { logAuditEvent } = require('../lib/auditLog')
const { AUDIT_ACTIONS } = require('../lib/auditActions')
const { sendServerError } = require('../lib/httpErrors')
const { findTitleConflict } = require('../lib/titleConflict')

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

const { teacherStrict } = require('../lib/roles')

// ─── SpeakingSample nested Part/Question graph (TC-036) ──────────────────────
// Một lần ghi lồng nhau của Prisma là atomic: hoặc toàn bộ Part/Question được
// tạo/thay, hoặc không bản ghi nào bị thay đổi.
const SPEAKING_PARTS_INCLUDE = {
  parts: {
    include: { questions: { orderBy: { orderNum: 'asc' } } },
    orderBy: { partNumber: 'asc' },
  },
}

function buildSpeakingPartRows(parts) {
  return (parts || []).map(part => ({
    partNumber: part.partNumber,
    title: part.title || null,
    description: part.description || null,
    questions: {
      create: (part.questions || []).map((q, index) => ({
        orderNum: q.orderNum ?? index + 1,
        questionText: q.questionText.trim(),
      })),
    },
  }))
}

// ─── PUBLIC: list samples (home page) ────────────────────────────────────────
// Fetcher + SWR cache nằm ở lib/publicContent.js (chia sẻ cache với /api/home).
function makeSampleListHandler(skill) {
  return async (req, res) => {
    if (req.query.page !== undefined || req.query.search || req.query.level || req.query.type || req.query.sort) {
      const page = Math.max(1, Math.min(1000000, parseInt(req.query.page, 10) || 1))
      const pageSize = Math.max(1, Math.min(24, parseInt(req.query.pageSize, 10) || 12))
      const sort = ['newest', 'title-asc', 'title-desc'].includes(req.query.sort) ? req.query.sort : 'newest'
      const options = {
        page,
        pageSize,
        search: String(req.query.search || '').trim().slice(0, 120),
        level: String(req.query.level || '').trim().slice(0, 32),
        examType: String(req.query.type || '').trim().slice(0, 100),
        sort,
      }
      try {
        return res.json(await getSamplePageCached(skill, options))
      } catch (err) {
        return sendServerError(res, err, 'Lỗi server')
      }
    }
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
    try {
      res.json(await getSampleListCached(skill, limit))
    } catch (err) {
      sendServerError(res, err, 'Lỗi server')
    }
  }
}

router.get('/writing', makeSampleListHandler('writing'))
router.get('/speaking', makeSampleListHandler('speaking'))

// ─── PUBLIC: detail ───────────────────────────────────────────────────────────
router.get('/writing/:id', async (req, res) => {
  try {
    // deletedAt: null — bài mẫu đã xóa mềm không còn hiển thị công khai.
    const s = await prisma.writingSample.findFirst({ where: { id: parseInt(req.params.id), deletedAt: null } })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

router.get('/speaking/:id', async (req, res) => {
  try {
    // deletedAt: null — bài mẫu đã xóa mềm không còn hiển thị công khai.
    const s = await prisma.speakingSample.findFirst({
      where: { id: parseInt(req.params.id), deletedAt: null },
      include: { parts: { include: { questions: { orderBy: { orderNum: 'asc' } } }, orderBy: { partNumber: 'asc' } } }
    })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

// ─── ADMIN: list all ──────────────────────────────────────────────────────────
router.get('/admin/writing', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const rows = await prisma.writingSample.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, level: true, examType: true, thumbnailUrl: true, tags: true, createdAt: true }
    })
    res.json(rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })))
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

router.get('/admin/speaking', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const rows = await prisma.speakingSample.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, level: true, examType: true, thumbnailUrl: true, tags: true, createdAt: true }
    })
    res.json(rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })))
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

// ─── ADMIN: get full detail ───────────────────────────────────────────────────
router.get('/admin/writing/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const s = await prisma.writingSample.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

router.get('/admin/speaking/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const s = await prisma.speakingSample.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { parts: { include: { questions: { orderBy: { orderNum: 'asc' } } }, orderBy: { partNumber: 'asc' } } }
    })
    if (!s) return res.status(404).json({ message: 'Không tìm thấy' })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi server')
  }
})

// ─── ADMIN: create ────────────────────────────────────────────────────────────
router.post('/admin/writing', authMiddleware, teacherStrict, validate(createSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    if (await findTitleConflict(prisma.writingSample, title)) return res.status(409).json({ message: 'Tên bài mẫu Writing đã tồn tại' })
    const s = await prisma.writingSample.create({
      data: { title: title.trim(), level: level || null, examType: examType || null, content: sanitizeRichText(content) || null, thumbnailUrl: thumbnailUrl || null, tags: tags ? JSON.stringify(tags) : null }
    })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_CREATE,
      entityType: 'WritingSample',
      entityId: s.id,
      entityLabel: s.title
    })
    res.status(201).json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi tạo')
  }
})

router.post('/admin/speaking', authMiddleware, teacherStrict, validate(createSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags, parts } = req.body
    if (await findTitleConflict(prisma.speakingSample, title)) return res.status(409).json({ message: 'Tên bài mẫu Speaking đã tồn tại' })
    const data = {
      title: title.trim(), level: level || null, examType: examType || null,
      content: sanitizeRichText(content) || null, thumbnailUrl: thumbnailUrl || null,
      tags: tags ? JSON.stringify(tags) : null,
    }
    if (parts !== undefined) data.parts = { create: buildSpeakingPartRows(parts) }
    const s = await prisma.speakingSample.create({ data, include: SPEAKING_PARTS_INCLUDE })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_CREATE,
      entityType: 'SpeakingSample',
      entityId: s.id,
      entityLabel: s.title
    })
    res.status(201).json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi tạo')
  }
})

// ─── ADMIN: update ────────────────────────────────────────────────────────────
router.put('/admin/writing/:id', authMiddleware, teacherStrict, validate(updateSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags } = req.body
    const id = parseInt(req.params.id, 10)
    if (title !== undefined && await findTitleConflict(prisma.writingSample, title, {}, id)) return res.status(409).json({ message: 'Tên bài mẫu Writing đã tồn tại' })
    const data = {}
    if (title !== undefined) data.title = title.trim()
    if (level !== undefined) data.level = level || null
    if (examType !== undefined) data.examType = examType || null
    if (content !== undefined) data.content = sanitizeRichText(content)
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl
    if (tags !== undefined) data.tags = JSON.stringify(tags)
    const s = await prisma.writingSample.update({ where: { id }, data })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_UPDATE,
      entityType: 'WritingSample',
      entityId: s.id,
      entityLabel: s.title
    })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi cập nhật')
  }
})

router.put('/admin/speaking/:id', authMiddleware, teacherStrict, validate(updateSampleSchema), async (req, res) => {
  try {
    const { title, level, examType, content, thumbnailUrl, tags, parts } = req.body
    const id = parseInt(req.params.id, 10)
    if (title !== undefined && await findTitleConflict(prisma.speakingSample, title, {}, id)) return res.status(409).json({ message: 'Tên bài mẫu Speaking đã tồn tại' })
    const data = {}
    if (title !== undefined) data.title = title.trim()
    if (level !== undefined) data.level = level || null
    if (examType !== undefined) data.examType = examType || null
    if (content !== undefined) data.content = sanitizeRichText(content)
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl
    if (tags !== undefined) data.tags = JSON.stringify(tags)
    if (parts !== undefined) {
      // Replace toàn bộ graph trong MỘT update lồng nhau (atomic).
      data.parts = { deleteMany: {} }
      const rows = buildSpeakingPartRows(parts)
      if (rows.length) data.parts.create = rows
    }
    const s = await prisma.speakingSample.update({ where: { id }, data, include: SPEAKING_PARTS_INCLUDE })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_UPDATE,
      entityType: 'SpeakingSample',
      entityId: s.id,
      entityLabel: s.title
    })
    res.json({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })
  } catch (err) {
    sendServerError(res, err, 'Lỗi cập nhật')
  }
})

// ─── ADMIN: upload thumbnail file → trả URL (KHÔNG gắn record) ────────────────
// Dùng khi tạo mới: upload trước, lấy URL, rồi mới ghi record → upload fail thì
// không có record mồ côi thiếu ảnh. Tái dùng thumbUpload (5MB, jpg/png/webp)
// giống endpoint /:id/thumbnail bên dưới.
const uploadThumbToUrl = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url } = await uploadOptimizedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails', folder: 'thumbnails' })
    res.json({ url })
  } catch (err) { sendServerError(res, err, 'Lỗi upload') }
}
router.post('/admin/writing/upload-thumbnail', authMiddleware, teacherStrict, thumbUpload.single('thumbnail'), uploadThumbToUrl)
router.post('/admin/speaking/upload-thumbnail', authMiddleware, teacherStrict, thumbUpload.single('thumbnail'), uploadThumbToUrl)

// ─── ADMIN: upload thumbnail (gắn thẳng vào record :id — giữ cho tương thích) ──
router.post('/admin/writing/:id/thumbnail', authMiddleware, teacherStrict,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const { url: thumbnailUrl } = await uploadOptimizedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails', folder: 'thumbnails' })
      const s = await prisma.writingSample.update({
        where: { id: parseInt(req.params.id) }, data: { thumbnailUrl }, select: { id: true, thumbnailUrl: true }
      })
      invalidate('samples:')
      await logAuditEvent(req, {
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'WritingSample',
        entityId: s.id,
        metadata: { resource: 'thumbnail' }
      })
      res.json(s)
    } catch (err) { sendServerError(res, err, 'Lỗi upload') }
  }
)

router.post('/admin/speaking/:id/thumbnail', authMiddleware, teacherStrict,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const { url: thumbnailUrl } = await uploadOptimizedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails', folder: 'thumbnails' })
      const s = await prisma.speakingSample.update({
        where: { id: parseInt(req.params.id) }, data: { thumbnailUrl }, select: { id: true, thumbnailUrl: true }
      })
      invalidate('samples:')
      await logAuditEvent(req, {
        action: AUDIT_ACTIONS.SAMPLE_UPDATE,
        entityType: 'SpeakingSample',
        entityId: s.id,
        metadata: { resource: 'thumbnail' }
      })
      res.json(s)
    } catch (err) { sendServerError(res, err, 'Lỗi upload') }
  }
)

// ─── ADMIN: delete (soft) ─────────────────────────────────────────────────────
router.delete('/admin/writing/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    // Đọc tiêu đề trước khi soft-delete để entityLabel vẫn đọc được sau này.
    const existing = await prisma.writingSample.findUnique({ where: { id }, select: { title: true } })
    await prisma.writingSample.update({ where: { id }, data: { deletedAt: new Date() } })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_DELETE,
      entityType: 'WritingSample',
      entityId: id,
      entityLabel: existing?.title ?? null
    })
    res.json({ message: 'Đã xóa' })
  } catch (err) { sendServerError(res, err, 'Lỗi xóa') }
})

router.delete('/admin/speaking/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.speakingSample.findUnique({ where: { id }, select: { title: true } })
    await prisma.speakingSample.update({ where: { id }, data: { deletedAt: new Date() } })
    invalidate('samples:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.SAMPLE_DELETE,
      entityType: 'SpeakingSample',
      entityId: id,
      entityLabel: existing?.title ?? null
    })
    res.json({ message: 'Đã xóa' })
  } catch (err) { sendServerError(res, err, 'Lỗi xóa') }
})

module.exports = router
