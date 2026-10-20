import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  attempt: { count: vi.fn() },
  practiceAttempt: { count: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// Mock generate-explanations
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

const { regenerateQuestionExplanation } = require('./explanationGeneratorService')

describe('PHẦN C (L2): Proposed Answer & Blind Solving Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('C.2: Proposed Answer Workflow (Exam)', () => {
    const mockQuestion = {
      id: 501,
      number: 5,
      type: 'mcq',
      questionText: 'Which gas is most abundant?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A', // Currently stored WRONG answer
      explanation: { status: 'ai_generated', answer: 'A' },
      passage: { body: 'Nitrogen makes up 78% of the atmosphere, oxygen 21%.', examId: 10 },
    }

    it('Step 1: When proposedAnswer differs from stored answer, runs blind solve (no answer/feedback leaked) and prompts confirmation if AI matches', async () => {
      prismaMock.question.findFirst.mockResolvedValue(mockQuestion)
      prismaMock.attempt.count.mockResolvedValue(42) // 42 attempts exist

      // Blind solve independently finds 'B' (Nitrogen)
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        evidence: { parts: [{ text: 'Nitrogen makes up 78% of the atmosphere.', paragraph: 1 }] },
        reasoning: 'The text states Nitrogen is 78%, which is the highest proportion.',
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
        isFallback: false,
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 5,
        isPractice: false,
        teacherFeedback: 'Check nitrogen vs oxygen percentages',
        proposedAnswer: 'B', // Teacher proposes 'B'
        confirmChangeAnswer: false,
      })

      // 1. Verify blind call received NO targetAnswer and NO teacherFeedback
      expect(generateExplanationMock).toHaveBeenCalledTimes(1)
      const [qCtx, family, ctx, options] = generateExplanationMock.mock.calls[0]
      expect(options.isFixedMode).toBe(false)
      expect(options.targetAnswer).toBeNull()
      expect(options.teacherFeedback).toBeNull()
      expect(options.forceProvider).toBe('Gemini')

      // 2. Verify requiresConfirmation is returned with attemptCount and AI evidence
      expect(res.ok).toBe(true)
      expect(res.requiresConfirmation).toBe(true)
      expect(res.proposedAnswer).toBe('B')
      expect(res.currentAnswer).toBe('A')
      expect(res.aiBlindAnswer).toBe('B')
      expect(res.attemptCount).toBe(42)
      expect(res.evidence).toContain('Nitrogen makes up 78%')

      // 3. Verify DB was NOT updated yet
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })

    it('Step 2: When confirmChangeAnswer is true, updates correctAnswer in DB and generates explanation in fixed mode with proposed answer', async () => {
      prismaMock.question.findFirst.mockResolvedValue(mockQuestion)
      prismaMock.question.update.mockResolvedValue({ id: 501, correctAnswer: 'B' })

      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        evidence: { parts: [{ text: 'Nitrogen makes up 78% of the atmosphere.', paragraph: 1 }] },
        reasoning: 'Nitrogen is 78%, which is the primary component.',
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
        no_support: false,
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 5,
        isPractice: false,
        teacherFeedback: 'Focus on 78% figure',
        proposedAnswer: 'B',
        confirmChangeAnswer: true,
      })

      // 1. Verify correctAnswer updated in DB
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 501 },
          data: { correctAnswer: 'B' },
        })
      )

      // 2. Verify generation in fixed mode with targetAnswer = 'B'
      const [qCtx, family, ctx, options] = generateExplanationMock.mock.calls[0]
      expect(options.isFixedMode).toBe(true)
      expect(options.targetAnswer).toBe('B')
      expect(options.teacherFeedback).toBe('Focus on 78% figure')

      // 3. Verify response
      expect(res.ok).toBe(true)
      expect(res.updatedCorrectAnswer).toBe('B')
      expect(res.status).toBe('teacher_reviewed')
      expect(res.explanation.teacher_note).toContain('Đã đổi đáp án chuẩn từ "A" sang "B"')
    })

    it('When AI blind solve does NOT match teacher proposedAnswer, rejects change and does not update DB', async () => {
      prismaMock.question.findFirst.mockResolvedValue(mockQuestion)

      // Teacher proposes 'D', but AI blind finds 'B'
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        evidence: { parts: [{ text: 'Nitrogen makes up 78% of the atmosphere.', paragraph: 1 }] },
        reasoning: 'The text clearly states Nitrogen is 78%.',
        provider: 'Gemini',
        isFallback: false,
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 5,
        isPractice: false,
        proposedAnswer: 'D',
        confirmChangeAnswer: false,
      })

      expect(res.ok).toBe(false)
      expect(res.conflict).toBe(true)
      expect(res.aiBlindAnswer).toBe('B')
      expect(res.proposedAnswer).toBe('D')
      expect(res.currentAnswer).toBe('A')
      expect(res.message).toContain('KHÔNG khớp với đáp án "D"')
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })

    it('Rejects using fallback (Groq) for answer change decisions (FALLBACK_NOT_ALLOWED)', async () => {
      prismaMock.question.findFirst.mockResolvedValue(mockQuestion)

      // Fallback Groq responded
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        isFallback: true,
        provider: 'Groq',
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 5,
        isPractice: false,
        proposedAnswer: 'B',
        confirmChangeAnswer: false,
      })

      expect(res.ok).toBe(false)
      expect(res.error).toBe('FALLBACK_NOT_ALLOWED')
      expect(res.message).toContain('không dùng AI dự phòng để quyết định đổi đáp án chuẩn')
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })
  })

  describe('C.3: Teacher Feedback Only Workflow', () => {
    const mockQuestion = {
      id: 502,
      number: 6,
      type: 'mcq',
      questionText: 'Q6',
      options: ['A', 'B'],
      correctAnswer: 'A', // Stored answer is A
      explanation: { status: 'ai_generated', answer: 'A' },
      passage: { body: 'Sample passage text', examId: 10 },
    }

    it('When teacher gives feedback and AI blind solve disagrees with stored answer, does NOT defend wrong answer and sets conflict_pending', async () => {
      prismaMock.question.findFirst.mockResolvedValue(mockQuestion)

      // AI blind finds 'B' (differs from stored 'A')
      generateExplanationMock.mockResolvedValueOnce({
        answer: 'B',
        evidence: { parts: [{ text: 'Passage shows B is true.', paragraph: 1 }] },
        reasoning: 'AI independent solve finds B.',
        provider: 'Gemini',
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 6,
        isPractice: false,
        teacherFeedback: 'Explain more clearly why A is correct', // Teacher tries to steer towards wrong A
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('conflict_pending')
      expect(res.isConflict).toBe(true)
      expect(res.explanation.aiAnswer).toBe('B')
      expect(res.explanation.teacher_note).toContain('AI chọn "B"')

      // Verify that explanation saved in DB is conflict_pending
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 502 },
          data: {
            explanation: expect.objectContaining({
              status: 'conflict_pending',
              aiAnswer: 'B',
            }),
          },
        })
      )
    })

    it('When question was already teacher_reviewed, trusts teacher answer and skips blind check', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        ...mockQuestion,
        explanation: { status: 'teacher_reviewed', answer: 'A' },
      })

      generateExplanationMock.mockResolvedValueOnce({
        answer: 'A',
        evidence: { parts: [{ text: 'Passage part.', paragraph: 1 }] },
        reasoning: 'Reasoning with feedback.',
        provider: 'Gemini',
      })

      const res = await regenerateQuestionExplanation({
        examId: 10,
        questionNumber: 6,
        isPractice: false,
        teacherFeedback: 'Make shorter',
      })

      expect(res.ok).toBe(true)
      // Only 1 call in fixedMode
      expect(generateExplanationMock).toHaveBeenCalledTimes(1)
      const options = generateExplanationMock.mock.calls[0][3]
      expect(options.isFixedMode).toBe(true)
      expect(options.targetAnswer).toBe('A')
      expect(options.teacherFeedback).toBe('Make shorter')
    })
  })

  describe('C.2: Proposed Answer Workflow (Practice)', () => {
    const mockPracticeExam = {
      id: 20,
      questions: [
        {
          id: 301,
          content: JSON.stringify({
            passage: 'Practice passage body about photosynthesis.',
            questions: [
              {
                number: 1,
                type: 'fill_blank',
                questionText: 'Plants need ___ to grow.',
                correctAnswer: 'water',
              },
            ],
          }),
          explanation: { byNumber: {} },
        },
      ],
    }

    it('Updates practice question group content in DB when confirmChangeAnswer is true', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValue(mockPracticeExam)
      prismaMock.practiceQuestion.findUnique.mockResolvedValue(mockPracticeExam.questions[0])
      prismaMock.practiceQuestion.update.mockResolvedValue({})

      generateExplanationMock.mockResolvedValueOnce({
        answer: 'sunlight',
        evidence: { parts: [{ text: 'Plants need sunlight to grow.', paragraph: 1 }] },
        reasoning: 'Sunlight is the required nutrient.',
        provider: 'Gemini',
      })

      const res = await regenerateQuestionExplanation({
        examId: 20,
        questionNumber: 1,
        isPractice: true,
        proposedAnswer: 'sunlight',
        confirmChangeAnswer: true,
      })

      expect(res.ok).toBe(true)
      expect(res.updatedCorrectAnswer).toBe('sunlight')
      expect(prismaMock.practiceQuestion.update).toHaveBeenCalled()
      const updateData = prismaMock.practiceQuestion.update.mock.calls[0][0].data
      expect(updateData.content).toContain('"correctAnswer":"sunlight"')
    })
  })
})
