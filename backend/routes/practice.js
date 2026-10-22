const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const { aiExplanationLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const prisma = require('../lib/prisma')
const { invalidate } = require('../lib/swrCache')
const { getQuestionCount, getPracticeListCached } = require('../lib/publicContent')
const { createPracticeSchema, updatePracticeSchema, practiceAttemptSchema } = require('../validators/contentValidator')
const { uploadAudio, uploadOptimizedCover } = require('../services/storageService')
const {
  generateForPracticeExam,
  isExplanationVisibleToLearner,
  filterLearnerExplanation,
  sanitizeExplanationForRead,
  regenerateQuestionExplanation,
  updateManualExplanation,
  reviewQuestionExplanation,
} = require('../services/explanationGeneratorService')
const { logAuditEvent } = require('../lib/auditLog')
const { AUDIT_ACTIONS } = require('../lib/auditActions')
const { acquireLock, releaseLock, isLocked } = require('../lib/explanationLock')
const { bindRequestAbort } = require('../lib/requestAbort')
const { sendServerError } = require('../lib/httpErrors')

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
    else cb(Object.assign(new Error('Chỉ chấp nhận ảnh jpg/png/webp'), { code: 'INVALID_FILE_TYPE' }))
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
    else cb(Object.assign(new Error('Chỉ chấp nhận file audio (mp3/wav/ogg/m4a/aac)'), { code: 'INVALID_FILE_TYPE' }))
  },
  limits: { fileSize: 50 * 1024 * 1024 }
})

const { teacherStrict, learnerOnly } = require('../lib/roles')

// ─── PUBLIC: list ─────────────────────────────────────────────────────────────
// Fetcher + SWR cache nằm ở lib/publicContent.js (chia sẻ cache với /api/home).
// getQuestionCount cũng import từ đó — còn dùng cho các route /admin bên dưới.
function practiceGroupsWithExplanations(rows, { forAdmin = false } = {}) {
  return (rows || []).map(pq => {
    const group = JSON.parse(pq.content)
    const byNumber = pq.explanation?.byNumber
    if (!byNumber) return group
    const qTypeMap = {}
    for (const q of group.questions || []) {
      qTypeMap[q.number] = q.type || group.type || pq.type
    }
    if (forAdmin) {
      const sanitizedByNumber = {}
      for (const [k, exp] of Object.entries(byNumber)) {
        sanitizedByNumber[k] = sanitizeExplanationForRead(exp, qTypeMap[k] || group.type || pq.type)
      }
      return { ...group, explanations: sanitizedByNumber }
    }
    // 3.1: Ẩn lời giải chưa duyệt hoặc conflict khỏi học sinh; lọc translation/full_sentence theo 2.3
    const filteredByNumber = {}
    for (const [k, exp] of Object.entries(byNumber)) {
      const filtered = filterLearnerExplanation(exp, qTypeMap[k] || group.type || pq.type)
      if (filtered) {
        filteredByNumber[k] = filtered
      }
    }
    return Object.keys(filteredByNumber).length ? { ...group, explanations: filteredByNumber } : group
  })
}

function carryOverExplanations(oldRows, newGroups) {
  const old = {}
  for (const row of oldRows || []) {
    const byNumber = row.explanation?.byNumber
    if (!byNumber) continue
    let group
    try { group = JSON.parse(row.content) } catch { continue }
    for (const q of group.questions || []) {
      if (byNumber[q.number]) {
        old[q.number] = {
          answer: String(q.correctAnswer ?? '').trim(),
          text: String(q.questionText ?? '').trim(),
          options: JSON.stringify(q.options ?? null),
          explanation: byNumber[q.number]
        }
      }
    }
  }
  return newGroups.map(g => {
    const group = typeof g === 'string' ? (() => { try { return JSON.parse(g) } catch { return {} } })() : g
    const byNumber = {}
    for (const q of group.questions || []) {
      const prev = old[q.number]
      if (prev && prev.explanation) {
        const answerChanged = prev.answer !== String(q.correctAnswer ?? '').trim()
        const textChanged = prev.text !== String(q.questionText ?? '').trim()
        const optionsChanged = prev.options !== JSON.stringify(q.options ?? null)
        if (answerChanged || textChanged || optionsChanged) {
          // 3.8: Không xóa lời giải, đánh dấu status 'possibly_stale'
          let staleReason = 'Nội dung câu hỏi đã thay đổi'
          if (answerChanged) staleReason = 'Đáp án đã thay đổi'
          else if (optionsChanged) staleReason = 'Các lựa chọn đã thay đổi'
          byNumber[q.number] = {
            ...prev.explanation,
            status: 'possibly_stale',
            staleReason,
            staleAt: new Date().toISOString()
          }
        } else {
          byNumber[q.number] = prev.explanation
        }
      }
    }
    return Object.keys(byNumber).length ? { byNumber } : null
  })
}

