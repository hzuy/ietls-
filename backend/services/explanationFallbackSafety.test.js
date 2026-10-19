import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const generateExpModulePath = require.resolve('../scripts/generate-explanations')
const originalGenerateExpModule = require(generateExpModulePath)
const generateExplanationMock = vi.fn()

require.cache[generateExpModulePath] = {
  id: generateExpModulePath,
  filename: generateExpModulePath,
  loaded: true,
  exports: {
    ...originalGenerateExpModule,
    generateExplanation: generateExplanationMock,
  },
}

const {
  generateForExam,
  generateForPracticeExam,
  regenerateQuestionExplanation,
} = require('./explanationGeneratorService')

describe('PHẦN 1: AN TOÀN KHI DÙNG FALLBACK (GROQ)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Fallback + Khớp correctAnswer -> Lưu có metadata provider/model Groq, status ai_generated', () => {
    it('generateForExam: lưu explanation ai_generated với metadata Groq khi đáp án khớp', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 1, title: 'Exam 1', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage text' },
        },
      ])

      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        explanation: 'Groq explanation matching B',
        evidence: 'Passage text',
        isFallback: true,
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
      })

      const res = await generateForExam(1, { force: true })

      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(1)
      expect(res.hasConflicts).toBe(false)
      expect(res.needsRetryCount).toBe(0)
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      const savedExp = prismaMock.question.update.mock.calls[0][0].data.explanation
      expect(savedExp.status).toBe('ai_generated')
      expect(savedExp.provider).toBe('Groq')
      expect(savedExp.model).toBe('llama-3.3-70b-versatile')
    })
  })

  describe('2. Fallback + Lệch correctAnswer -> KHÔNG conflict_pending, thử lại Gemini, nếu fail thì không ghi đè và đánh dấu needs_regeneration / needsRetry', () => {
    it('generateForExam: fallback lệch và 2 lần retry Gemini đều fail -> không lưu đè, trả về needsRetryQuestions', async () => {
      const oldExplanation = {
        status: 'ai_generated',
        answer: 'B',
        explanation: 'Old valid explanation',
      }
      prismaMock.exam.findUnique.mockResolvedValue({ id: 2, title: 'Exam 2', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 201,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: oldExplanation,
          passage: { body: 'Passage text' },
        },
      ])

      // Lần đầu gọi: Groq fallback trả về A (lệch với correctAnswer B)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'A',
        explanation: 'Groq wrong answer',
        isFallback: true,
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
      })
      // Lần retry Gemini 1: lỗi
      generateExplanationMock.mockRejectedValueOnce(new Error('Gemini 429 quota exceeded'))
      // Lần retry Gemini 2: lỗi
      generateExplanationMock.mockRejectedValueOnce(new Error('Gemini 503 unavailable'))

      const res = await generateForExam(2, { force: true, timeBudgetMs: 40000 })

      expect(res.ok).toBe(true)
      // KHÔNG được tạo conflict_pending
      expect(res.hasConflicts).toBe(false)
      expect(res.conflicts).toBeUndefined()
      // Đưa vào needsRetry
      expect(res.needsRetryCount).toBe(1)
      expect(res.needsRetryQuestions.map(r => r.number)).toContain(1)
      // KHÔNG ghi đè vào DB
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })

    it('generateForPracticeExam: fallback lệch và Gemini fail -> không ghi đè, thêm vào needsRetryQuestions', async () => {
      const practiceExamData = {
        id: 3,
        skill: 'reading',
        passage: 'Sample passage text for practice',
        questions: [
          {
            id: 301,
            content: JSON.stringify({
              type: 'mcq',
              questions: [
                {
                  number: 1,
                  questionText: 'Question 1',
                  options: ['A. apple', 'B. banana', 'C. orange', 'D. pear'],
                  correctAnswer: 'B',
                  explanation: {
                    status: 'ai_generated',
                    answer: 'B',
                    explanation: 'Existing explanation',
                  },
                },
              ],
            }),
          },
        ],
      }
      prismaMock.practiceExam.findUnique.mockResolvedValue(practiceExamData)

      // Lần đầu Groq trả về C (lệch B)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'C',
        explanation: 'Groq wrong answer',
        isFallback: true,
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
      })
      // 2 lần retry Gemini đều trả về fallback hoặc lỗi
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'C',
        isFallback: true,
        provider: 'Groq',
      })
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'C',
        isFallback: true,
        provider: 'Groq',
      })

      const res = await generateForPracticeExam(3, { force: true, timeBudgetMs: 40000 })

      expect(res.ok).toBe(true)
      expect(res.hasConflicts).toBe(false)
      expect(res.needsRetryCount).toBe(1)
      expect(res.needsRetryQuestions.map(r => r.number)).toContain(1)
      // Không ghi đè câu hỏi trong practiceQuestion
      expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()
    })
  })

  describe('3. Gemini + Lệch correctAnswer -> conflict_pending như cũ', () => {
    it('generateForExam: Gemini thuần trả về lệch đáp án -> tạo conflict_pending kèm teacher_note đối chiếu', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 4, title: 'Exam 4', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 401,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage text' },
        },
      ])

      generateExplanationMock.mockResolvedValueOnce({
        answer: 'D',
        explanation: 'Gemini reasoning choosing D',
        evidence: 'Passage text',
        isFallback: false,
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      })

      const res = await generateForExam(4, { force: true })

      expect(res.ok).toBe(false)
      expect(res.hasConflicts).toBe(true)
      expect(res.conflicts.length).toBe(1)
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      const savedExp = prismaMock.question.update.mock.calls[0][0].data.explanation
      expect(savedExp.status).toBe('conflict_pending')
      expect(savedExp.aiAnswer).toBe('D')
      expect(savedExp.teacher_note).toContain('AI chọn "D"; đáp án đề đang là "B"')
    })
  })

  describe('4. Fallback ban đầu lệch nhưng thử lại Gemini thành công -> Dùng kết quả Gemini', () => {
    it('generateForExam: Groq lệch nhưng retry 1 bằng Gemini thuần khớp đáp án -> lưu kết quả Gemini', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 5, title: 'Exam 5', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 501,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: null,
          passage: { body: 'Passage text' },
        },
      ])

      // Lần đầu Groq trả về C (lệch)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'C',
        isFallback: true,
        provider: 'Groq',
      })
      // Retry 1: Gemini thuần trả về B (khớp)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        explanation: 'Gemini resolved accurately',
        evidence: 'Passage text',
        isFallback: false,
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      })

      const res = await generateForExam(5, { force: true, timeBudgetMs: 40000 })

      expect(res.ok).toBe(true)
      expect(res.hasConflicts).toBe(false)
      expect(res.generatedCount).toBe(1)
      expect(res.needsRetryCount).toBe(0)
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      const savedExp = prismaMock.question.update.mock.calls[0][0].data.explanation
      expect(savedExp.status).toBe('ai_generated')
      expect(savedExp.provider).toBe('Gemini')
      expect(savedExp.model).toBe('gemini-3.5-flash-lite')
    })

    it('regenerateQuestionExplanation (Exam): Groq lệch nhưng retry Gemini thành công -> nhận kết quả Gemini', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 601,
        number: 1,
        type: 'mcq',
        questionText: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        explanation: { status: 'needs_regeneration' },
        passage: { body: 'Passage text', examId: 6 },
      })

      // Lần đầu Groq trả về A (lệch)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'A',
        isFallback: true,
        provider: 'Groq',
      })
      // Retry Gemini: Gemini trả về B (khớp)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        explanation: 'Gemini recovered answer B',
        evidence: 'Passage text',
        isFallback: false,
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      })

      const res = await regenerateQuestionExplanation({
        examId: 6,
        questionNumber: 1,
        isPractice: false,
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('ai_generated')
      expect(res.isConflict).toBe(false)
      expect(res.explanation.provider).toBe('Gemini')
      expect(res.explanation.answer).toBe('B')
    })

    it('regenerateQuestionExplanation (Exam): Groq lệch và retry Gemini thất bại -> không ghi đè, trả về needsRetry', async () => {
      const originalOldExp = { status: 'ai_generated', answer: 'B', explanation: 'Old preserved' }
      prismaMock.question.findFirst.mockResolvedValue({
        id: 701,
        number: 1,
        type: 'mcq',
        questionText: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        explanation: originalOldExp,
        passage: { body: 'Passage text', examId: 7 },
      })

      // Lần đầu Groq trả về A (lệch)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'A',
        isFallback: true,
        provider: 'Groq',
      })
      // 2 lần retry Gemini đều fail
      generateExplanationMock.mockRejectedValueOnce(new Error('Rate limit'))
      generateExplanationMock.mockRejectedValueOnce(new Error('Rate limit'))

      const res = await regenerateQuestionExplanation({
        examId: 7,
        questionNumber: 1,
        isPractice: false,
      })

      expect(res.ok).toBe(false)
      expect(res.status).toBe('needs_regeneration')
      expect(res.isConflict).toBe(false)
      expect(res.needsRetry).toBe(true)
      expect(res.message).toContain('AI chính đang bận, kết quả dự phòng của câu #1 chưa đủ tin cậy')
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })
  })
})
