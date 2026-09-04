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
      const promise = fetcher()
        .then(freshData => {
          cache.set(cacheKey, { data: freshData, ts: Date.now() })
        })
        .catch(err => {
          if (process.env.NODE_ENV !== 'production') console.error(`[SWR Background Revalidate Error - ${cacheKey}]`, err)
        })
        .finally(() => {
          pendingRevalidations.delete(cacheKey)
        })
      pendingRevalidations.set(cacheKey, promise)
    }
    return cached.data
  }

  // 3. No cache exists (cold start) -> check if another request is already fetching cold data
  if (pendingRevalidations.has(cacheKey)) {
    await pendingRevalidations.get(cacheKey)
    const newCached = cache.get(cacheKey)
    if (newCached) return newCached.data
  }

  // Cold start calculation
  const promise = (async () => {
    const data = await fetcher()
    cache.set(cacheKey, { data, ts: Date.now() })
    return data
  })()

  pendingRevalidations.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    pendingRevalidations.delete(cacheKey)
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
  if (typeof keyOrPrefix === 'function') {
    for (const k of cache.keys()) if (keyOrPrefix(k)) cache.delete(k)
    return
  }
  if (typeof keyOrPrefix !== 'string' || keyOrPrefix === '') return
  for (const k of cache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) cache.delete(k)
  }
}

/** Xoá sạch — chủ yếu dùng trong test. */
function clearAll() {
  cache.clear()
  pendingRevalidations.clear()
}

module.exports = { getOrRevalidate, invalidate, clearAll, DEFAULT_TTL }
