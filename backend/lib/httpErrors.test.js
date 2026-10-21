import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendServerError, DEFAULT_MESSAGE } from './httpErrors'

// res giả tối thiểu: chỉ những gì sendServerError cần dùng.
function makeRes({ headersSent = false } = {}) {
  const res = { headersSent }
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('sendServerError — không rò chi tiết lỗi nội bộ ra client', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('trả 500 chỉ với message, KHÔNG kèm field error', () => {
    const res = makeRes()

    sendServerError(res, new Error('lỗi nội bộ'))

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: DEFAULT_MESSAGE })
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('error')
  })

  it('giữ thông điệp tiếng Việt riêng của từng route', () => {
    const res = makeRes()

    sendServerError(res, new Error('x'), 'Lỗi upload')

    expect(res.json).toHaveBeenCalledWith({ message: 'Lỗi upload' })
  })

  it('ghi log server kèm stack để còn debug được', () => {
    const err = new Error('Raw query failed. Code: "42703". Message: column "secretColumn" does not exist')
    const res = makeRes()

    sendServerError(res, err, 'Lỗi server')

    const logged = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('[SERVER_ERROR] Lỗi server')
    expect(logged).toContain('column "secretColumn" does not exist')
    // Có stack (không chỉ mỗi message)
    expect(logged).toContain('httpErrors.test.js')
  })

  it('không gửi thêm gì khi response đã được gửi (headersSent)', () => {
    const res = makeRes({ headersSent: true })

    const result = sendServerError(res, new Error('x'))

    expect(result).toBeUndefined()
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('vẫn hoạt động khi lỗi không phải Error object (vd string) và dùng message mặc định nếu message rỗng', () => {
    const res = makeRes()

    sendServerError(res, 'lỗi dạng chuỗi', '')

    expect(res.json).toHaveBeenCalledWith({ message: DEFAULT_MESSAGE })
    const logged = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('lỗi dạng chuỗi')
  })
})
