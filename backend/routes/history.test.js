import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── GET /api/user/history — INTEGRATION test (postgres-dev) ───────────────
// Lịch sử làm bài Reading/Listening (đã hoàn thành) của user đang đăng nhập:
// phân trang, lọc theo skill/đề thi, correct/total tính từ QuestionAnswer,
// và không bao giờ lộ lượt của người khác. Gọi thẳng DB thật nên CHỈ chạy khi
// DATABASE_URL trỏ postgres-dev local — chạy qua `npm run test:dev-db`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/history.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi.')
}

const prisma = require('../lib/prisma')
const app = require('../server')

const MARKER = '[HISTORY-TEST]'
let uniqueCounter = 0
function uniqueEmail(tag) {
  uniqueCounter += 1
  return `history-test-${tag}-${Date.now()}-${uniqueCounter}@example.test`
}

function tokenFor(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })
}

async function createReadingExam(title, questionsSpec) {
  const exam = await prisma.exam.create({ data: { title: `${MARKER} ${title}`, skill: 'reading' } })
  const passage = await prisma.passage.create({ data: { examId: exam.id, number: 1, title: 'P1', body: 'Passage body.' } })
  const questions = []
  for (const spec of questionsSpec) {
    const q = await prisma.question.create({
      data: {
        passageId: passage.id, number: spec.number, type: 'short_answer',
        questionText: `Question ${spec.number}`, correctAnswer: spec.correctAnswer,
      }
    })
    questions.push(q)
  }
  return { exam, passage, questions }
}

async function createListeningExam(title, questionsSpec) {
  const exam = await prisma.exam.create({ data: { title: `${MARKER} ${title}`, skill: 'listening' } })
  const section = await prisma.listeningSection.create({ data: { examId: exam.id, number: 1, context: 'Section 1' } })
  const questions = []
  for (const spec of questionsSpec) {
    const q = await prisma.question.create({
      data: {
        listeningSectionId: section.id, number: spec.number, type: 'short_answer',
        questionText: `Question ${spec.number}`, correctAnswer: spec.correctAnswer,
      }
    })
    questions.push(q)
  }
  return { exam, section, questions }
}

async function createAttempt(userId, examId, { score, finishedAt, answers }) {
  const attempt = await prisma.attempt.create({
    data: { userId, examId, score, finishedAt, answers: JSON.stringify({}) }
  })
  if (answers?.length) {
    await prisma.questionAnswer.createMany({
      data: answers.map(a => ({ attemptId: attempt.id, questionId: a.questionId, userAnswer: a.userAnswer, isCorrect: a.isCorrect }))
    })
  }
  return attempt
}

// Cleanup phải xóa Attempt (cascade QuestionAnswer) TRƯỚC khi xóa Exam (cascade
// Passage/Section -> Question) — Question có FK Restrict từ QuestionAnswer nên
// xóa Exam trước trong khi QuestionAnswer còn tham chiếu sẽ vi phạm FK.
async function cleanupExams(examIds) {
  if (!examIds.length) return
  await prisma.attempt.deleteMany({ where: { examId: { in: examIds } } })
  await prisma.exam.deleteMany({ where: { id: { in: examIds } } })
}
async function cleanupUsers(userIds) {
  if (!userIds.length) return
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}

