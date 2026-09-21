const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')
const validate = require('../middleware/validate')
const { roundBand, ieltsOverall } = require('../lib/scoreUtils')
const { computeStreak } = require('../lib/streak')
const { historyQuerySchema } = require('../validators/historyValidator')

// GET /api/user/stats — thống kê luyện thi của user đang đăng nhập
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Tổng số bài đã hoàn thành
    const totalAttempts = await prisma.attempt.count({
      where: { userId, finishedAt: { not: null } },
    })

    // Tất cả bài có điểm, kèm kỹ năng từ exam (tối đa 500 bài gần nhất)
    const attempts = await prisma.attempt.findMany({
      where: { userId, finishedAt: { not: null }, score: { not: null } },
      select: { score: true, exam: { select: { skill: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // Band theo kỹ năng
    const skillScores = { reading: [], listening: [], writing: [], speaking: [] }
    for (const a of attempts) {
      const skill = a.exam?.skill
      if (skill && skillScores[skill] !== undefined) {
        skillScores[skill].push(a.score)
      }
    }

    const avg = arr => arr.length ? roundBand(arr.reduce((s, v) => s + v, 0) / arr.length) : null
    const bandBySkill = {
      reading:   avg(skillScores.reading),
      listening: avg(skillScores.listening),
      writing:   avg(skillScores.writing),
      speaking:  avg(skillScores.speaking),
    }

    const activeBands = Object.values(bandBySkill).filter(v => v !== null)
    const avgBand = activeBands.length ? ieltsOverall(activeBands) : 0

    // Streak — số ngày liên tiếp có bài hoàn thành (tính từ hôm nay hoặc hôm qua
    // theo NGÀY LỊCH VIỆT NAM, xem lib/streak.js + lib/vnDate.js)
    // Lấy tối đa 366 ngày gần nhất — đủ cho bất kỳ streak thực tế nào
    const finishedDates = await prisma.attempt.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { finishedAt: true },
      orderBy: { finishedAt: 'desc' },
      take: 366,
    })

    const streak = computeStreak(finishedDates.map(a => a.finishedAt))

    res.json({ totalAttempts, avgBand, streak, bandBySkill })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// GET /api/user/history — lịch sử làm bài Reading/Listening (đã hoàn thành) của
// user đang đăng nhập. Chỉ trả lượt của chính req.user.userId — không nhận userId
// từ query nên không có đường nào để xem lượt của người khác.
router.get('/history', authMiddleware, validate(historyQuerySchema, 'query'), async (req, res) => {
  try {
    const userId = req.user.userId
    const { skill, examId, page, limit } = req.validatedQuery
    const skip = (page - 1) * limit

    const where = {
      userId,
      finishedAt: { not: null },
    }
    
    if (skill) {
      where.exam = { skill }
    } else if (!examId) {
      where.exam = { skill: { in: ['reading', 'listening', 'writing', 'speaking'] } }
    }

    if (examId) where.examId = examId

    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true,
          score: true,
          finishedAt: true,
          exam: {
            select: {
              id: true, title: true, skill: true, testNumber: true, bookNumber: true,
              series: { select: { name: true } },
            },
          },
        },
      }),
      prisma.attempt.count({ where }),
    ])

    // Số câu đúng/tổng tính từ QuestionAnswer theo attemptId (không dùng AnswerLog) —
    // gộp 2 truy vấn groupBy trên đúng trang hiện tại, tránh N+1 theo từng attempt.
    const attemptIds = attempts.map(a => a.id)
    const correctByAttempt = {}
    const totalByAttempt = {}
    if (attemptIds.length > 0) {
      const [totalCounts, correctCounts] = await Promise.all([
        prisma.questionAnswer.groupBy({
          by: ['attemptId'],
          where: { attemptId: { in: attemptIds } },
          _count: { _all: true },
        }),
        prisma.questionAnswer.groupBy({
          by: ['attemptId'],
          where: { attemptId: { in: attemptIds }, isCorrect: true },
          _count: { _all: true },
        }),
      ])
      totalCounts.forEach(t => { totalByAttempt[t.attemptId] = t._count._all })
      correctCounts.forEach(c => { correctByAttempt[c.attemptId] = c._count._all })
    }

    const history = attempts.map(a => ({
      attemptId: a.id,
      examId: a.exam.id,
      examTitle: a.exam.title,
      seriesName: a.exam.series?.name ?? null,
      bookNumber: a.exam.bookNumber,
      testNumber: a.exam.testNumber,
      skill: a.exam.skill,
      correct: correctByAttempt[a.id] || 0,
      total: totalByAttempt[a.id] || 0,
      bandScore: a.score,
      finishedAt: a.finishedAt,
    }))

    res.json({ history, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
