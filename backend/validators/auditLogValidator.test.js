import { describe, it, expect } from 'vitest'
const { auditLogsQuerySchema } = require('./auditLogValidator')

describe('auditLogValidator', () => {
  describe('auditLogsQuerySchema', () => {
    it('applies defaults when no filter is given', () => {
      const res = auditLogsQuerySchema.safeParse({})
      expect(res.success).toBe(true)
      expect(res.data).toMatchObject({ page: 1, limit: 20 })
      expect(res.data.actorUserId).toBeUndefined()
      expect(res.data.action).toBeUndefined()
    })

    it('treats empty-string filters (frontend cleared inputs) as absent', () => {
      const res = auditLogsQuerySchema.safeParse({
        actorUserId: '', action: '', entityType: '', entityId: '', from: '', to: '', search: ''
      })
      expect(res.success).toBe(true)
      expect(res.data.actorUserId).toBeUndefined()
      expect(res.data.action).toBeUndefined()
      expect(res.data.entityType).toBeUndefined()
      expect(res.data.entityId).toBeUndefined()
      expect(res.data.from).toBeUndefined()
      expect(res.data.to).toBeUndefined()
      expect(res.data.search).toBeUndefined()
    })

    it('coerces entityId to a positive int when entityType is also given', () => {
      const res = auditLogsQuerySchema.safeParse({ entityType: 'Exam', entityId: '42' })
      expect(res.success).toBe(true)
      expect(res.data.entityId).toBe(42)

      expect(auditLogsQuerySchema.safeParse({ entityType: 'Exam', entityId: '-1' }).success).toBe(false)
      expect(auditLogsQuerySchema.safeParse({ entityType: 'Exam', entityId: 'abc' }).success).toBe(false)
    })

    it('rejects entityId without entityType — id alone cannot identify an object', () => {
      const res = auditLogsQuerySchema.safeParse({ entityId: '5' })
      expect(res.success).toBe(false)
      expect(res.error.issues[0].path).toEqual(['entityType'])
    })

    it('coerces actorUserId to a positive int', () => {
      expect(auditLogsQuerySchema.safeParse({ actorUserId: '5' }).data.actorUserId).toBe(5)
      expect(auditLogsQuerySchema.safeParse({ actorUserId: '-1' }).success).toBe(false)
      expect(auditLogsQuerySchema.safeParse({ actorUserId: 'abc' }).success).toBe(false)
    })

    it('accepts action as a repeated query param (array) with known values', () => {
      const res = auditLogsQuerySchema.safeParse({ action: ['exam.create', 'exam.update'] })
      expect(res.success).toBe(true)
      expect(res.data.action).toEqual(['exam.create', 'exam.update'])
    })

    it('accepts action as a comma-separated string', () => {
      const res = auditLogsQuerySchema.safeParse({ action: 'exam.create,exam.update' })
      expect(res.success).toBe(true)
      expect(res.data.action).toEqual(['exam.create', 'exam.update'])
    })

    it('rejects an action value that is not in AUDIT_ACTIONS', () => {
      const res = auditLogsQuerySchema.safeParse({ action: 'not.a.real.action' })
      expect(res.success).toBe(false)
    })

    it('rejects a from/to that is not YYYY-MM-DD', () => {
      expect(auditLogsQuerySchema.safeParse({ from: '2026-1-1' }).success).toBe(false)
      expect(auditLogsQuerySchema.safeParse({ to: '01/09/2026' }).success).toBe(false)
      expect(auditLogsQuerySchema.safeParse({ from: '2026-09-01' }).success).toBe(true)
    })

    it('rejects limit above the max and non-positive page', () => {
      expect(auditLogsQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
      expect(auditLogsQuerySchema.safeParse({ limit: '100' }).success).toBe(true)
      expect(auditLogsQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    })

    it('trims and accepts a free-text entityType/search', () => {
      const res = auditLogsQuerySchema.safeParse({ entityType: '  Exam  ', search: '  hello  ' })
      expect(res.success).toBe(true)
      expect(res.data.entityType).toBe('Exam')
      expect(res.data.search).toBe('hello')
    })
  })
})
