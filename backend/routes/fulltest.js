const express = require('express')
const authMiddleware = require('../middleware/auth')
const prisma = require('../lib/prisma')

const router = express.Router()

function ieltsOverall(scores) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const floored = Math.floor(avg)
  const frac = Math.round((avg - floored) * 100) / 100
  if (frac >= 0.75) return floored + 1
  if (frac >= 0.25) return floored + 0.5
  return floored
}

// P7 Fix: 4 skill queries chạy song song với Promise.all thay vì tuần tự trong for-loop
// Trước: 4 × ~30ms roundtrip = ~120ms / lần gọi
// Sau:   max(4 queries) = ~30ms / lần gọi
async function getFullTestStatus(userId, seriesId, bookNumber, testNumber) {
  const exams = await prisma.exam.findMany({
    where: { seriesId, bookNumber, testNumber },
    select: {
      id: true, skill: true,
      writingTasks:  { select: { id: true } },
      speakingParts: { select: { id: true } }
    }
  })

  const examMap = {}
  for (const e of exams) examMap[e.skill] = e

  const readingExam   = examMap.reading
  const listeningExam = examMap.listening
  const writingExam   = examMap.writing
  const speakingExam  = examMap.speaking

  const writingTaskIds  = writingExam?.writingTasks?.map(t => t.id)  ?? []
  const speakingPartIds = speakingExam?.speakingParts?.map(p => p.id) ?? []

  const [readingAttempt, listeningAttempt, writingAnswers, speakingAnswers] = await Promise.all([
    readingExam
      ? prisma.attempt.findFirst({
          where: { userId, examId: readingExam.id },
          orderBy: { finishedAt: 'desc' },
          select: { score: true }
        })
      : null,
    listeningExam
      ? prisma.attempt.findFirst({
          where: { userId, examId: listeningExam.id },
          orderBy: { finishedAt: 'desc' },
          select: { score: true }
        })
      : null,
    writingTaskIds.length > 0
      ? prisma.writingAnswer.findMany({
          where: { userId, taskId: { in: writingTaskIds } },
          orderBy: { createdAt: 'desc' },
          select: { taskId: true, aiScore: true }
        })
      : [],
    speakingPartIds.length > 0
      ? prisma.speakingAnswer.findMany({
          where: { userId, partId: { in: speakingPartIds } },
          orderBy: { createdAt: 'desc' },
          select: { partId: true, aiScore: true }
        })
      : [],
  ])

  const skills = {}

  skills.reading = readingExam
    ? { available: true,  done: !!readingAttempt,   score: readingAttempt?.score   ?? null }
    : { available: false, done: false, score: null }

  skills.listening = listeningExam
    ? { available: true,  done: !!listeningAttempt, score: listeningAttempt?.score ?? null }
    : { available: false, done: false, score: null }

  if (!writingExam) {
    skills.writing = { available: false, done: false, score: null }
  } else if (writingTaskIds.length === 0) {
    skills.writing = { available: true, done: false, score: null }
  } else {
    const latestByTask = {}
    for (const a of writingAnswers) {
      if (!latestByTask[a.taskId]) latestByTask[a.taskId] = a
    }
    const done = Object.keys(latestByTask).length === writingTaskIds.length
    const scores = Object.values(latestByTask).map(a => a.aiScore).filter(s => s != null)
    const score = scores.length > 0
      ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2
      : null
    skills.writing = { available: true, done, score }
  }

  if (!speakingExam) {
    skills.speaking = { available: false, done: false, score: null }
  } else if (speakingPartIds.length === 0) {
    skills.speaking = { available: true, done: false, score: null }
  } else {
    const latestByPart = {}
    for (const a of speakingAnswers) {
      if (!latestByPart[a.partId]) latestByPart[a.partId] = a
    }
    const done = Object.keys(latestByPart).length === speakingPartIds.length
    const scores = Object.values(latestByPart).map(a => a.aiScore).filter(s => s != null)
    const score = scores.length > 0
      ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2
      : null
    skills.speaking = { available: true, done, score }
  }

  const allFourAvailable = ['reading', 'listening', 'writing', 'speaking'].every(s => skills[s]?.available)
  const allFourDone      = ['reading', 'listening', 'writing', 'speaking'].every(s => skills[s]?.done)
  const isComplete = allFourAvailable && allFourDone

  let overallBand = null
  if (isComplete) {
    const scores = ['reading', 'listening', 'writing', 'speaking'].map(s => skills[s].score)
    if (scores.every(s => s != null)) overallBand = ieltsOverall(scores)
  }

  return { isFullTest: allFourAvailable, isComplete, seriesId, bookNumber, testNumber, skills, overallBand }
}