describeIntegration('GET /api/user/history (postgres-dev integration)', () => {
  let user, otherUser, userToken

  beforeAll(async () => {
    user = await prisma.user.create({ data: { name: `${MARKER} user`, email: uniqueEmail('user'), password: 'x', role: 'user' } })
    otherUser = await prisma.user.create({ data: { name: `${MARKER} other`, email: uniqueEmail('other'), password: 'x', role: 'user' } })
    userToken = tokenFor(user)
  })

  afterAll(async () => {
    // Xóa Exam (cascade Attempt/QuestionAnswer qua cleanupExams) TRƯỚC khi xóa
    // User — Attempt có FK bắt buộc tới User nên thứ tự ngược lại sẽ vi phạm FK
    // nếu có attempt nào còn sót lại (vd. từ một test bị fail giữa chừng).
    const leftoverExams = await prisma.exam.findMany({ where: { title: { startsWith: MARKER } }, select: { id: true } })
    await cleanupExams(leftoverExams.map(e => e.id))
    await cleanupUsers([user.id, otherUser.id])
    const leftoverUsers = await prisma.user.findMany({ where: { name: { startsWith: MARKER } }, select: { id: true } })
    await cleanupUsers(leftoverUsers.map(u => u.id))
  })

  it('trả về lịch sử reading+listening mới nhất trước, correct/total tính từ QuestionAnswer, loại trừ writing/speaking và lượt chưa hoàn thành', async () => {
    const { exam: readingExam, questions: rq } = await createReadingExam('history-basic-reading', [
      { number: 1, correctAnswer: 'yes' }, { number: 2, correctAnswer: 'no' }
    ])
    const { exam: listeningExam, questions: lq } = await createListeningExam('history-basic-listening', [
      { number: 1, correctAnswer: 'a' }, { number: 2, correctAnswer: 'b' }
    ])
    const writingExam = await prisma.exam.create({ data: { title: `${MARKER} history-basic-writing`, skill: 'writing' } })

    const now = Date.now()
    try {
      const readingAttempt = await createAttempt(user.id, readingExam.id, {
        score: 6.5, finishedAt: new Date(now - 2 * 60_000),
        answers: [
          { questionId: rq[0].id, userAnswer: 'yes', isCorrect: true },
          { questionId: rq[1].id, userAnswer: 'wrong', isCorrect: false },
        ]
      })
      const listeningAttempt = await createAttempt(user.id, listeningExam.id, {
        score: 8.0, finishedAt: new Date(now - 1 * 60_000),
        answers: [
          { questionId: lq[0].id, userAnswer: 'a', isCorrect: true },
          { questionId: lq[1].id, userAnswer: 'b', isCorrect: true },
        ]
      })
      // Writing attempt — không thuộc phạm vi, không được xuất hiện trong history
      await createAttempt(user.id, writingExam.id, { score: 7.0, finishedAt: new Date(now), answers: [] })
      // Lượt chưa hoàn thành (finishedAt null) — không được xuất hiện
      await prisma.attempt.create({ data: { userId: user.id, examId: readingExam.id, score: null, finishedAt: null } })

      const res = await request(app).get('/api/user/history').set('Authorization', `Bearer ${userToken}`).expect(200)

      expect(res.body.history).toHaveLength(2)
      // Mới nhất trước: listening (finishedAt now-1min) trước reading (now-2min)
      expect(res.body.history[0].attemptId).toBe(listeningAttempt.id)
      expect(res.body.history[0].skill).toBe('listening')
      expect(res.body.history[0].correct).toBe(2)
      expect(res.body.history[0].total).toBe(2)
      expect(res.body.history[0].bandScore).toBe(8.0)

      expect(res.body.history[1].attemptId).toBe(readingAttempt.id)
      expect(res.body.history[1].skill).toBe('reading')
      expect(res.body.history[1].correct).toBe(1)
      expect(res.body.history[1].total).toBe(2)
      expect(res.body.history[1].examTitle).toContain('history-basic-reading')

      expect(res.body.history.some(h => h.skill === 'writing')).toBe(false)
      expect(res.body.total).toBe(2)
    } finally {
      await cleanupExams([readingExam.id, listeningExam.id, writingExam.id])
    }
  })

  it('phân trang đúng theo page/limit', async () => {
    const { exam, questions } = await createReadingExam('history-paging', [{ number: 1, correctAnswer: 'x' }])
    try {
      const base = Date.now()
      const attempts = []
      for (let i = 0; i < 3; i++) {
        attempts.push(await createAttempt(user.id, exam.id, {
          score: 5.0, finishedAt: new Date(base - i * 60_000),
          answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }]
        }))
      }

      const page1 = await request(app)
        .get('/api/user/history').query({ limit: 2, page: 1 })
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(page1.body.history).toHaveLength(2)
      expect(page1.body.total).toBe(3)
      expect(page1.body.pages).toBe(2)
      expect(page1.body.history[0].attemptId).toBe(attempts[0].id)

      const page2 = await request(app)
        .get('/api/user/history').query({ limit: 2, page: 2 })
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(page2.body.history).toHaveLength(1)
      expect(page2.body.history[0].attemptId).toBe(attempts[2].id)
    } finally {
      await cleanupExams([exam.id])
    }
  })

  it('lọc theo skill', async () => {
    const { exam: readingExam, questions: rq } = await createReadingExam('history-filter-skill-reading', [{ number: 1, correctAnswer: 'x' }])
    const { exam: listeningExam, questions: lq } = await createListeningExam('history-filter-skill-listening', [{ number: 1, correctAnswer: 'x' }])
    try {
      await createAttempt(user.id, readingExam.id, { score: 5.0, finishedAt: new Date(), answers: [{ questionId: rq[0].id, userAnswer: 'x', isCorrect: true }] })
      await createAttempt(user.id, listeningExam.id, { score: 5.0, finishedAt: new Date(), answers: [{ questionId: lq[0].id, userAnswer: 'x', isCorrect: true }] })

      const res = await request(app)
        .get('/api/user/history').query({ skill: 'listening' })
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(res.body.history.every(h => h.skill === 'listening')).toBe(true)
      expect(res.body.history.some(h => h.examId === listeningExam.id)).toBe(true)
      expect(res.body.history.some(h => h.examId === readingExam.id)).toBe(false)
    } finally {
      await cleanupExams([readingExam.id, listeningExam.id])
    }
  })

  it('lọc theo đề thi (examId)', async () => {
    const { exam: examA, questions: qa } = await createReadingExam('history-filter-exam-a', [{ number: 1, correctAnswer: 'x' }])
    const { exam: examB, questions: qb } = await createReadingExam('history-filter-exam-b', [{ number: 1, correctAnswer: 'x' }])
    try {
      await createAttempt(user.id, examA.id, { score: 5.0, finishedAt: new Date(), answers: [{ questionId: qa[0].id, userAnswer: 'x', isCorrect: true }] })
      await createAttempt(user.id, examB.id, { score: 6.0, finishedAt: new Date(), answers: [{ questionId: qb[0].id, userAnswer: 'x', isCorrect: true }] })

      const res = await request(app)
        .get('/api/user/history').query({ examId: examA.id })
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(res.body.history.every(h => h.examId === examA.id)).toBe(true)
    } finally {
      await cleanupExams([examA.id, examB.id])
    }
  })

  it('không trả lượt của người khác dù lọc theo examId của họ', async () => {
    const { exam, questions } = await createReadingExam('history-other-user', [{ number: 1, correctAnswer: 'x' }])
    try {
      await createAttempt(otherUser.id, exam.id, { score: 9.0, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })

      const res = await request(app)
        .get('/api/user/history').query({ examId: exam.id })
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(res.body.history).toHaveLength(0)
      expect(res.body.total).toBe(0)
    } finally {
      await cleanupExams([exam.id])
    }
  })
})