function makePracticeListHandler(skill) {
  return async (req, res) => {
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 4
    try {
      res.json(await getPracticeListCached(skill, limit))
    } catch (err) { sendServerError(res, err, 'Lỗi server') }
  }
}

const PRACTICE_SKILLS = new Set(['reading', 'listening'])

function attemptSummary(a, skill) {
  return { attemptId: a.id, examId: a.practiceExamId, skill, finishedAt: a.createdAt, correct: a.correct, total: a.total, bandScore: null }
}

router.get('/attempts/:skill', authMiddleware, learnerOnly, async (req, res) => {
  const { skill } = req.params
  if (!PRACTICE_SKILLS.has(skill)) return res.status(400).json({ message: 'Kỹ năng không hợp lệ' })
  try {
    const rows = await prisma.practiceAttempt.findMany({
      where: { userId: req.user.userId, practiceExam: { skill } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, practiceExamId: true, correct: true, total: true, createdAt: true },
    })
    const byExam = {}
    for (const a of rows) (byExam[a.practiceExamId] ||= []).push(attemptSummary(a, skill))
    res.json(byExam)
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

router.post('/attempts/:skill/:id', authMiddleware, learnerOnly, validate(practiceAttemptSchema), async (req, res) => {
  const { skill } = req.params
  const examId = parseInt(req.params.id)
  if (!PRACTICE_SKILLS.has(skill) || !Number.isInteger(examId)) return res.status(400).json({ message: 'Yêu cầu không hợp lệ' })
  try {
    const exam = await prisma.practiceExam.findFirst({ where: { id: examId, skill, deletedAt: null }, select: { id: true } })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy bài luyện tập' })
    const { answers, correct, total } = req.body
    const created = await prisma.practiceAttempt.create({
      data: { userId: req.user.userId, practiceExamId: examId, answers, correct, total },
      select: { id: true, practiceExamId: true, correct: true, total: true, createdAt: true },
    })
    res.status(201).json(attemptSummary(created, skill))
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

router.get('/attempts/:skill/:id/:attemptId', authMiddleware, learnerOnly, async (req, res) => {
  const { skill } = req.params
  const examId = parseInt(req.params.id)
  const attemptId = parseInt(req.params.attemptId)
  if (!PRACTICE_SKILLS.has(skill) || !Number.isInteger(examId) || !Number.isInteger(attemptId)) return res.status(400).json({ message: 'Yêu cầu không hợp lệ' })
  try {
    const attempt = await prisma.practiceAttempt.findFirst({
      where: { id: attemptId, practiceExamId: examId, userId: req.user.userId },
    })
    if (!attempt) return res.status(404).json({ message: 'Không tìm thấy lượt làm bài' })
    res.json({ ...attemptSummary(attempt, skill), answers: attempt.answers })
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

router.get('/reading', makePracticeListHandler('reading'))
router.get('/listening', makePracticeListHandler('listening'))

// ─── AUTH: detail ─────────────────────────────────────────────────────────────
router.get('/reading/:id', authMiddleware, async (req, res) => {
  try {
    // deletedAt: null — bài luyện tập đã xóa mềm không được trả cho học sinh.
    const exam = await prisma.practiceExam.findFirst({
      where: { id: parseInt(req.params.id), deletedAt: null },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    const groups = practiceGroupsWithExplanations(exam.questions, { forAdmin: false })
    res.json({ ...exam, questions: { groups } })
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

router.get('/listening/:id', authMiddleware, async (req, res) => {
  try {
    // deletedAt: null — bài luyện tập đã xóa mềm không được trả cho học sinh.
    const exam = await prisma.practiceExam.findFirst({
      where: { id: parseInt(req.params.id), deletedAt: null },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    const groups = practiceGroupsWithExplanations(exam.questions, { forAdmin: false })
    res.json({ ...exam, questions: { groups } })
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

// ─── ADMIN: list ──────────────────────────────────────────────────────────────
// select tường minh — KHÔNG lấy `passage` (toàn văn bài đọc, vài KB/row): bảng
// danh sách admin chỉ cần title + thumbnail + số câu; sửa đề fetch riêng qua
// route detail /admin/:skill/:id (vẫn trả đủ `passage`, không đụng ở đây — P7).
router.get('/admin/reading', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'reading', deletedAt: null },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, skill: true, level: true,
        thumbnailUrl: true, audioUrl: true, createdAt: true,
        questions: { select: { content: true } }
      }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

router.get('/admin/listening', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const rows = await prisma.practiceExam.findMany({
      where: { skill: 'listening', deletedAt: null },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, skill: true, level: true,
        thumbnailUrl: true, audioUrl: true, createdAt: true,
        questions: { select: { content: true } }
      }
    })
    res.json(rows.map(r => ({
      ...r,
      questionCount: getQuestionCount(r),
      questions: undefined
    })))
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

// ─── ADMIN: detail for editing ────────────────────────────────────────────────
router.get('/admin/:skill/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const exam = await prisma.practiceExam.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy' })
    
    // Map to JSON for editor (bao gồm cả explanations đã lưu)
    const groups = practiceGroupsWithExplanations(exam.questions, { forAdmin: true })
    res.json({ ...exam, questions: JSON.stringify({ groups }) })
  } catch (err) { sendServerError(res, err, 'Lỗi server') }
})

// ─── ADMIN: create (FIXED) ────────────────────────────────────────────────────
router.post('/admin/:skill', authMiddleware, teacherStrict, validate(createPracticeSchema), async (req, res) => {
  const { skill } = req.params
  const { title, level, thumbnailUrl, audioUrl, passage, transcript, questions } = req.body

  try {
    const exam = await prisma.practiceExam.create({
      data: {
        title: title.trim(),
        skill,
        level: level || null,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: skill === "listening" ? audioUrl : null,
        passage: passage || null,
        transcript: skill === 'listening' ? (transcript || null) : null,
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

    invalidate('practice:')

    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_CREATE,
      entityType: 'PracticeExam',
      entityId: exam.id,
      entityLabel: exam.title,
      metadata: { skill, questionCount: (questions || []).length }
    })

    res.status(201).json(exam)
  } catch (error) {
    console.error("CREATE PRACTICE ERROR:", error)
    return res.status(500).json({ message: error.message })
  }
})

// ─── ADMIN: update (FIXED) ────────────────────────────────────────────────────
router.put('/admin/:skill/:id', authMiddleware, teacherStrict, validate(updatePracticeSchema), async (req, res) => {
  const { id, skill } = req.params
  const practiceId = parseInt(id, 10)
  const lockKey = `practice:${practiceId}`

  if (isLocked(lockKey)) {
    return res.status(409).json({
      message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành trước khi lưu bài.'
    })
  }

  const { title, level, thumbnailUrl, audioUrl, passage, transcript, questions } = req.body

  try {
    // Trả về bản ghi sau khi update (kèm questions) để dùng cho audit log bên
    // dưới — không đổi response cho client, vẫn chỉ res.json({ ok: true }).
    const updatedExam = await prisma.$transaction(async (tx) => {
      const oldRows = Array.isArray(questions)
        ? await tx.practiceQuestion.findMany({ where: { examId: parseInt(id) }, select: { content: true, explanation: true } })
        : []
      const keptExplanations = Array.isArray(questions) ? carryOverExplanations(oldRows, questions) : []
      const updateData = { isNormalized: true }
      if (title !== undefined) updateData.title = title.trim()
      if (level !== undefined) updateData.level = level
      if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
      if (passage !== undefined) updateData.passage = passage
      if (audioUrl !== undefined) updateData.audioUrl = audioUrl
      if (transcript !== undefined) updateData.transcript = transcript || null

      // ✅ Update main record and manage relation
      return tx.practiceExam.update({
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
              type: q.type || 'group',
              ...(keptExplanations[index] ? { explanation: keptExplanations[index] } : {})
            }))
          } : undefined
        },
        include: { questions: true }
      })
    })

    invalidate('practice:')

    // Route xóa hết question rồi tạo lại (không diff) — chỉ log tổng số question
    // sau khi cập nhật, không cố tạo bộ đếm created/updated/pruned như route Exam.
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_UPDATE,
      entityType: 'PracticeExam',
      entityId: parseInt(id),
      entityLabel: updatedExam.title,
      metadata: { skill, questionCount: updatedExam.questions.length }
    })

    res.json({ ok: true })
  } catch (error) {
    console.error("UPDATE PRACTICE ERROR:", error)
    return res.status(500).json({ message: error.message })
  }
})

// ─── ADMIN: upload file → trả URL (KHÔNG gắn record) ─────────────────────────
// Dùng khi TẠO MỚI: upload file trước, lấy URL, rồi mới tạo record với URL trong
// body → upload fail thì không có record mồ côi thiếu file. Tái dùng đúng
// thumbUpload/audioUpload (5MB / 50MB, lọc type) như endpoint /:id/* bên dưới.
router.post('/admin/:skill/upload-thumbnail', authMiddleware, teacherStrict, thumbUpload.single('thumbnail'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url } = await uploadOptimizedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails', folder: 'thumbnails' })
    // Chưa gắn vào record nào (upload trước khi tạo mới) → entityId null. Không
    // log URL (có thể chứa query/token) — chỉ ghi loại tài nguyên.
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_UPDATE,
      entityType: 'PracticeExam',
      entityId: null,
      metadata: { resource: 'thumbnail' }
    })
    res.json({ url })
  } catch (err) { sendServerError(res, err, 'Lỗi upload') }
})

router.post('/admin/listening/upload-audio', authMiddleware, teacherStrict, audioUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url } = await uploadAudio(req.file, { subdir: 'audio', folder: 'audio' })
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_UPDATE,
      entityType: 'PracticeExam',
      entityId: null,
      metadata: { resource: 'audio' }
    })
    res.json({ url })
  } catch (err) { sendServerError(res, err, 'Lỗi upload audio') }
})

