const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const prisma = require('../lib/prisma')
const { ieltsOverall } = require('../lib/scoreUtils')
const { createSeriesSchema, updateSeriesSchema } = require('../validators/contentValidator')

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
    else cb(new Error('Chỉ chấp nhận jpg/png/webp'))
  },
  limits: { fileSize: 5 * 1024 * 1024 }
})

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin' })
  next()
}

// ─── ADMIN routes (must be before /:id) ──────────────────────────────────────

// GET /admin/list
router.get('/admin/list', authMiddleware, adminOnly, async (req, res) => {
  try {
    const series = await prisma.series.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        exams: {
          include: { exam: { select: { id: true, title: true, skill: true } } },
          orderBy: { testNumber: 'asc' }
        }
      }
    })
    res.json(series)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// GET /admin/exams-list — list all available exams for selection
router.get('/admin/exams-list', authMiddleware, adminOnly, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { deletedAt: null },
      orderBy: [{ skill: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, skill: true, bookNumber: true, testNumber: true }
    })
    res.json(exams)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// POST /admin — create series
router.post('/admin', authMiddleware, adminOnly, validate(createSeriesSchema), async (req, res) => {
  try {
    const { name, description, type, exams } = req.body
    const series = await prisma.series.create({
      data: {
        name: name.trim(),
        description: description || null,
        type: type || 'academic',
        ...(exams?.length ? {
          exams: { create: exams.map(e => ({ examId: e.examId, testNumber: e.testNumber })) }
        } : {})
      }
    })
    res.status(201).json(series)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo', error: err.message })
  }
})

// PUT /admin/:id — update series
router.put('/admin/:id', authMiddleware, adminOnly, validate(updateSeriesSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, description, type, exams } = req.body
    await prisma.seriesExam.deleteMany({ where: { seriesId: id } })
    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description
    if (type !== undefined) data.type = type
    if (exams?.length) {
      data.exams = { create: exams.map(e => ({ examId: e.examId, testNumber: e.testNumber })) }
    }
    const series = await prisma.series.update({ where: { id }, data })
    res.json(series)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật', error: err.message })
  }
})

// DELETE /admin/:id
router.delete('/admin/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.series.update({ where: { id }, data: { deletedAt: new Date() } })
    res.json({ message: 'Đã xóa' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa', error: err.message })
  }
})

