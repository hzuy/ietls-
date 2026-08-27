const express = require('express')
const os = require('os')
const ExcelJS = require('exceljs')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { teacherOrAdmin, teacherOnly } = require('../../lib/roles')
const { attemptsQuerySchema } = require('../../validators/submissionValidator')

// ─── STALE-WHILE-REVALIDATE CACHE & STAMPEDE PROTECTION ───────────────────────
const cache = new Map()
const pendingRevalidations = new Map()
const CACHE_TTL = 60 * 1000 // 60 seconds

async function getOrRevalidate(cacheKey, fetcher) {
  const cached = cache.get(cacheKey)
  const now = Date.now()

  // 1. Fresh cache exists -> return immediately
  if (cached && (now - cached.ts < CACHE_TTL)) {
    return cached.data
  }

  // 2. Stale cache exists -> return immediately, revalidate in background
  if (cached) {
    if (!pendingRevalidations.has(cacheKey)) {
      const promise = fetcher()
        .then(freshData => {
          cache.set(cacheKey, { data: freshData, ts: Date.now() })
        })
        .catch(err => {
          if (process.env.NODE_ENV !== 'production') console.error(`[SWR Background Revalidate Error - ${cacheKey}]`, err)
        })
        .finally(() => {
          pendingRevalidations.delete(cacheKey)
        })
      pendingRevalidations.set(cacheKey, promise)
    }
    return cached.data
  }

  // 3. No cache exists (cold start) -> check if another request is already fetching cold data
  if (pendingRevalidations.has(cacheKey)) {
    await pendingRevalidations.get(cacheKey)
    const newCached = cache.get(cacheKey)
    if (newCached) return newCached.data
  }

  // Cold start calculation
  const promise = (async () => {
    const data = await fetcher()
    cache.set(cacheKey, { data, ts: Date.now() })
    return data
  })()

  pendingRevalidations.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    pendingRevalidations.delete(cacheKey)
  }
}

// ─── OPTIMIZED DB AGGREGATIONS (Raw SQL for Performance) ─────────────────────

// Gộp 6 câu count() Band Distribution thành 1 query SQL CASE WHEN duy nhất
async function getBandDistribution() {
  const rows = await prisma.$queryRaw`
    SELECT 
      COUNT(CASE WHEN score < 4 THEN 1 END)::int as c0,
      COUNT(CASE WHEN score >= 4 AND score < 5 THEN 1 END)::int as c1,
      COUNT(CASE WHEN score >= 5 AND score < 6 THEN 1 END)::int as c2,
      COUNT(CASE WHEN score >= 6 AND score < 7 THEN 1 END)::int as c3,
      COUNT(CASE WHEN score >= 7 AND score < 8 THEN 1 END)::int as c4,
      COUNT(CASE WHEN score >= 8 THEN 1 END)::int as c5
    FROM "Attempt"
    WHERE score IS NOT NULL;
  `
  const row = (rows && rows[0]) || {}
  return [
    { range: '<4.0',     count: Number(row.c0 || 0) },
    { range: '4.0–4.9',  count: Number(row.c1 || 0) },
    { range: '5.0–5.9',  count: Number(row.c2 || 0) },
    { range: '6.0–6.9',  count: Number(row.c3 || 0) },
    { range: '7.0–7.9',  count: Number(row.c4 || 0) },
    { range: '8.0–9.0',  count: Number(row.c5 || 0) },
  ]
}

// Tính số lượng đăng ký theo ngày (hoặc theo tháng khi period='all') bằng GROUP BY tại DB
async function getRegistrationsByDay(since, daysCount, now = new Date()) {
  if (!since) {
    const rows = await prisma.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as date, COUNT(*)::int as count
      FROM "User"
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY date ASC
    `
    return (rows || []).map(r => ({ date: r.date, count: Number(r.count) }))
  }

  const rows = await prisma.$queryRaw`
    SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, COUNT(*)::int as count
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
  `
  const countsByDate = Object.fromEntries((rows || []).map(r => [r.date, Number(r.count)]))

  const dayMap = {}
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = countsByDate[key] || 0
  }
  return Object.entries(dayMap).map(([date, count]) => ({ date, count }))
}

// Tính số lượt thi theo ngày (hoặc theo tháng khi period='all') bằng GROUP BY tại DB
async function getAttemptsByDay(since, daysCount, now = new Date()) {
  if (!since) {
    const rows = await prisma.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as date, COUNT(*)::int as count
      FROM "Attempt"
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY date ASC
    `
    return (rows || []).map(r => ({ date: r.date, count: Number(r.count) }))
  }

  const rows = await prisma.$queryRaw`
    SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, COUNT(*)::int as count
    FROM "Attempt"
    WHERE "createdAt" >= ${since}
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
  `
  const countsByDate = Object.fromEntries((rows || []).map(r => [r.date, Number(r.count)]))

  const dayMap = {}
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = countsByDate[key] || 0
  }
  return Object.entries(dayMap).map(([date, count]) => ({ date, count }))
}

