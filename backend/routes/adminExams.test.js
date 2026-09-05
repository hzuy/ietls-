import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const prismaMock = {
  exam: {
    groupBy: vi.fn().mockResolvedValue([
      { skill: 'reading', _count: { id: 10 } },
      { skill: 'listening', _count: { id: 8 } }
    ]),
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        title: 'Cambridge 19 Reading Test 1',
        skill: 'reading',
        bookNumber: 19,
        testNumber: 1,
        seriesId: 1,
        createdAt: '2026-07-23T00:00:00.000Z',
        passages: [],
        listeningSections: [],
        writingTasks: [],
        speakingParts: [],
        _count: { attempts: 5 }
      }
    ]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({})
  },
  attempt: {
    groupBy: vi.fn().mockResolvedValue([
      { examId: 1, _avg: { score: 7.5 } }
    ]),
    aggregate: vi.fn().mockResolvedValue({
      _count: { _all: 42 },
      _avg: { score: 6.8 }
    })
  },
  passage: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  listeningSection: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  question: {
    update: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  questionGroup: {
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  noteSection: {
    deleteMany: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({})
  },
  matchingOption: {
    deleteMany: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({})
  },
  questionAnswer: {
    findMany: vi.fn().mockResolvedValue([])
  },
  answerLog: {
    findMany: vi.fn().mockResolvedValue([])
  },
  writingTask: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({})
  },
  $transaction: vi.fn()
}
prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

const app = require('../server')

describe('Admin Exams Router & Pagination', () => {
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/admin/exams/counts returns skill count mapping', async () => {
    const res = await request(app)
      .get('/api/admin/exams/counts')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('reading', 10)
    expect(res.body).toHaveProperty('listening', 8)
    expect(res.body).toHaveProperty('writing', 0)
    expect(res.body).toHaveProperty('speaking', 0)
  })

  it('GET /api/admin/exams returns paginated exam payload with questionCount and avgScore', async () => {
    const res = await request(app)
      .get('/api/admin/exams?skill=reading&page=1&limit=10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body).toHaveProperty('exams')
    expect(res.body).toHaveProperty('total', 1)
    expect(res.body).toHaveProperty('page', 1)
    expect(res.body).toHaveProperty('pages', 1)
    expect(res.body.exams.length).toBe(1)
    expect(res.body.exams[0].avgScore).toBe(7.5)
  })

  it('GET /api/admin/exams returns global stats (not page-scoped) when skill is given', async () => {
    const res = await request(app)
      .get('/api/admin/exams?skill=reading')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(res.body.stats).toEqual({
      totalExams: 1,
      noQuestionsCount: 1,
      totalAttempts: 42,
      avgBand: 6.8
    })
  })

  it('GET /api/admin/exams applies status=no_questions and sortBy=attempts to the Prisma query', async () => {
    await request(app)
      .get('/api/admin/exams?skill=reading&status=no_questions&sortBy=attempts&sortOrder=asc')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.exam.findMany.mock.calls.at(-1)[0]
    expect(call.where).toHaveProperty('NOT')
    expect(call.orderBy).toEqual({ attempts: { _count: 'asc' } })
  })
})

