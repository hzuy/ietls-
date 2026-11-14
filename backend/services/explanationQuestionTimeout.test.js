import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() }, practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async fn => fn(prismaMock)),
}
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }
const generatorPath = require.resolve('../scripts/generate-explanations')
const original = require(generatorPath)
const generateExplanation = vi.fn()
require.cache[generatorPath] = { id: generatorPath, filename: generatorPath, loaded: true,
  exports: { ...original, generateExplanation } }
const service = require('./explanationGeneratorService')

describe.each(['exam', 'practice'])('%s question deadline', kind => {
  let practiceRow
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    prismaMock.exam.findUnique.mockResolvedValue({ id: 10, skill: 'reading' })
    prismaMock.question.findMany.mockResolvedValue([{ id: 101, number: 1, type: 'fill_blank', correctAnswer: 'nine', explanation: { aiAnswer: 'nine' }, passage: { body: 'The library opens at nine.' } }])
    practiceRow = { id: 201,
      content: JSON.stringify({ type: 'note_completion', qNumberStart: 1, qNumberEnd: 1, questions: [{ number: 1, correctAnswer: 'nine' }] }),
      explanation: { byNumber: { 1: { aiAnswer: 'nine' } } },
    }
    prismaMock.practiceExam.findUnique.mockResolvedValue({ id: 10, skill: 'reading', passage: 'The library opens at nine.', questions: [practiceRow] })
    prismaMock.practiceQuestion.findUnique.mockResolvedValue(practiceRow)
    prismaMock.question.findUnique.mockResolvedValue({ explanation: null })
  })
  afterEach(() => vi.useRealTimers())

  it('allows a provider result after 25 seconds instead of cutting it off at 20 seconds', async () => {
    generateExplanation.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ v: 2, answer: 'nine', reasoning: 'The passage gives the opening time.' }), 25000)))
    const pending = kind === 'exam' ? service.generateForExam(10, { force: true }) : service.generateForPracticeExam(10, { force: true })
    await vi.advanceTimersByTimeAsync(25001)
    const result = await pending
    expect(result.generatedCount).toBe(1)
    expect(result.errors).toBeUndefined()
    expect(result.remainingQuestionNumbers).toEqual([])
  })

  it('clamps the question deadline to leave room within the 48-second hard request cap', async () => {
    const dbValue = kind === 'exam' ? { id: 10, skill: 'reading' }
      : { id: 10, skill: 'reading', passage: 'The library opens at nine.', questions: [practiceRow] }
    const findExam = kind === 'exam' ? prismaMock.exam.findUnique : prismaMock.practiceExam.findUnique
    findExam.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(dbValue), 20000)))
    generateExplanation.mockImplementation((_q, _family, _ctx, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('provider aborted'), { name: 'AbortError' })), { once: true })
    }))
    const pending = kind === 'exam' ? service.generateForExam(10, { force: true }) : service.generateForPracticeExam(10, { force: true })
    await vi.advanceTimersByTimeAsync(45001)
    const result = await pending
    expect(result.errors).toEqual([expect.objectContaining({ code: 'AI_QUESTION_TIMEOUT', timeoutMs: 25000 })])
    expect(result.generatedCount).toBe(0)
  })

  it.each([false, true])('aborts the provider at the deadline and returns a numbered timeout (keep input: %s)', async keepInput => {
    const external = new AbortController()
    let providerSignal
    generateExplanation.mockImplementation((_q, _family, _ctx, options) => new Promise((_resolve, reject) => {
      providerSignal = options.signal
      providerSignal?.addEventListener('abort', () => reject(Object.assign(new Error('provider aborted'), { name: 'AbortError' })), { once: true })
    }))
    const options = { force: true, signal: external.signal, resolveChoices: keepInput ? { 1: 'input' } : {} }
    const pending = kind === 'exam' ? service.generateForExam(10, options) : service.generateForPracticeExam(10, options)
    await vi.advanceTimersByTimeAsync(35001)
    const result = await pending
    expect(providerSignal).not.toBe(external.signal)
    expect(providerSignal.aborted).toBe(true)
    expect(external.signal.aborted).toBe(false)
    expect(result.errors).toEqual([expect.objectContaining({ number: 1, code: 'AI_QUESTION_TIMEOUT', timeoutMs: 35000 })])
    expect(result.remainingQuestionNumbers).toEqual([])
    expect(result.generatedCount).toBe(0)
    expect(prismaMock.question.update).not.toHaveBeenCalled()
    expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()
  })

  it('propagates user cancellation without turning it into a question timeout', async () => {
    const external = new AbortController()
    let providerSignal
    generateExplanation.mockImplementation((_q, _family, _ctx, options) => new Promise((_resolve, reject) => {
      providerSignal = options.signal
      providerSignal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
    }))
    const pending = kind === 'exam'
      ? service.generateForExam(10, { force: true, signal: external.signal })
      : service.generateForPracticeExam(10, { force: true, signal: external.signal })
    await vi.advanceTimersByTimeAsync(1)
    external.abort()
    const result = await pending
    expect(providerSignal.aborted).toBe(true)
    expect(result.errors).toBeUndefined()
    expect(result.remainingQuestionNumbers).toEqual([1])
    expect(prismaMock.question.update).not.toHaveBeenCalled()
    expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()
  })

  it('also bounds the blind verification needed before keeping an unverified answer', async () => {
    practiceRow.explanation = null
    prismaMock.question.findMany.mockResolvedValue([{ id: 101, number: 1, type: 'fill_blank', correctAnswer: 'nine', passage: { body: 'The library opens at nine.' } }])
    generateExplanation.mockImplementation((_q, _family, _ctx, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
    }))
    const options = { force: true, resolveChoices: { 1: 'input' } }
    const pending = kind === 'exam' ? service.generateForExam(10, options) : service.generateForPracticeExam(10, options)
    await vi.advanceTimersByTimeAsync(35001)
    const result = await pending
    expect(generateExplanation.mock.calls[0][3].forceProvider).toBe('Gemini')
    expect(result.errors).toEqual([expect.objectContaining({ number: 1, code: 'AI_QUESTION_TIMEOUT' })])
    expect(result.generatedCount).toBe(0)
  })

  it('bounds fallback-answer verification without changing the stored answer or opening a conflict', async () => {
    let retrySignal
    generateExplanation.mockResolvedValueOnce({ v: 2, answer: 'ten', provider: 'Groq', isFallback: true, reasoning: 'Fallback result.' })
      .mockImplementationOnce((_q, _family, _ctx, options) => new Promise((_resolve, reject) => {
        retrySignal = options.signal
        retrySignal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
      }))
    const pending = kind === 'exam' ? service.generateForExam(10, { force: true }) : service.generateForPracticeExam(10, { force: true })
    await vi.advanceTimersByTimeAsync(37001)
    const result = await pending
    expect(retrySignal.aborted).toBe(true)
    expect(result.hasConflicts).toBe(false)
    expect(result.needsRetryQuestions).toEqual([expect.objectContaining({ number: 1 })])
    expect(result.remainingQuestionNumbers).toEqual([])
  })
})