// ─── ADMIN: upload thumbnail (gắn thẳng vào record :id — giữ cho tương thích) ──
router.post('/admin/:skill/:id/thumbnail', authMiddleware, teacherStrict, thumbUpload.single('thumbnail'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url: thumbnailUrl } = await uploadOptimizedCover(req.file, { dir: thumbDir, urlPrefix: '/uploads/thumbnails', folder: 'thumbnails' })
    const exam = await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { thumbnailUrl },
      select: { id: true, thumbnailUrl: true }
    })
    invalidate('practice:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_UPDATE,
      entityType: 'PracticeExam',
      entityId: exam.id,
      metadata: { resource: 'thumbnail' }
    })
    res.json(exam)
  } catch (err) { sendServerError(res, err, 'Lỗi upload') }
})

// ─── ADMIN: upload audio (listening only) ────────────────────────────────────
router.post('/admin/listening/:id/audio', authMiddleware, teacherStrict, audioUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' })
  try {
    const { url: audioUrl } = await uploadAudio(req.file, { subdir: 'audio', folder: 'audio' })
    const exam = await prisma.practiceExam.update({
      where: { id: parseInt(req.params.id) },
      data: { audioUrl },
      select: { id: true, audioUrl: true }
    })
    invalidate('practice:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_UPDATE,
      entityType: 'PracticeExam',
      entityId: exam.id,
      metadata: { resource: 'audio' }
    })
    res.json(exam)
  } catch (err) { sendServerError(res, err, 'Lỗi upload audio') }
})

