const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const authMiddleware = require('../middleware/auth')

// GET /api/user/stats — thống kê luyện thi của user đang đăng nhập
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Tổng số bài đã hoàn thành
    const totalAttempts = await prisma.attempt.count({
      where: { userId, finishedAt: { not: null } },
    })

    // Tất cả bài có điểm, kèm kỹ năng từ exam
    const attempts = await prisma.attempt.findMany({
      where: { userId, finishedAt: { not: null }, score: { not: null } },
      select: { score: true, exam: { select: { skill: true } } },
    })

    // Band theo kỹ năng
    const skillScores = { reading: [], listening: [], writing: [], speaking: [] }
    for (const a of attempts) {
      const skill = a.exam?.skill
      if (skill && skillScores[skill] !== undefined) {
        skillScores[skill].push(a.score)
      }
    }

    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
    const bandBySkill = {
      reading:   avg(skillScores.reading),
      listening: avg(skillScores.listening),
      writing:   avg(skillScores.writing),
      speaking:  avg(skillScores.speaking),
    }

    const allScores = Object.values(skillScores).flat()
    const avgBand = avg(allScores)

    // Streak — số ngày liên tiếp có bài hoàn thành (tính từ hôm nay hoặc hôm qua)
    const finishedDates = await prisma.attempt.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { finishedAt: true },
    })

    const dateSet = new Set(
      finishedDates.map(a => a.finishedAt.toISOString().split('T')[0])
    )

    const toDateStr = d => d.toISOString().split('T')[0]
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = toDateStr(today)
    const yesterdayStr = toDateStr(new Date(today.getTime() - 86400000))

    let streak = 0
    if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
      const cursor = new Date(dateSet.has(todayStr) ? today : today.getTime() - 86400000)
      while (dateSet.has(toDateStr(cursor))) {
        streak++
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      }
    }

    res.json({ totalAttempts, avgBand, streak, bandBySkill })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
