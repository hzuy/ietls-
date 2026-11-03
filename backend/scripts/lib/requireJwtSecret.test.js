import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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

  it('nạp file .env khi biến môi trường chưa có (giống server.js)', () => {
    delete process.env.JWT_SECRET
    // Tạo .env tạm để test không phụ thuộc backend/.env có sẵn trên máy hay không.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwt-secret-'))
    const envPath = path.join(dir, '.env')
    fs.writeFileSync(envPath, 'JWT_SECRET=secret-tu-file-env\n')
    try {
      expect(requireJwtSecret({ envPath })).toBe('secret-tu-file-env')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