// ─── ADMIN: delete (soft) ─────────────────────────────────────────────────────
router.delete('/admin/:skill/:id', authMiddleware, teacherStrict, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const lockKey = `practice:${id}`
    if (isLocked(lockKey)) {
      return res.status(409).json({
        message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành trước khi xóa.'
      })
    }
    // Đọc tiêu đề trước khi soft-delete để entityLabel vẫn đọc được sau này.
    const existing = await prisma.practiceExam.findUnique({ where: { id }, select: { title: true } })
    await prisma.practiceExam.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
    invalidate('practice:')
    await logAuditEvent(req, {
      action: AUDIT_ACTIONS.PRACTICE_DELETE,
      entityType: 'PracticeExam',
      entityId: id,
      entityLabel: existing?.title ?? null
    })
    res.json({ message: 'Đã xóa' })
  } catch (err) { sendServerError(res, err, 'Lỗi xóa') }
})

// ─── ADMIN: GET EXPLANATION STATUS FOR PRACTICE (READ-ONLY) ─────────────────
router.get('/admin/:skill/:id/explanation-status', authMiddleware, teacherStrict, async (req, res) => {
  const { skill, id } = req.params
  if (!PRACTICE_SKILLS.has(skill)) {
    return res.status(400).json({ message: 'Kỹ năng không hợp lệ' })
  }
  const practiceId = parseInt(id, 10)
  if (isNaN(practiceId)) {
    return res.status(400).json({ message: 'ID không hợp lệ' })
  }

  try {
    const exam = await prisma.practiceExam.findFirst({
      where: { id: practiceId, skill, deletedAt: null },
      include: { questions: { orderBy: { orderNum: 'asc' } } }
    })
    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy bài luyện tập' })
    }

    const lockKey = `practice:${practiceId}`
    const isLockedNow = isLocked(lockKey)

    const statusCounts = {
      ai_generated: 0,
      teacher_reviewed: 0,
      teacher_edited: 0,
      conflict_pending: 0,
      needs_regeneration: 0,
      none: 0,
    }
    const unprocessedQuestionNumbers = []
    let totalQuestions = 0
    let generatedCount = 0

    for (const pq of exam.questions || []) {
      let group
      try {
        group = typeof pq.content === 'string' ? JSON.parse(pq.content) : pq.content
      } catch {
        group = null
      }
      if (!group || !Array.isArray(group.questions)) continue

      const byNumber = (pq.explanation && typeof pq.explanation === 'object' && pq.explanation.byNumber)
        ? pq.explanation.byNumber
        : {}

      for (const q of group.questions) {
        const qNum = Number(q.number)
        if (!qNum) continue
        totalQuestions++

        let exp = byNumber[qNum]
        if (typeof exp === 'string') {
          try { exp = JSON.parse(exp) } catch { exp = null }
        }
        const hasExp = exp && typeof exp === 'object' && (exp.steps || exp.reasoning || exp.aiExplanation || exp.status)
        if (hasExp) {
          generatedCount++
          const st = exp.status || 'ai_generated'
          if (statusCounts[st] !== undefined) {
            statusCounts[st]++
          } else {
            statusCounts.ai_generated++
          }
        } else {
          statusCounts.none++
          unprocessedQuestionNumbers.push(qNum)
        }
      }
    }

    res.json({
      isLocked: isLockedNow,
      totalQuestions,
      generatedCount,
      unprocessedCount: unprocessedQuestionNumbers.length,
      unprocessedQuestionNumbers,
      statusCounts,
    })
  } catch (err) {
    console.error('[GET PRACTICE EXPLANATION STATUS ERROR]', err)
    sendServerError(res, err, 'Lỗi server khi lấy trạng thái giải thích AI')
  }
})