// Public: 4 Full Test series mới nhất cho trang chủ
router.get('/featured', async (req, res) => {
  try {
    const series = await prisma.examSeries.findMany({
      where: { deletedAt: null },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: {
        bookCovers: { orderBy: { bookNumber: 'desc' }, take: 1 },
        exams: {
          where: { skill: 'reading' },
          select: { id: true, _count: { select: { attempts: true } } },
          take: 10
        }
      }
    })
    const result = series.map(s => ({
      id: s.id,
      name: s.name,
      coverImageUrl: s.bookCovers[0]?.coverImageUrl ?? null,
      bookCount: s.bookCovers.length,
      attemptCount: s.exams.reduce((sum, e) => sum + e._count.attempts, 0)
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

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

    const [series, status] = await Promise.all([
      prisma.examSeries.findUnique({
        where: { id: parseInt(seriesId) },
        select: { name: true }
      }),
      getFullTestStatus(userId, parseInt(seriesId), parseInt(bookNumber), parseInt(testNumber))
    ])
    res.json({ ...status, seriesName: series?.name ?? '' })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// GET /full-test/user-progress
// P2 Fix: Thay thế vòng lặp N×5 queries bằng 4 parallel queries + xử lý in-memory
// Trước: 40 nhóm × 5 queries = 200 DB queries / request
// Sau:   1 + 3 = 4 DB queries tổng cộng bất kể có bao nhiêu nhóm
router.get('/user-progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    // Step 1: Lấy tất cả exam thuộc full-test (1 query, bao gồm writingTasks + speakingParts)
    const allExams = await prisma.exam.findMany({
      where: { seriesId: { not: null }, bookNumber: { not: null }, testNumber: { not: null }, deletedAt: null },
      select: {
        id: true, skill: true, seriesId: true, bookNumber: true, testNumber: true,
        writingTasks:  { select: { id: true } },
        speakingParts: { select: { id: true } }
      }
    })

    // Group theo (seriesId, bookNumber, testNumber)
    const groups = {}
    for (const e of allExams) {
      const key = `${e.seriesId}_${e.bookNumber}_${e.testNumber}`
      if (!groups[key]) groups[key] = {
        seriesId: e.seriesId, bookNumber: e.bookNumber, testNumber: e.testNumber, exams: {}
      }
      groups[key].exams[e.skill] = e
    }

    // Chỉ giữ các nhóm có đủ 4 kỹ năng
    const fullTestGroups = Object.values(groups).filter(g =>
      ['reading', 'listening', 'writing', 'speaking'].every(s => g.exams[s])
    )

    if (fullTestGroups.length === 0) return res.json([])

    // Step 2: Thu thập tất cả IDs cần query
    const examIds       = fullTestGroups.flatMap(g => ['reading', 'listening'].map(s => g.exams[s].id))
    const writingTaskIds  = fullTestGroups.flatMap(g => g.exams.writing.writingTasks.map(t => t.id))
    const speakingPartIds = fullTestGroups.flatMap(g => g.exams.speaking.speakingParts.map(p => p.id))

    // Step 3: Batch fetch tất cả dữ liệu user trong 3 queries song song
    const [attempts, writingAnswers, speakingAnswers] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId, examId: { in: examIds } },
        orderBy: { finishedAt: 'desc' },
        select: { examId: true, score: true }
      }),
      writingTaskIds.length > 0
        ? prisma.writingAnswer.findMany({
            where: { userId, taskId: { in: writingTaskIds } },
            orderBy: { createdAt: 'desc' },
            select: { taskId: true, aiScore: true }
          })
        : [],
      speakingPartIds.length > 0
        ? prisma.speakingAnswer.findMany({
            where: { userId, partId: { in: speakingPartIds } },
            orderBy: { createdAt: 'desc' },
            select: { partId: true, aiScore: true }
          })
        : [],
    ])

    // Step 4: Build lookup maps (entry đầu tiên = mới nhất do đã orderBy desc)
    const latestAttemptByExam = {}
    for (const a of attempts) {
      if (!latestAttemptByExam[a.examId]) latestAttemptByExam[a.examId] = a
    }
    const latestWritingByTask = {}
    for (const a of writingAnswers) {
      if (!latestWritingByTask[a.taskId]) latestWritingByTask[a.taskId] = a
    }
    const latestSpeakingByPart = {}
    for (const a of speakingAnswers) {
      if (!latestSpeakingByPart[a.partId]) latestSpeakingByPart[a.partId] = a
    }

    // Step 5: Tính trạng thái hoàn toàn trong bộ nhớ — 0 queries thêm
    const result = fullTestGroups.map(g => {
      const skills = {}

      for (const skill of ['reading', 'listening']) {
        const attempt = latestAttemptByExam[g.exams[skill].id]
        skills[skill] = { available: true, done: !!attempt, score: attempt?.score ?? null }
      }

      const taskIds = g.exams.writing.writingTasks.map(t => t.id)
      if (taskIds.length === 0) {
        skills.writing = { available: true, done: false, score: null }
      } else {
        const done = taskIds.every(id => latestWritingByTask[id])
        const scores = taskIds.map(id => latestWritingByTask[id]?.aiScore).filter(s => s != null)
        const score = scores.length > 0
          ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2
          : null
        skills.writing = { available: true, done, score }
      }

      const partIds = g.exams.speaking.speakingParts.map(p => p.id)
      if (partIds.length === 0) {
        skills.speaking = { available: true, done: false, score: null }
      } else {
        const done = partIds.every(id => latestSpeakingByPart[id])
        const scores = partIds.map(id => latestSpeakingByPart[id]?.aiScore).filter(s => s != null)
        const score = scores.length > 0
          ? Math.round(Math.min(9, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length)) * 2) / 2
          : null
        skills.speaking = { available: true, done, score }
      }

      const allFourDone = ['reading', 'listening', 'writing', 'speaking'].every(s => skills[s].done)
      const isComplete  = allFourDone

      let overallBand = null
      if (isComplete) {
        const scores = ['reading', 'listening', 'writing', 'speaking'].map(s => skills[s].score)
        if (scores.every(s => s != null)) overallBand = ieltsOverall(scores)
      }

      return {
        isFullTest: true, isComplete,
        seriesId: g.seriesId, bookNumber: g.bookNumber, testNumber: g.testNumber,
        skills, overallBand
      }
    })

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
