import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── ?attemptId= trên GET /reading|listening/exams/:id/result-detail ───────
// INTEGRATION test (postgres-dev). Bao gồm: không truyền -> lượt mới nhất
// (hành vi cũ giữ nguyên), truyền -> đúng lượt đó, lượt của người khác/đề khác
// bị từ chối, và trường hợp câu hỏi đã bị gỡ khỏi cấu trúc đề hiện tại hoặc bị
// đổi đáp án sau khi làm bài (không lỗi trang). Gọi thẳng DB thật nên CHỈ chạy
// khi DATABASE_URL trỏ postgres-dev local — chạy qua `npm run test:dev-db`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key'

const IS_DEV_DB = (process.env.DATABASE_URL || '').includes('127.0.0.1:5433')
const describeIntegration = IS_DEV_DB ? describe : describe.skip

if (!IS_DEV_DB) {
  console.warn('[routes/resultDetail.test.js] Bỏ qua — DATABASE_URL không trỏ postgres-dev. Chạy `npm run test:dev-db` để thực thi.')
}

const prisma = require('../lib/prisma')
const app = require('../server')

const MARKER = '[RESULTDETAIL-TEST]'
let uniqueCounter = 0
function uniqueEmail(tag) {
  uniqueCounter += 1
  return `resultdetail-test-${tag}-${Date.now()}-${uniqueCounter}@example.test`
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

describeIntegration('?attemptId trên GET result-detail (postgres-dev integration)', () => {
  let user, otherUser, userToken

  beforeAll(async () => {
    user = await prisma.user.create({ data: { name: `${MARKER} user`, email: uniqueEmail('user'), password: 'x', role: 'user' } })
    otherUser = await prisma.user.create({ data: { name: `${MARKER} other`, email: uniqueEmail('other'), password: 'x', role: 'user' } })
    userToken = tokenFor(user)
  })

  afterAll(async () => {
    const leftoverExams = await prisma.exam.findMany({ where: { title: { startsWith: MARKER } }, select: { id: true } })
    await cleanupExams(leftoverExams.map(e => e.id))
    await cleanupUsers([user.id, otherUser.id])
    const leftoverUsers = await prisma.user.findMany({ where: { name: { startsWith: MARKER } }, select: { id: true } })
    await cleanupUsers(leftoverUsers.map(u => u.id))
  })

  describe('GET /reading/exams/:id/result-detail', () => {
    it('không truyền attemptId -> trả lượt mới nhất (giữ nguyên hành vi cũ)', async () => {
      const { exam, questions } = await createReadingExam('result-detail-latest', [{ number: 1, correctAnswer: 'x' }])
      try {
        const older = await createAttempt(user.id, exam.id, { score: 4.0, finishedAt: new Date(Date.now() - 60_000), answers: [{ questionId: questions[0].id, userAnswer: 'wrong', isCorrect: false }] })
        const latest = await createAttempt(user.id, exam.id, { score: 7.5, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })

        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .set('Authorization', `Bearer ${userToken}`).expect(200)
        expect(res.body.bandScore).toBe(latest.score)
        expect(res.body.bandScore).not.toBe(older.score)
      } finally {
        await cleanupExams([exam.id])
      }
    })

    it('truyền attemptId -> trả đúng lượt đó (không phải lượt mới nhất)', async () => {
      const { exam, questions } = await createReadingExam('result-detail-specific', [{ number: 1, correctAnswer: 'x' }])
      try {
        const older = await createAttempt(user.id, exam.id, { score: 4.0, finishedAt: new Date(Date.now() - 60_000), answers: [{ questionId: questions[0].id, userAnswer: 'wrong', isCorrect: false }] })
        await createAttempt(user.id, exam.id, { score: 7.5, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })

        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .query({ attemptId: older.id })
          .set('Authorization', `Bearer ${userToken}`).expect(200)
        expect(res.body.bandScore).toBe(older.score)
      } finally {
        await cleanupExams([exam.id])
      }
    })

    it('attemptId của người khác -> từ chối (404), không lộ dữ liệu', async () => {
      const { exam, questions } = await createReadingExam('result-detail-other-user', [{ number: 1, correctAnswer: 'x' }])
      try {
        const otherAttempt = await createAttempt(otherUser.id, exam.id, { score: 9.0, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })

        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .query({ attemptId: otherAttempt.id })
          .set('Authorization', `Bearer ${userToken}`)
        expect(res.status).toBe(404)
      } finally {
        await cleanupExams([exam.id])
      }
    })

    it('attemptId hợp lệ nhưng của đề khác (:id không khớp) -> từ chối (404)', async () => {
      const { exam: examA, questions: qa } = await createReadingExam('result-detail-wrong-exam-a', [{ number: 1, correctAnswer: 'x' }])
      const { exam: examB } = await createReadingExam('result-detail-wrong-exam-b', [{ number: 1, correctAnswer: 'x' }])
      try {
        const attemptOnA = await createAttempt(user.id, examA.id, { score: 6.0, finishedAt: new Date(), answers: [{ questionId: qa[0].id, userAnswer: 'x', isCorrect: true }] })

        const res = await request(app)
          .get(`/api/reading/exams/${examB.id}/result-detail`)
          .query({ attemptId: attemptOnA.id })
          .set('Authorization', `Bearer ${userToken}`)
        expect(res.status).toBe(404)
      } finally {
        await cleanupExams([examA.id, examB.id])
      }
    })

    it('attemptId không phải số -> 400 lỗi validate', async () => {
      const { exam } = await createReadingExam('result-detail-invalid-attemptid', [{ number: 1, correctAnswer: 'x' }])
      try {
        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .query({ attemptId: 'not-a-number' })
          .set('Authorization', `Bearer ${userToken}`)
        expect(res.status).toBe(400)
      } finally {
        await cleanupExams([exam.id])
      }
    })

    it('câu hỏi đã bị gỡ khỏi cấu trúc đề hiện tại sau khi làm bài -> không lỗi trang, câu đó bị bỏ qua khỏi thống kê', async () => {
      const { exam, questions } = await createReadingExam('result-detail-removed-question', [
        { number: 1, correctAnswer: 'yes' }, { number: 2, correctAnswer: 'no' }
      ])
      try {
        await createAttempt(user.id, exam.id, {
          score: 5.0, finishedAt: new Date(),
          answers: [
            { questionId: questions[0].id, userAnswer: 'yes', isCorrect: true },
            { questionId: questions[1].id, userAnswer: 'no', isCorrect: true },
          ]
        })

        // Mô phỏng câu hỏi 2 "đã bị xóa khỏi đề": gỡ khỏi passage (Question có
        // QuestionAnswer tham chiếu nên không thể hard-delete thật — FK Restrict
        // chặn ở tầng DB, đã xác nhận bằng thực nghiệm — đây là cách gần nhất tái
        // tạo "không còn trong cấu trúc đề hiện tại" mà không phá ràng buộc).
        await prisma.question.update({ where: { id: questions[1].id }, data: { passageId: null } })

        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .set('Authorization', `Bearer ${userToken}`).expect(200)

        expect(res.body.totalQuestions).toBe(1)
        expect(res.body.correct).toBe(1)
        const allNumbers = res.body.sections.flatMap(s => s.questions.flatMap(q => q.grouped ? q.numbers : [q.number]))
        expect(allNumbers).toEqual([1])
      } finally {
        // Xóa Attempt (cascade QuestionAnswer) TRƯỚC — câu hỏi đã gỡ khỏi passage
        // vẫn còn bị QuestionAnswer tham chiếu (FK Restrict) nên không thể xóa
        // trực tiếp cho tới khi QuestionAnswer đó không còn.
        await prisma.attempt.deleteMany({ where: { examId: exam.id } })
        await prisma.question.deleteMany({ where: { id: questions[1].id } })
        await cleanupExams([exam.id])
      }
    })

    it('câu hỏi bị thay đổi đáp án đúng sau khi làm bài -> hiển thị đáp án đúng HIỆN TẠI, không phải lúc làm bài', async () => {
      const { exam, questions } = await createReadingExam('result-detail-changed-answer', [{ number: 1, correctAnswer: 'old-answer' }])
      try {
        await createAttempt(user.id, exam.id, {
          score: 5.0, finishedAt: new Date(),
          answers: [{ questionId: questions[0].id, userAnswer: 'old-answer', isCorrect: true }]
        })
        await prisma.question.update({ where: { id: questions[0].id }, data: { correctAnswer: 'new-answer' } })

        const res = await request(app)
          .get(`/api/reading/exams/${exam.id}/result-detail`)
          .set('Authorization', `Bearer ${userToken}`).expect(200)

        const q = res.body.sections[0].questions.find(x => x.number === 1)
        expect(q.correctAnswer).toBe('new-answer')
      } finally {
        await cleanupExams([exam.id])
      }
    })
  })

  describe('GET /listening/exams/:id/result-detail', () => {
    it('truyền attemptId -> trả đúng lượt đó; attemptId của người khác -> từ chối', async () => {
      const { exam, questions } = await createListeningExam('listening-result-detail', [{ number: 1, correctAnswer: 'x' }])
      try {
        const older = await createAttempt(user.id, exam.id, { score: 4.0, finishedAt: new Date(Date.now() - 60_000), answers: [{ questionId: questions[0].id, userAnswer: 'wrong', isCorrect: false }] })
        await createAttempt(user.id, exam.id, { score: 7.5, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })

        const specific = await request(app)
          .get(`/api/listening/exams/${exam.id}/result-detail`)
          .query({ attemptId: older.id })
          .set('Authorization', `Bearer ${userToken}`).expect(200)
        expect(specific.body.bandScore).toBe(older.score)

        const otherAttempt = await createAttempt(otherUser.id, exam.id, { score: 9.0, finishedAt: new Date(), answers: [{ questionId: questions[0].id, userAnswer: 'x', isCorrect: true }] })
        const denied = await request(app)
          .get(`/api/listening/exams/${exam.id}/result-detail`)
          .query({ attemptId: otherAttempt.id })
          .set('Authorization', `Bearer ${userToken}`)
        expect(denied.status).toBe(404)
      } finally {
        await cleanupExams([exam.id])
      }
    })

    it('câu hỏi đã bị gỡ khỏi cấu trúc đề hiện tại sau khi làm bài -> không lỗi trang, câu đó bị bỏ qua khỏi thống kê', async () => {
      const { exam, questions } = await createListeningExam('listening-removed-question', [
        { number: 1, correctAnswer: 'yes' }, { number: 2, correctAnswer: 'no' }
      ])
      try {
        await createAttempt(user.id, exam.id, {
          score: 5.0, finishedAt: new Date(),
          answers: [
            { questionId: questions[0].id, userAnswer: 'yes', isCorrect: true },
            { questionId: questions[1].id, userAnswer: 'no', isCorrect: true },
          ]
        })

        await prisma.question.update({ where: { id: questions[1].id }, data: { listeningSectionId: null } })

        const res = await request(app)
          .get(`/api/listening/exams/${exam.id}/result-detail`)
          .set('Authorization', `Bearer ${userToken}`).expect(200)

        expect(res.body.totalQuestions).toBe(1)
        expect(res.body.correct).toBe(1)
      } finally {
        await prisma.attempt.deleteMany({ where: { examId: exam.id } })
        await prisma.question.deleteMany({ where: { id: questions[1].id } })
        await cleanupExams([exam.id])
      }
    })
  })
})