// ─── ADMIN: generate AI explanations with conflict detection ──────────────────
router.post('/admin/:skill/:id/generate-explanations', authMiddleware, teacherStrict, aiExplanationLimiter, async (req, res) => {
  const { id } = req.params
  const { force = false, resolveChoices = {}, overwriteProtected = false, questionNumbers = null, timeBudgetMs = null } = req.body || {}
  const practiceId = parseInt(id, 10)
  const lockKey = `practice:${practiceId}`

  if (!acquireLock(lockKey)) {
    return res.status(409).json({
      message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành.'
    })
  }

  const abort = bindRequestAbort(req, res)

  try {
    const result = await generateForPracticeExam(practiceId, {
      force,
      resolveChoices,
      overwriteProtected,
      questionNumbers,
      timeBudgetMs,
      signal: abort.signal,
    })
    res.json(result)
  } catch (err) {
    if (err.name === 'AbortError' || abort.signal.aborted) {
      console.log(`[CLIENT_ABORT] Practice #${practiceId}: client ngắt kết nối, bỏ qua phản hồi.`)
      return
    }
    console.error('[GENERATE PRACTICE EXPLANATIONS ERROR]', err)
    res.status(500).json({ message: err.message || 'Lỗi khi tạo giải thích bằng AI' })
  } finally {
    abort.dispose()
    releaseLock(lockKey)
  }
})

