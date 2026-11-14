import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  $executeRawUnsafe: vi.fn(async () => 1),
  question: { findMany: vi.fn(), updateMany: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  practiceQuestion: { updateMany: vi.fn() },
  $transaction: vi.fn(async callback => callback(prisma)),
}
function inject(path, exports) {
  const id = require.resolve(path)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
inject('../lib/prisma', prisma)
const requestGeminiJson = vi.fn(), groqCreate = vi.fn(), getGroqClient = vi.fn(() => ({ chat: { completions: { create: groqCreate } } }))
inject('../lib/groqClient', { requestGeminiJson, getGroqClient, getGroqModel: () => 'test-groq' })
const originalGenerator = require('../scripts/generate-explanations')
inject('../scripts/generate-explanations', { ...originalGenerator, enrichExplanation: raw => ({ ...raw, v: 2 }) })
const service = require('./explanationDraftService')
const legacy = require('./explanationGeneratorService')
const { draftEnvelope } = require('../lib/explanationWorkflow')

const source = 'The library opens at nine.'
const valid = { v: 2, answer: 'nine', reasoning: 'The source gives the opening time.', evidence: { parts: [{ text: source }] } }

describe.each(['exam', 'practice'])('%s draft service', kind => {
  let question, row, practice
  const args = () => ({ examId: 10, isPractice: kind === 'practice', ...(kind === 'exam' ? { questionId: 101 } : { questionNumber: 1 }) })
  const raw = () => kind === 'exam' ? question.explanation : row.explanation?.byNumber?.[1]
  const setRaw = value => { if (kind === 'exam') question.explanation = value; else row.explanation = { byNumber: { 1: value } } }
  const target = async () => (await service.targets(prisma, kind, 10, kind === 'exam' ? { questionId: 101 } : { questionNumber: 1 }))[0]
  const generate = options => kind === 'exam' ? service.generateForExam(10, options) : service.generateForPracticeExam(10, options)

  beforeEach(() => {
    vi.clearAllMocks()
    question = { id: 101, number: 1, type: 'fill_blank', questionText: 'The library opens at ___.', correctAnswer: 'nine', explanation: null,
      passage: { body: source, examId: 10 }, group: { id: 11, instruction: 'ONE WORD ONLY', noteSections: [], matchingOptions: [] } }
    row = { id: 201, content: JSON.stringify({ type: 'note_completion', instruction: 'ONE WORD ONLY', questions: [{ number: 1, questionText: question.questionText, correctAnswer: 'nine' }] }), explanation: null }
    practice = { id: 10, skill: 'reading', passage: source, questions: [row] }
    prisma.question.findMany.mockImplementation(async () => [structuredClone(question)])
    prisma.practiceExam.findUnique.mockImplementation(async () => structuredClone(practice))
    prisma.question.updateMany.mockImplementation(async ({ data }) => { question.explanation = structuredClone(data.explanation); return { count: 1 } })
    prisma.practiceQuestion.updateMany.mockImplementation(async ({ data }) => { Object.assign(row, structuredClone(data)); return { count: 1 } })
    requestGeminiJson.mockResolvedValue({ data: valid, provider: 'Gemini', model: 'test-gemini' })
    groqCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] })
  })

  it('generates a committed fixed-answer draft without altering the answer or exposing it to learners', async () => {
    const result = await generate({ questionNumbers: [1], force: true })
    expect(result).toMatchObject({ generatedCount: 1, hasConflicts: false, remainingQuestionNumbers: [], errors: [] })
    expect(raw()).toMatchObject({ workflowVersion: 3, published: null, draft: { payload: { answer: 'nine' } } })
    expect(legacy.filterLearnerExplanation(raw())).toBeNull()
    expect(requestGeminiJson.mock.calls[0][0]).toContain('nine')
    expect(requestGeminiJson.mock.calls[0][1]).toMatchObject({ retriesPerModel: 0, allowModelFallback: false })
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', kind === 'practice' ? 72414 : 72413, 10)
    if (kind === 'exam') expect(prisma.question.updateMany.mock.calls[0][0].data).not.toHaveProperty('correctAnswer')
    else expect(JSON.parse(row.content).questions[0].correctAnswer).toBe('nine')
  })

  it('retains the old published result while generating a replacement draft', async () => {
    const published = { ...valid, status: 'teacher_reviewed', reasoning: 'Published original' }
    setRaw(published)
    await generate({ force: true, questionNumbers: [1] })
    expect(legacy.filterLearnerExplanation(raw()).reasoning).toBe('Published original')
    expect(raw().draft.payload.reasoning).toBe(valid.reasoning)
  })

  it('does not regenerate visible legacy content by default even when questionNumbers selects the scope', async () => {
    setRaw({ ...valid, status: 'ai_generated' })
    expect(await generate({ force: false, questionNumbers: [1] })).toMatchObject({ generatedCount: 0 })
    expect(requestGeminiJson).not.toHaveBeenCalled()
  })

  it.each([false, true])('replays a committed operation without another provider call or write (force: %s)', async force => {
    const options = { force, questionNumbers: [1], operationId: 'operation-replay-123' }
    const first = await generate(options)
    const version = raw().draft.version
    const replay = await generate(options)
    expect(first.generatedCount).toBe(1)
    expect(replay.generatedCount).toBe(1)
    expect(raw().draft.version).toBe(version)
    expect(requestGeminiJson).toHaveBeenCalledTimes(1)
    expect(prisma.question.updateMany.mock.calls.length + prisma.practiceQuestion.updateMany.mock.calls.length).toBe(1)
  })

  it('uses only one fallback after provider overload and disables SDK retries', async () => {
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.generatedCount).toBe(1)
    expect(requestGeminiJson).toHaveBeenCalledTimes(1)
    expect(groqCreate).toHaveBeenCalledTimes(1)
    expect(getGroqClient).toHaveBeenCalledWith({ maxRetries: 0 })
    expect(raw().draft.payload.provider).toBe('Groq')
  })

  it('keeps a source-invalid old publication hidden until the new source draft is explicitly published', async () => {
    setRaw({ workflowVersion: 3, published: { ...valid, status: 'teacher_reviewed' }, publishedSourceHash: 'old-source', draft: null })
    await generate({ force: true, questionNumbers: [1] })
    const envelope = raw()
    expect(envelope.publishedStale).toBe(true)
    expect(legacy.filterLearnerExplanation(envelope)).toBeNull()
    await service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: envelope.draft.version, sourceHash: envelope.draft.sourceHash } })
    expect(legacy.filterLearnerExplanation(raw())).toMatchObject({ answer: 'nine', status: 'teacher_reviewed' })
  })

  it('saves manual changes only as a draft, preserving the published explanation and avoiding AI calls', async () => {
    const data = service.input(await target())
    const published = { ...valid, status: 'teacher_reviewed', reasoning: 'Published original' }
    const envelope = draftEnvelope(published, valid, data.sourceHash)
    setRaw(envelope)
    const result = await service.updateManualExplanation({ ...args(), fields: { reasoning: 'Teacher authored draft', expectedDraftVersion: envelope.draft.version, expectedSourceHash: data.sourceHash } })
    expect(result.explanation).toMatchObject({ status: 'draft_ready', hasDraft: true, reasoning: 'Teacher authored draft' })
    expect(legacy.filterLearnerExplanation(raw()).reasoning).toBe('Published original')
    expect(requestGeminiJson).not.toHaveBeenCalled()
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('publishes exactly the viewed draft without any provider call', async () => {
    const data = service.input(await target())
    const envelope = draftEnvelope(null, { ...valid, reasoning: 'Teacher reviewed exact wording' }, data.sourceHash)
    setRaw(envelope)
    const result = await service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: envelope.draft.version, sourceHash: data.sourceHash } })
    expect(result.explanation).toMatchObject({ status: 'published', hasDraft: false, reasoning: 'Teacher reviewed exact wording' })
    expect(raw().draft).toBeNull()
    expect(legacy.filterLearnerExplanation(raw()).reasoning).toBe('Teacher reviewed exact wording')
    expect(requestGeminiJson).not.toHaveBeenCalled()
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('rejects a stale draft version before writing', async () => {
    const data = service.input(await target())
    setRaw(draftEnvelope(null, valid, data.sourceHash))
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: 'another-version', sourceHash: data.sourceHash } })).rejects.toMatchObject({ code: 'DRAFT_CHANGED', status: 409 })
    expect(prisma.question.updateMany).not.toHaveBeenCalled()
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a manual edit based on an outdated published version', async () => {
    const data = service.input(await target())
    setRaw({ workflowVersion: 3, published: { ...valid, status: 'teacher_reviewed' }, publishedVersion: 'new-publication', publishedSourceHash: data.sourceHash, draft: null })
    await expect(service.updateManualExplanation({ ...args(), fields: {
      reasoning: 'Old modal content', expectedDraftVersion: null, expectedPublishedVersion: 'old-publication', expectedSourceHash: data.sourceHash,
    } })).rejects.toMatchObject({ code: 'DRAFT_CHANGED', status: 409 })
    expect(requestGeminiJson).not.toHaveBeenCalled()
    expect(prisma.question.updateMany).not.toHaveBeenCalled()
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
  })

  it('rejects publishing after the passage/transcript changes', async () => {
    const data = service.input(await target())
    const envelope = draftEnvelope(null, valid, data.sourceHash)
    setRaw(envelope)
    if (kind === 'exam') question.passage.body = 'The library opens at ten.'
    else practice.passage = 'The library opens at ten.'
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: envelope.draft.version, sourceHash: data.sourceHash } })).rejects.toMatchObject({ code: 'SOURCE_CHANGED', status: 409 })
  })

  it('rejects a failed compare-and-swap instead of claiming a saved draft', async () => {
    const original = await target()
    const model = kind === 'exam' ? prisma.question : prisma.practiceQuestion
    model.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(service.write(original, () => draftEnvelope(null, valid, service.input(original).sourceHash))).rejects.toMatchObject({ code: 'DRAFT_CHANGED', status: 409 })
  })

  it('does not count a generated result whose database write failed', async () => {
    const model = kind === 'exam' ? prisma.question : prisma.practiceQuestion
    model.updateMany.mockRejectedValueOnce(Object.assign(new Error('private database query'), { code: 'P2028' }))
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.generatedCount).toBe(0)
    expect(result.errors).toEqual([expect.objectContaining({ number: 1, code: 'AI_SAVE_FAILED' })])
    expect(JSON.stringify(result)).not.toContain('private database query')
  })

  it('aborts an in-flight provider request without saving a partial result', async () => {
    const controller = new AbortController()
    requestGeminiJson.mockImplementationOnce((_prompt, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true })
    }))
    const pending = generate({ force: true, questionNumbers: [1], signal: controller.signal })
    await vi.waitFor(() => expect(requestGeminiJson).toHaveBeenCalledTimes(1))
    controller.abort()
    const result = await pending
    expect(result.generatedCount).toBe(0)
    expect(result.remainingQuestionNumbers).toEqual([1])
    expect(prisma.question.updateMany).not.toHaveBeenCalled()
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
  })

  it('records unsupported evidence as a review issue and blocks publication', async () => {
    requestGeminiJson.mockResolvedValueOnce({ data: { no_support: true, support_note: 'The source does not support this answer' }, model: 'test' })
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.needsRetryQuestions).toEqual([expect.objectContaining({ number: 1, reason: 'The source does not support this answer' })])
    const envelope = raw()
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: envelope.draft.version, sourceHash: envelope.draft.sourceHash } })).rejects.toMatchObject({ code: 'DRAFT_INVALID', status: 400 })
    expect(legacy.filterLearnerExplanation(envelope)).toBeNull()
  })

  it('accepts an explicit teacher publication of a valid legacy explanation', async () => {
    setRaw({ ...valid, status: 'ai_generated' })
    const result = await service.reviewQuestionExplanation(args())
    expect(result.explanation.status).toBe('published')
    expect(legacy.filterLearnerExplanation(raw()).status).toBe('teacher_reviewed')
  })

  it('does not treat Listening context or a passage fallback as a real transcript', async () => {
    if (kind === 'exam') {
      question.passage = null
      question.listeningSection = { context: 'A description of the situation', transcript: '' }
    } else {
      practice.skill = 'listening'
      practice.transcript = ''
      practice.passage = 'A description of the situation'
    }
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.errors[0]).toMatchObject({ code: 'MISSING_DATA', status: 400 })
    expect(result.errors[0].message).toMatch(/transcript/)
    expect(requestGeminiJson).not.toHaveBeenCalled()
  })

  it('rejects AI answer adoption requests rather than changing the exam answer', async () => {
    await expect(generate({ resolveChoices: { 1: 'ai' } })).rejects.toMatchObject({ code: 'ANSWER_CHANGE_DISABLED', status: 400 })
    expect(requestGeminiJson).not.toHaveBeenCalled()
  })

  it('rejects a write when group instructions change during generation', async () => {
    const original = await target()
    const sourceReader = kind === 'exam' ? prisma.question.findMany : prisma.practiceExam.findUnique
    sourceReader.mockClear()
    if (kind === 'exam') question.group.instruction = 'TWO WORDS ONLY'
    else {
      const content = JSON.parse(row.content)
      content.instruction = 'TWO WORDS ONLY'
      row.content = JSON.stringify(content)
    }
    await expect(service.write(original, () => draftEnvelope(null, valid, service.input(original).sourceHash)))
      .rejects.toMatchObject({ code: 'SOURCE_CHANGED', status: 409 })
    expect(prisma.question.updateMany).not.toHaveBeenCalled()
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
    expect(prisma.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(sourceReader.mock.invocationCallOrder[0])
  })

  if (kind === 'practice') it('rejects a write when another item replaces the same display number', async () => {
    const content = JSON.parse(row.content)
    content.questions[0]._explanationId = 'original-item'
    row.content = JSON.stringify(content)
    const original = await target()
    content.questions[0]._explanationId = 'replacement-item'
    row.content = JSON.stringify(content)
    await expect(service.write(original, () => draftEnvelope(null, valid, service.input(original).sourceHash)))
      .rejects.toMatchObject({ code: 'SOURCE_CHANGED', status: 409 })
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
  })
})

