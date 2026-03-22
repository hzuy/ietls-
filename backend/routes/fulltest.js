const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

function ieltsOverall(scores) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const floored = Math.floor(avg)
  const frac = Math.round((avg - floored) * 100) / 100
  if (frac >= 0.75) return floored + 1
  if (frac >= 0.25) return floored + 0.5
  return floored
}

async function getFullTestStatus(userId, seriesId, bookNumber, testNumber) {
  const exams = await prisma.exam.findMany({
    where: { seriesId, bookNumber, testNumber },
    select: {
      id: true, skill: true,
      writingTasks: { select: { id: true } },
      speakingParts: { select: { id: true } }
    }
  })

  const examMap = {}
  for (const e of exams) examMap[e.skill] = e

  const skills = {}
  for (const skill of ['reading', 'listening', 'writing', 'speaking']) {
    const exam = examMap[skill]
    if (!exam) { skills[skill] = { available: false, done: false, score: null }; continue }

    if (skill === 'reading' || skill === 'listening') {
      const attempt = await prisma.attempt.findFirst({
        where: { userId, examId: exam.id },
        orderBy: { finishedAt: 'desc' },
        select: { score: true }
      })
      skills[skill] = { available: true, done: !!attempt, score: attempt?.score ?? null }
    } else if (skill === 'writing') {
      const taskIds = exam.writingTasks.map(t => t.id)
      if (taskIds.length === 0) { skills[skill] = { available: true, done: false, score: null }; continue }
      const answers = await prisma.writingAnswer.findMany({
        where: { userId, taskId: { in: taskIds } },
        orderBy: { createdAt: 'desc' },
        select: { taskId: true, aiScore: true }
      })
      const latestByTask = {}
      for (const a of answers) {
        if (!latestByTask[a.taskId]) latestByTask[a.taskId] = a
      }
      const done = Object.keys(latestByTask).length === taskIds.length
      const scores = Object.values(latestByTask).map(a => a.aiScore).filter(s => s != null)
      const score = scores.length > 0 ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2 : null
      skills[skill] = { available: true, done, score }
    } else if (skill === 'speaking') {
      const partIds = exam.speakingParts.map(p => p.id)
      if (partIds.length === 0) { skills[skill] = { available: true, done: false, score: null }; continue }
      const answers = await prisma.speakingAnswer.findMany({
        where: { userId, partId: { in: partIds } },
        orderBy: { createdAt: 'desc' },
        select: { partId: true, aiScore: true }
      })
      const latestByPart = {}
      for (const a of answers) {
        if (!latestByPart[a.partId]) latestByPart[a.partId] = a
      }
      const done = Object.keys(latestByPart).length === partIds.length
      const scores = Object.values(latestByPart).map(a => a.aiScore).filter(s => s != null)
      const score = scores.length > 0 ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2 : null
      skills[skill] = { available: true, done, score }
    }
  }

  const allFourAvailable = ['reading', 'listening', 'writing', 'speaking'].every(s => skills[s]?.available)
  const allFourDone = ['reading', 'listening', 'writing', 'speaking'].every(s => skills[s]?.done)
  const isComplete = allFourAvailable && allFourDone

  let overallBand = null
  if (isComplete) {
    const scores = ['reading', 'listening', 'writing', 'speaking'].map(s => skills[s].score)
    if (scores.every(s => s != null)) overallBand = ieltsOverall(scores)
  }

  return { isFullTest: allFourAvailable, isComplete, seriesId, bookNumber, testNumber, skills, overallBand }
}

// GET /full-test/status?examId=X
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const examId = parseInt(req.query.examId)
    if (!examId) return res.status(400).json({ message: 'examId required' })

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { seriesId: true, bookNumber: true, testNumber: true }
    })
    if (!exam || !exam.seriesId || !exam.bookNumber || !exam.testNumber) {
      return res.json({ isFullTest: false, isComplete: false })
    }

    const status = await getFullTestStatus(userId, exam.seriesId, exam.bookNumber, exam.testNumber)
    res.json(status)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// GET /full-test/result?seriesId=X&bookNumber=Y&testNumber=Z
router.get('/result', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    const { seriesId, bookNumber, testNumber } = req.query

    const series = await prisma.examSeries.findUnique({
      where: { id: parseInt(seriesId) },
      select: { name: true }
    })
    const status = await getFullTestStatus(userId, parseInt(seriesId), parseInt(bookNumber), parseInt(testNumber))
    res.json({ ...status, seriesName: series?.name ?? '' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// GET /full-test/user-progress — progress for all full-test groups (all 4 skills available)
router.get('/user-progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    const allExams = await prisma.exam.findMany({
      where: { seriesId: { not: null }, bookNumber: { not: null }, testNumber: { not: null } },
      select: { skill: true, seriesId: true, bookNumber: true, testNumber: true }
    })

    // Group by (seriesId, bookNumber, testNumber)
    const groups = {}
    for (const e of allExams) {
      const key = `${e.seriesId}_${e.bookNumber}_${e.testNumber}`
      if (!groups[key]) groups[key] = { seriesId: e.seriesId, bookNumber: e.bookNumber, testNumber: e.testNumber, skillSet: new Set() }
      groups[key].skillSet.add(e.skill)
    }

    // Only groups that have all 4 skills
    const fullTestGroups = Object.values(groups).filter(g =>
      ['reading', 'listening', 'writing', 'speaking'].every(s => g.skillSet.has(s))
    )

    const result = []
    for (const g of fullTestGroups) {
      const status = await getFullTestStatus(userId, g.seriesId, g.bookNumber, g.testNumber)
      result.push(status)
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
