import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AI_ERROR_CODES,
  LEARNER_MESSAGES,
  classifyAiError,
  toLearnerAiErrorMessage,
  logAiError,
} from './aiErrors'

describe('classifyAiError — lưu mã ổn định thay vì message thô', () => {
  it('nhận diện rate limit (429)', () => {
    expect(classifyAiError({ status: 429, message: 'Rate limit reached for model llama' })).toBe(AI_ERROR_CODES.RATE_LIMIT)
    expect(classifyAiError({ message: 'Error: Too Many Requests' })).toBe(AI_ERROR_CODES.RATE_LIMIT)
  })

  it('nhận diện timeout (504, ETIMEDOUT, aborted)', () => {
    expect(classifyAiError({ status: 504 })).toBe(AI_ERROR_CODES.TIMEOUT)
    expect(classifyAiError({ code: 'ETIMEDOUT' })).toBe(AI_ERROR_CODES.TIMEOUT)
    expect(classifyAiError({ message: 'The operation was aborted' })).toBe(AI_ERROR_CODES.TIMEOUT)
  })

  it('nhận diện dịch vụ không khả dụng (502/503/overloaded)', () => {
    expect(classifyAiError({ status: 503 })).toBe(AI_ERROR_CODES.SERVICE_UNAVAILABLE)
    expect(classifyAiError({ status: 502 })).toBe(AI_ERROR_CODES.SERVICE_UNAVAILABLE)
    expect(classifyAiError({ message: 'model is overloaded' })).toBe(AI_ERROR_CODES.SERVICE_UNAVAILABLE)
  })

  it('nhận diện lỗi model (404/model_not_found)', () => {
    expect(classifyAiError({ status: 404 })).toBe(AI_ERROR_CODES.MODEL)
    expect(classifyAiError({ message: 'model_not_found' })).toBe(AI_ERROR_CODES.MODEL)
    expect(classifyAiError({ message: 'The model `x` does not exist' })).toBe(AI_ERROR_CODES.MODEL)
  })

  it('nhận diện phản hồi AI không hợp lệ', () => {
    expect(classifyAiError({ message: 'Unexpected token < in JSON at position 0' })).toBe(AI_ERROR_CODES.INVALID_RESPONSE)
  })

  it('lỗi lạ -> AI_ERROR', () => {
    expect(classifyAiError(new Error('something odd'))).toBe(AI_ERROR_CODES.UNKNOWN)
    expect(classifyAiError(null)).toBe(AI_ERROR_CODES.UNKNOWN)
  })
})

describe('toLearnerAiErrorMessage — chỉ trả câu thân thiện, không lộ chi tiết', () => {
  it('trả câu tiếng Việt cho mã đã lưu', () => {
    for (const code of Object.values(AI_ERROR_CODES)) {
      expect(toLearnerAiErrorMessage(code)).toBe(LEARNER_MESSAGES[code])
    }
  })

  it('bản ghi cũ chứa message thô vẫn được phân loại, không lộ nội dung gốc', () => {
    const legacy = 'Groq API error: model_not_found (model `llama-3.3-70b` decommissioned)'
    const msg = toLearnerAiErrorMessage(legacy)
    expect(msg).toBe(LEARNER_MESSAGES[AI_ERROR_CODES.MODEL])
    expect(msg).not.toContain('llama')
    expect(msg).not.toContain('Groq')
    expect(msg).not.toContain('model_not_found')
  })

  it('giá trị rỗng hoặc lạ -> câu mặc định', () => {
    expect(toLearnerAiErrorMessage(null)).toBe(LEARNER_MESSAGES[AI_ERROR_CODES.UNKNOWN])
    expect(toLearnerAiErrorMessage('')).toBe(LEARNER_MESSAGES[AI_ERROR_CODES.UNKNOWN])
    expect(toLearnerAiErrorMessage('lỗi gì đó không xác định')).toBe(LEARNER_MESSAGES[AI_ERROR_CODES.UNKNOWN])
  })

  it('mọi câu trả về đều là tiếng Việt thân thiện, không chứa tên kỹ thuật', () => {
    for (const code of Object.values(AI_ERROR_CODES)) {
      const msg = LEARNER_MESSAGES[code]
      expect(msg.length).toBeGreaterThan(10)
      expect(msg).not.toMatch(/http|api|model|token|json|groq|gemini|stack/i)
    }
  })
})

describe('logAiError — chi tiết ở server', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ghi status/code/message kèm tag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logAiError('[Writing AI Error]', Object.assign(new Error('boom upstream'), { status: 503, code: 'ServerError' }))

    expect(spy).toHaveBeenCalledTimes(1)
    const [tag, detail] = spy.mock.calls[0]
    expect(tag).toBe('[Writing AI Error]')
    expect(detail).toMatchObject({ status: 503, code: 'SERVERERROR', message: 'boom upstream' })
  })

  it('không ném lỗi khi error là null', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => logAiError('[Test]', null)).not.toThrow()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
