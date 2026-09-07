const NodeCache = require('node-cache')
const { invalidate: invalidateSwr } = require('../lib/swrCache')

// NodeCache instance: stdTTL 10 phút, checkperiod dọn rác 2 phút
const memoryCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  useClones: true,
})

const TTL_CAMBRIDGE = 600       // 10 phút
const TTL_FULLTEST = 600        // 10 phút
const TTL_EXAM_DETAIL = 900     // 15 phút

/**
 * Lấy dữ liệu từ cache theo key
 */
function get(key) {
  return memoryCache.get(key)
}

/**
 * Ghi dữ liệu vào cache với TTL tùy chọn (tính bằng giây)
 */
function set(key, value, ttl = 600) {
  return memoryCache.set(key, value, ttl)
}

/**
 * Xóa 1 hoặc nhiều key
 */
function del(keyOrKeys) {
  return memoryCache.del(keyOrKeys)
}

/**
 * Xóa toàn bộ cache
 */
function flushAll() {
  return memoryCache.flushAll()
}

/**
 * Cache Wrapper: Lấy từ cache nếu có, nếu chưa có thì gọi fetcher() và lưu lại
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 * @param {number} [ttlSeconds]
 */
async function getOrSet(key, fetcher, ttlSeconds = 600) {
  const cached = memoryCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const fresh = await fetcher()
  if (fresh !== undefined && fresh !== null) {
    memoryCache.set(key, fresh, ttlSeconds)
  }
  return fresh
}

/**
 * Invalidation Helper: Xóa cache khi có cập nhật đề thi
 * @param {number|string} [examId]
 */
function invalidateExamCaches(examId) {
  if (examId) {
    memoryCache.del([
      `exam:reading:${examId}`,
      `exam:listening:${examId}`,
    ])
  }
  // Xóa các key danh mục
  const allKeys = memoryCache.keys()
  const toDelete = allKeys.filter(k =>
    k.startsWith('exam:') ||
    k.startsWith('cambridge:') ||
    k.startsWith('fulltests:')
  )
  if (toDelete.length > 0) {
    memoryCache.del(toDelete)
  }

  // Đồng bộ invalidate qua SWR cache
  try {
    invalidateSwr('fulltests:')
    invalidateSwr('practice:')
    invalidateSwr('samples:')
  } catch {
    // SWR cache optional
  }
}

module.exports = {
  cache: memoryCache,
  get,
  set,
  del,
  flushAll,
  getOrSet,
  invalidateExamCaches,
  TTL_CAMBRIDGE,
  TTL_FULLTEST,
  TTL_EXAM_DETAIL,
}
