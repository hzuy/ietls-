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

  it('confirms the persisted AI preview without calling the provider again', async () => {
    const preview = { v: 2, status: 'conflict_pending', answer: 'ten', aiAnswer: 'ten', reasoning: 'Reviewed preview', provider: 'Gemini' }
    if (kind === 'exam') {
      prismaMock.question.findMany.mockResolvedValue([
        { id: 101, number: 1, type: 'fill_blank', correctAnswer: 'nine', explanation: preview, passage: { body: 'The library opens at ten.' } },
        { id: 102, number: 2, type: 'fill_blank', correctAnswer: 'nine', passage: { body: 'The library opens at nine.' } },
      ])
    } else {
      practiceRow.explanation = { byNumber: { 1: preview } }
      const group = JSON.parse(practiceRow.content)
      group.qNumberEnd = 2
      group.questions.push({ number: 2, correctAnswer: 'nine' })
      practiceRow.content = JSON.stringify(group)
    }
    const result = await (kind === 'exam' ? service.generateForExam(10, { force: true, resolveChoices: { 1: 'ai' } }) : service.generateForPracticeExam(10, { force: true, resolveChoices: { 1: 'ai' } }))
    expect(generateExplanation).not.toHaveBeenCalled()
    expect(result.generatedCount).toBe(1)
    if (kind === 'exam') {
      expect(prismaMock.question.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ correctAnswer: 'ten', explanation: expect.objectContaining({ reasoning: 'Reviewed preview', status: 'ai_generated' }) }) }))
    } else {
      expect(prismaMock.practiceQuestion.update).toHaveBeenCalled()
      const data = prismaMock.practiceQuestion.update.mock.calls[0][0].data
      expect(data.explanation.byNumber[1]).toMatchObject({ answer: 'ten', reasoning: 'Reviewed preview', status: 'ai_generated' })
      expect(JSON.parse(data.content).questions[0].correctAnswer).toBe('ten')
    }
  })

  it('does not regenerate or save when the pending preview is missing', async () => {
    const result = await (kind === 'exam' ? service.generateForExam(10, { force: true, resolveChoices: { 1: 'ai' } }) : service.generateForPracticeExam(10, { force: true, resolveChoices: { 1: 'ai' } }))
    expect(generateExplanation).not.toHaveBeenCalled()
    expect(result.generatedCount).toBe(0)
    expect(result.errors).toEqual([expect.objectContaining({ number: 1 })])
    expect(prismaMock.question.update).not.toHaveBeenCalled()
    expect(prismaMock.practiceQuestion.update).not.toHaveBeenCalled()
  })

  it('allows a 5.323-second save within the remaining hard request budget', async () => {
    generateExplanation.mockResolvedValue({ v: 2, answer: 'nine', reasoning: 'The passage gives the opening time.' })
    prismaMock.$transaction.mockImplementationOnce(async (callback, options) => {
      if (!options || options.timeout < 5323) throw Object.assign(new Error('Transaction already closed'), { code: 'P2028' })
      expect(options.timeout + options.maxWait).toBeLessThan(48000)
      return callback(prismaMock)
    })
    const result = await (kind === 'exam' ? service.generateForExam(10, { force: true }) : service.generateForPracticeExam(10, { force: true }))
    expect(result.generatedCount).toBe(1)
  })

  it('reports a rolled-back save as a database failure without exposing internal details', async () => {
    generateExplanation.mockResolvedValue({ v: 2, answer: 'nine', reasoning: 'The passage gives the opening time.' })
    prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error('Transaction not found: internal SQL details'), { code: 'P2028' }))
    const pending = kind === 'exam' ? service.generateForExam(10, { force: true }) : service.generateForPracticeExam(10, { force: true })
    await expect(pending).rejects.toMatchObject({ code: 'AI_SAVE_FAILED', phase: 'saving', causeCode: 'P2028', generatedCount: 0 })
  })

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
