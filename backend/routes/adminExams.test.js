import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { AUDIT_ACTIONS } from '../lib/auditActions'

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
    findFirst: vi.fn(),
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
  speakingPart: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({})
  },
  speakingQuestion: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({})
  },
  auditLog: {
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

  it('PUT reading exam matches and updates by explicit question.id even if question numbers changed', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    // Old questions had numbers 1 and 2 with ids 701 and 702.
    // In new body, numbers are shifted to 5 and 6, but ids 701 and 702 are passed explicitly.
    const body = {
      title: 'Reading Test 1',
      passages: [{
        number: 1, title: 'Passage 1', subtitle: null, letteredParagraphs: false, body: 'Body text',
        questionGroups: [{
          id: 601,
          type: 'mcq', qNumberStart: 5, qNumberEnd: 6, instruction: '', maxChoices: 2, canReuse: false,
          questions: [
            { id: 701, number: 5, questionText: 'Q1 renumbered to 5', options: ['A', 'B'], correctAnswer: 'A' },
            { id: 702, number: 6, questionText: 'Q2 renumbered to 6', options: ['A', 'B'], correctAnswer: 'B' }
          ]
        }],
        questions: []
      }]
    }

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.question.createMany).not.toHaveBeenCalled()
    expect(prismaMock.question.delete).not.toHaveBeenCalled()

    expect(prismaMock.question.update).toHaveBeenCalledWith({
      where: { id: 701 },
      data: expect.objectContaining({ number: 5, questionText: 'Q1 renumbered to 5' })
    })
    expect(prismaMock.question.update).toHaveBeenCalledWith({
      where: { id: 702 },
      data: expect.objectContaining({ number: 6, questionText: 'Q2 renumbered to 6' })
    })
  })

  it('PUT reading exam handles matching_headings group and replaces matching options', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([{
      id: 501, number: 1,
      questions: [],
      questionGroups: [
        {
          id: 601, sortOrder: 0, type: 'matching_headings',
          matchingOptions: [{ id: 801, optionLetter: 'i', optionText: 'Old Heading' }],
          questions: [{ id: 701, number: 1 }]
        }
      ]
    }])

    const body = {
      title: 'Reading Test 1',
      passages: [{
        number: 1, title: 'Passage 1', subtitle: null, letteredParagraphs: false, body: 'Body text',
        questionGroups: [{
          id: 601,
          type: 'matching_headings', qNumberStart: 1, qNumberEnd: 1, instruction: 'Choose headings',
          matchingOptions: [
            { letter: 'i', text: 'New Heading 1' },
            { letter: 'ii', text: 'New Heading 2' }
          ],
          questions: [{ id: 701, number: 1, questionText: 'Paragraph A', correctAnswer: 'i' }]
        }],
        questions: []
      }]
    }

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.matchingOption.deleteMany).toHaveBeenCalledWith({ where: { groupId: 601 } })
    expect(prismaMock.matchingOption.createMany).toHaveBeenCalledWith({
      data: [
        { groupId: 601, optionLetter: 'i', optionText: 'New Heading 1', sortOrder: 0 },
        { groupId: 601, optionLetter: 'ii', optionText: 'New Heading 2', sortOrder: 1 }
      ]
    })
    expect(prismaMock.question.update).toHaveBeenCalledWith({
      where: { id: 701 },
      data: expect.objectContaining({ number: 1, type: 'matching_headings' })
    })
  })

  it('PUT reading exam handles diagram_label group mapping hint to questionText and type to fill_blank', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([{
      id: 501, number: 1,
      questions: [],
      questionGroups: [
        {
          id: 601, sortOrder: 0, type: 'diagram_label',
          questions: [{ id: 701, number: 1 }]
        }
      ]
    }])

    const body = {
      title: 'Reading Test 1',
      passages: [{
        number: 1, title: 'Passage 1', subtitle: null, letteredParagraphs: false, body: 'Body text',
        questionGroups: [{
          id: 601,
          type: 'diagram_label', qNumberStart: 1, qNumberEnd: 1, instruction: 'Label diagram',
          imageUrl: '/uploads/diagram.png',
          questions: [{ id: 701, number: 1, hint: 'Top of arch', correctAnswer: 'keystone' }]
        }],
        questions: []
      }]
    }

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(body)
      .expect(200)

    expect(prismaMock.question.update).toHaveBeenCalledWith({
      where: { id: 701 },
      data: expect.objectContaining({ questionText: 'Top of arch', type: 'fill_blank', correctAnswer: 'keystone' })
    })
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

  // ─── Duplicate testNumber Validation (BUG-08) ─────────────────────────────
  it('PUT exam returns 409 if testNumber is already taken in the same series and book', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 10, skill: 'reading', seriesId: 1, bookNumber: 19, testNumber: 1 })
    prismaMock.exam.findFirst.mockResolvedValueOnce({ id: 99, title: 'Existing Test' })

    const res = await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Duplicate Test', testNumber: 2, bookNumber: 19, seriesId: 1 })
      .expect(409)

    expect(res.body.message).toContain('đã tồn tại')
  })

  it('POST /exams/reading returns 409 if testNumber is already taken in the same series and book', async () => {
    prismaMock.exam.findFirst
      .mockResolvedValueOnce(null) // title check passes
      .mockResolvedValueOnce({ id: 99, title: 'Existing Test' }) // checkDuplicateExamTest matches

    const res = await request(app)
      .post('/api/admin/exams/reading')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'New Test', seriesId: 1, bookNumber: 19, testNumber: 1, passages: [] })
      .expect(409)

    expect(res.body.message).toContain('đã tồn tại trong cùng cuốn/bộ đề')
  })

  // ─── Speaking Exams (GET, PUT, POST) ───────────────────────────────────────
  it('GET /api/admin/exams selects number, cueCard, and _count.questions for speakingParts', async () => {
    await request(app)
      .get('/api/admin/exams?skill=speaking')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    const call = prismaMock.exam.findMany.mock.calls.at(-1)[0]
    expect(call.select.speakingParts).toEqual({
      select: {
        id: true,
        number: true,
        cueCard: true,
        _count: { select: { questions: true } }
      }
    })
  })

  it('PUT speaking exam updates cueCard and questions for all 3 parts in place', async () => {
    prismaMock.exam.findUnique
      .mockResolvedValueOnce({ skill: 'speaking', seriesId: 1 })
      .mockResolvedValueOnce({
        id: 40,
        speakingParts: [
          { id: 101, number: 1 },
          { id: 102, number: 2 },
          { id: 103, number: 3 }
        ]
      })
    prismaMock.speakingPart.findMany.mockResolvedValueOnce([
      { id: 101, number: 1 },
      { id: 102, number: 2 },
      { id: 103, number: 3 }
    ])

    await request(app)
      .put('/api/admin/exams/40')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Cambridge 18 Speaking Test 1',
        part1: { cueCard: 'Desc 1', questions: ['Q1', 'Q2'] },
        part2: { cueCard: 'Describe a law...', questions: [] },
        part3: { cueCard: 'Desc 3', questions: ['##TOPIC##:Rules', 'Q3', 'Q4'] }
      })
      .expect(200)

    expect(prismaMock.speakingPart.update).toHaveBeenCalledTimes(3)
    expect(prismaMock.speakingQuestion.deleteMany).toHaveBeenCalledTimes(3)
    expect(prismaMock.speakingQuestion.createMany).toHaveBeenCalledTimes(2) // Part 1 (2 qs) and Part 3 (3 qs)
  })

  it('POST /api/admin/exams/speaking creates all 3 parts with questions and cueCards', async () => {
    prismaMock.exam.findFirst
      .mockResolvedValueOnce(null) // title check passes
    prismaMock.exam.create = vi.fn().mockResolvedValueOnce({
      id: 41,
      title: 'New Speaking Test',
      speakingParts: [
        { id: 201, number: 1, cueCard: 'P1', questions: [{ id: 1 }] },
        { id: 202, number: 2, cueCard: 'P2 Cue Card', questions: [] },
        { id: 203, number: 3, cueCard: 'P3', questions: [{ id: 2 }] }
      ]
    })

    const res = await request(app)
      .post('/api/admin/exams/speaking')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'New Speaking Test',
        part1: { cueCard: 'P1 desc', questions: ['Q1'] },
        part2: { cueCard: 'P2 Cue Card prompt', questions: [] },
        part3: { cueCard: 'P3 desc', questions: ['##TOPIC##:Social Media', 'Q2'] }
      })
      .expect(201)

    expect(res.body.id).toBe(41)
    expect(prismaMock.exam.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'New Speaking Test',
        skill: 'speaking',
        speakingParts: expect.objectContaining({
          create: expect.arrayContaining([
            expect.objectContaining({ number: 1 }),
            expect.objectContaining({ number: 2, cueCard: 'P2 Cue Card prompt' }),
            expect.objectContaining({ number: 3 })
          ])
        })
      })
    }))
  })
})

