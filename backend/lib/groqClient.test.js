import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
class MockGroq {
  constructor() {
    this.chat = { completions: { create } }
  }
}
const groqPath = require.resolve('groq-sdk')
require.cache[groqPath] = { id: groqPath, filename: groqPath, loaded: true, exports: MockGroq }

const { requestGradingJson, gradingParams } = require('./groqClient')

const reply = content => ({ choices: [{ message: { content }, finish_reason: 'stop' }] })

describe('requestGradingJson', () => {
  beforeEach(() => {
    create.mockReset()
    delete process.env.GROQ_REASONING_EFFORT
  })

  it('asks for JSON mode and low reasoning on gpt-oss models', () => {
    expect(gradingParams('openai/gpt-oss-120b')).toEqual({ response_format: { type: 'json_object' }, reasoning_effort: 'low' })
    expect(gradingParams('llama-3.1-8b-instant')).toEqual({ response_format: { type: 'json_object' } })
    process.env.GROQ_REASONING_EFFORT = 'medium'
    expect(gradingParams('openai/gpt-oss-120b').reasoning_effort).toBe('medium')
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
})
