import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  setting: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    deleteMany: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
  },
}

const prismaPath = require.resolve('./prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const {
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_LOG_PURGE_MIN_INTERVAL_MS,
  LAST_PURGE_SETTING_KEY,
  claimPurgeRun,
  purgeOldAuditLogs,
} = require('./auditLogRetention')

describe('claimPurgeRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claim thành công khi chưa có Setting nào (lần chạy đầu tiên)', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.setting.create.mockResolvedValue({})

    const result = await claimPurgeRun(new Date())

    expect(result).toBe(true)
    expect(prismaMock.setting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: LAST_PURGE_SETTING_KEY }),
    })
  })

  it('claim bị chặn khi Setting đã tồn tại và chưa đủ khoảng cách tối thiểu', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.setting.findUnique.mockResolvedValue({ key: LAST_PURGE_SETTING_KEY, value: new Date().toISOString() })

    const result = await claimPurgeRun(new Date())

    expect(result).toBe(false)
    expect(prismaMock.setting.create).not.toHaveBeenCalled()
  })

  it('claim thành công lại sau khi đã đủ khoảng cách tối thiểu (updateMany trúng)', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })

    const result = await claimPurgeRun(new Date())

    expect(result).toBe(true)
    expect(prismaMock.setting.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.setting.create).not.toHaveBeenCalled()
  })

  it('claim thất bại khi race: create đụng unique constraint (P2002)', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.setting.findUnique.mockResolvedValue(null)
    const err = new Error('Unique constraint failed')
    err.code = 'P2002'
    prismaMock.setting.create.mockRejectedValue(err)

    const result = await claimPurgeRun(new Date())

    expect(result).toBe(false)
  })

  it('ném lại lỗi không phải P2002 từ create', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.setting.findUnique.mockResolvedValue(null)
    prismaMock.setting.create.mockRejectedValue(new Error('DB down'))

    await expect(claimPurgeRun(new Date())).rejects.toThrow('DB down')
  })

  it('dùng đúng ngưỡng AUDIT_LOG_PURGE_MIN_INTERVAL_MS khi tính staleBefore', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })
    const now = new Date('2026-01-01T12:00:00.000Z')

    await claimPurgeRun(now)

    const expectedStaleBefore = new Date(now.getTime() - AUDIT_LOG_PURGE_MIN_INTERVAL_MS).toISOString()
    expect(prismaMock.setting.updateMany).toHaveBeenCalledWith({
      where: { key: LAST_PURGE_SETTING_KEY, value: { lt: expectedStaleBefore } },
      data: { value: now.toISOString() },
    })
  })
})

describe('purgeOldAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('không làm gì khi claim thất bại (không gọi deleteMany)', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.setting.findUnique.mockResolvedValue({ key: LAST_PURGE_SETTING_KEY, value: new Date().toISOString() })

    await purgeOldAuditLogs()

    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('không ghi audit log khi deleteMany trả count 0 (tránh log rác)', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 0 })

    await purgeOldAuditLogs()

    expect(prismaMock.auditLog.deleteMany).toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('ghi audit log auditlog.auto_purge với actorType system và metadata đúng khi count > 0', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 5 })

    await purgeOldAuditLogs()

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1)
    const call = prismaMock.auditLog.create.mock.calls[0][0]
    expect(call.data.action).toBe('auditlog.auto_purge')
    expect(call.data.entityType).toBe('AuditLog')
    expect(call.data.actorType).toBe('system')
    expect(call.data.actorUserId).toBeNull()
    expect(call.data.metadata).toMatchObject({ deletedCount: 5 })
    expect(call.data.metadata.cutoff).toEqual(expect.any(String))
  })

  it('dùng đúng cutoff theo AUDIT_LOG_RETENTION_DAYS khi gọi deleteMany', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 0 })
    const before = Date.now()

    await purgeOldAuditLogs()

    const arg = prismaMock.auditLog.deleteMany.mock.calls[0][0]
    const cutoff = arg.where.createdAt.lt
    const expectedMs = AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    // Cho phép sai số nhỏ do thời gian thực thi giữa Date.now() ở test và trong hàm.
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(expectedMs - 1000)
    expect(before - cutoff.getTime()).toBeLessThanOrEqual(expectedMs + 5000)
  })

  it('không throw ra ngoài khi deleteMany lỗi — chỉ console.error', async () => {
    prismaMock.setting.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auditLog.deleteMany.mockRejectedValue(new Error('DB down'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(purgeOldAuditLogs()).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('không throw ra ngoài khi claimPurgeRun lỗi bất ngờ', async () => {
    prismaMock.setting.updateMany.mockRejectedValue(new Error('DB down'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(purgeOldAuditLogs()).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
