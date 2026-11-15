import { describe, it, expect, beforeEach } from 'vitest'

// Phải set trước khi middleware/rateLimiter được require.
process.env.RATE_LIMIT_AI_EXPLANATION_MAX = '2'
process.env.RATE_LIMIT_AI_EXPLANATION_RUN_MAX = '3'

const {
  aiExplanationRunLimiter,
  resetAiExplanationRuns,
  DEFAULT_AI_EXPLANATION_MAX,
  DEFAULT_AI_EXPLANATION_RUN_MAX,
} = require('./rateLimiter')

function req(body, userId = 1) {
  return { body, user: { userId }, headers: { 'x-test-rate-limit': 'true' }, ip: '127.0.0.1' }
}

function res() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

function run(limiter = aiExplanationRunLimiter, request = req({})) {
  const response = res()
  let nextCalled = false
  limiter(request, response, () => { nextCalled = true })
  return { response, nextCalled }
}

describe('aiExplanationRunLimiter (quota theo lượt chạy)', () => {
  beforeEach(() => resetAiExplanationRuns())

  it('cho phép nhiều request trong cùng một operationId', () => {
    for (let i = 0; i < DEFAULT_AI_EXPLANATION_RUN_MAX; i += 1) {
      const { nextCalled } = run(aiExplanationRunLimiter, req({ operationId: 'run_abc12345' }))
      expect(nextCalled).toBe(true)
    }
  })

  it('chặn khi một lượt chạy gửi quá số request cho phép', () => {
    for (let i = 0; i < DEFAULT_AI_EXPLANATION_RUN_MAX; i += 1) {
      expect(run(aiExplanationRunLimiter, req({ operationId: 'run_abc12345' })).nextCalled).toBe(true)
    }
    const blocked = run(aiExplanationRunLimiter, req({ operationId: 'run_abc12345' }))
    expect(blocked.nextCalled).toBe(false)
    expect(blocked.response.statusCode).toBe(429)
    expect(blocked.response.body).toMatchObject({ code: 'AI_RATE_LIMITED' })
    expect(blocked.response.body.retryAfter).toBeGreaterThan(0)
  })

  it('giới hạn số lượt chạy khác nhau của cùng một user', () => {
    for (let i = 0; i < DEFAULT_AI_EXPLANATION_MAX; i += 1) {
      expect(run(aiExplanationRunLimiter, req({ operationId: `run_number_${i}` })).nextCalled).toBe(true)
    }
    const blocked = run(aiExplanationRunLimiter, req({ operationId: 'run_number_overflow' }))
    expect(blocked.nextCalled).toBe(false)
    expect(blocked.response.body.code).toBe('AI_RATE_LIMITED')
  })

  it('không tính quota của user này sang user khác', () => {
    for (let i = 0; i < DEFAULT_AI_EXPLANATION_MAX; i += 1) {
      run(aiExplanationRunLimiter, req({ operationId: `run_user_one_${i}` }, 11))
    }
    expect(run(aiExplanationRunLimiter, req({ operationId: 'run_user_one_x' }, 11)).nextCalled).toBe(false)
    expect(run(aiExplanationRunLimiter, req({ operationId: 'run_user_two_x' }, 12)).nextCalled).toBe(true)
  })
})