// ─── PUT /api/admin/exams/:id — diff-based upsert (preserve IDs) ────────────
// Regression coverage for the delete-and-recreate → diff-and-upsert rewrite:
// editing an exam must never regenerate Question/Passage/Section/WritingTask
// ids, and must never delete a question that a QuestionAnswer/AnswerLog still
// references — such a request must be rejected (409) with nothing else saved.
describe('Admin Exams Router — PUT (diff-based upsert)', () => {
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

  // ─── Reading ───────────────────────────────────────────────────────────────
  const oldReadingPassage = () => ({
    id: 501, number: 1,
    questions: [],
    questionGroups: [
      { id: 601, sortOrder: 0, questions: [{ id: 701, number: 1 }, { id: 702, number: 2 }] }
    ]
  })

  const readingGroup = (questions) => ({
    type: 'mcq', qNumberStart: 1, qNumberEnd: questions.length, instruction: '', maxChoices: 2, canReuse: false,
    questions
  })

  const readingBody = (questions) => ({
    title: 'Reading Test 1',
    passages: [{
      number: 1, title: 'Passage 1', subtitle: null, letteredParagraphs: false, body: 'Body text',
      questionGroups: [readingGroup(questions)],
      questions: []
    }]
  })

  it('PUT reading exam with no question removed updates in place and preserves ids (never touches answer tables)', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    const res = await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([
        { number: 1, questionText: 'Q1 updated', options: ['A', 'B'], correctAnswer: 'A' },
        { number: 2, questionText: 'Q2 updated', options: ['A', 'B'], correctAnswer: 'B' }
      ]))
      .expect(200)

    expect(res.body).toEqual({ id: 10, passages: [] })
    expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([701, 702])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
    // No deletion candidates at all this request → the answer tables are never queried.
    expect(prismaMock.questionAnswer.findMany).not.toHaveBeenCalled()
    expect(prismaMock.answerLog.findMany).not.toHaveBeenCalled()
  })

  it('PUT reading exam deletes a question that was never answered', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([])

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([{ number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }]))
      .expect(200)

    expect(prismaMock.question.delete).toHaveBeenCalledWith({ where: { id: 702 } })
    expect(prismaMock.question.update).toHaveBeenCalledWith({ where: { id: 701 }, data: expect.objectContaining({ number: 1 }) })
  })

  it('PUT reading exam rejects (409) removing a question that already has an answer, and saves nothing', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([{ questionId: 702 }])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([{ number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }]))
      .expect(409)

    expect(res.body.blockedQuestions).toEqual([{ passageNumber: 1, groupSortOrder: 0, questionNumber: 2 }])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
    expect(prismaMock.question.update).not.toHaveBeenCalled()
    expect(prismaMock.passage.update).not.toHaveBeenCalled()
    expect(prismaMock.exam.update).not.toHaveBeenCalled()
  })

  it('PUT reading exam creates a brand-new passage without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    const body = readingBody([
      { number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', options: ['A', 'B'], correctAnswer: 'B' }
    ])
    body.passages.push({
      number: 2, title: 'Passage 2', subtitle: null, letteredParagraphs: false, body: 'New passage body',
      questionGroups: [readingGroup([{ number: 3, questionText: 'Q3', options: ['A', 'B'], correctAnswer: 'A' }])],
      questions: []
    })

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.passage.create).toHaveBeenCalledTimes(1)
    const createArg = prismaMock.passage.create.mock.calls[0][0].data
    expect(createArg.number).toBe(2)
    expect(createArg.questionGroups.create[0].questions.create[0].number).toBe(3)

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([701, 702])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
    expect(prismaMock.questionAnswer.findMany).not.toHaveBeenCalled()
  })

  it('PUT reading exam creates a brand-new group in an existing passage without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    const body = readingBody([
      { number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', options: ['A', 'B'], correctAnswer: 'B' }
    ])
    body.passages[0].questionGroups.push(readingGroup([{ number: 3, questionText: 'Q3', options: ['A', 'B'], correctAnswer: 'A' }]))

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.questionGroup.create).toHaveBeenCalledTimes(1)
    const groupArg = prismaMock.questionGroup.create.mock.calls[0][0].data
    expect(groupArg.passageId).toBe(501)
    expect(groupArg.questions.create[0].number).toBe(3)

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([701, 702])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  it('PUT reading exam creates a brand-new question in an existing group without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    const body = readingBody([
      { number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', options: ['A', 'B'], correctAnswer: 'B' },
      { number: 3, questionText: 'Q3', options: ['A', 'B'], correctAnswer: 'A' }
    ])

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.question.createMany).toHaveBeenCalledTimes(1)
    const createManyArg = prismaMock.question.createMany.mock.calls[0][0].data
    expect(createManyArg).toEqual([expect.objectContaining({ number: 3, groupId: 601 })])

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([701, 702])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  // ─── Listening ─────────────────────────────────────────────────────────────
  const oldListeningSection = () => ({
    id: 511, number: 1,
    questions: [],
    questionGroups: [
      { id: 611, sortOrder: 0, questions: [{ id: 711, number: 1 }, { id: 712, number: 2 }] }
    ]
  })

  const listeningGroup = (questions) => ({
    type: 'matching', qNumberStart: 1, qNumberEnd: questions.length, instruction: '', maxChoices: 2,
    matchingOptions: [{ letter: 'A', text: 'Opt A' }],
    questions
  })

  const listeningBody = (questions) => ({
    title: 'Listening Test 1',
    sections: [{
      number: 1, context: '', audioUrl: null, transcript: null,
      questionGroups: [listeningGroup(questions)],
      questions: []
    }]
  })

  it('PUT listening exam with no question removed updates in place and preserves ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' }).mockResolvedValueOnce({ id: 20, listeningSections: [] })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])

    const res = await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(listeningBody([
        { number: 1, questionText: 'Q1 updated', correctAnswer: 'A' },
        { number: 2, questionText: 'Q2 updated', correctAnswer: 'A' }
      ]))
      .expect(200)

    expect(res.body).toEqual({ id: 20, listeningSections: [] })
    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([711, 712])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  it('PUT listening exam deletes a question that was never answered', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' }).mockResolvedValueOnce({ id: 20, listeningSections: [] })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([])

    await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(listeningBody([{ number: 1, questionText: 'Q1', correctAnswer: 'A' }]))
      .expect(200)

    expect(prismaMock.question.delete).toHaveBeenCalledWith({ where: { id: 712 } })
  })

  it('PUT listening exam rejects (409) removing an answered question, and saves nothing', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([{ questionId: 712 }])

    const res = await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(listeningBody([{ number: 1, questionText: 'Q1', correctAnswer: 'A' }]))
      .expect(409)

    expect(res.body.blockedQuestions).toEqual([{ sectionNumber: 1, groupSortOrder: 0, questionNumber: 2 }])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
    expect(prismaMock.listeningSection.update).not.toHaveBeenCalled()
    expect(prismaMock.exam.update).not.toHaveBeenCalled()
  })

  it('PUT listening exam creates a brand-new section without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' }).mockResolvedValueOnce({ id: 20, listeningSections: [] })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])

    const body = listeningBody([
      { number: 1, questionText: 'Q1', correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', correctAnswer: 'A' }
    ])
    body.sections.push({
      number: 2, context: 'New section', audioUrl: null, transcript: null,
      questionGroups: [listeningGroup([{ number: 3, questionText: 'Q3', correctAnswer: 'A' }])],
      questions: []
    })

    await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.listeningSection.create).toHaveBeenCalledTimes(1)
    const createArg = prismaMock.listeningSection.create.mock.calls[0][0].data
    expect(createArg.number).toBe(2)
    expect(createArg.questionGroups.create[0].questions.create[0].number).toBe(3)

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([711, 712])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  it('PUT listening exam creates a brand-new group in an existing section without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' }).mockResolvedValueOnce({ id: 20, listeningSections: [] })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])

    const body = listeningBody([
      { number: 1, questionText: 'Q1', correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', correctAnswer: 'A' }
    ])
    body.sections[0].questionGroups.push(listeningGroup([{ number: 3, questionText: 'Q3', correctAnswer: 'A' }]))

    await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.questionGroup.create).toHaveBeenCalledTimes(1)
    const groupArg = prismaMock.questionGroup.create.mock.calls[0][0].data
    expect(groupArg.sectionId).toBe(511)
    expect(groupArg.questions.create[0].number).toBe(3)

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([711, 712])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  it('PUT listening exam creates a brand-new question in an existing group without touching existing ids', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'listening' }).mockResolvedValueOnce({ id: 20, listeningSections: [] })
    prismaMock.listeningSection.findMany.mockResolvedValueOnce([oldListeningSection()])

    const body = listeningBody([
      { number: 1, questionText: 'Q1', correctAnswer: 'A' },
      { number: 2, questionText: 'Q2', correctAnswer: 'A' },
      { number: 3, questionText: 'Q3', correctAnswer: 'A' }
    ])

    await request(app)
      .put('/api/admin/exams/20')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.question.createMany).toHaveBeenCalledTimes(1)
    const createManyArg = prismaMock.question.createMany.mock.calls[0][0].data
    expect(createManyArg).toEqual([expect.objectContaining({ number: 3, groupId: 611 })])

    const updatedIds = prismaMock.question.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([711, 712])
    expect(prismaMock.question.delete).not.toHaveBeenCalled()
  })

  // ─── Writing ───────────────────────────────────────────────────────────────
  it('PUT writing exam updates both existing WritingTask rows in place, preserving id', async () => {
    prismaMock.exam.findUnique
      .mockResolvedValueOnce({ skill: 'writing' })
      .mockResolvedValueOnce({ id: 30, writingTasks: [{ id: 901, number: 1 }, { id: 902, number: 2 }] })
    prismaMock.writingTask.findMany.mockResolvedValueOnce([{ id: 901, number: 1 }, { id: 902, number: 2 }])

    await request(app)
      .put('/api/admin/exams/30')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Writing Test 1', task1: { prompt: 'New task 1 prompt' }, task2: { prompt: 'New task 2 prompt' } })
      .expect(200)

    expect(prismaMock.writingTask.create).not.toHaveBeenCalled()
    expect(prismaMock.writingTask.update).toHaveBeenCalledTimes(2)
    const updatedIds = prismaMock.writingTask.update.mock.calls.map(c => c[0].where.id).sort()
    expect(updatedIds).toEqual([901, 902])
  })

  it('PUT writing exam creates a WritingTask row for a slot missing in the DB', async () => {
    prismaMock.exam.findUnique
      .mockResolvedValueOnce({ skill: 'writing' })
      .mockResolvedValueOnce({ id: 30, writingTasks: [] })
    prismaMock.writingTask.findMany.mockResolvedValueOnce([{ id: 901, number: 1 }])

    await request(app)
      .put('/api/admin/exams/30')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Writing Test 1', task1: { prompt: 'Task 1' }, task2: { prompt: 'Task 2' } })
      .expect(200)

    expect(prismaMock.writingTask.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.writingTask.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.writingTask.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ number: 2, examId: 30 }))
  })
})
