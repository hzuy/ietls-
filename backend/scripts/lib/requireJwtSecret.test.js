import { describe, it, expect, afterEach } from 'vitest'

import { requireJwtSecret } from './requireJwtSecret'

/**
 * HỒI QUY: 4 script verify/capture từng hardcode JWT_SECRET production thật (giá
 * trị trùng với JWT_SECRET trong backend/.env) làm giá trị mặc định, tức là bí mật
 * production nằm trong mã nguồn đã commit. Helper này thay thế chúng: không còn
 * secret nào trong repo và báo lỗi rõ ràng nếu thiếu biến môi trường.
 */
describe('requireJwtSecret', () => {
  const original = process.env.JWT_SECRET

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })

  it('trả về JWT_SECRET khi biến môi trường đã được set', () => {
    process.env.JWT_SECRET = 'secret-tu-bien-moi-truong'
    expect(requireJwtSecret()).toBe('secret-tu-bien-moi-truong')
  })

  it('báo lỗi rõ ràng khi thiếu JWT_SECRET (không có secret mặc định)', () => {
    delete process.env.JWT_SECRET
    expect(() => requireJwtSecret({ loadEnv: false })).toThrow(/Thiếu JWT_SECRET/)
  })

  it('coi chuỗi chỉ có khoảng trắng là thiếu', () => {
    process.env.JWT_SECRET = '   '
    expect(() => requireJwtSecret({ loadEnv: false })).toThrow(/Thiếu JWT_SECRET/)
  })

  it('nạp backend/.env khi biến môi trường chưa có (giống server.js)', () => {
    delete process.env.JWT_SECRET
    const secret = requireJwtSecret()
    expect(typeof secret).toBe('string')
    expect(secret.trim().length).toBeGreaterThan(0)
  })
})
