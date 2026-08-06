import { describe, it, expect } from 'vitest'
const {
  createSeriesSchema,
  createSampleSchema,
  transcribeUploadSchema,
  bookCoverSchema,
  examSeriesSchema,
} = require('./contentValidator')

describe('contentValidator', () => {
  describe('createSeriesSchema', () => {
    it('passes with valid name and empty exams array', () => {
      const valid = { name: 'IELTS Cambridge 19', description: 'Sample series', type: 'academic', exams: [] }
      const res = createSeriesSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('fails when series name is empty', () => {
      const invalid = { name: '', description: '' }
      const res = createSeriesSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Thiếu tên bộ đề')
    })
  })

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
