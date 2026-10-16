import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const { isAnswerMatch, generateForExam, generateForPracticeExam } = require('./explanationGeneratorService')

describe('explanationGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isAnswerMatch', () => {
    it('matches exact strings', () => {
      expect(isAnswerMatch('True', 'True')).toBe(true)
      expect(isAnswerMatch('TRUE', 'true')).toBe(true)
    })

    it('matches trimmed and normalized strings', () => {
      expect(isAnswerMatch('  FALSE  ', 'false')).toBe(true)
      expect(isAnswerMatch('“timber”', 'timber')).toBe(true)
    })

    it('matches slash separated alternatives', () => {
      expect(isAnswerMatch('center/centre', 'centre')).toBe(true)
      expect(isAnswerMatch('theater | theatre', 'theater')).toBe(true)
    })

    it('returns false for mismatched answers', () => {
      expect(isAnswerMatch('True', 'False')).toBe(false)
      expect(isAnswerMatch('apple', 'banana')).toBe(false)
    })
  })

  describe('generateForExam', () => {
    it('throws error if exam not found', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce(null)
      await expect(generateForExam(999)).rejects.toThrow('Không tìm thấy đề thi #999')
    })

    it('skips questions that already have explanation when force is false', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 1, title: 'Cam 19 Test 1', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 10,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          explanation: { answer: 'A' },
        },
      ])

      const res = await generateForExam(1, { force: false })
      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(0)
      expect(res.hasConflicts).toBe(false)
    })
  })
})
