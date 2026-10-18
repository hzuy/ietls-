import { describe, it, expect, beforeEach, vi } from 'vitest'
const { ExplanationLock, acquireLock, releaseLock, isLocked, clearAllLocks } = require('./explanationLock')

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
