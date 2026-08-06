import { describe, it, expect } from 'vitest'
const {
  readingSubmitSchema,
  writingSubmitSchema,
  speakingSubmitSchema,
  attemptsQuerySchema,
} = require('./submissionValidator')

describe('submissionValidator', () => {
  describe('readingSubmitSchema', () => {
    it('passes when answers is a valid object', () => {
      const valid = { answers: { "1": "TRUE", "2": "FALSE" } }
      const res = readingSubmitSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('fails when answers is null or an array or string', () => {
      expect(readingSubmitSchema.safeParse({ answers: null }).success).toBe(false)
      expect(readingSubmitSchema.safeParse({ answers: ["TRUE"] }).success).toBe(false)
      expect(readingSubmitSchema.safeParse({ answers: "TRUE" }).success).toBe(false)
    })
  })

  describe('writingSubmitSchema', () => {
    it('passes with valid taskId and essay string', () => {
      const valid = { taskId: "12", essay: "This is my essay body..." }
      const res = writingSubmitSchema.safeParse(valid)
      expect(res.success).toBe(true)
      expect(res.data.taskId).toBe(12) // Coerced to number
    })

    it('fails when taskId is missing or invalid', () => {
      const invalid = { taskId: "abc", essay: "Essay body" }
      const res = writingSubmitSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })
  })

  describe('speakingSubmitSchema', () => {
    it('passes with valid partId and transcript', () => {
      const valid = { partId: 5, transcript: "I live in Hanoi..." }
      const res = speakingSubmitSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })
  })

  describe('attemptsQuerySchema', () => {
    it('passes with valid band scores [0.0 - 9.0]', () => {
      expect(attemptsQuerySchema.safeParse({ scoreMin: '5.5', scoreMax: '8.0' }).success).toBe(true)
      expect(attemptsQuerySchema.safeParse({ scoreMin: 0, scoreMax: 9 }).success).toBe(true)
    })

    it('fails when scoreMin or scoreMax is out of range or not a number', () => {
      expect(attemptsQuerySchema.safeParse({ scoreMin: '-1' }).success).toBe(false)
      expect(attemptsQuerySchema.safeParse({ scoreMax: '100' }).success).toBe(false)
      expect(attemptsQuerySchema.safeParse({ scoreMin: 'abc' }).success).toBe(false)
    })
  })
})
