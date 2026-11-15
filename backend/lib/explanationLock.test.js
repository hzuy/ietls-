import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
const { ExplanationLock, acquireLock, acquireRunSlot, releaseLock, isLocked, clearAllLocks, httpRunConcurrency, normalizeLimit } = require('./explanationLock')

describe('ExplanationLock (Requirement 2.5 & A.2)', () => {
  beforeEach(() => {
    clearAllLocks()
    vi.useRealTimers()
  })

  it('acquires and releases lock successfully', () => {
    expect(acquireLock('exam:10')).toBe(true)
    expect(isLocked('exam:10')).toBe(true)
    expect(acquireLock('exam:10')).toBe(false) // already locked

    releaseLock('exam:10')
    expect(isLocked('exam:10')).toBe(false)
    expect(acquireLock('exam:10')).toBe(true)
  })

  it('expires lock after TTL', () => {
    vi.useFakeTimers()
    const lock = new ExplanationLock(180000) // 180s

    expect(lock.acquire('exam:20')).toBe(true)
    expect(lock.isLocked('exam:20')).toBe(true)

    // Advance 179s - still locked
    vi.advanceTimersByTime(179000)
    expect(lock.isLocked('exam:20')).toBe(true)
    expect(lock.acquire('exam:20')).toBe(false)

    // Advance past 180s - expired
    vi.advanceTimersByTime(2000)
    expect(lock.isLocked('exam:20')).toBe(false)
    expect(lock.acquire('exam:20')).toBe(true)
  })

  it('manages different keys independently', () => {
    expect(acquireLock('exam:1')).toBe(true)
    expect(acquireLock('exam:2')).toBe(true)
    expect(acquireLock('practice:1')).toBe(true)

    expect(isLocked('exam:1')).toBe(true)
    expect(isLocked('exam:2')).toBe(true)
    expect(isLocked('practice:1')).toBe(true)
    expect(isLocked('practice:2')).toBe(false)

    releaseLock('exam:1')
    expect(isLocked('exam:1')).toBe(false)
    expect(isLocked('exam:2')).toBe(true)
  })
})

describe('ExplanationLock slot limit', () => {
  const env = process.env.AI_EXPLANATION_HTTP_CONCURRENCY

  beforeEach(() => clearAllLocks())
  afterEach(() => {
    if (env === undefined) delete process.env.AI_EXPLANATION_HTTP_CONCURRENCY
    else process.env.AI_EXPLANATION_HTTP_CONCURRENCY = env
  })

  it('allows up to the requested number of concurrent holders', () => {
    expect(acquireLock('exam:30', undefined, 2)).toBe(true)
    expect(acquireLock('exam:30', undefined, 2)).toBe(true)
    expect(acquireLock('exam:30', undefined, 2)).toBe(false) // both slots taken

    releaseLock('exam:30') // a single release frees exactly one slot
    expect(acquireLock('exam:30', undefined, 2)).toBe(true)

    releaseLock('exam:30')
    releaseLock('exam:30')
    expect(isLocked('exam:30')).toBe(false)
  })

  it('clamps the limit to the supported maximum', () => {
    expect(normalizeLimit(99)).toBe(4)
    expect(normalizeLimit(0)).toBe(1)
    expect(normalizeLimit('abc')).toBe(1)
  })

  it('defaults the HTTP slot count to one and honours the env override', () => {
    delete process.env.AI_EXPLANATION_HTTP_CONCURRENCY
    expect(httpRunConcurrency()).toBe(1)
    expect(acquireRunSlot('exam:31')).toBe(true)
    expect(acquireRunSlot('exam:31')).toBe(false)

    process.env.AI_EXPLANATION_HTTP_CONCURRENCY = '2'
    expect(httpRunConcurrency()).toBe(2)
    expect(acquireRunSlot('exam:32')).toBe(true)
    expect(acquireRunSlot('exam:32')).toBe(true)
    expect(acquireRunSlot('exam:32')).toBe(false)
  })
})
