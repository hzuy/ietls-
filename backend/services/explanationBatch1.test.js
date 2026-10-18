import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
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

const {
  isExplanationVisibleToLearner,
  filterLearnerExplanation,
  validateManualExplanation,
  generateForExam,
  generateForPracticeExam,
  regenerateQuestionExplanation,
  updateManualExplanation,
  reviewQuestionExplanation,
  updatePracticeQuestionExplanationTx,
} = require('./explanationGeneratorService')

describe('Batch 1 Explanation Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 3.1 & 3.2 LEARNER FILTERING & BACKWARD COMPATIBILITY ─────────────────
  describe('Learner Explanation Filtering (3.1 & 3.2)', () => {
    it('allows ai_generated, teacher_reviewed, and teacher_edited', () => {
      expect(isExplanationVisibleToLearner({ status: 'ai_generated', answer: 'A' })).toBe(true)
      expect(isExplanationVisibleToLearner({ status: 'teacher_reviewed', answer: 'A' })).toBe(true)
      expect(isExplanationVisibleToLearner({ status: 'teacher_edited', answer: 'A' })).toBe(true)
    })

    it('hides conflict_pending, needs_regeneration, and possibly_stale from learners', () => {
      expect(isExplanationVisibleToLearner({ status: 'conflict_pending', answer: 'A' })).toBe(false)
      expect(isExplanationVisibleToLearner({ status: 'needs_regeneration', answer: 'A' })).toBe(false)
      expect(isExplanationVisibleToLearner({ status: 'possibly_stale', answer: 'A' })).toBe(false)
    })

    it('maintains backward compatibility with legacy explanations without status (3.2)', () => {
      const legacyExp = { v: 2, answer: 'TRUE', predict: 'prediction text' }
      expect(isExplanationVisibleToLearner(legacyExp)).toBe(true)
      expect(filterLearnerExplanation(legacyExp)).toEqual(legacyExp)
    })

    it('filterLearnerExplanation returns null for unapproved explanations', () => {
      expect(filterLearnerExplanation({ status: 'conflict_pending' })).toBeNull()
      expect(filterLearnerExplanation({ status: 'needs_regeneration' })).toBeNull()
      expect(filterLearnerExplanation({ status: 'possibly_stale' })).toBeNull()
      expect(filterLearnerExplanation(null)).toBeNull()
    })
  })

  // ─── 4.1 PARTIAL SAVE & RESOLVE CHOICES (3.3 & 3.4) ─────────────────────────
  describe('Partial Save & Conflict Handling (4.1, 3.3, 3.4)', () => {
    const dummyExam = { id: 10, title: 'Test Exam', skill: 'reading' }

    it('saves both matching (ai_generated) and conflicting (conflict_pending) questions to DB before returning (4.1)', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(dummyExam)
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 101,
          number: 1,
          type: 'mcq',
          questionText: 'Q1',
          correctAnswer: 'patients',
          passage: { body: 'sample text' },
          options: JSON.stringify(['peers', 'patients']),
        },
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          correctAnswer: 'students',
          passage: { body: 'sample text' },
          options: JSON.stringify(['students', 'teachers']),
        },
      ])

      // Q1 AI answer matches 'patients'
      // Q2 AI answer conflicts: 'teachers' vs 'students'
      generateExplanationMock
        .mockResolvedValueOnce({
          v: 2,
          answer: 'patients',
          reasoning: 'Matches passage',
        })
        .mockResolvedValueOnce({
          v: 2,
          answer: 'teachers',
          reasoning: 'AI thinks teachers',
        })

      const res = await generateForExam(10, { force: true })

      expect(res.ok).toBe(false)
      expect(res.hasConflicts).toBe(true)
      expect(res.conflicts).toHaveLength(1)
      expect(res.conflicts[0].number).toBe(2)

      // Transaction must have executed to save both questions
      expect(prismaMock.question.update).toHaveBeenCalledTimes(2)

      // Q1 saved with ai_generated
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 101 },
          data: expect.objectContaining({
            explanation: expect.objectContaining({ status: 'ai_generated' }),
          }),
        })
      )

      // Q2 saved with conflict_pending and aiAnswer stored
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            correctAnswer: 'students',
            explanation: expect.objectContaining({
              status: 'conflict_pending',
              aiAnswer: 'teachers',
            }),
          }),
        })
      )
    })

    it('when teacher chooses ai (3.4), updates correctAnswer and sets status ai_generated', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(dummyExam)
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          correctAnswer: 'students',
          passage: { body: 'sample text' },
          options: JSON.stringify(['students', 'teachers']),
        },
      ])

      generateExplanationMock.mockResolvedValueOnce({
        v: 2,
        answer: 'teachers',
        reasoning: 'AI reasoning',
      })

      const res = await generateForExam(10, { force: true, resolveChoices: { 2: 'ai' } })
      expect(res.ok).toBe(true)
      expect(res.hasConflicts).toBe(false)

      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            correctAnswer: 'teachers',
            explanation: expect.objectContaining({
              status: 'ai_generated',
              answer: 'teachers',
            }),
          }),
        })
      )
    })

    it('when teacher chooses input (3.3), keeps teacher answer and sets status needs_regeneration', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(dummyExam)
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 102,
          number: 2,
          type: 'mcq',
          questionText: 'Q2',
          correctAnswer: 'students',
          passage: { body: 'sample text' },
          options: JSON.stringify(['students', 'teachers']),
        },
      ])

      generateExplanationMock.mockResolvedValueOnce({
        v: 2,
        answer: 'teachers',
        reasoning: 'AI reasoning',
      })

      const res = await generateForExam(10, { force: true, resolveChoices: { 2: 'input' } })
      expect(res.ok).toBe(true)

      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({
            correctAnswer: 'students',
            explanation: expect.objectContaining({
              status: 'needs_regeneration',
              teacherKeptAnswer: 'students',
            }),
          }),
        })
      )
    })
  })

  // ─── 3.10 OVERWRITE PROTECTION WITH FORCE ─────────────────────────────────
  describe('Overwrite Protection when force: true (3.10)', () => {
    it('skips questions with teacher_reviewed and teacher_edited when overwriteProtected is false', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 1, title: 'Exam', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 1,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          passage: { body: 'text' },
          explanation: { status: 'teacher_reviewed', v: 2, answer: 'A' },
        },
        {
          id: 2,
          number: 2,
          type: 'mcq',
          correctAnswer: 'B',
          passage: { body: 'text' },
          explanation: { status: 'teacher_edited', v: 2, answer: 'B' },
        },
        {
          id: 3,
          number: 3,
          type: 'mcq',
          correctAnswer: 'C',
          passage: { body: 'text' },
          explanation: { status: 'ai_generated', v: 2, answer: 'C' },
        },
      ])

      generateExplanationMock.mockResolvedValue({ v: 2, answer: 'C' })

      await generateForExam(1, { force: true, overwriteProtected: false })

      // Only question 3 should be regenerated
      expect(generateExplanationMock).toHaveBeenCalledTimes(1)
      expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 } })
      )
    })

    it('overwrites teacher_reviewed when overwriteProtected is true', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({ id: 1, title: 'Exam', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValue([
        {
          id: 1,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          passage: { body: 'text' },
          explanation: { status: 'teacher_reviewed', v: 2, answer: 'A' },
        },
      ])

      generateExplanationMock.mockResolvedValue({ v: 2, answer: 'A' })

      await generateForExam(1, { force: true, overwriteProtected: true })

      expect(generateExplanationMock).toHaveBeenCalledTimes(1)
      expect(prismaMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } })
      )
    })
  })

  // ─── 3.7 & 4.4 SAFE MANUAL EDIT ───────────────────────────────────────────
  describe('Safe Manual Edit (3.7 & 4.4)', () => {
    it('validates lengths and types of editable fields', () => {
      expect(() => validateManualExplanation({ reasoning: 'x'.repeat(2001) })).toThrow(/2000/)
      expect(() => validateManualExplanation({ predict: 'x'.repeat(1001) })).toThrow(/1000/)
      expect(() => validateManualExplanation({ translation: 'x'.repeat(1001) })).toThrow(/1000/)
      expect(() => validateManualExplanation({ full_sentence: 'x'.repeat(1001) })).toThrow(/1000/)
      expect(() => validateManualExplanation({ distractors: Array(11).fill({ option: 'A', reason: 'R' }) })).toThrow(/10/)
    })

    it('strips/ignores evidence and answer if provided in payload (3.7)', () => {
      const cleaned = validateManualExplanation({
        reasoning: 'Valid reasoning',
        evidence: 'Malicious evidence overwrite',
        answer: 'Changed Answer',
      })
      expect(cleaned.reasoning).toBe('Valid reasoning')
      expect(cleaned.evidence).toBeUndefined()
      expect(cleaned.answer).toBeUndefined()
    })

    it('updates question with status teacher_edited and manualEdit: true', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 50,
        number: 5,
        correctAnswer: 'TRUE',
        explanation: { v: 2, answer: 'TRUE', reasoning: 'Old' },
      })
      prismaMock.question.update.mockResolvedValue({})

      const res = await updateManualExplanation({
        examId: 1,
        questionId: 50,
        isPractice: false,
        fields: { reasoning: 'New reasoning by teacher' },
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('teacher_edited')
      expect(res.explanation.status).toBe('teacher_edited')
      expect(res.explanation.manualEdit).toBe(true)
      expect(res.explanation.reasoning).toBe('New reasoning by teacher')
      expect(res.explanation.updatedAt).toBeDefined()
    })
  })

  // ─── 3.5 & 4.5 TEACHER REVIEW ACTION ──────────────────────────────────────
  describe('Teacher Review Action (3.5 & 4.5 & B.4)', () => {
    it('sets status to teacher_reviewed when answer matches correctAnswer', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 70,
        number: 7,
        type: 'mcq',
        correctAnswer: 'B',
        options: JSON.stringify(['A', 'B']),
        explanation: { v: 2, answer: 'B', status: 'ai_generated' },
      })
      prismaMock.question.update.mockResolvedValue({})

      const res = await reviewQuestionExplanation({
        examId: 2,
        questionId: 70,
        isPractice: false,
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('teacher_reviewed')
      expect(res.explanation.status).toBe('teacher_reviewed')
      expect(res.explanation.reviewedAt).toBeDefined()
    })

    it('blocks review if explanation answer does not match question correctAnswer for Exam', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 70,
        number: 7,
        type: 'mcq',
        correctAnswer: 'A',
        options: JSON.stringify(['A', 'B']),
        explanation: { v: 2, answer: 'B', status: 'conflict_pending' },
      })

      await expect(
        reviewQuestionExplanation({ examId: 2, questionId: 70, isPractice: false })
      ).rejects.toThrow(/Không thể duyệt lời giải vì đáp án trong lời giải \("B"\) không khớp với đáp án đúng của câu hỏi \("A"\)/)
    })

    it('blocks review if explanation answer does not match question correctAnswer for Practice', async () => {
      const practiceRow = {
        id: 10,
        content: JSON.stringify({
          type: 'mcq',
          questions: [{ number: 1, correctAnswer: 'TRUE' }],
        }),
        explanation: {
          byNumber: {
            1: { v: 2, answer: 'FALSE', status: 'conflict_pending' },
          },
        },
      }
      prismaMock.practiceExam.findUnique.mockResolvedValue({
        id: 5,
        questions: [practiceRow],
      })
      prismaMock.practiceQuestion.findUnique.mockResolvedValue(practiceRow)

      await expect(
        reviewQuestionExplanation({ examId: 5, questionNumber: 1, isPractice: true })
      ).rejects.toThrow(/Không thể duyệt lời giải vì đáp án trong lời giải \("FALSE"\) không khớp với đáp án đúng của câu hỏi \("TRUE"\)/)
    })

    it('allows review when answers match with trailing punctuation (Batch 1)', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 72,
        number: 1,
        type: 'mcq',
        correctAnswer: 'students.',
        options: JSON.stringify(['A. peers', 'B. patients', 'C. students']),
        explanation: { v: 2, answer: 'C. students', status: 'ai_generated' },
      })
      prismaMock.question.update.mockResolvedValue({})

      const res = await reviewQuestionExplanation({
        examId: 2,
        questionId: 72,
        isPractice: false,
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('teacher_reviewed')
    })

    it('throws error if question has no explanation to review', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 71,
        number: 8,
        explanation: null,
      })

      await expect(
        reviewQuestionExplanation({ examId: 2, questionId: 71, isPractice: false })
      ).rejects.toThrow(/chưa có lời giải/)
    })
  })

  // ─── 3.9 & 4.3 REGENERATE WITH TEACHER FEEDBACK & VERIFICATION FAILURE ───
  describe('Regenerate with Teacher Feedback (3.9 & 4.3)', () => {
    it('records teacherFeedback and maintains feedbackHistory up to 5 entries', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 80,
        number: 9,
        type: 'mcq',
        correctAnswer: 'A',
        options: JSON.stringify(['A', 'B']),
        passage: { body: 'text' },
        explanation: {
          v: 2,
          answer: 'A',
          status: 'ai_generated',
          feedbackHistory: [
            { at: '2026-10-10T00:00:00Z', feedback: 'FB 1' },
            { at: '2026-10-11T00:00:00Z', feedback: 'FB 2' },
          ],
        },
      })

      generateExplanationMock.mockResolvedValue({
        v: 2,
        answer: 'A',
        reasoning: 'New AI reasoning',
        provider: 'Gemini',
        model: 'gemini-3.5-flash-lite',
      })

      const res = await regenerateQuestionExplanation({
        examId: 3,
        questionId: 80,
        isPractice: false,
        teacherFeedback: 'Clarify paragraph 2',
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('ai_generated')
      expect(res.explanation.teacherFeedback).toBe('Clarify paragraph 2')
      expect(res.explanation.feedbackHistory).toHaveLength(3)
      expect(res.explanation.feedbackHistory[0].feedback).toBe('Clarify paragraph 2')
    })

    it('sets conflict_pending if AI answer differs from correctAnswer after regenerate (3.9)', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 81,
        number: 10,
        type: 'mcq',
        correctAnswer: 'A',
        options: JSON.stringify(['A', 'B']),
        passage: { body: 'text' },
        explanation: { v: 2, answer: 'A' },
      })

      generateExplanationMock.mockResolvedValue({
        v: 2,
        answer: 'B', // Differs from 'A'
        reasoning: 'AI thinks B',
      })

      const res = await regenerateQuestionExplanation({
        examId: 3,
        questionId: 81,
        isPractice: false,
        teacherFeedback: 'Focus on line 3',
      })

      expect(res.ok).toBe(true)
      expect(res.status).toBe('conflict_pending')
      expect(res.isConflict).toBe(true)
      expect(res.explanation.aiAnswer).toBe('B')
    })

    it('returns error and does NOT save if evidence verification fails (3.9)', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 82,
        number: 11,
        type: 'mcq',
        correctAnswer: 'A',
        passage: { body: 'text' },
      })

      const { ExplanationValidationError } = require('../scripts/generate-explanations')
      generateExplanationMock.mockRejectedValue(
        new ExplanationValidationError('"evidence_quote" không có nguyên văn trong bài')
      )

      const res = await regenerateQuestionExplanation({
        examId: 3,
        questionId: 82,
        isPractice: false,
        teacherFeedback: 'Please check quotes',
      })

      expect(res.ok).toBe(false)
      expect(res.error).toBe('EVIDENCE_NOT_FOUND')
      expect(prismaMock.question.update).not.toHaveBeenCalled()
    })
  })

  // ─── 3.6 CONCURRENCY SAFE FOR PRACTICE ────────────────────────────────────
  describe('Concurrency Safe for Practice (3.6)', () => {
    it('updatePracticeQuestionExplanationTx performs atomic read-modify-write inside transaction', async () => {
      let storedRow = {
        id: 200,
        content: JSON.stringify({ questions: [{ number: 1 }, { number: 2 }] }),
        explanation: {
          byNumber: {
            1: { v: 2, answer: 'A', status: 'ai_generated' },
          },
        },
      }

      prismaMock.practiceQuestion.findUnique.mockImplementation(async () => ({ ...storedRow }))
      prismaMock.practiceQuestion.update.mockImplementation(async ({ data }) => {
        storedRow.explanation = data.explanation
        return storedRow
      })

      // Update question 2
      await updatePracticeQuestionExplanationTx(200, (byNumber) => {
        byNumber[2] = { v: 2, answer: 'B', status: 'ai_generated' }
        return byNumber
      })

      expect(storedRow.explanation.byNumber[1]).toBeDefined()
      expect(storedRow.explanation.byNumber[2]).toBeDefined()
      expect(storedRow.explanation.byNumber[1].answer).toBe('A')
      expect(storedRow.explanation.byNumber[2].answer).toBe('B')
    })
  })
})
