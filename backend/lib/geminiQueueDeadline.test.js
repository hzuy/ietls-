import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const { requestGeminiJson } = require('./groqClient')
const { scheduleGeminiCall, resetRateLimiterState } = require('./geminiRateLimiter')
const reply = () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) })
const originalKey = process.env.GEMINI_API_KEY
const originalRpm = process.env.GEMINI_MAX_RPM
describe('Gemini request deadlines', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    process.env.GEMINI_API_KEY = 'test_key'
    process.env.GEMINI_MAX_RPM = '12'
    resetRateLimiterState()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(Object.assign(new Error('provider deadline'), { name: 'TimeoutError' })), ms)
      return controller.signal
    })
  })
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); resetRateLimiterState()
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey
    if (originalRpm === undefined) delete process.env.GEMINI_MAX_RPM; else process.env.GEMINI_MAX_RPM = originalRpm
  })
  it('gives the provider its full 22 seconds after waiting 5 seconds in the queue', async () => {
    await scheduleGeminiCall(async () => reply())
    const fetch = vi.fn((_url, options) => new Promise((resolve, reject) => {
      setTimeout(() => resolve(reply()), 20000)
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    let outcome = 'pending'
    const pending = requestGeminiJson('prompt', { allowModelFallback: false, retriesPerModel: 0 })
      .then(() => { outcome = 'success' }, () => { outcome = 'failed' })
    await vi.advanceTimersByTimeAsync(25001)
    expect(outcome).toBe('success')
    expect(fetch).toHaveBeenCalledTimes(1)
    await pending
  })
  it('honors a single-model budget so the caller can fall back before its question deadline', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('provider unavailable'))
    vi.stubGlobal('fetch', fetch)
    await expect(requestGeminiJson('prompt', { allowModelFallback: false, retriesPerModel: 0 })).rejects.toThrow('provider unavailable')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
