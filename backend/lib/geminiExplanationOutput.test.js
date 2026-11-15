import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestGeminiJson } = require('./groqClient')
const { resetRateLimiterState } = require('./geminiRateLimiter')
const generator = require('../scripts/generate-explanations')
const originalKey = process.env.GEMINI_API_KEY
const response = (text, finishReason = 'STOP', extra = {}) => ({ ok: true, json: async () => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }], ...extra,
}) })
const strict = { strictJson: true, allowModelFallback: false, retriesPerModel: 0 }

beforeEach(() => { process.env.GEMINI_API_KEY = 'fixture-key'; resetRateLimiterState() })
afterEach(() => {
  vi.unstubAllGlobals(); resetRateLimiterState()
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey
})

describe('strict explanation JSON transport', () => {
  it.each(['{"answer":"press"}', '{"answer":"press'])('rejects MAX_TOKENS even if JSON can be parsed or repaired', async text => {
    const fetch = vi.fn().mockResolvedValue(response(text, 'MAX_TOKENS', { usageMetadata: { promptTokenCount: 2508, candidatesTokenCount: 4080, totalTokenCount: 6588, privateField: 'omit' } }))
    vi.stubGlobal('fetch', fetch)
    const diagnostic = vi.fn()
    await expect(requestGeminiJson('fixture', { ...strict, onDiagnostic: diagnostic })).rejects.toMatchObject({
      code: 'AI_RESPONSE_TRUNCATED', status: 502, phase: 'parsing', causeCode: 'MAX_TOKENS', finishReason: 'MAX_TOKENS',
      tokenUsage: { promptTokenCount: 2508, candidatesTokenCount: 4080, totalTokenCount: 6588 },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(diagnostic).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'parsing', causeCode: 'MAX_TOKENS' }))
  })
  it.each(['{"answer":', '[]', 'null', '"answer"'])('rejects incomplete or wrong-shaped content: %s', async text => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text)))
    await expect(requestGeminiJson('fixture', strict)).rejects.toMatchObject({ code: 'AI_RESPONSE_INVALID', causeCode: 'INVALID_JSON' })
  })
  it('ignores thought text and joins the final response parts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { text: 'private reasoning', thought: true }, { text: '{"answer":' }, { text: '"press"}' },
    ] } }] }) }))
    expect(await requestGeminiJson('fixture', { ...strict, withMetadata: true })).toMatchObject({ data: { answer: 'press' }, finishReason: 'STOP' })
  })
  it('leaves legacy non-strict repair behavior available for other integrations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('{"ok":true', 'MAX_TOKENS')))
    expect(await requestGeminiJson('fixture', { allowModelFallback: false, retriesPerModel: 0 })).toEqual({ ok: true })
  })
})

describe('bounded explanation generation and partial translation', () => {
  const q = { number: 1, type: 'note_completion', questionText: 'The library opens at ___.', correctAnswer: 'nine', passage: { body: 'The library opens at nine.' }, group: { type: 'note_completion' } }
  const family = 'COMPLETION'
  const ctx = generator.buildContext(q, family)
  const raw = { question_chunks: [{ text: 'opens at ___', label: 'giờ mở cửa' }], predict: 'Tìm giờ mở cửa.',
    evidence_quote: 'The library opens at nine.', answer: 'nine', reasoning: 'Bài nêu giờ mở cửa là chín giờ.',
    full_sentence: 'The library opens at nine.', translation: 'The library opens at nine.' }

  it('bounds both normal and recovery arrays without creating alternatives for completion', () => {
    const normal = generator.buildResponseSchema(q.type, null, { compact: true, isFixedMode: true })
    const short = generator.buildResponseSchema(q.type, null, { compact: true, extraCompact: true, isFixedMode: true })
    expect(normal.properties.question_chunks.maxItems).toBe(6)
    expect(short.properties.question_chunks.maxItems).toBe(3)
    expect(short.properties.paraphrases.maxItems).toBe(1)
    expect(normal.properties.distractors.maxItems).toBe(0)
    expect(normal.required).toEqual(expect.arrayContaining(['full_sentence', 'translation']))
    expect(generator.buildPrompt(q, family, ctx, null, null, { compact: true, extraCompact: true, isFixedMode: true, targetAnswer: 'nine' })).toContain('LƯỢT RÚT GỌN')
    expect(generator.buildResponseSchema(q.type).properties.question_chunks.maxItems).toBeUndefined()
  })
  it('retains validated core and full sentence when only translation needs repair', () => {
    const partial = generator.enrichExplanation(raw, ctx, 'nine', family, { allowPartialTranslation: true })
    expect(partial).toMatchObject({ answer: 'nine', reasoning: raw.reasoning, full_sentence: raw.full_sentence, translation: '',
      evidence: { parts: [{ text: raw.evidence_quote }] }, contentIssue: { code: 'TRANSLATION_INVALID' } })
    expect(partial.no_support).not.toBe(true)
    expect(() => generator.enrichExplanation(raw, ctx, 'nine', family)).toThrow(/translation/)
  })
  it('does not preserve fabricated evidence as a translation-only issue', () => {
    expect(() => generator.enrichExplanation({ ...raw, evidence_quote: 'Invented source sentence.' }, ctx, 'nine', family, { allowPartialTranslation: true })).toThrow(/evidence_quote/)
  })
})
