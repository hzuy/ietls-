// In-memory concurrency lock with TTL (180s).
// Guards AI explanation runs so two tabs do not write the same question twice.
// The lock accepts an optional slot count: a single run may hold one slot while
// independent question groups still use the remaining slots. Every DB write is
// additionally protected by the transaction-scoped advisory lock and by the
// compare-and-swap on the stored explanation (see lib/explanationWriteLock.js).

const DEFAULT_TTL_MS = 180 * 1000 // 180s per requirement 2.5

const MAX_CONCURRENT_RUNS = 4

function normalizeLimit(limit) {
  const value = Number(limit)
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(MAX_CONCURRENT_RUNS, Math.floor(value))
}

class ExplanationLock {
  constructor(defaultTtlMs = DEFAULT_TTL_MS) {
    this.locks = new Map() // key -> { at, count }
    this.defaultTtlMs = defaultTtlMs
  }

  freshEntry(key, ttlMs = this.defaultTtlMs) {
    const entry = this.locks.get(key)
    if (!entry) return null
    if (Date.now() - entry.at > ttlMs) {
      this.locks.delete(key)
      return null
    }
    return entry
  }

  isLocked(key, ttlMs = this.defaultTtlMs) {
    return Boolean(this.freshEntry(key, ttlMs))
  }

  activeCount(key, ttlMs = this.defaultTtlMs) {
    return this.freshEntry(key, ttlMs)?.count || 0
  }

  acquire(key, ttlMs = this.defaultTtlMs, limit = 1) {
    const max = normalizeLimit(limit)
    const entry = this.freshEntry(key, ttlMs)
    if (!entry) {
      this.locks.set(key, { at: Date.now(), count: 1 })
      return true
    }
    if (entry.count >= max) return false
    entry.count += 1
    entry.at = Date.now()
    return true
  }

  release(key) {
    const entry = this.locks.get(key)
    if (!entry) return
    entry.count -= 1
    if (entry.count <= 0) this.locks.delete(key)
  }

  clear() {
    this.locks.clear()
  }
}

const globalLock = new ExplanationLock()

// How many HTTP explanation requests may hold a slot for the same exam at once.
// The default of 1 keeps the old "one AI task per exam" behaviour; raise it with
// AI_EXPLANATION_HTTP_CONCURRENCY when two teachers must work in parallel.
const MAX_HTTP_CONCURRENCY = 4
const DEFAULT_HTTP_CONCURRENCY = 1

function httpRunConcurrency() {
  const raw = Number(process.env.AI_EXPLANATION_HTTP_CONCURRENCY)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_HTTP_CONCURRENCY
  return Math.min(MAX_HTTP_CONCURRENCY, Math.floor(raw))
}

module.exports = {
  ExplanationLock,
  globalLock,
  acquireLock: (key, ttlMs, limit) => globalLock.acquire(key, ttlMs, limit),
  acquireRunSlot: (key) => globalLock.acquire(key, undefined, httpRunConcurrency()),
  releaseLock: (key) => globalLock.release(key),
  isLocked: (key, ttlMs) => globalLock.isLocked(key, ttlMs),
  activeLockCount: (key, ttlMs) => globalLock.activeCount(key, ttlMs),
  clearAllLocks: () => globalLock.clear(),
  httpRunConcurrency,
  DEFAULT_TTL_MS,
  MAX_CONCURRENT_RUNS,
  MAX_HTTP_CONCURRENCY,
  normalizeLimit,
}
