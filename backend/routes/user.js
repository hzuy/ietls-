const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')
const { learnerOnly } = require('../lib/roles')
const validate = require('../middleware/validate')
const { roundBand, ieltsOverall } = require('../lib/scoreUtils')
const { computeStreak } = require('../lib/streak')
const { pickCurrentAttempt, averageBand } = require('../lib/speakingAttempt')
const { historyQuerySchema } = require('../validators/historyValidator')

// GET /api/user/stats — thống kê luyện thi của user đang đăng nhập
router.get('/stats', authMiddleware, learnerOnly, async (req, res) => {
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
router.get('/history', authMiddleware, learnerOnly, validate(historyQuerySchema, 'query'), async (req, res) => {
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
          correctCount: true,
          totalCount: true,
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
      correct: a.correctCount != null ? a.correctCount : (correctByAttempt[a.id] || 0),
      total: a.totalCount != null ? a.totalCount : (totalByAttempt[a.id] || 0),
      bandScore: a.score,
      finishedAt: a.finishedAt,
    }))

    const [writingAnswers, speakingAnswers] = await Promise.all([
      prisma.writingAnswer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          taskId: true,
          aiScore: true,
          createdAt: true,
          task: { select: { examId: true } }
        }
      }),
      prisma.speakingAnswer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          partId: true,
          aiScore: true,
          createdAt: true,
          part: { select: { examId: true, number: true } }
        }
      })
    ])

    const writingHistoryExamIds = [...new Set(writingAnswers.map(a => a.task.examId))]
    const speakingHistoryExamIds = [...new Set(speakingAnswers.map(a => a.part.examId))]

    // Tính điểm Writing gần nhất theo từng exam
    const writingScoresByExam = {}
    const writingByExamTask = {}
    for (const a of writingAnswers) {
      const eId = a.task?.examId
      if (!eId) continue
      if (!writingByExamTask[eId]) writingByExamTask[eId] = {}
      if (writingByExamTask[eId][a.taskId] === undefined) {
        writingByExamTask[eId][a.taskId] = a.aiScore
      }
    }
    for (const [eId, taskScoresMap] of Object.entries(writingByExamTask)) {
      const scores = Object.values(taskScoresMap).filter(s => s != null)
      if (scores.length > 0) {
        writingScoresByExam[eId] = Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2
      } else {
        writingScoresByExam[eId] = 0.0
      }
    }

    // Tính điểm Speaking gần nhất theo từng exam
    const speakingScoresByExam = {}
    const speakingAnswersByExam = {}
    for (const a of speakingAnswers) {
      const eId = a.part?.examId
      if (!eId) continue
      ;(speakingAnswersByExam[eId] ||= []).push({ ...a, partNumber: a.part.number })
    }
    for (const [eId, list] of Object.entries(speakingAnswersByExam)) {
      const current = pickCurrentAttempt(list)
      speakingScoresByExam[eId] = averageBand(Object.values(current).map(a => a.aiScore)) ?? 0.0
    }

    res.json({ 
      history, 
      total, 
      page, 
      pages: Math.ceil(total / limit),
      writingHistoryExamIds,
      speakingHistoryExamIds,
      writingScoresByExam,
      speakingScoresByExam
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