// ─── Audit Log wiring (exam.create / exam.update / exam.delete) ────────────
// Verifies the explicit logAuditEvent() calls added to the exam create/update/
// delete handlers — not a re-test of the diff-based upsert logic above.
describe('Admin Exams Router — Audit Log', () => {
  const teacherToken = jwt.sign({ userId: 2, email: 'teacher@example.com', role: 'teacher' }, 'test_secret_key', { expiresIn: '1h' })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
  })

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

  it('POST /exams/reading logs exam.create with entityLabel + skill/passage/question counts', async () => {
    prismaMock.exam.findFirst.mockResolvedValueOnce(null)
    prismaMock.exam.create = vi.fn().mockResolvedValueOnce({ id: 50, title: 'Brand New Reading' })

    await request(app)
      .post('/api/admin/exams/reading')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Brand New Reading',
        passages: [{ number: 1, title: 'P1', body: 'x', questionGroups: [readingGroup([{ number: 1, questionText: 'Q1', correctAnswer: 'A' }])], questions: [] }]
      })
      .expect(201)

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'user',
        actorUserId: 2,
        actorEmail: 'teacher@example.com',
        actorRole: 'teacher',
        action: AUDIT_ACTIONS.EXAM_CREATE,
        entityType: 'Exam',
        entityId: 50,
        entityLabel: 'Brand New Reading',
        metadata: { skill: 'reading', passageCount: 1, questionCount: 1 }
      })
    })
  })

  it('PUT /exams/:id (reading, no deletions) logs exam.update with deleted: 0', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, title: 'Reading Test 1', passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([
        { number: 1, questionText: 'Q1 updated', options: ['A', 'B'], correctAnswer: 'A' },
        { number: 2, questionText: 'Q2 updated', options: ['A', 'B'], correctAnswer: 'B' }
      ]))
      .expect(200)

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1)
    const call = prismaMock.auditLog.create.mock.calls[0][0]
    expect(call.data.action).toBe(AUDIT_ACTIONS.EXAM_UPDATE)
    expect(call.data.entityId).toBe(10)
    expect(call.data.entityLabel).toBe('Reading Test 1')
    expect(call.data.metadata.deleted).toBe(0)
  })

  it('PUT /exams/:id (reading, 1 question deleted) logs exam.update with deleted: 1', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' }).mockResolvedValueOnce({ id: 10, title: 'Reading Test 1', passages: [] })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([])

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([{ number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }]))
      .expect(200)

    const call = prismaMock.auditLog.create.mock.calls[0][0]
    expect(call.data.metadata.deleted).toBe(1)
  })

  it('PUT /exams/:id rejected with 409 (blocked deletion) does NOT write an audit log', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ skill: 'reading' })
    prismaMock.passage.findMany.mockResolvedValueOnce([oldReadingPassage()])
    prismaMock.questionAnswer.findMany.mockResolvedValueOnce([{ questionId: 702 }])
    prismaMock.answerLog.findMany.mockResolvedValueOnce([])

    await request(app)
      .put('/api/admin/exams/10')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(readingBody([{ number: 1, questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' }]))
      .expect(409)

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('DELETE /exams/:id reads the title before soft-delete and logs exam.delete with that snapshot', async () => {
    prismaMock.exam.findUnique.mockResolvedValueOnce({ title: 'Đề sắp bị xóa' })

    await request(app)
      .delete('/api/admin/exams/77')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200)

    expect(prismaMock.exam.findUnique).toHaveBeenCalledWith({ where: { id: 77 }, select: { title: true } })
    expect(prismaMock.exam.update).toHaveBeenCalledWith({ where: { id: 77 }, data: { deletedAt: expect.any(Date) } })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AUDIT_ACTIONS.EXAM_DELETE,
        entityType: 'Exam',
        entityId: 77,
        entityLabel: 'Đề sắp bị xóa'
      })
    })
  })
})