// ─── ADMIN: regenerate single question explanation with teacher feedback ─────────
router.post('/admin/:skill/:id/questions/:qNum/regenerate-explanation', authMiddleware, teacherStrict, aiExplanationLimiter, async (req, res) => {
  const { skill, id, qNum } = req.params
  const { teacherFeedback, proposedAnswer, confirmChangeAnswer } = req.body || {}
  const practiceId = parseInt(id, 10)
  const lockKey = `practice:${practiceId}`

  if (!acquireLock(lockKey)) {
    return res.status(409).json({
      message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành.'
    })
  }

  const abort = bindRequestAbort(req, res)

  try {
    const result = await regenerateQuestionExplanation({
      examId: practiceId,
      questionNumber: parseInt(qNum, 10),
      isPractice: true,
      skill,
      teacherFeedback,
      proposedAnswer,
      confirmChangeAnswer: Boolean(confirmChangeAnswer),
      signal: abort.signal,
    })
    res.json(result)
  } catch (err) {
    if (err.name === 'AbortError' || abort.signal.aborted) {
      console.log(`[CLIENT_ABORT] Practice #${practiceId} câu #${qNum}: client ngắt kết nối, bỏ qua phản hồi.`)
      return
    }
    console.error('[REGENERATE PRACTICE QUESTION EXPLANATION ERROR]', err)
    if (err.isTimeout || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        ok: false,
        error: 'TIMEOUT',
        message: 'Hết thời gian xử lý AI khi tạo lại giải thích (quá 48s). Vui lòng thử lại.',
      })
    }
    res.status(500).json({ message: err.message || 'Lỗi khi tạo lại giải thích' })
  } finally {
    abort.dispose()
    releaseLock(lockKey)
  }
})

// ─── ADMIN: manually edit single question explanation ─────────────────────────────
router.put('/admin/:skill/:id/questions/:qNum/explanation', authMiddleware, teacherStrict, async (req, res) => {
  const { id, qNum } = req.params
  const practiceId = parseInt(id, 10)
  const lockKey = `practice:${practiceId}`

  if (isLocked(lockKey)) {
    return res.status(409).json({
      message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành trước khi sửa lời giải.'
    })
  }

  try {
    const result = await updateManualExplanation({
      examId: practiceId,
      questionNumber: parseInt(qNum, 10),
      isPractice: true,
      fields: req.body || {},
    })
    res.json(result)
  } catch (err) {
    console.error('[EDIT PRACTICE QUESTION EXPLANATION ERROR]', err)
    res.status(400).json({ message: err.message || 'Lỗi khi lưu chỉnh sửa giải thích' })
  }
})

// ─── ADMIN: approve/review single question explanation ────────────────────────────
router.post('/admin/:skill/:id/questions/:qNum/review-explanation', authMiddleware, teacherStrict, async (req, res) => {
  const { id, qNum } = req.params
  const practiceId = parseInt(id, 10)
  const lockKey = `practice:${practiceId}`

  if (isLocked(lockKey)) {
    return res.status(409).json({
      message: 'Đang có một tác vụ AI khác đang chạy cho bài luyện tập này. Vui lòng chờ hoàn thành trước khi duyệt lời giải.'
    })
  }

  try {
    const result = await reviewQuestionExplanation({
      examId: practiceId,
      questionNumber: parseInt(qNum, 10),
      isPractice: true,
    })
    res.json(result)
  } catch (err) {
    console.error('[REVIEW PRACTICE QUESTION EXPLANATION ERROR]', err)
    res.status(400).json({ message: err.message || 'Lỗi khi duyệt giải thích' })
  }
})

module.exports = router
module.exports.practiceGroupsWithExplanations = practiceGroupsWithExplanations
module.exports.carryOverExplanations = carryOverExplanations
