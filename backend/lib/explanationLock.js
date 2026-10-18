// In-memory concurrency lock with TTL (180s)
// Giữ an toàn cho tác vụ sinh lời giải AI, ngăn chặn race condition giữa
// sinh cả đề, sinh theo nhóm, tạo lại một câu, sửa tay, duyệt và cập nhật form.

const DEFAULT_TTL_MS = 180 * 1000 // 180s per requirement 2.5

class ExplanationLock {
  constructor(defaultTtlMs = DEFAULT_TTL_MS) {
    this.locks = new Map() // key -> timestamp
    this.defaultTtlMs = defaultTtlMs
  }

  isLocked(key, ttlMs = this.defaultTtlMs) {
    if (!this.locks.has(key)) return false
    const ts = this.locks.get(key)
    if (Date.now() - ts > ttlMs) {
      this.locks.delete(key)
      return false
    }
    return true
  }

  acquire(key, ttlMs = this.defaultTtlMs) {
    if (this.isLocked(key, ttlMs)) {
      return false
    }
    this.locks.set(key, Date.now())
    return true
  }

  release(key) {
    this.locks.delete(key)
  }

  clear() {
    this.locks.clear()
  }
}

const globalLock = new ExplanationLock()

module.exports = {
  ExplanationLock,
  globalLock,
  acquireLock: (key, ttlMs) => globalLock.acquire(key, ttlMs),
  releaseLock: (key) => globalLock.release(key),
  isLocked: (key, ttlMs) => globalLock.isLocked(key, ttlMs),
  clearAllLocks: () => globalLock.clear(),
  DEFAULT_TTL_MS,
}
