const express = require('express')
const authMiddleware = require('../middleware/auth')
const { learnerOnly } = require('../lib/roles')
const prisma = require('../lib/prisma')
const { ieltsOverall } = require('../lib/scoreUtils')
const { averageBand } = require('../lib/speakingAttempt')
const { speakingAttempts, writingAttempts } = require('../lib/attemptGroups')
const { sendServerError } = require('../lib/httpErrors')

const router = express.Router()

// ── TC-054: một item AI chỉ hoàn tất khi đã graded VÀ có điểm thực ────────────
// Trước đây `done` chỉ kiểm tra "đã có row" nên bài đang pending/grading/failed
// vẫn bị coi là xong và overallBand được tính từ điểm thiếu.
function isGradedAnswer(answer) {
  return !!answer && answer.status === 'graded' && answer.aiScore != null
}

// Trạng thái chi tiết để UI phân biệt: chưa làm / đang chấm / chấm lỗi / xong.
function aiSkillStatus(answers) {
  const list = answers.filter(Boolean)
  if (list.length === 0) return 'not_started'
  if (list.every(isGradedAnswer)) return 'done'
  if (list.some(a => a.status === 'failed')) return 'failed'
  if (list.some(a => a.status === 'grading')) return 'grading'
  if (list.some(a => a.status === 'pending')) return 'pending'
  return 'in_progress'
}

function gradedCount(answers) {
  return answers.filter(isGradedAnswer).length
}

// Writing: Task 1 có trọng số 1, Task 2 có trọng số 2 (chuẩn IELTS).
// Chỉ trả band khi MỌI task đã graded + có điểm; ngược lại null.
function writingWeightedBand(tasks, latestByTask) {
  let weighted = 0
  let totalWeight = 0
  for (const task of tasks) {
    const answer = latestByTask[task.id]
    if (!isGradedAnswer(answer)) return null
    const weight = Number(task.number) === 2 ? 2 : 1
    weighted += Number(answer.aiScore) * weight
    totalWeight += weight
  }
  if (!totalWeight) return null
  return Math.round(Math.min(9, Math.max(0, weighted / totalWeight)) * 2) / 2
}


