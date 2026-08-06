import { describe, it, expect } from 'vitest'
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  adminChangePasswordSchema,
  createAccountSchema,
} = require('./authValidator')

describe('authValidator', () => {
  describe('registerSchema', () => {
    it('passes with valid registration payload', () => {
      const valid = { email: 'student@example.com', password: 'password123', name: 'Nguyen Van A' }
      const res = registerSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('fails when email is invalid', () => {
      const invalid = { email: 'invalid-email', password: 'password123', name: 'Nguyen Van A' }
      const res = registerSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Email không đúng định dạng')
    })

    it('fails when password is too short (< 8 chars)', () => {
      const invalid = { email: 'student@example.com', password: 'short', name: 'Nguyen Van A' }
      const res = registerSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Mật khẩu phải có ít nhất 8 ký tự')
    })
  })

  describe('loginSchema', () => {
    it('passes with valid login payload', () => {
      const valid = { email: 'student@example.com', password: 'password123' }
      const res = loginSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('fails when email or password is empty', () => {
      const invalid = { email: '', password: '' }
      const res = loginSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })
  })

  describe('adminChangePasswordSchema vs changePasswordSchema', () => {
    it('requires 8 chars for user password change', () => {
      const payload = { oldPassword: 'pass', newPassword: '123456' }
      const res = changePasswordSchema.safeParse(payload)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Mật khẩu mới phải có ít nhất 8 ký tự')
    })

    it('allows 6 chars for admin password change per policy', () => {
      const payload = { currentPassword: 'pass', newPassword: '123456' }
      const res = adminChangePasswordSchema.safeParse(payload)
      expect(res.success).toBe(true)
    })
  })

  describe('createAccountSchema', () => {
    it('fails when role is not admin or teacher', () => {
      const invalid = { email: 'teacher@example.com', password: 'password123', name: 'Teacher', role: 'student' }
      const res = createAccountSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      expect(res.error.issues[0].message).toBe('Role không hợp lệ')
    })
  })
})
