import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  auditLog: {
    create: vi.fn().mockResolvedValue({})
  }
}

const prismaPath = require.resolve('./prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock
}

const { logAuditEvent, sanitizeMetadata } = require('./auditLog')

describe('sanitizeMetadata', () => {
  it('lọc bỏ các khóa nhạy cảm (password/token/secret và biến thể)', () => {
    const result = sanitizeMetadata({
      password: 'x',
      plainPassword: 'y',
      resetToken: 'z',
      apiSecret: 'w',
      created: 3,
      updated: 1
    })
    expect(result).toEqual({ created: 3, updated: 1 })
  })

  it('lọc đệ quy trong object lồng nhau', () => {
    const result = sanitizeMetadata({ nested: { token: 'x', keep: 1 }, list: [{ secret: 'a', ok: 2 }] })
    expect(result).toEqual({ nested: { keep: 1 }, list: [{ ok: 2 }] })
  })

  it('giữ nguyên giá trị không phải object', () => {
    expect(sanitizeMetadata(null)).toBeNull()
    expect(sanitizeMetadata(undefined)).toBeNull()
    expect(sanitizeMetadata(5)).toBe(5)
  })
})

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trích actor từ req.user khi có req (actorType "user")', async () => {
    const req = { user: { userId: 7, email: 'teacher@example.com', role: 'teacher' } }
    await logAuditEvent(req, {
      action: 'exam.create',
      entityType: 'Exam',
      entityId: 10,
      entityLabel: 'Test 1',
      metadata: { created: 1 }
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorType: 'user',
        actorUserId: 7,
        actorEmail: 'teacher@example.com',
        actorName: null,
        actorRole: 'teacher',
        action: 'exam.create',
        entityType: 'Exam',
        entityId: 10,
        entityLabel: 'Test 1',
        metadata: { created: 1 }
      }
    })
  })

  it('dùng actorType "system" và actorUserId null khi không có req', async () => {
    await logAuditEvent(null, {
      action: 'trash.auto_purge',
      entityType: 'Exam',
      metadata: { count: 2 }
    })

    const call = prismaMock.auditLog.create.mock.calls[0][0]
    expect(call.data.actorType).toBe('system')
    expect(call.data.actorUserId).toBeNull()
    expect(call.data.actorEmail).toBeNull()
    expect(call.data.actorRole).toBeNull()
  })

  it('lọc khóa nhạy cảm khỏi metadata trước khi ghi', async () => {
    await logAuditEvent({ user: { userId: 1, email: 'a@a.com', role: 'admin' } }, {
      action: 'user.password_reset',
      entityType: 'User',
      entityId: 5,
      metadata: { newPassword: 'abc123', note: 'ok' }
    })

    const call = prismaMock.auditLog.create.mock.calls[0][0]
    expect(call.data.metadata).toEqual({ note: 'ok' })
  })

  it('không throw khi prisma.auditLog.create ném lỗi — thao tác gọi vẫn resolve bình thường', async () => {
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('DB down'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(logAuditEvent(null, { action: 'exam.delete', entityType: 'Exam', entityId: 1 })).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
