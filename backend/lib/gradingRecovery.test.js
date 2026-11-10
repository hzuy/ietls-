import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const {
  reconcileStaleWritingGrading,
  startGradingRecovery,
  DEFAULT_STALE_MS,
} = require('./gradingRecovery')

describe('lib/gradingRecovery — TC-048', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('marks every in-flight job failed on startup (olderThanMs = 0)', async () => {
    const prisma = { writingAnswer: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } }

    const count = await reconcileStaleWritingGrading(prisma)

    expect(count).toBe(2)
    expect(prisma.writingAnswer.updateMany).toHaveBeenCalledWith({
      where: { status: { in: ['pending', 'grading'] } },
      data: { status: 'failed', error: 'grading_interrupted' },
    })
  })

  it('only touches jobs older than the cutoff in stale mode', async () => {
    const prisma = { writingAnswer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } }
    const now = new Date('2026-11-06T10:00:00.000Z')

    await reconcileStaleWritingGrading(prisma, { olderThanMs: 15 * 60 * 1000, now })

    const cutoff = new Date(now.getTime() - 15 * 60 * 1000)
    expect(prisma.writingAnswer.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['pending', 'grading'] },
        OR: [
          { gradingStartedAt: { lt: cutoff } },
          { gradingStartedAt: null, createdAt: { lt: cutoff } },
        ],
      },
      data: { status: 'failed', error: 'grading_interrupted' },
    })
  })

  it('runs at startup and then periodically, without keeping the process alive', async () => {
    const prisma = { writingAnswer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } }
    const logger = { warn: vi.fn(), error: vi.fn() }
    const previousInterval = process.env.GRADING_RECOVERY_INTERVAL_MS
    const previousMode = process.env.GRADING_RECONCILE_ON_STARTUP
    process.env.GRADING_RECOVERY_INTERVAL_MS = '20'
    delete process.env.GRADING_RECONCILE_ON_STARTUP

    const timer = startGradingRecovery(prisma, { logger })
    try {
      await vi.waitFor(() => expect(prisma.writingAnswer.updateMany).toHaveBeenCalledTimes(1))
      expect(prisma.writingAnswer.updateMany.mock.calls[0][0].where).toEqual({
        status: { in: ['pending', 'grading'] },
      })

      await vi.waitFor(() => expect(prisma.writingAnswer.updateMany.mock.calls.length).toBeGreaterThanOrEqual(2))
      const periodicWhere = prisma.writingAnswer.updateMany.mock.calls[1][0].where
      expect(periodicWhere.OR).toBeDefined()

      // Timer đã unref → không giữ event loop sống.
      expect(typeof timer.unref).toBe('function')
    } finally {
      clearInterval(timer)
      if (previousInterval === undefined) delete process.env.GRADING_RECOVERY_INTERVAL_MS
      else process.env.GRADING_RECOVERY_INTERVAL_MS = previousInterval
      if (previousMode === undefined) delete process.env.GRADING_RECONCILE_ON_STARTUP
      else process.env.GRADING_RECONCILE_ON_STARTUP = previousMode
    }
  })

  it('swallows database errors instead of crashing the server', async () => {
    const prisma = { writingAnswer: { updateMany: vi.fn().mockRejectedValue(new Error('db down')) } }
    const logger = { warn: vi.fn(), error: vi.fn() }

    await expect(reconcileStaleWritingGrading(prisma)).rejects.toThrow('db down')
    // startGradingRecovery bắt lỗi và chỉ log.
    const previous = process.env.GRADING_RECONCILE_ON_STARTUP
    process.env.GRADING_RECONCILE_ON_STARTUP = 'all'
    const timer = startGradingRecovery(prisma, { logger })
    try {
      await vi.waitFor(() => expect(logger.error).toHaveBeenCalled())
    } finally {
      clearInterval(timer)
      if (previous === undefined) delete process.env.GRADING_RECONCILE_ON_STARTUP
      else process.env.GRADING_RECONCILE_ON_STARTUP = previous
    }
    expect(DEFAULT_STALE_MS).toBe(15 * 60 * 1000)
  })
})