// ─── DASHBOARD FETCHER ───────────────────────────────────────────────────────
async function fetchDashboardOverviewData() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const [
    totalUsers, usersThisMonth, usersLastMonth,
    attemptsToday, avgBandRaw, totalExams,
    registrationsByDay,
    [latestExams, latestAttempts],
    aiAttemptsToday,
    attemptsByDay,
    bandDistribution,
    skillDist,
    recent,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'user' } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: startOfThisMonth } } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
    prisma.attempt.count({ where: { finishedAt: { gte: startOfToday } } }),
    prisma.attempt.aggregate({ where: { score: { not: null } }, _avg: { score: true } }),
    prisma.exam.count(),
    getRegistrationsByDay(thirtyDaysAgo, 30, now),
    Promise.all([
      prisma.exam.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { title: true, createdAt: true } }),
      prisma.attempt.findMany({ take: 2, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } }),
    ]),
    prisma.attempt.count({ where: { finishedAt: { gte: startOfToday }, exam: { skill: { in: ['writing', 'speaking'] } } } }),
    getAttemptsByDay(thirtyDaysAgo, 30, now),
    getBandDistribution(),
    prisma.attempt.groupBy({ by: ['examId'], _count: { id: true } }),
    prisma.attempt.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { finishedAt: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        exam: { select: { id: true, title: true, skill: true } },
      },
    }),
  ])

  const examIds = skillDist.map(s => s.examId)
  const examSkillMap = await prisma.exam.findMany({
    where: { id: { in: examIds } },
    select: { id: true, skill: true },
  })

  // Build systemLogs
  const systemLogs = [
    ...latestExams.map(e => ({
      time: e.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      user: 'Hệ thống',
      action: `Đã thêm đề mới: ${e.title}`,
      status: 'Hoàn tất',
    })),
    ...latestAttempts.map(a => ({
      time: a.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      user: a.user?.name || 'Ẩn danh',
      action: `Hoàn thành bài thi ${a.examId}`,
      status: 'Thành công',
    })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5)

  // Build systemHealth
  const freeMem = os.freemem()
  const totalMem = os.totalmem()
  const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
  const aiLimitUsage = Math.min(100, Math.round((aiAttemptsToday / 500) * 100))
  const systemHealth = { serverMemory: memUsage, aiLimit: aiLimitUsage }

  // Build skillDistribution
  const skillLookup = Object.fromEntries(examSkillMap.map(e => [e.id, e.skill]))
  const skillCount = { reading: 0, listening: 0, writing: 0, speaking: 0 }
  skillDist.forEach(({ examId, _count }) => {
    const s = skillLookup[examId]
    if (s && s in skillCount) skillCount[s] += _count.id
  })
  const skillDistribution = Object.entries(skillCount).map(([skill, count]) => ({ skill, count }))

  return {
    stats: {
      totalUsers, usersThisMonth, usersLastMonth,
      attemptsToday,
      avgBand: avgBandRaw._avg.score || 0,
      totalExams,
    },
    registrationsByDay,
    systemLogs,
    systemHealth,
    attemptsByDay,
    bandDistribution,
    skillDistribution,
    recentAttempts: recent,
  }
}

// ─── DASHBOARD ROUTE ─────────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, teacherOrAdmin, async (req, res) => {
  try {
    const cacheKey = 'dashboard_overview'
    const result = await getOrRevalidate(cacheKey, fetchDashboardOverviewData)
    res.json(result)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Dashboard Error]', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── ATTEMPTS ────────────────────────────────────────────────────────────────