describe('shared input and output validation', () => {
  const data = q => service.input({ q })
  const reading = { type: 'fill_blank', questionText: 'Opening time?', correctAnswer: 'nine', passage: { body: source }, group: {} }
  it('requires an image for image questions before contacting AI', () => {
    expect(service.preflight(data({ ...reading, type: 'map_diagram' }))).toMatch(/ảnh/)
  })
  it('requires choices for MCQ questions', () => {
    expect(service.preflight(data({ ...reading, type: 'mcq' }))).toMatch(/lựa chọn/)
  })
  it('rejects a saved MCQ answer that is outside the available choices', () => {
    expect(service.preflight(data({ ...reading, type: 'mcq', correctAnswer: 'E', options: JSON.stringify(['First', 'Second']) }))).toBeTruthy()
  })
  it('rejects a multi-select answer that does not meet the required choice count', () => {
    expect(service.preflight(data({ ...reading, type: 'mcq_multi', correctAnswer: 'A', options: JSON.stringify(['First', 'Second', 'Third']), group: { maxChoices: 2 } }))).toBeTruthy()
  })
  it('allows NOT GIVEN without manufacturing an affirmative quote', () => {
    const context = data({ ...reading, type: 'true_false_ng', correctAnswer: 'NOT GIVEN' })
    expect(service.payloadIssue(context, { answer: 'NOT GIVEN', reasoning: 'The source never states the requested opening date.' })).toBeNull()
  })
  it('rejects an AI answer that differs from the saved answer', () => {
    expect(service.payloadIssue(data(reading), { ...valid, answer: 'ten' })).toMatch(/khớp/)
  })
  it('rejects an empty quote instead of treating it as evidence', () => {
    expect(service.payloadIssue(data(reading), { ...valid, evidence: { parts: [{ text: '' }] } })).toBeTruthy()
  })
  it('requires transcript evidence for Listening image questions', () => {
    const context = data({ ...reading, type: 'map_diagram', passage: null, listeningSection: { transcript: source }, group: {} })
    expect(context.ctx.skill).toBe('listening')
    expect(service.payloadIssue(context, { answer: 'nine', reasoning: 'The map label is nine.' })).toBeTruthy()
    expect(service.payloadIssue(context, valid)).toBeNull()
  })
  it('enforces the word portion of a words-and-number limit', () => {
    const context = data({ ...reading, correctAnswer: 'one two three four 5', group: { instruction: 'NO MORE THAN TWO WORDS AND/OR A NUMBER' } })
    expect(service.payloadIssue(context, { ...valid, answer: context.answer })).toMatch(/giới hạn/)
  })
})
