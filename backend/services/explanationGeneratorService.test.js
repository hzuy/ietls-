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

    it('throws error if questions are missing correctAnswer', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 2, title: 'Exam Without Answer', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 11,
          number: 5,
          type: 'mcq',
          correctAnswer: '',
        },
      ])

      await expect(generateForExam(2)).rejects.toThrow('chưa có đáp án đúng: Câu 5')
    })

    it('throws error if questions needing generation have no passage', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 3, title: 'Exam Without Passage', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 12,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          explanation: null,
          passage: null,
          group: null,
        },
      ])

      await expect(generateForExam(3)).rejects.toThrow('chưa có nội dung bài đọc (Passage) cho câu 1')
    })
  })

  describe('generateForPracticeExam', () => {
    it('throws error if reading practice exam has no passage', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValueOnce({
        id: 10,
        skill: 'reading',
        passage: '',
        questions: [],
      })
      await expect(generateForPracticeExam(10)).rejects.toThrow('chưa có nội dung đề bài (Passage)')
    })

    it('throws error if practice exam questions are missing correctAnswer', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValueOnce({
        id: 11,
        skill: 'reading',
        passage: 'Valid passage',
        questions: [
          {
            id: 101,
            content: JSON.stringify({
              type: 'true_false_ng',
              questions: [
                { number: 3, questionText: 'Statement 3', correctAnswer: '' },
              ],
            }),
          },
        ],
      })
      await expect(generateForPracticeExam(11)).rejects.toThrow('chưa có đáp án đúng: Câu 3')
    })
  })
})
