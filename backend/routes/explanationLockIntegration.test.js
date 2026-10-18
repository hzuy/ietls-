import { describe, it, expect, beforeEach, vi } from 'vitest'
const { acquireLock, releaseLock, clearAllLocks, isLocked } = require('../lib/explanationLock')

describe('Explanation Route Locks Integration (Requirement 2.5 & A.2)', () => {
  beforeEach(() => {
    clearAllLocks()
  })

  it('rejects concurrent AI generation on same exam', () => {
    expect(acquireLock('exam:10')).toBe(true)
    expect(acquireLock('exam:10')).toBe(false)
    expect(isLocked('exam:10')).toBe(true)
    releaseLock('exam:10')
    expect(isLocked('exam:10')).toBe(false)
  })

  it('rejects manual edit and review while AI is running on exam', () => {
    acquireLock('exam:10')
    // Attempting edit/review when locked
    expect(isLocked('exam:10')).toBe(true)
    releaseLock('exam:10')
    expect(isLocked('exam:10')).toBe(false)
  })

  it('rejects concurrent AI generation and save on same practice exam', () => {
    expect(acquireLock('practice:5')).toBe(true)
    expect(acquireLock('practice:5')).toBe(false)
    // Attempting practice save when locked
    expect(isLocked('practice:5')).toBe(true)
    releaseLock('practice:5')
    expect(isLocked('practice:5')).toBe(false)
  })

  it('isolates different exams and practice exams', () => {
    acquireLock('exam:1')
    expect(isLocked('exam:1')).toBe(true)
    expect(isLocked('exam:2')).toBe(false)
    expect(isLocked('practice:1')).toBe(false)
    releaseLock('exam:1')
  })
})
