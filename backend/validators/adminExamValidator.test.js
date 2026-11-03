import { describe, it, expect } from 'vitest'
const {
  createReadingExamSchema,
  createListeningExamSchema,
  createWritingExamSchema,
} = require('./adminExamValidator')

describe('adminExamValidator', () => {
  describe('Option A Verification: Empty Exam Frames MUST PASS', () => {
    it('passes when passages is an empty array passages: []', () => {
      const emptyFrame = {
        title: 'Cambridge 19 Reading Draft',
        passages: []
      }
      const res = createReadingExamSchema.safeParse(emptyFrame)
      expect(res.success).toBe(true)
    })

    it('passes when passages contain empty title, empty body, and empty questionGroups', () => {
      const emptyPassages = {
        title: 'Draft Reading Exam',
        passages: [
          { number: 1, title: '', body: '', questionGroups: [] },
          { number: 2, title: '', body: '', questionGroups: [] },
          { number: 3, title: '', body: '', questionGroups: [] }
        ]
      }
      const res = createReadingExamSchema.safeParse(emptyPassages)
      expect(res.success).toBe(true)
    })

    it('passes when sections is an empty array sections: [] in Listening', () => {
      const emptyListening = {
        title: 'Listening Draft',
        sections: []
      }
      const res = createListeningExamSchema.safeParse(emptyListening)
      expect(res.success).toBe(true)
    })
  })

  describe('Validation Enforcement: Invalid Data Types MUST FAIL', () => {
    it('fails when title is missing or empty', () => {
      const invalid = { title: '', passages: [] }
      const res = createReadingExamSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Tên đề thi không được để trống')
    })

    it('fails when passages is a string instead of an array', () => {
      const invalid = { title: 'Test Reading', passages: 'invalid-string' }
      const res = createReadingExamSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })

    it('fails when questionGroup has invalid type literal', () => {
      const invalid = {
        title: 'Test Exam',
        passages: [
          { number: 1, questionGroups: [{ qNumberStart: 1, qNumberEnd: 5, type: 'unknown_type' }] }
        ]
      }
      const res = createReadingExamSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })
  })

  describe('MCQ duplicate-option guard', () => {
    const withMcq = (options) => ({
      title: 'Test Exam',
      passages: [{
        number: 1,
        questionGroups: [{
          qNumberStart: 1, qNumberEnd: 2, type: 'mcq_multi', maxChoices: 2,
          questions: [{ number: 1, questionText: 'Q', options, correctAnswer: '' }],
        }],
      }],
    })

    it('fails when two options in one question have identical text', () => {
      const res = createReadingExamSchema.safeParse(withMcq(['a', 'a', 'b']))
      expect(res.success).toBe(false)
      expect(res.error.issues.some(i => /không được trùng nội dung/.test(i.message))).toBe(true)
    })

    it('fails on duplicates that differ only by surrounding whitespace', () => {
      const res = createReadingExamSchema.safeParse(withMcq(['cat', ' cat ', 'dog']))
      expect(res.success).toBe(false)
    })

    it('passes when all options are distinct', () => {
      const res = createReadingExamSchema.safeParse(withMcq(['a', 'b', 'c', 'd']))
      expect(res.success).toBe(true)
    })

    it('ignores blank options (multiple empties are not "duplicates")', () => {
      const res = createReadingExamSchema.safeParse(withMcq(['a', 'b', '', '']))
      expect(res.success).toBe(true)
    })
  })

  describe('numeric ranges and answer domains', () => {
    const groupPayload = (group) => ({ title: 'Validation sample', passages: [{ number: 1, questionGroups: [group] }] })

    it('rejects reversed and fractional question ranges', () => {
      expect(createReadingExamSchema.safeParse(groupPayload({ qNumberStart: 4, qNumberEnd: 2, type: 'short_answer', questions: [] })).success).toBe(false)
      expect(createReadingExamSchema.safeParse(groupPayload({ qNumberStart: 1.5, qNumberEnd: 2, type: 'short_answer', questions: [] })).success).toBe(false)
    })

    it('rejects out-of-range, duplicate question numbers and invalid TFNG answers', () => {
      const result = createReadingExamSchema.safeParse(groupPayload({
        qNumberStart: 1, qNumberEnd: 2, type: 'true_false_ng',
        questions: [
          { number: 1, correctAnswer: 'TRUE' },
          { number: 1, correctAnswer: 'MAYBE' },
          { number: 3, correctAnswer: 'FALSE' },
        ],
      }))
      expect(result.success).toBe(false)
      expect(result.error.issues.some(issue => issue.path.includes('correctAnswer'))).toBe(true)
      expect(result.error.issues.filter(issue => issue.path.at(-1) === 'number').length).toBeGreaterThan(0)
    })

    it('rejects fractional full-test metadata', () => {
      expect(createReadingExamSchema.safeParse({ title: 'Draft', passages: [], bookNumber: 1.5 }).success).toBe(false)
      expect(createReadingExamSchema.safeParse({ title: 'Draft', passages: [], seriesId: -2 }).success).toBe(false)
    })
  })
})