// POST /admin/:id/thumbnail
router.post('/admin/:id/thumbnail', authMiddleware, adminOnly,
  thumbUpload.single('thumbnail'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' })
    try {
      const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`
      const series = await prisma.series.update({
        where: { id: parseInt(req.params.id) },
        data: { thumbnailUrl },
        select: { id: true, thumbnailUrl: true }
      })
      res.json(series)
    } catch (err) {
      res.status(500).json({ message: 'Lỗi upload', error: err.message })
    }
  }
)

// GET /admin/:id — fetch single series with full exam data (BUG-10)
router.get('/admin/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        exams: {
          include: { exam: { select: { id: true, title: true, skill: true } } },
          orderBy: { testNumber: 'asc' }
        }
      }
    })
    if (!series || series.deletedAt) return res.status(404).json({ message: 'Không tìm thấy bộ đề' })
    res.json(series)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// ─── PUBLIC routes ────────────────────────────────────────────────────────────

// GET /:id/leaderboard — top 5 users by average score in this series
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const seriesExams = await prisma.seriesExam.findMany({
      where: { seriesId: id },
      include: {
        exam: {
          select: {
            id: true, skill: true,
            writingTasks: { select: { id: true } },
            speakingParts: { select: { id: true } }
          }
        }
      }
    })
    if (!seriesExams.length) return res.json([])

    const rlIds = seriesExams.filter(se => ['reading', 'listening'].includes(se.exam.skill)).map(se => se.exam.id)
    const writingTaskIds = seriesExams.filter(se => se.exam.skill === 'writing').flatMap(se => se.exam.writingTasks.map(t => t.id))
    const speakingPartIds = seriesExams.filter(se => se.exam.skill === 'speaking').flatMap(se => se.exam.speakingParts.map(p => p.id))

    const [attempts, writingAnswers, speakingAnswers] = await Promise.all([
      rlIds.length ? prisma.attempt.findMany({
        where: { examId: { in: rlIds }, finishedAt: { not: null } },
        select: { userId: true, score: true, examId: true },
        orderBy: { finishedAt: 'desc' }
      }) : [],
      writingTaskIds.length ? prisma.writingAnswer.findMany({
        where: { taskId: { in: writingTaskIds }, aiScore: { not: null } },
        select: { userId: true, aiScore: true, taskId: true },
        orderBy: { createdAt: 'desc' }
      }) : [],
      speakingPartIds.length ? prisma.speakingAnswer.findMany({
        where: { partId: { in: speakingPartIds }, aiScore: { not: null } },
        select: { userId: true, aiScore: true, partId: true },
        orderBy: { createdAt: 'desc' }
      }) : [],
    ])

    const userScores = {}
    const seen = new Set()
    for (const a of attempts) {
      const key = `${a.userId}-${a.examId}`
      if (!seen.has(key) && a.score != null) {
        seen.add(key)
        if (!userScores[a.userId]) userScores[a.userId] = []
        userScores[a.userId].push(a.score)
      }
    }
    const seenW = new Set()
    for (const a of writingAnswers) {
      const key = `${a.userId}-${a.taskId}`
      if (!seenW.has(key)) {
        seenW.add(key)
        if (!userScores[a.userId]) userScores[a.userId] = []
        userScores[a.userId].push(a.aiScore)
      }
    }
    const seenS = new Set()
    for (const a of speakingAnswers) {
      const key = `${a.userId}-${a.partId}`
      if (!seenS.has(key)) {
        seenS.add(key)
        if (!userScores[a.userId]) userScores[a.userId] = []
        userScores[a.userId].push(a.aiScore)
      }
    }

    const userIds = Object.keys(userScores).map(Number)
    if (!userIds.length) return res.json([])

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    })
    const userMap = {}
    for (const u of users) userMap[u.id] = u

    const ranked = userIds
      .map(uid => {
        const scores = userScores[uid]
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        return { userId: uid, name: userMap[uid]?.name || 'Ẩn danh', score: Math.round(Math.min(9, Math.max(0, avg)) * 2) / 2, count: scores.length }
      })
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, 5)

    res.json(ranked)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// GET / — list all series
router.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const series = await prisma.series.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { 
        mappings: {
          include: {
            examSeries: {
              include: {
                exams: { select: { bookNumber: true } },
                bookCovers: { select: { bookNumber: true, coverImageUrl: true } }
              }
            }
          }
        },
        exams: {
          include: { exam: { select: { bookNumber: true } } }
        }
      }
    })
    
    const result = series.map(s => {
      // Collect book numbers from all sources (native exams + mapped admin series)
      let bookNums = new Set(s.exams.map(e => e.exam?.bookNumber).filter(n => n != null))
      
      s.mappings.forEach(m => {
        m.examSeries.exams.forEach(e => { if (e.bookNumber) bookNums.add(e.bookNumber) })
        m.examSeries.bookCovers.forEach(bc => bookNums.add(bc.bookNumber))
      })

      const testNums = [...new Set(s.exams.map(e => e.testNumber))]
      
      return {
        id: s.id, name: s.name, description: s.description,
        thumbnailUrl: s.thumbnailUrl, type: s.type,
        bookNumbers: Array.from(bookNums).sort((a,b) => b - a),
        testCount: testNums.length, attemptCount: 0, createdAt: s.createdAt
      }
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// GET /:id/progress — user progress (auth required)
router.get('/:id/progress', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const userId = req.user.userId

    const seriesExams = await prisma.seriesExam.findMany({
      where: { seriesId: id },
      include: {
        exam: {
          select: {
            id: true, skill: true,
            writingTasks: { select: { id: true } },
            speakingParts: { select: { id: true } }
          }
        }
      }
    })
    if (!seriesExams.length) return res.json({})

    const examIds = seriesExams.filter(se => ['reading', 'listening'].includes(se.exam.skill)).map(se => se.exam.id)
    const writingTaskIds = seriesExams.filter(se => se.exam.skill === 'writing').flatMap(se => se.exam.writingTasks.map(t => t.id))
    const speakingPartIds = seriesExams.filter(se => se.exam.skill === 'speaking').flatMap(se => se.exam.speakingParts.map(p => p.id))

    const [attempts, writingAnswers, speakingAnswers] = await Promise.all([
      examIds.length ? prisma.attempt.findMany({ where: { userId, examId: { in: examIds }, finishedAt: { not: null } }, select: { examId: true, score: true }, orderBy: { finishedAt: 'desc' } }) : [],
      writingTaskIds.length ? prisma.writingAnswer.findMany({ where: { userId, taskId: { in: writingTaskIds } }, select: { taskId: true, aiScore: true }, orderBy: { createdAt: 'desc' } }) : [],
      speakingPartIds.length ? prisma.speakingAnswer.findMany({ where: { userId, partId: { in: speakingPartIds } }, select: { partId: true, aiScore: true }, orderBy: { createdAt: 'desc' } }) : [],
    ])

    const latestAttempt = {}
    for (const a of attempts) { if (!latestAttempt[a.examId]) latestAttempt[a.examId] = a }
    const latestWriting = {}
    for (const a of writingAnswers) { if (!latestWriting[a.taskId]) latestWriting[a.taskId] = a }
    const latestSpeaking = {}
    for (const a of speakingAnswers) { if (!latestSpeaking[a.partId]) latestSpeaking[a.partId] = a }

    const testMap = {}
    for (const se of seriesExams) {
      if (!testMap[se.testNumber]) testMap[se.testNumber] = {}
      const skill = se.exam.skill
      if (skill === 'reading' || skill === 'listening') {
        const att = latestAttempt[se.exam.id]
        testMap[se.testNumber][skill] = { done: !!att, score: att?.score ?? null }
      } else if (skill === 'writing') {
        const taskIds = se.exam.writingTasks.map(t => t.id)
        const done = taskIds.length > 0 && taskIds.every(tid => latestWriting[tid])
        const scores = taskIds.map(tid => latestWriting[tid]?.aiScore).filter(s => s != null)
        testMap[se.testNumber][skill] = { done, score: scores.length ? scores.reduce((a, b) => a + b) / scores.length : null }
      } else if (skill === 'speaking') {
        const partIds = se.exam.speakingParts.map(p => p.id)
        const done = partIds.length > 0 && partIds.every(pid => latestSpeaking[pid])
        const scores = partIds.map(pid => latestSpeaking[pid]?.aiScore).filter(s => s != null)
        testMap[se.testNumber][skill] = { done, score: scores.length ? scores.reduce((a, b) => a + b) / scores.length : null }
      }
    }
    res.json(testMap)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

// GET /:id — series detail
router.get('/:id', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const id = parseInt(req.params.id)

    const series = await prisma.series.findFirst({
      where: { id, deletedAt: null },
      include: {
        mappings: {
          include: {
            examSeries: {
              include: {
                exams: {
                  include: {
                    passages: { select: { id: true } },
                    listeningSections: { select: { id: true } },
                    writingTasks: { select: { id: true } },
                    speakingParts: { select: { id: true } },
                    _count: { select: { attempts: true } }
                  }
                }
              }
            }
          }
        },
        exams: {
          include: {
            exam: {
              select: {
                id: true, title: true, skill: true,
                passages: { select: { id: true } },
                listeningSections: { select: { id: true } },
                writingTasks: { select: { id: true } },
                speakingParts: { select: { id: true } },
                _count: { select: { attempts: true } }
              }
            }
          },
          orderBy: { testNumber: 'asc' }
        }
      }
    })
    if (!series) return res.status(404).json({ message: 'Không tìm thấy' })

    const testMap = {}
    
    // 1. Process native linked exams
    for (const se of series.exams) {
      if (!testMap[se.testNumber]) testMap[se.testNumber] = { testNumber: se.testNumber, exams: {} }
      const e = se.exam
      testMap[se.testNumber].exams[e.skill] = {
        id: e.id, title: e.title, attemptCount: e._count.attempts,
        passageCount: e.passages?.length ?? 0,
        sectionCount: e.listeningSections?.length ?? 0,
        taskCount: e.writingTasks?.length ?? 0,
        partCount: e.speakingParts?.length ?? 0,
      }
    }

    // 2. Process mapped admin exams
    series.mappings.forEach(m => {
      m.examSeries.exams.forEach(e => {
        if (!e.testNumber) return
        if (!testMap[e.testNumber]) testMap[e.testNumber] = { testNumber: e.testNumber, exams: {} }
        // Only overwrite if native doesn't exist to prevent duplicates
        if (!testMap[e.testNumber].exams[e.skill]) {
          testMap[e.testNumber].exams[e.skill] = {
            id: e.id, title: e.title, attemptCount: e._count.attempts,
            passageCount: e.passages?.length ?? 0,
            sectionCount: e.listeningSections?.length ?? 0,
            taskCount: e.writingTasks?.length ?? 0,
            partCount: e.speakingParts?.length ?? 0,
          }
        }
      })
    })

    const tests = Object.values(testMap).sort((a, b) => a.testNumber - b.testNumber)

    const others = await prisma.series.findMany({
      where: { id: { not: id }, deletedAt: null },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, thumbnailUrl: true, exams: { select: { testNumber: true } } }
    })

    res.json({
      id: series.id, name: series.name, description: series.description,
      thumbnailUrl: series.thumbnailUrl, type: series.type,
      tests,
      others: others.map(o => ({ id: o.id, name: o.name, thumbnailUrl: o.thumbnailUrl, testCount: [...new Set(o.exams.map(e => e.testNumber))].length }))
    })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
})

module.exports = router
