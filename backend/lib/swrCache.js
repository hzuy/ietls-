// ─── STALE-WHILE-REVALIDATE CACHE (in-memory, per-process) ────────────────────
// Tách ra từ routes/admin/dashboard.js để nhiều route file dùng chung MỘT store
// + có cơ chế invalidate khi admin sửa nội dung.
//
// Đặc điểm:
//   - Fresh (< ttl)            → trả ngay từ cache.
//   - Stale (>= ttl, có data)  → trả ngay data cũ, revalidate NỀN 1 lần.
//   - Cold (chưa có data)      → tính 1 lần, các request đồng thời chờ chung
//                                promise đó (chống stampede / dogpile).
//
// Lưu ý: cache sống trong RAM process. Server chạy 1 container Node duy nhất
// (docker-compose) nên đủ dùng. Nếu sau này scale nhiều instance thì thay bằng
// Redis — giữ nguyên interface getOrRevalidate / invalidate.

const cache = new Map()
const pendingRevalidations = new Map()
const generations = new Map()

const DEFAULT_TTL = 60 * 1000 // 60s

/**
 * @param {string}   cacheKey
 * @param {() => Promise<any>} fetcher  Hàm tính dữ liệu (thường là truy vấn DB).
 * @param {number}   [ttl]   Thời gian coi là "fresh", ms. Mặc định 60s.
 */
async function getOrRevalidate(cacheKey, fetcher, ttl = DEFAULT_TTL) {
  const cached = cache.get(cacheKey)
  const now = Date.now()

  // 1. Fresh cache exists -> return immediately
  if (cached && (now - cached.ts < ttl)) {
    return cached.data
  }

  // 2. Stale cache exists -> return immediately, revalidate in background
  if (cached) {
    if (!pendingRevalidations.has(cacheKey)) {
      const generation = generations.get(cacheKey) || 0
      const promise = fetcher()
        .then(freshData => {
          if ((generations.get(cacheKey) || 0) === generation) cache.set(cacheKey, { data: freshData, ts: Date.now() })
        })
        .catch(err => {
          if (process.env.NODE_ENV !== 'production') console.error(`[SWR Background Revalidate Error - ${cacheKey}]`, err)
        })
        .finally(() => {
          if (pendingRevalidations.get(cacheKey) === promise) pendingRevalidations.delete(cacheKey)
        })
      pendingRevalidations.set(cacheKey, promise)
    }
    return cached.data
  }

  // 3. No cache exists (cold start) -> check if another request is already fetching cold data
  if (pendingRevalidations.has(cacheKey)) {
    const pending = pendingRevalidations.get(cacheKey)
    await pending
    const newCached = cache.get(cacheKey)
    if (newCached) return newCached.data
    if (pendingRevalidations.get(cacheKey) !== pending) return getOrRevalidate(cacheKey, fetcher, ttl)
  }

  // Cold start calculation
  const generation = generations.get(cacheKey) || 0
  const promise = (async () => {
    const data = await fetcher()
    if ((generations.get(cacheKey) || 0) === generation) cache.set(cacheKey, { data, ts: Date.now() })
    return data
  })()

  pendingRevalidations.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    if (pendingRevalidations.get(cacheKey) === promise) pendingRevalidations.delete(cacheKey)
  }
}

/**
 * Xoá cache. Truyền:
 *   - string  → xoá key đúng bằng nó HOẶC bắt đầu bằng nó (prefix). Vd
 *               invalidate('practice:') xoá cả 'practice:reading:4', 'practice:listening:0'...
 *   - function(key) → xoá mọi key mà predicate trả true.
 * Không truyền gì → không làm gì (tránh xoá nhầm toàn bộ).
 */
function invalidate(keyOrPrefix) {
  const matches = key => typeof keyOrPrefix === 'function'
    ? keyOrPrefix(key)
    : typeof keyOrPrefix === 'string' && keyOrPrefix !== '' && (key === keyOrPrefix || key.startsWith(keyOrPrefix))
  const keys = new Set([...cache.keys(), ...pendingRevalidations.keys()])
  for (const key of keys) {
    if (!matches(key)) continue
    generations.set(key, (generations.get(key) || 0) + 1)
    cache.delete(key)
    pendingRevalidations.delete(key)
  }
}

/** Xoá sạch — chủ yếu dùng trong test. */
function clearAll() {
  cache.clear()
  pendingRevalidations.clear()
  generations.clear()
}

module.exports = { getOrRevalidate, invalidate, clearAll, DEFAULT_TTL }
