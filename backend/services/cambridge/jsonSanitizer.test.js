import { describe, it, expect } from 'vitest'
const { cleanJsonRaw, repairTruncatedJson } = require('./jsonSanitizer')

describe('jsonSanitizer', () => {
  describe('cleanJsonRaw', () => {
    it('cleans markdown backticks and whitespace', () => {
      const raw = '```json\n{"key": "value"}\n```'
      expect(cleanJsonRaw(raw)).toBe('{"key": "value"}')
    })

    it('returns empty string for null or undefined input', () => {
      expect(cleanJsonRaw(null)).toBe('')
      expect(cleanJsonRaw(undefined)).toBe('')
    })
  })

  describe('repairTruncatedJson', () => {
    it('returns clean JSON as-is if finishReason is stop and JSON is complete', () => {
      const raw = '{"title": "Exam 1", "passages": []}'
      expect(repairTruncatedJson(raw, 'stop')).toBe('{"title": "Exam 1", "passages": []}')
    })

    it('repairs truncated JSON when finishReason is length and missing closing braces', () => {
      const truncated = '{"title": "Exam 1", "passages": [{"number": 1}'
      const repaired = repairTruncatedJson(truncated, 'length')
      expect(repaired).toBe('{"title": "Exam 1", "passages": [{"number": 1}]}')
      expect(() => JSON.parse(repaired)).not.toThrow()
    })

    it('removes trailing commas before repairing truncated JSON', () => {
      const truncated = '{"title": "Exam 1", "questions": ["Q1", "Q2",'
      const repaired = repairTruncatedJson(truncated, 'length')
      expect(repaired).toBe('{"title": "Exam 1", "questions": ["Q1", "Q2"]}')
      expect(() => JSON.parse(repaired)).not.toThrow()
    })
  })
})