router.get('/attempts', authMiddleware, teacherOnly, validate(attemptsQuerySchema, 'query'), async (req, res) => {
  try {
    // req.validatedQuery — dữ liệu đã được validate + coerce bởi attemptsQuerySchema
    // (Express 5 không cho gán đè req.query, xem middleware/validate.js)
    const { search, skill, dateFrom, dateTo, seriesId, scoreMin, scoreMax, sortBy, sortOrder, page, limit } = req.validatedQuery
    const skip = (page - 1) * limit

    const where = { finishedAt: { not: null } }

    if (scoreMin !== undefined) {
      where.score = { ...where.score, gte: Math.round(scoreMin * 2) / 2 }
    }
    if (scoreMax !== undefined) {
      where.score = { ...where.score, lte: Math.round(scoreMax * 2) / 2 }
    }

    if (skill || seriesId) {
      where.exam = {}
      if (skill) where.exam.skill = skill
      if (seriesId) where.exam.seriesId = seriesId
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        where.createdAt.lte = to
      }
    }

    const orderBy = sortBy === 'score'
      ? { score: { sort: sortOrder === 'asc' ? 'asc' : 'desc', nulls: 'last' } }
      : { createdAt: 'desc' }

    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        skip, take: limit,
        orderBy,
        include: {
          user: { select: { id: true, name: true, email: true } },
          exam: { select: { id: true, title: true, skill: true } }
        }
      }),
      prisma.attempt.count({ where })
    ])

    res.json({ attempts, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── ATTEMPTS EXPORT (theo các lượt thi đã tick chọn ở frontend) ──────────────
const EXPORT_MAX_IDS = 1000

router.post('/attempts/export', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body?.attemptIds) ? req.body.attemptIds : []
    const attemptIds = [...new Set(
      rawIds
        .map(v => Number(v))
        .filter(n => Number.isInteger(n) && n > 0)
    )]

    if (attemptIds.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 lượt thi để xuất dữ liệu' })
    }
    if (attemptIds.length > EXPORT_MAX_IDS) {
      return res.status(400).json({ message: `Chỉ được xuất tối đa ${EXPORT_MAX_IDS} lượt thi mỗi lần. Vui lòng bỏ bớt lựa chọn.` })
    }

    const where = { finishedAt: { not: null }, id: { in: attemptIds } }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="attempts-selected-${attemptIds.length}.xlsx"`)

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: false
    })

    const worksheet = workbook.addWorksheet('Lịch sử thi')

    worksheet.columns = [
      { header: 'Người dùng', key: 'userName', width: 25 },
      { header: 'Email', key: 'userEmail', width: 30 },
      { header: 'Kỹ năng', key: 'skill', width: 15 },
      { header: 'Đề thi', key: 'examTitle', width: 35 },
      { header: 'Band', key: 'score', width: 10 },
      { header: 'Ngày thi', key: 'createdAt', width: 15 }
    ]

    const SKILL_LABEL = {
      reading: 'Reading',
      listening: 'Listening',
      writing: 'Writing',
      speaking: 'Speaking'
    }

    const BATCH_SIZE = 500
    let skip = 0
    let hasMore = true

    while (hasMore) {
      const batch = await prisma.attempt.findMany({
        where,
        skip,
        take: BATCH_SIZE,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          exam: { select: { id: true, title: true, skill: true } }
        }
      })

      for (const a of batch) {
        const row = worksheet.addRow([
          a.user?.name || '',
          a.user?.email || '',
          SKILL_LABEL[a.exam?.skill] || a.exam?.skill || '',
          a.exam?.title || '',
          a.score != null ? Number(a.score.toFixed(1)) : '',
          a.createdAt ? new Date(a.createdAt).toLocaleDateString('vi-VN') : ''
        ])
        row.commit()
      }

      if (batch.length < BATCH_SIZE) {
        hasMore = false
      } else {
        skip += BATCH_SIZE
      }
    }

    worksheet.commit()
    await workbook.commit()
  } catch (error) {
    if (!res.headersSent) {
      console.error('[Export Pre-Stream Error]', error)
      return res.status(500).json({ message: 'Lỗi server khi xuất dữ liệu', error: error.message })
    } else {
      console.error(`[Export Mid-Stream Error] Lỗi xảy ra tại batch:`, error)
      try {
        if (typeof res.destroy === 'function') res.destroy(error)
        else res.end()
      } catch {
        res.end()
      }
    }
  }
})

// ─── ANALYTICS FETCHER ───────────────────────────────────────────────────────
async function fetchAnalyticsData(period) {
  const isAll = period === 'all'
  const days = period === 'week' ? 7 : 30
  const since = isAll ? null : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d })()
  // dateWhere: empty object when period=all (no date filter), otherwise restrict by since
  const dateWhere = since ? { createdAt: { gte: since } } : {}

  const [
    totalAttempts, totalUsers, totalUsersAll, avgBandRaw, skillCountBySkill, skillAvgBySkill, topUsers,
    attemptsByDay,
    bandDistribution,
  ] = await Promise.all([
    prisma.attempt.count({ where: { finishedAt: { not: null }, ...dateWhere } }),
    prisma.user.count({ where: { role: 'user', ...dateWhere } }),
    prisma.user.count({ where: { role: 'user' } }), // total across all time — not period-filtered
    prisma.attempt.aggregate({ where: { score: { not: null }, ...dateWhere }, _avg: { score: true } }),
    prisma.attempt.groupBy({
      by: ['examId'],
      where: { finishedAt: { not: null }, ...dateWhere },
      _count: { id: true },
    }),
    prisma.attempt.groupBy({
      by: ['examId'],
      where: { finishedAt: { not: null }, ...dateWhere, score: { not: null } },
      _avg: { score: true },
    }),
    prisma.attempt.groupBy({
      by: ['userId'],
      where: { score: { not: null }, ...dateWhere },
      _avg: { score: true },
      _count: { id: true },
      orderBy: { _avg: { score: 'desc' } },
      take: 10
    }),
    getAttemptsByDay(since, isAll ? null : days),
    getBandDistribution(),
  ])

  const allAnalyticsExamIds = [...new Set([...skillCountBySkill.map(r => r.examId), ...skillAvgBySkill.map(r => r.examId)])]
  const analyticsExamSkillMap = await prisma.exam.findMany({
    where: { id: { in: allAnalyticsExamIds } },
    select: { id: true, skill: true },
  })
  const analyticsSkillLookup = Object.fromEntries(analyticsExamSkillMap.map(e => [e.id, e.skill]))

  const bySkill = { reading: { count: 0, totalScore: 0, scoreCount: 0 }, listening: { count: 0, totalScore: 0, scoreCount: 0 }, writing: { count: 0, totalScore: 0, scoreCount: 0 }, speaking: { count: 0, totalScore: 0, scoreCount: 0 } }
  skillCountBySkill.forEach(r => {
    const s = analyticsSkillLookup[r.examId]
    if (s && s in bySkill) bySkill[s].count += r._count.id
  })
  skillAvgBySkill.forEach(r => {
    const s = analyticsSkillLookup[r.examId]
    if (s && s in bySkill && r._avg.score != null) {
      bySkill[s].totalScore += r._avg.score
      bySkill[s].scoreCount++
    }
  })
  const skillBreakdown = Object.entries(bySkill).map(([skill, { count, totalScore, scoreCount }]) => ({
    skill, count,
    avgScore: scoreCount > 0 ? (totalScore / scoreCount) : null
  }))

  const topUserIds = topUsers.map(u => u.userId)
  const topUserInfo = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, email: true }
  })
  const userMap = Object.fromEntries(topUserInfo.map(u => [u.id, u]))
  const topUsersResult = topUsers.map(u => ({
    ...userMap[u.userId],
    avgScore: u._avg.score,
    attemptCount: u._count.id
  }))

  return {
    overview: { totalAttempts, totalUsers, totalUsersAll, avgBand: avgBandRaw._avg.score },
    skillBreakdown,
    topUsers: topUsersResult,
    attemptsByDay,
    bandDistribution,
  }
}

// ─── ANALYTICS ROUTE ─────────────────────────────────────────────────────────
router.get('/analytics', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { period = 'month' } = req.query
    const cacheKey = `analytics_${period}`
    const result = await getOrRevalidate(cacheKey, () => fetchAnalyticsData(period))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
