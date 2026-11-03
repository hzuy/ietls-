import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const modelNames = ['practiceExam', 'writingSample', 'speakingSample', 'exam', 'examSeries', 'bookCover', 'writingTask', 'speakingPart', 'question', 'answerLog', 'attempt', 'writingAnswer', 'speakingAnswer']
let state
let failDeleteModel
let operations
const audit = vi.fn()
const invalidate = vi.fn()
const invalidateExamCaches = vi.fn()

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some(branch => matches(row, branch))
    const actual = row[key]
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in expected) return expected.in.includes(actual)
      if ('not' in expected && actual === expected.not) return false
      if ('lt' in expected && !(actual < expected.lt)) return false
      if ('gte' in expected && !(actual >= expected.gte)) return false
      if ('not' in expected || 'lt' in expected || 'gte' in expected) return true
      return actual && matches(actual, expected)
    }
    return actual === expected
  })
}

function clientFor(getState, transaction = false) {
  return Object.fromEntries(modelNames.map(model => [model, {
    findMany: vi.fn(async ({ where } = {}) => getState()[model].filter(row => matches(row, where))),
    findUnique: vi.fn(async ({ where }) => getState()[model].find(row => matches(row, where)) || null),
    count: vi.fn(async ({ where } = {}) => getState()[model].filter(row => matches(row, where)).length),
    update: vi.fn(async ({ where, data }) => {
      operations.push({ model, method: 'update', transaction })
      const row = getState()[model].find(row => matches(row, where))
      Object.assign(row, data)
      return row
    }),
    updateMany: vi.fn(async () => { throw new Error('Unexpected update in purge test') }),
    deleteMany: vi.fn(async ({ where }) => {
      operations.push({ model, method: 'deleteMany', transaction })
      if (failDeleteModel === model) throw new Error('Simulated database write failure')
      const db = getState()
      const removed = db[model].filter(row => matches(row, where))
      const ids = removed.map(row => row.id)
      if (model === 'exam') {
        const taskIds = db.writingTask.filter(row => ids.includes(row.examId)).map(row => row.id)
        const partIds = db.speakingPart.filter(row => ids.includes(row.examId)).map(row => row.id)
        const questionIds = db.question.filter(row => ids.includes(row.passage?.examId || row.listeningSection?.examId)).map(row => row.id)
        if (db.attempt.some(row => ids.includes(row.examId)) || db.writingAnswer.some(row => taskIds.includes(row.taskId)) || db.speakingAnswer.some(row => partIds.includes(row.partId)) || db.answerLog.some(row => questionIds.includes(row.questionId))) throw new Error('Restrict FK: exam history not removed')
        db.writingTask = db.writingTask.filter(row => !taskIds.includes(row.id))
        db.speakingPart = db.speakingPart.filter(row => !partIds.includes(row.id))
        db.question = db.question.filter(row => !questionIds.includes(row.id))
      }
      db[model] = db[model].filter(row => !ids.includes(row.id))
      return { count: removed.length }
    }),
  }]))
}

