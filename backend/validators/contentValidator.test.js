import { describe, it, expect } from 'vitest'
const {
  createSampleSchema,
  createPracticeSchema,
  transcribeUploadSchema,
  bookCoverSchema,
  examSeriesSchema,
} = require('./contentValidator')

describe('contentValidator', () => {
  describe('createSampleSchema', () => {
    it('passes with valid sample payload and allows empty content for draft mode', () => {
      const valid = { title: 'Writing Task 2 Band 8.0', content: '', tags: ['Opinion', 'Education'] }
      const res = createSampleSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('fails when title is missing', () => {
      const invalid = { title: '', content: 'Sample essay' }
      const res = createSampleSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Thiếu tiêu đề')
    })

    // ─── TC-036: nested Speaking Part/Question graph ─────────────────────
    it('accepts nested speaking parts and normalises the `number` alias (TC-036)', () => {
      const res = createSampleSchema.safeParse({
        title: 'Speaking Sample',
        parts: [
          { number: 1, title: 'Part 1', questions: [{ questionText: 'Where are you from?' }] },
          { partNumber: 2, questions: [{ orderNum: 2, questionText: 'Describe a book.' }, { questionText: 'Why?' }] },
        ],
      })
      expect(res.success).toBe(true)
      expect(res.data.parts[0]).toMatchObject({ partNumber: 1 })
      expect(res.data.parts[1]).toMatchObject({ partNumber: 2 })
      expect(res.data.parts[1].questions).toHaveLength(2)
    })

    it('rejects duplicate part numbers (TC-036)', () => {
      const res = createSampleSchema.safeParse({
        title: 'Speaking Sample',
        parts: [
          { partNumber: 1, questions: [{ questionText: 'A' }] },
          { partNumber: 1, questions: [{ questionText: 'B' }] },
        ],
      })
      expect(res.success).toBe(false)
      expect(res.error.issues.some(i => /bị trùng/.test(i.message))).toBe(true)
    })

    it('rejects a part without partNumber/number and more than 10 parts (TC-036)', () => {
      expect(createSampleSchema.safeParse({
        title: 'Speaking Sample',
        parts: [{ questions: [{ questionText: 'A' }] }],
      }).success).toBe(false)

      expect(createSampleSchema.safeParse({
        title: 'Speaking Sample',
        parts: Array.from({ length: 11 }, (_, i) => ({ partNumber: i + 1, questions: [] })),
      }).success).toBe(false)
    })

    it('rejects empty question text inside a part (TC-036)', () => {
      const res = createSampleSchema.safeParse({
        title: 'Speaking Sample',
        parts: [{ partNumber: 1, questions: [{ questionText: '   ' }] }],
      })
      expect(res.success).toBe(false)
    })
  })

  describe('createPracticeSchema — MCQ duplicate-option guard', () => {
    const withGroup = (options) => ({
      title: 'Practice A',
      questions: [{ type: 'mcq_multi', qNumberStart: 1, qNumberEnd: 2, maxChoices: 2,
        questions: [{ number: 1, options, correctAnswer: '' }] }],
    })

    it('fails when a question has two identical option texts', () => {
      const res = createPracticeSchema.safeParse(withGroup(['x', 'x']))
      expect(res.success).toBe(false)
      expect(res.error.issues.some(i => /không được trùng nội dung/.test(i.message))).toBe(true)
    })

    it('passes with distinct options', () => {
      const res = createPracticeSchema.safeParse(withGroup(['x', 'y', 'z']))
      expect(res.success).toBe(true)
    })

    it('passes for non-MCQ groups', () => {
      const res = createPracticeSchema.safeParse({
        title: 'Practice B',
        questions: [{ type: 'matching', qNumberStart: 1, qNumberEnd: 3, questions: [] }],
      })
      expect(res.success).toBe(true)
    })

    it('rejects primitive question groups that are not strings or objects', () => {
      expect(createPracticeSchema.safeParse({ title: 'Practice C', questions: [42] }).success).toBe(false)
    })
  })

  describe('transcribeUploadSchema (Path Traversal Protection)', () => {
    it('passes with safe audioUrl path', () => {
      const valid = { audioUrl: '/uploads/audio-12345.mp3' }
      const res = transcribeUploadSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('blocks malicious relative audioUrl path containing ..', () => {
      const malicious = { audioUrl: '/uploads/../../etc/passwd' }
      const res = transcribeUploadSchema.safeParse(malicious)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('audioUrl không hợp lệ (phát hiện đường dẫn tương đối không an toàn)')
    })
  })

  describe('bookCoverSchema & examSeriesSchema', () => {
    it('coerces valid seriesId to number', () => {
      const valid = { seriesId: '5' }
      const res = bookCoverSchema.safeParse(valid)
      expect(res.success).toBe(true)
      expect(res.data.seriesId).toBe(5)
    })

    it('fails when examSeries name is empty', () => {
      const invalid = { name: '' }
      const res = examSeriesSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Tên bộ đề không được để trống')
    })
  })
})
