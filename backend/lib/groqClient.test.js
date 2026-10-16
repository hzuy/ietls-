import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
class MockGroq {
  constructor() {
    this.chat = { completions: { create } }
  }
}
const groqPath = require.resolve('groq-sdk')
require.cache[groqPath] = { id: groqPath, filename: groqPath, loaded: true, exports: MockGroq }

const { requestGradingJson, requestAiChat, gradingParams, getGroqVisionModel } = require('./groqClient')

const reply = content => ({ choices: [{ message: { content }, finish_reason: 'stop' }] })

describe('requestGradingJson', () => {
  beforeEach(() => {
    create.mockReset()
    delete process.env.GROQ_REASONING_EFFORT
    delete process.env.GROQ_VISION_MODEL
  })

  it('asks for JSON mode and low reasoning on gpt-oss models', () => {
    expect(gradingParams('openai/gpt-oss-120b')).toEqual({ response_format: { type: 'json_object' }, reasoning_effort: 'low' })
    expect(gradingParams('llama-3.1-8b-instant')).toEqual({ response_format: { type: 'json_object' } })
    process.env.GROQ_REASONING_EFFORT = 'medium'
    expect(gradingParams('openai/gpt-oss-120b').reasoning_effort).toBe('medium')
  })

  it('selects vision model and formats messages when image is provided', async () => {
    create.mockResolvedValue(reply('{"overall": 7}'))
    const res = await requestGradingJson('p', { image: 'data:image/png;base64,abc' })
    expect(res).toEqual({ overall: 7 })
    expect(getGroqVisionModel()).toBe('qwen/qwen3.8-27b')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'p' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
            ]
          }
        ]
      })
    )
  })

  it('returns the parsed feedback', async () => {
    create.mockResolvedValue(reply('{"overall": 6}'))
    expect(await requestGradingJson('p')).toEqual({ overall: 6 })
    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' })
  })

  it('retries once when the model returns broken JSON', async () => {
    create
      .mockResolvedValueOnce(reply('{"explanation": “by 2020” }'))
      .mockResolvedValueOnce(reply('{"overall": 5.5}'))
    expect(await requestGradingJson('p')).toEqual({ overall: 5.5 })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('retries once on a JSON validation error from Groq, then gives up', async () => {
    const err = Object.assign(new Error('json_validate_failed'), { status: 400 })
    create.mockRejectedValue(err)
    await expect(requestGradingJson('p')).rejects.toThrow('json_validate_failed')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('does not retry on other errors such as rate limits', async () => {
    create.mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 }))
    await expect(requestGradingJson('p')).rejects.toThrow('rate limit')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('uses Gemini as primary when enabled and falls back to Groq if Gemini fails', async () => {
    process.env.GEMINI_API_KEY = 'test_gemini_key'
    process.env.ENABLE_GEMINI_IN_TEST = 'true'

    const originalFetch = global.fetch
    try {
      // 1. Success case with Gemini
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"from": "gemini"}' }] } }],
        }),
      })

      const geminiRes = await requestGradingJson('prompt test')
      expect(geminiRes).toEqual({ from: 'gemini' })
      expect(global.fetch).toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()

      // 2. Failure case with Gemini -> falls back to Groq
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Gemini network error'))
      create.mockResolvedValueOnce(reply('{"from": "groq_fallback"}'))

      const fallbackRes = await requestGradingJson('prompt test')
      expect(fallbackRes).toEqual({ from: 'groq_fallback' })
      expect(create).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
      delete process.env.ENABLE_GEMINI_IN_TEST
    }
  })
})

describe('requestAiChat', () => {
  beforeEach(() => {
    create.mockReset()
  })

  it('routes to Groq in test environment by default', async () => {
    create.mockResolvedValueOnce(reply('Groq test response'))
    const res = await requestAiChat([{ role: 'user', content: 'hello' }])
    expect(res.text).toBe('Groq test response')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('routes to Gemini when enabled and falls back to Groq if Gemini fails', async () => {
    process.env.GEMINI_API_KEY = 'test_gemini_key'
    process.env.ENABLE_GEMINI_IN_TEST = 'true'

    const originalFetch = global.fetch
    try {
      // 1. Success case with Gemini Chat
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Hello from Gemini Chat' }] } }],
        }),
      })

      const geminiRes = await requestAiChat([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User prompt' },
      ])
      expect(geminiRes.text).toBe('Hello from Gemini Chat')
      expect(global.fetch).toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()

      // 2. Failure case with Gemini Chat -> falls back to Groq
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Gemini Chat 503 error'))
      create.mockResolvedValueOnce(reply('Hello from Groq Fallback Chat'))

      const fallbackRes = await requestAiChat([
        { role: 'user', content: 'User prompt' },
      ])
      expect(fallbackRes.text).toBe('Hello from Groq Fallback Chat')
      expect(create).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
      delete process.env.ENABLE_GEMINI_IN_TEST
    }
  })
})