const prisma = clientFor(() => state)
prisma.$transaction = vi.fn(async callback => {
  const draft = structuredClone(state)
  const tx = clientFor(() => draft, true)
  const result = await callback(tx)
  state = draft
  return result
})
function mockModule(relative, exports) {
  const id = require.resolve(relative)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
mockModule('../../lib/prisma', prisma)
mockModule('../../middleware/auth', (req, res, next) => {
  req.user = { userId: 123, role: req.headers['x-test-role'] || 'admin' }
  next()
})
mockModule('../../lib/auditLog', { logAuditEvent: audit })
mockModule('../../lib/swrCache', { invalidate })
mockModule('../../utils/cache', { invalidateExamCaches })
const app = express()
app.use(express.json())
app.use('/api/admin', require('./trash'))
const { purgeTrash } = require('../../services/trashPurgeService')
const day = 86400000

function emptyState() {
  return Object.fromEntries(modelNames.map(name => [name, []]))
}
function seedGraph() {
  const deletedAt = new Date(Date.now() - 40 * day)
  state.examSeries.push({ id: 1, name: 'Series', deletedAt })
  state.bookCover.push({ id: 2, seriesId: 1, bookNumber: 1, deletedAt, series: { name: 'Series' } })
  state.exam.push({ id: 3, title: 'Exam', skill: 'reading', seriesId: 1, bookNumber: 1, deletedAt })
  state.writingTask.push({ id: 4, examId: 3 })
  state.speakingPart.push({ id: 5, examId: 3 })
  state.question.push({ id: 6, passage: { examId: 3 } })
  state.attempt.push({ id: 7, examId: 3 })
  state.answerLog.push({ id: 8, questionId: 6, attemptId: 7 })
  state.writingAnswer.push({ id: 9, taskId: 4 })
  state.speakingAnswer.push({ id: 10, partId: 5 })
  state.practiceExam.push({ id: 11, title: 'Practice', skill: 'reading', deletedAt })
  state.writingSample.push({ id: 12, title: 'Writing', deletedAt })
  state.speakingSample.push({ id: 13, title: 'Speaking', deletedAt })
}
const deleteRequest = (path, role = 'admin') => request(app).delete(`/api/admin${path}`).set('x-test-role', role)

beforeEach(() => {
  vi.clearAllMocks()
  state = emptyState()
  operations = []
  failDeleteModel = null
  seedGraph()
  audit.mockResolvedValue(undefined)
  prisma.$transaction.mockImplementation(async callback => {
    const draft = structuredClone(state)
    const result = await callback(clientFor(() => draft, true))
    state = draft
    return result
  })
})

describe('trash purge safety', () => {
  it.each(['teacher', 'admin'])('GET /trash as %s is read-only even with expired data', async role => {
    const before = structuredClone(state)
    const response = await request(app).get('/api/admin/trash').set('x-test-role', role)
    expect(response.status).toBe(200)
    expect(response.body.items.length).toBeGreaterThan(0)
    expect(state).toEqual(before)
    expect(operations).toEqual([])
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it.each(['teacher', 'user'])('rejects every permanent purge route for %s', async role => {
    for (const path of ['/trash/purge', '/trash/purge-expired', '/trash/exam_series/1/permanent']) {
      expect((await deleteRequest(path, role)).status).toBe(403)
    }
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(operations).toEqual([])
  })

  it.each([
    ['/trash/exam_series/1/permanent', 'exam'], ['/trash/purge', 'exam'], ['/trash/purge-expired', 'exam'],
    ['/trash/exam_series/1/permanent', 'bookCover'], ['/trash/purge', 'bookCover'], ['/trash/purge-expired', 'bookCover'],
    ['/trash/book/2/permanent', 'exam'],
  ])('blocks %s before writes when a %s child is active', async (path, model) => {
    state[model][0].deletedAt = null
    const before = structuredClone(state)
    const response = await deleteRequest(path)
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('TRASH_HAS_ACTIVE_CHILDREN')
    expect(operations).toEqual([])
    expect(state).toEqual(before)
    expect(audit).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('does not expire a series while a newer trashed child is still within retention', async () => {
    state.exam[0].deletedAt = new Date(Date.now() - 5 * day)
    const response = await deleteRequest('/trash/purge-expired')
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('TRASH_CHILD_RETENTION_PENDING')
    expect(operations).toEqual([])
  })

  it.each(['/trash/purge', '/trash/purge-expired'])('rolls back the whole graph when a later write fails in %s', async path => {
    const before = structuredClone(state)
    failDeleteModel = 'speakingSample'
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await deleteRequest(path)
      expect(response.status).toBe(500)
      expect(operations.some(op => op.model === 'exam')).toBe(true)
      expect(operations.every(op => op.transaction)).toBe(true)
      expect(state).toEqual(before)
      expect(audit).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
      expect(invalidateExamCaches).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })

  it('purges selected exams and history plus the rest of the trash atomically before audit/cache updates', async () => {
    const response = await deleteRequest('/trash/purge')
    expect(response.status).toBe(200)
    expect(Object.values(state).every(rows => rows.length === 0)).toBe(true)
    expect(operations.every(op => op.transaction)).toBe(true)
    expect(operations.findIndex(op => op.model === 'answerLog')).toBeLessThan(operations.findIndex(op => op.model === 'exam'))
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'Serializable' })
    expect(response.body.counts).toEqual({ practiceExam: 1, writingSample: 1, speakingSample: 1, exam: 1, examSeries: 1, bookCover: 1 })
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'trash.purge_all', metadata: response.body.counts }))
    expect(invalidateExamCaches).toHaveBeenCalledOnce()
  })

  it('purges one trashed series and its trashed descendant graph without touching unrelated samples', async () => {
    const response = await deleteRequest('/trash/exam_series/1/permanent')
    expect(response.status).toBe(200)
    for (const model of ['examSeries', 'bookCover', 'exam', 'attempt', 'answerLog', 'writingAnswer', 'speakingAnswer']) expect(state[model]).toEqual([])
    expect(state.writingSample).toHaveLength(1)
    expect(state.practiceExam).toHaveLength(1)
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'trash.purge_one', entityType: 'ExamSeries', entityId: 1, entityLabel: 'Series' }))
  })

  it('keeps exact-boundary and newer items when explicitly purging expired items', async () => {
    state = emptyState()
    const now = new Date('2026-11-03T00:00:00Z')
    state.writingSample.push(
      { id: 1, title: 'Expired', deletedAt: new Date(now - 40 * day) },
      { id: 2, title: 'Boundary', deletedAt: new Date(now - 30 * day) },
      { id: 3, title: 'Recent', deletedAt: new Date(now - 5 * day) },
    )
    const result = await purgeTrash({ expiredOnly: true, now })
    expect(result.counts.writingSample).toBe(1)
    expect(state.writingSample.map(row => row.id)).toEqual([2, 3])
  })

  it('records an explicit admin retention action after successful deletion', async () => {
    const response = await deleteRequest('/trash/purge-expired')
    expect(response.status).toBe(200)
    expect(Object.values(state).every(rows => rows.length === 0)).toBe(true)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ user: { userId: 123, role: 'admin' } }), expect.objectContaining({ action: 'trash.auto_purge', metadata: expect.objectContaining({ trigger: 'admin', retentionDays: 30 }) }))
  })

  it.each([
    ['/trash/writing_sample/999/permanent', 404], ['/trash/unknown/1/permanent', 400],
    ['/trash/exam_reading/3abc/permanent', 400], ['/trash/exam_reading/0/permanent', 400],
    ['/trash/listening_practice/11/permanent', 404],
  ])('rejects invalid/missing targets %s without writes', async (path, status) => {
    expect((await deleteRequest(path)).status).toBe(status)
    expect(operations).toEqual([])
    expect(audit).not.toHaveBeenCalled()
  })

  it('does not permanently delete active targets', async () => {
    state.writingSample[0].deletedAt = null
    expect((await deleteRequest('/trash/writing_sample/12/permanent')).status).toBe(409)
    expect(operations).toEqual([])
  })

  it('returns a retryable conflict for serialization failures without audit/cache changes', async () => {
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('Concurrent change'), { code: 'P2034' }))
    const response = await deleteRequest('/trash/purge')
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('TRASH_PURGE_CONFLICT')
    expect(audit).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })
})