// P7 Fix: 4 skill queries chạy song song với Promise.all thay vì tuần tự trong for-loop
// Trước: 4 × ~30ms roundtrip = ~120ms / lần gọi
// Sau:   max(4 queries) = ~30ms / lần gọi
async function getFullTestStatus(userId, seriesId, bookNumber, testNumber) {
  const exams = await prisma.exam.findMany({
    where: { seriesId, bookNumber, testNumber, deletedAt: null, series: { deletedAt: null } },
    select: {
      id: true, skill: true,
      writingTasks:  { select: { id: true, number: true } },
      speakingParts: { select: { id: true, number: true } }
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
          select: { id: true, taskId: true, aiScore: true, status: true, createdAt: true }
        })
      : [],
    speakingPartIds.length > 0
      ? prisma.speakingAnswer.findMany({
          where: { userId, partId: { in: speakingPartIds } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, partId: true, aiScore: true, status: true, createdAt: true, part: { select: { number: true } } }
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
    const latestByTask = writingAttempts(writingAnswers)[0]?.items || {}
    const answersByTask = writingTaskIds.map(id => latestByTask[id])
    const done = answersByTask.every(isGradedAnswer) && answersByTask.length > 0
    const score = done ? writingWeightedBand(writingExam.writingTasks, latestByTask) : null
    skills.writing = {
      available: true, done, score,
      status: aiSkillStatus(answersByTask),
      graded: gradedCount(answersByTask),
      total: writingTaskIds.length,
    }
  }

  if (!speakingExam) {
    skills.speaking = { available: false, done: false, score: null }
  } else if (speakingPartIds.length === 0) {
    skills.speaking = { available: true, done: false, score: null }
  } else {
    const latestByPart = speakingAttempts(speakingAnswers.map(a => ({ ...a, partNumber: a.part?.number })))[0]?.items || {}
    const answersByPart = speakingPartIds.map(id => latestByPart[id])
    const done = answersByPart.every(isGradedAnswer) && answersByPart.length > 0
    const score = done ? averageBand(answersByPart.map(a => a.aiScore)) : null
    skills.speaking = {
      available: true, done, score,
      status: aiSkillStatus(answersByPart),
      graded: gradedCount(answersByPart),
      total: speakingPartIds.length,
    }
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

// GET /full-test/status?examId=X
router.get('/status', authMiddleware, learnerOnly, async (req, res) => {
  try {
    const userId = req.user.userId
    const examId = parseInt(req.query.examId)
    if (!examId) return res.status(400).json({ message: 'examId required' })

    const exam = await prisma.exam.findUnique({
      where: { id: examId, deletedAt: null, series: { deletedAt: null } },
      select: { seriesId: true, bookNumber: true, testNumber: true }
    })
    if (!exam || !exam.seriesId || !exam.bookNumber || !exam.testNumber) {
      return res.json({ isFullTest: false, isComplete: false })
    }

    const status = await getFullTestStatus(userId, exam.seriesId, exam.bookNumber, exam.testNumber)
    res.json(status)
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// GET /full-test/result?seriesId=X&bookNumber=Y&testNumber=Z
router.get('/result', authMiddleware, learnerOnly, async (req, res) => {
  try {
    const userId = req.user.userId
    const { seriesId, bookNumber, testNumber } = req.query

    const [series, status] = await Promise.all([
      prisma.examSeries.findUnique({
        where: { id: parseInt(seriesId), deletedAt: null },
        select: { name: true }
      }),
      getFullTestStatus(userId, parseInt(seriesId), parseInt(bookNumber), parseInt(testNumber))
    ])
    res.json({ ...status, seriesName: series?.name ?? '' })
  } catch (error) {
    sendServerError(res, error, 'Lỗi server')
  }
})

// GET /full-test/user-progress
// P2 Fix: Thay thế vòng lặp N×5 queries bằng 4 parallel queries + xử lý in-memory
// Trước: 40 nhóm × 5 queries = 200 DB queries / request
// Sau:   1 + 3 = 4 DB queries tổng cộng bất kể có bao nhiêu nhóm
router.get('/user-progress', authMiddleware, learnerOnly, async (req, res) => {
  try {
    const userId = req.user.userId

    // Step 1: Lấy tất cả exam thuộc full-test (1 query, bao gồm writingTasks + speakingParts)
    const allExams = await prisma.exam.findMany({
      where: { seriesId: { not: null }, series: { deletedAt: null }, bookNumber: { not: null }, testNumber: { not: null }, deletedAt: null },
      select: {
        id: true, skill: true, seriesId: true, bookNumber: true, testNumber: true,
        writingTasks:  { select: { id: true, number: true } },
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
            select: { id: true, taskId: true, aiScore: true, status: true, createdAt: true, task: { select: { examId: true } } }
          })
        : [],
      speakingPartIds.length > 0
        ? prisma.speakingAnswer.findMany({
            where: { userId, partId: { in: speakingPartIds } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, partId: true, aiScore: true, status: true, createdAt: true, part: { select: { examId: true, number: true } } }
          })
        : [],
    ])

    // Step 4: Build lookup maps (entry đầu tiên = mới nhất do đã orderBy desc)
    const latestAttemptByExam = {}
    for (const a of attempts) {
      if (!latestAttemptByExam[a.examId]) latestAttemptByExam[a.examId] = a
    }
    const byExam = (list, examOf) => list.reduce((m, a) => ((m[examOf(a)] ||= []).push(a), m), {})
    const latestWritingByTask = {}
    for (const list of Object.values(byExam(writingAnswers, a => a.task?.examId))) {
      Object.assign(latestWritingByTask, writingAttempts(list)[0]?.items || {})
    }
    const latestSpeakingByPart = {}
    for (const list of Object.values(byExam(speakingAnswers, a => a.part?.examId))) {
      Object.assign(latestSpeakingByPart, speakingAttempts(list.map(a => ({ ...a, partNumber: a.part?.number })))[0]?.items || {})
    }

    // Step 5: Tính trạng thái hoàn toàn trong bộ nhớ — 0 queries thêm
    const result = fullTestGroups.map(g => {
      const skills = {}

      for (const skill of ['reading', 'listening']) {
        const attempt = latestAttemptByExam[g.exams[skill].id]
        skills[skill] = {
          available: true, done: !!attempt, score: attempt?.score ?? null,
          status: attempt ? 'done' : 'not_started',
        }
      }

      const tasks = g.exams.writing.writingTasks
      const taskIds = tasks.map(t => t.id)
      if (taskIds.length === 0) {
        skills.writing = { available: true, done: false, score: null }
      } else {
        const answers = taskIds.map(id => latestWritingByTask[id])
        const done = answers.every(isGradedAnswer) && answers.length > 0
        const score = done ? writingWeightedBand(tasks, latestWritingByTask) : null
        skills.writing = {
          available: true, done, score,
          status: aiSkillStatus(answers),
          graded: gradedCount(answers),
          total: taskIds.length,
        }
      }

      const partIds = g.exams.speaking.speakingParts.map(p => p.id)
      if (partIds.length === 0) {
        skills.speaking = { available: true, done: false, score: null }
      } else {
        const answers = partIds.map(id => latestSpeakingByPart[id])
        const done = answers.every(isGradedAnswer) && answers.length > 0
        const score = done ? averageBand(answers.map(a => a.aiScore)) : null
        skills.speaking = {
          available: true, done, score,
          status: aiSkillStatus(answers),
          graded: gradedCount(answers),
          total: partIds.length,
        }
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
    sendServerError(res, error, 'Lỗi server')
  }
})

module.exports = router
