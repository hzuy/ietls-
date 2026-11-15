import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  $executeRawUnsafe: vi.fn(async () => 1),
  question: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  practiceQuestion: { findUnique: vi.fn(), updateMany: vi.fn() },
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
const enrichExplanation = vi.fn(raw => ({ ...raw, v: 2 }))
inject('../scripts/generate-explanations', { ...originalGenerator, enrichExplanation })
const service = require('./explanationDraftService')
const legacy = require('./explanationGeneratorService')
const { draftEnvelope } = require('../lib/explanationWorkflow')

const source = 'The library opens at nine.'
const valid = { v: 2, answer: 'nine', reasoning: 'The source gives the opening time.', evidence: { parts: [{ text: source }] }, full_sentence: source, translation: 'Thư viện mở cửa lúc chín giờ.' }

describe.each(['exam', 'practice'])('%s draft service', kind => {
  let question, row, practice
  const args = () => ({ examId: 10, isPractice: kind === 'practice', ...(kind === 'exam' ? { questionId: 101 } : { questionNumber: 1 }) })
  const raw = () => kind === 'exam' ? question.explanation : row.explanation?.byNumber?.[1]
  const setRaw = value => { if (kind === 'exam') question.explanation = value; else row.explanation = { byNumber: { 1: value } } }
  const target = async () => (await service.targets(prisma, kind, 10, kind === 'exam' ? { questionId: 101 } : { questionNumber: 1 }))[0]
  const generate = options => kind === 'exam' ? service.generateForExam(10, options) : service.generateForPracticeExam(10, options)
  const installNotes = (answer, { instruction = 'Complete the notes.', bank = false } = {}) => {
    const noteSource = 'The population of London increased. Some businessmen supported Pearson. Families moved to the suburbs. Articles appeared in the press.'
    const group = { type: bank ? 'drag_word_bank' : 'note_completion', instruction,
      noteSections: [{ title: 'London underground', lines: [
        { contentWithTokens: 'The [Q:1] of London increased rapidly', lineType: 'heading' },
        { contentWithTokens: 'Building the railway moved families to housing in the [Q:2]' },
        { contentWithTokens: 'Negative articles appeared in the [Q:5]' },
      ] }], ...(bank ? { matchingOptions: [{ optionLetter: 'A', optionText: 'population' }, { optionLetter: 'B', optionText: 'press' }] } : {}) }
    if (kind === 'exam') {
      question.correctAnswer = answer
      question.questionText = ''
      question.passage.body = noteSource
      Object.assign(question.group, group)
    } else {
      const content = { ...JSON.parse(row.content), ...group }
      Object.assign(content.questions[0], { correctAnswer: answer, questionText: '' })
      row.content = JSON.stringify(content)
      practice.passage = noteSource
    }
    return noteSource
  }

  beforeEach(() => {
    vi.clearAllMocks()
    enrichExplanation.mockImplementation(raw => ({ ...raw, v: 2 }))
    question = { id: 101, number: 1, type: 'fill_blank', questionText: 'The library opens at ___.', correctAnswer: 'nine', explanation: null,
      passage: { body: source, examId: 10 }, group: { id: 11, instruction: 'ONE WORD ONLY', noteSections: [], matchingOptions: [] } }
    row = { id: 201, content: JSON.stringify({ type: 'note_completion', instruction: 'ONE WORD ONLY', questions: [{ number: 1, questionText: question.questionText, correctAnswer: 'nine' }] }), explanation: null }
    practice = { id: 10, skill: 'reading', passage: source, questions: [row] }
    prisma.question.findMany.mockImplementation(async () => [structuredClone(question)])
    prisma.question.findFirst.mockImplementation(async ({ where }) => {
      const id = where?.AND?.find(part => part.id)?.id
      return id && id !== question.id ? null : structuredClone(question)
    })
    prisma.practiceExam.findUnique.mockImplementation(async () => structuredClone(practice))
    prisma.practiceQuestion.findUnique.mockImplementation(async ({ where }) => (where?.id === row.id ? structuredClone(row) : null))
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
    expect(requestGeminiJson.mock.calls[0][1]).toMatchObject({ strictJson: true, max_tokens: 3072 })
    expect(requestGeminiJson.mock.calls[0][1].responseSchema.properties.answer.enum).toEqual(['nine'])
    expect(enrichExplanation.mock.calls[0][4]).toEqual({ allowPartialTranslation: true })
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', kind === 'practice' ? 72414 : 72413, 10)
    if (kind === 'exam') expect(prisma.question.updateMany.mock.calls[0][0].data).not.toHaveProperty('correctAnswer')
    else expect(JSON.parse(row.content).questions[0].correctAnswer).toBe('nine')
  })

  it('returns the committed explanations so the editor does not refetch the whole exam', async () => {
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.saved).toHaveLength(1)
    expect(result.saved[0]).toMatchObject({ number: 1 })
    expect(result.saved[0].explanation).toMatchObject({ reasoning: valid.reasoning, workflowVersion: 3, status: 'draft_ready' })
    expect(result.saved[0].questionId).toBe(kind === 'exam' ? 101 : null)
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('shares a single provider call when two runs ask for the same question', async () => {
    let resolveCall
    requestGeminiJson.mockImplementationOnce(() => new Promise(resolve => { resolveCall = resolve }))
    const firstRun = generate({ force: true, questionNumbers: [1] })
    const secondRun = generate({ force: true, questionNumbers: [1] })
    await vi.waitFor(() => expect(requestGeminiJson).toHaveBeenCalledTimes(1))
    resolveCall({ data: valid, provider: 'Gemini', model: 'test-gemini' })

    const results = await Promise.all([firstRun, secondRun])
    expect(requestGeminiJson).toHaveBeenCalledTimes(1)
    expect(results.map(item => item.generatedCount)).toEqual([1, 1])
  })

  it('clamps the HTTP time budget to the supported range', () => {
    expect(service.resolveBudget(1000)).toBe(15000)
    expect(service.resolveBudget(45000)).toBe(45000)
    expect(service.resolveBudget(999999)).toBe(60000)
    expect(service.resolveBudget(null)).toBe(48000)
  })

  it('retains the old published result while generating a replacement draft', async () => {
    const published = { ...valid, status: 'teacher_reviewed', reasoning: 'Published original' }
    setRaw(published)
    await generate({ force: true, questionNumbers: [1] })
    expect(legacy.filterLearnerExplanation(raw()).reasoning).toBe('Published original')
    expect(raw().draft.payload.reasoning).toBe(valid.reasoning)
  })

  it('never stores invented alternatives for an open question, even if a provider returns them', async () => {
    requestGeminiJson.mockResolvedValueOnce({ data: { ...valid, distractors: [{ option: 'library', reason: 'Invented alternative' }] } })
    await generate({ force: true, questionNumbers: [1] })
    expect(raw().draft.payload.distractors).toEqual([])
  })
  it('keeps the existing stored type and source identity for same-family open groups', async () => {
    if (kind === 'exam') question.group.type = 'note_completion'
    const current = await target()
    expect(current.q.type).toBe('fill_blank')
    expect(service.input(current).sourceHash).toBe(service.input({ ...current, q: { ...current.q, type: 'fill_blank' } }).sourceHash)
  })

  it('preserves actual word-bank alternatives when a child question uses fill_blank', async () => {
    const matchingOptions = [{ optionLetter: 'A', optionText: 'nine' }, { optionLetter: 'B', optionText: 'ten' }]
    if (kind === 'exam') Object.assign(question.group, { type: 'drag_word_bank', matchingOptions })
    else {
      const content = JSON.parse(row.content)
      Object.assign(content, { type: 'drag_word_bank', matchingOptions })
      content.questions[0].type = 'fill_blank'
      row.content = JSON.stringify(content)
    }
    const alternative = { option: 'ten', reason: 'The source says nine.' }
    requestGeminiJson.mockResolvedValueOnce({ data: { ...valid, distractors: [alternative] } })
    const result = await generate({ force: true, questionNumbers: [1] })
    expect(result.generatedCount).toBe(1)
    expect(raw().draft.payload.distractors).toEqual([alternative])
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

  it('retries truncation once with a smaller strict budget and no Groq fallback', async () => {
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Truncated'), { code: 'AI_RESPONSE_TRUNCATED', status: 502 }))
    const result = await generate({ force: true })
    expect(result.generatedCount).toBe(1)
    expect(requestGeminiJson).toHaveBeenCalledTimes(2)
    expect(requestGeminiJson.mock.calls[1][1]).toMatchObject({ strictJson: true, max_tokens: 2048, retriesPerModel: 0, allowModelFallback: false })
    expect(requestGeminiJson.mock.calls[1][1].responseSchema.properties.answer.enum).toEqual(['nine'])
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('preserves the existing draft after two truncated responses with safe metadata', async () => {
    const initial = draftEnvelope(null, valid, service.input(await target()).sourceHash)
    setRaw(initial)
    const error = Object.assign(new Error('private provider response'), { code: 'AI_RESPONSE_TRUNCATED', status: 502, phase: 'parsing', causeCode: 'MAX_TOKENS',
      finishReason: 'MAX_TOKENS', tokenUsage: { promptTokenCount: 30, candidatesTokenCount: 3072, totalTokenCount: 3102, secret: 'private' } })
    requestGeminiJson.mockRejectedValueOnce(error).mockRejectedValueOnce(error)
    const result = await generate({ force: true })
    expect(requestGeminiJson).toHaveBeenCalledTimes(2)
    expect(groqCreate).not.toHaveBeenCalled()
    expect(result.generatedCount).toBe(0)
    expect(result.errors[0]).toMatchObject({ code: 'AI_RESPONSE_TRUNCATED', phase: 'parsing', causeCode: 'MAX_TOKENS', action: 'retry_generation', finishReason: 'MAX_TOKENS',
      tokenUsage: { promptTokenCount: 30, candidatesTokenCount: 3072, totalTokenCount: 3102 } })
    expect(JSON.stringify(result)).not.toContain('private')
    expect(raw()).toEqual(initial)
  })

  it('does not retry truncation with less than eight seconds remaining', async () => {
    const now = Date.now()
    let elapsed = 0
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now + elapsed)
    requestGeminiJson.mockImplementationOnce(async () => {
      elapsed = 30000
      throw Object.assign(new Error('Truncated'), { code: 'AI_RESPONSE_TRUNCATED', status: 502 })
    })
    try {
      expect((await generate({ force: true })).errors[0].code).toBe('AI_RESPONSE_TRUNCATED')
      expect(requestGeminiJson).toHaveBeenCalledTimes(1)
      expect(groqCreate).not.toHaveBeenCalled()
    } finally { clock.mockRestore() }
  })

  it('does not retry or fallback for invalid JSON', async () => {
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('private JSON body'), { code: 'AI_RESPONSE_INVALID', status: 502, phase: 'parsing', causeCode: 'INVALID_JSON' }))
    const result = await generate({ force: true })
    expect(result.errors[0]).toMatchObject({ code: 'AI_RESPONSE_INVALID', phase: 'parsing', causeCode: 'INVALID_JSON' })
    expect(requestGeminiJson).toHaveBeenCalledTimes(1)
    expect(groqCreate).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('never opens a third provider attempt when the compact retry fails with transport overload', async () => {
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Truncated'), { code: 'AI_RESPONSE_TRUNCATED', status: 502 }))
      .mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
    const result = await generate({ force: true })
    expect(result.generatedCount).toBe(0)
    expect(requestGeminiJson).toHaveBeenCalledTimes(2)
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('cancels the compact retry without committing a draft or starting fallback', async () => {
    const controller = new AbortController()
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Truncated'), { code: 'AI_RESPONSE_TRUNCATED', status: 502 }))
      .mockImplementationOnce((_prompt, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true })
      }))
    const pending = generate({ force: true, signal: controller.signal })
    await vi.waitFor(() => expect(requestGeminiJson).toHaveBeenCalledTimes(2))
    controller.abort()
    const result = await pending
    expect(result.generatedCount).toBe(0)
    expect(result.remainingQuestionNumbers).toEqual([1])
    expect(groqCreate).not.toHaveBeenCalled()
    expect(prisma.question.updateMany).not.toHaveBeenCalled()
    expect(prisma.practiceQuestion.updateMany).not.toHaveBeenCalled()
  })

  it('limits total attempts to two when a transport fallback is truncated', async () => {
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
    groqCreate.mockResolvedValueOnce({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(valid) } }] })
    const result = await generate({ force: true })
    expect(result.errors[0].code).toBe('AI_RESPONSE_TRUNCATED')
    expect(requestGeminiJson).toHaveBeenCalledTimes(1)
    expect(groqCreate).toHaveBeenCalledTimes(1)
    expect(result.generatedCount).toBe(0)
  })

  it('preserves core content and publication while translation is edited without regeneration', async () => {
    setRaw({ ...valid, status: 'teacher_reviewed', reasoning: 'Published old wording' })
    requestGeminiJson.mockResolvedValueOnce({ data: { ...valid, translation: '', contentIssue: { code: 'TRANSLATION_INVALID', message: 'Cần sửa bản dịch tiếng Việt.' } } })
    const result = await generate({ force: true })
    expect(result).toMatchObject({ generatedCount: 1, errors: [], needsRetryQuestions: [{ number: 1, code: 'TRANSLATION_INVALID', action: 'edit_translation' }] })
    expect(raw().draft.payload).toMatchObject({ reasoning: valid.reasoning, evidence: valid.evidence, full_sentence: source, translation: '', contentIssue: { code: 'TRANSLATION_INVALID' } })
    expect(raw().draft.payload.no_support).not.toBe(true)
    expect(legacy.filterLearnerExplanation(raw()).reasoning).toBe('Published old wording')
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: raw().draft.version } })).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    requestGeminiJson.mockClear()
    expect((await generate({ force: false })).generatedCount).toBe(0)
    expect(requestGeminiJson).not.toHaveBeenCalled()
    await service.updateManualExplanation({ ...args(), fields: { reasoning: 'Teacher edited reasoning', expectedDraftVersion: raw().draft.version } })
    expect(raw().draft.payload.contentIssue.code).toBe('TRANSLATION_INVALID')
    await service.updateManualExplanation({ ...args(), fields: { translation: valid.translation, expectedDraftVersion: raw().draft.version } })
    expect(raw().draft.issue).toBeNull()
    expect(raw().draft.payload).not.toHaveProperty('contentIssue')
    await service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: raw().draft.version } })
    expect(raw().published.reasoning).toBe('Teacher edited reasoning')
    expect(requestGeminiJson).not.toHaveBeenCalled()
  })

  it('binds the AI prompt to the selected blank and rejects an explanation of another note', async () => {
    const noteSource = installNotes('press')
    const previous = { ...valid, answer: 'press', status: 'teacher_reviewed', reasoning: 'Previous visible wording' }
    setRaw(previous)
    requestGeminiJson.mockResolvedValueOnce({ data: { ...valid, answer: 'press', full_sentence: 'Negative articles appeared in the press.',
      evidence: { parts: [{ text: noteSource }] }, question_chunks: [{ text: '5. ___ ___' }] } })
    const result = await generate({ force: true })
    expect(result.needsRetryQuestions[0]).toMatchObject({ code: 'QUESTION_CONTEXT_MISMATCH', action: 'retry_generation' })
    expect(requestGeminiJson.mock.calls[0][0]).toContain('The [Q:1] of London increased rapidly')
    expect(requestGeminiJson.mock.calls[0][0]).not.toContain('[Q:2]')
    expect(requestGeminiJson.mock.calls[0][0]).not.toContain('[Q:5]')
    expect(raw().published).toEqual(previous)
    expect(raw().draft.payload.contentIssue.code).toBe('QUESTION_CONTEXT_MISMATCH')
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: raw().draft.version } })).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    const current = await target()
    expect(current.q.correctAnswer).toBe('press')
  })

  it('preserves a genuine unsupported response for a forced key instead of borrowing another blank', async () => {
    installNotes('press')
    requestGeminiJson.mockResolvedValueOnce({ data: { no_support: true, support_note: 'The selected blank concerns population, not newspapers.' } })
    const result = await generate({ force: true })
    expect(result.needsRetryQuestions[0]).toMatchObject({ code: 'MISSING_EVIDENCE', action: 'edit_source' })
    expect(raw().draft.payload.no_support).toBe(true)
    expect((await target()).q.correctAnswer).toBe('press')
  })

  it.each(['Gemini', 'Groq'])('prioritizes the actual q3 answer mismatch over a filled-template mismatch from %s', async provider => {
    const noteSource = installNotes('traffic')
    const targetLine = "A number of [Q:3] agreed with Pearson's idea"
    if (kind === 'exam') {
      question.number = 3
      question.group.noteSections[0].lines = [{ contentWithTokens: targetLine }]
    } else {
      const content = JSON.parse(row.content)
      content.questions[0].number = 3
      content.noteSections[0].lines = [{ contentWithTokens: targetLine }]
      row.content = JSON.stringify(content)
    }
    const wrong = { ...valid, answer: 'businessmen', no_support: false, full_sentence: "A number of businessmen agreed with Pearson's idea",
      question_chunks: [{ text: 'A number of' }, { text: '3. ___' }], evidence: { parts: [{ text: noteSource }] } }
    if (provider === 'Gemini') requestGeminiJson.mockResolvedValueOnce({ data: wrong })
    else {
      requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
      groqCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(wrong) } }] })
    }
    const result = await generate({ force: true, questionNumbers: [3] })
    expect(result.needsRetryQuestions[0]).toMatchObject({ number: 3, code: 'ANSWER_MISMATCH', action: 'retry_generation' })
    expect(requestGeminiJson.mock.calls[0][1].responseSchema.properties.answer.enum).toEqual(['traffic'])
    const current = (await service.targets(prisma, kind, 10, { questionNumber: 3 }))[0]
    expect(current.q.correctAnswer).toBe('traffic')
    expect(current.raw.draft.payload.contentIssue.code).toBe('ANSWER_MISMATCH')
    expect(current.raw.draft.payload.no_support).not.toBe(true)
    await expect(service.reviewQuestionExplanation({ examId: 10, isPractice: kind === 'practice',
      ...(kind === 'exam' ? { questionId: 101 } : { questionNumber: 3 }), fields: { draftVersion: current.raw.draft.version } }))
      .rejects.toMatchObject({ code: 'DRAFT_INVALID' })
  })

  it('reports a reading key absent from a passage-word task before making an AI request', async () => {
    installNotes('outskirts', { instruction: 'Write ONE WORD ONLY from the passage for each answer.' })
    const result = await generate({ force: true })
    expect(result.errors[0]).toMatchObject({ code: 'ANSWER_NOT_IN_SOURCE', action: 'edit_source', status: 400 })
    expect(result.generatedCount).toBe(0)
    expect(requestGeminiJson).not.toHaveBeenCalled()
    expect((await target()).q.correctAnswer).toBe('outskirts')
  })

  it('rechecks explicit target templates on manual save and publication without calling AI', async () => {
    const noteSource = installNotes('population')
    const current = await target()
    setRaw(draftEnvelope(null, { ...valid, answer: 'population', question_chunks: [{ text: '1. ___' }],
      evidence: { parts: [{ text: noteSource }] }, full_sentence: 'The population of London increased rapidly' }, service.input(current).sourceHash))
    const version = raw().draft.version
    await service.updateManualExplanation({ ...args(), fields: { expectedDraftVersion: version, full_sentence: 'Negative articles appeared in the population.' } })
    expect(raw().draft.payload.contentIssue.code).toBe('QUESTION_CONTEXT_MISMATCH')
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: raw().draft.version } })).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(requestGeminiJson).not.toHaveBeenCalled()
  })

  it('focuses word-bank notes despite their mapped fill_blank child type', async () => {
    const noteSource = installNotes('A', { bank: true })
    requestGeminiJson.mockResolvedValueOnce({ data: { ...valid, answer: 'A', question_chunks: [{ text: '5. ___' }], evidence: { parts: [{ text: noteSource }] } } })
    const result = await generate({ force: true })
    expect(result.needsRetryQuestions[0]).toMatchObject({ code: 'QUESTION_CONTEXT_MISMATCH' })
    expect(requestGeminiJson.mock.calls[0][0]).toContain('The [Q:1] of London increased rapidly')
    expect(requestGeminiJson.mock.calls[0][0]).not.toContain('[Q:5]')
    expect((await target()).q.correctAnswer).toBe('A')
  })

  it('integrates real enrichment to save valid core when Gemini returns an English translation', async () => {
    enrichExplanation.mockImplementationOnce(originalGenerator.enrichExplanation)
    requestGeminiJson.mockResolvedValueOnce({ data: {
      question_chunks: [{ text: 'The library opens at', label: 'time' }], predict: 'Find the opening time.',
      answer: 'nine', reasoning: valid.reasoning, evidence_quote: source, full_sentence: source, translation: source,
    } })
    const result = await generate({ force: true })
    expect(result.errors).toEqual([])
    expect(result.needsRetryQuestions[0]).toMatchObject({ code: 'TRANSLATION_INVALID', action: 'edit_translation' })
    expect(raw().draft.payload).toMatchObject({ answer: 'nine', reasoning: valid.reasoning, translation: '', full_sentence: source, evidence: { parts: [{ text: source }] } })
    expect(raw().draft.payload.no_support).not.toBe(true)
  })

  it('bounds the compact retry to fifteen seconds without another provider attempt', async () => {
    vi.useFakeTimers()
    requestGeminiJson.mockRejectedValueOnce(Object.assign(new Error('Truncated'), { code: 'AI_RESPONSE_TRUNCATED', status: 502 }))
      .mockImplementationOnce((_prompt, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Timed out'), { name: 'AbortError' })), { once: true })
      }))
    try {
      const pending = generate({ force: true })
      await vi.waitFor(() => expect(requestGeminiJson).toHaveBeenCalledTimes(2))
      await vi.advanceTimersByTimeAsync(15001)
      const result = await pending
      expect(result.errors[0].code).toBe('AI_QUESTION_TIMEOUT')
      expect(result.generatedCount).toBe(0)
      expect(groqCreate).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('reports generic content validation separately from missing evidence', async () => {
    enrichExplanation.mockImplementationOnce(() => { throw new originalGenerator.ExplanationValidationError('private invalid output') })
    const result = await generate({ force: true })
    expect(result.generatedCount).toBe(0)
    expect(result.errors[0]).toMatchObject({ code: 'EXPLANATION_INVALID', phase: 'validation' })
    expect(result.needsRetryQuestions).toEqual([])
    expect(raw()).toBeFalsy()
    expect(JSON.stringify(result)).not.toContain('private invalid output')
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
    expect(result.needsRetryQuestions[0]).toMatchObject({ code: 'MISSING_EVIDENCE', action: 'edit_source' })
    const envelope = raw()
    await expect(service.reviewQuestionExplanation({ ...args(), fields: { draftVersion: envelope.draft.version, sourceHash: envelope.draft.sourceHash } })).rejects.toMatchObject({ code: 'DRAFT_INVALID', status: 400 })
    expect(legacy.filterLearnerExplanation(envelope)).toBeNull()
    requestGeminiJson.mockClear()
    expect((await generate({ force: false })).generatedCount).toBe(0)
    expect(requestGeminiJson).not.toHaveBeenCalled()
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
    const sourceReader = kind === 'exam' ? prisma.question.findFirst : prisma.practiceQuestion.findUnique
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
  it('identifies a missing full sentence separately from a bad translation', () => {
    expect(service.payloadIssue(data(reading), { ...valid, full_sentence: '' })).toBe('Cần bổ sung câu hoàn chỉnh và bản dịch tiếng Việt.')
    expect(service.payloadIssue(data(reading), { ...valid, translation: source })).toBe('Cần sửa bản dịch tiếng Việt.')
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
