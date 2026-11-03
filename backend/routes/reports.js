const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const prisma = require('../lib/prisma')
const { verifySession } = require('../lib/authUser')
const authMiddleware = require('../middleware/auth')
const { teacherOrAdmin } = require('../lib/roles')
const { uploadImage } = require('../services/storageService')
const { sendServerError } = require('../lib/httpErrors')

const router = express.Router()

// Multer setup for report screenshot uploads
const tempDir = path.join(__dirname, '..', 'uploads', 'temp')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'report-' + unique + path.extname(file.originalname).toLowerCase())
  },
})

const reportUpload = multer({
  storage: reportStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(Object.assign(new Error('Chỉ chấp nhận file ảnh JPG, PNG, WEBP'), { code: 'INVALID_FILE_TYPE' }))
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return next()
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const problem = await verifySession(decoded)
    if (!problem) req.user = decoded
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next()
}

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Bạn đã gửi nhiều báo lỗi gần đây, vui lòng chờ ít phút trước khi thử lại.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const ALLOWED_ISSUE_TYPES = new Set(['content_wrong', 'ui_bug', 'lost_work', 'slow_hang', 'other'])
const ALLOWED_SKILLS = new Set(['reading', 'listening', 'writing', 'speaking', 'general'])

// POST /api/reports — Gửi báo lỗi (User / Learner)
router.post('/', reportLimiter, optionalAuth, reportUpload.single('image'), async (req, res) => {
  try {
    const {
      issueType = 'content_wrong',
      description = '',
      skill = 'reading',
      sourceType = 'exam',
      examId,
      practiceExamId,
      location,
      questionNumber,
    } = req.body

    const trimmedDesc = String(description).trim()
    if (!trimmedDesc) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: 'Vui lòng nhập mô tả chi tiết lỗi.' })
    }

    if (trimmedDesc.length > 2500) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: 'Mô tả quá dài (tối đa 2500 ký tự).' })
    }

    const safeIssueType = ALLOWED_ISSUE_TYPES.has(issueType) ? issueType : 'other'
    const safeSkill = ALLOWED_SKILLS.has(skill) ? skill : 'reading'

    let imageUrl = null
    if (req.file) {
      try {
        const uploaded = await uploadImage(req.file, { subdir: 'reports', folder: 'reports' })
        imageUrl = uploaded.url
      } catch (uploadErr) {
        console.error('[ErrorReport uploadImage error]', uploadErr)
      }
    }

    const parsedExamId = examId ? parseInt(examId, 10) : null
    const parsedPracticeId = practiceExamId ? parseInt(practiceExamId, 10) : null
    const parsedQNum = questionNumber ? parseInt(questionNumber, 10) : null

    const report = await prisma.errorReport.create({
      data: {
        userId: req.user?.userId || null,
        examId: Number.isInteger(parsedExamId) ? parsedExamId : null,
        practiceExamId: Number.isInteger(parsedPracticeId) ? parsedPracticeId : null,
        skill: safeSkill,
        sourceType: String(sourceType || 'exam').slice(0, 30),
        location: location ? String(location).slice(0, 255) : null,
        questionNumber: Number.isInteger(parsedQNum) ? parsedQNum : null,
        issueType: safeIssueType,
        description: trimmedDesc,
        imageUrl,
        status: 'pending',
      },
    })

    res.status(201).json({
      ok: true,
      message: 'Cảm ơn bạn đã gửi báo lỗi! Đội ngũ phát triển sẽ kiểm tra và khắc phục sớm nhất.',
      reportId: report.id,
    })
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path) } catch {}
    }
    console.error('[POST /api/reports Error]', err)
    sendServerError(res, err, 'Lỗi server khi gửi báo lỗi')
  }
})

// GET /api/reports/admin — Lấy danh sách báo lỗi cho Admin/Teacher
router.get('/admin', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const { status, skill, page = 1, limit = 20 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))

    const where = {}
    if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
      where.status = status
    }
    if (skill && ALLOWED_SKILLS.has(skill)) {
      where.skill = skill
    }

    const [total, reports] = await Promise.all([
      prisma.errorReport.count({ where }),
      prisma.errorReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ])

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      reports,
    })
  } catch (err) {
    console.error('[GET /api/reports/admin Error]', err)
    sendServerError(res, err, 'Lỗi server')
  }
})

// PATCH /api/reports/admin/:id — Cập nhật trạng thái báo lỗi
router.patch('/admin/:id', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: 'ID không hợp lệ' })
    const reportId = Number(req.params.id)

    const { status, adminNote } = req.body
    const allowedStatuses = ['pending', 'resolved', 'dismissed']
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái báo lỗi không hợp lệ', field: 'status' })
    }
    const updateData = {}
    if (status !== undefined) {
      updateData.status = status
    }
    if (!Object.keys(updateData).length && adminNote === undefined) {
      return res.status(400).json({ message: 'Cần cung cấp trạng thái hoặc ghi chú cần cập nhật' })
    }
    if (adminNote !== undefined) {
      updateData.adminNote = typeof adminNote === 'string' ? adminNote.trim() : null
    }

    const updated = await prisma.errorReport.update({
      where: { id: reportId },
      data: updateData,
    })

    res.json({ ok: true, report: updated })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Không tìm thấy báo lỗi' })
    console.error('[PATCH /api/reports/admin/:id Error]', err)
    sendServerError(res, err, 'Lỗi server')
  }
})

module.exports = router
