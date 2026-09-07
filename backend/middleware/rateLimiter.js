const rateLimit = require('express-rate-limit')

const DEFAULT_WINDOW_MS = (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000
const DEFAULT_OBJECTIVE_MAX = parseInt(process.env.RATE_LIMIT_SUBMIT_OBJECTIVE_MAX) || 20
const DEFAULT_AI_MAX = parseInt(process.env.RATE_LIMIT_SUBMIT_AI_MAX) || 10

/**
 * Key generator distinguishing by authenticated userId when available,
 * falling back to client IP.
 */
function defaultKeyGenerator(req) {
  if (req.user && req.user.userId) {
    return `user_${req.user.userId}`
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * Skip logic to prevent existing test suites (with multiple mocked submits in a single run)
 * from hitting rate limits, while allowing dedicated rate limit tests via header 'x-test-rate-limit'.
 */
function shouldSkip(req) {
  if (process.env.NODE_ENV === 'test') {
    if (req.headers && req.headers['x-test-rate-limit'] === 'true') return false
    if (process.env.ENABLE_RATE_LIMIT_IN_TEST === 'true') return false
    return true
  }
  return false
}

/**
 * Factory for creating configured rate limiters with JSON response format.
 */
function createSubmitRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_OBJECTIVE_MAX,
  message = 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
  skip = shouldSkip,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    keyGenerator: defaultKeyGenerator,
    validate: { keyGeneratorIpFallback: false },
    skip,
    handler: (req, res, next, options) => {
      res.status(429).json({ message: options.message })
    },
    message,
  })
}

// ── Rate limiter cho kỹ năng khách quan (Reading & Listening) ─────────────────
// Mặc định: tối đa 20 lượt nộp bài / user trong 15 phút
const objectiveSubmitLimiter = createSubmitRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: DEFAULT_OBJECTIVE_MAX,
  message: 'Bạn đã nộp bài quá nhiều lần. Vui lòng thử lại sau 15 phút.',
})

// ── Rate limiter cho kỹ năng chấm bằng AI (Writing & Speaking) ────────────────
// Mặc định: tối đa 10 lượt chấm / user trong 15 phút (tránh cạn kiệt quota Groq AI)
const aiSubmitLimiter = createSubmitRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: DEFAULT_AI_MAX,
  message: 'Bạn đã gửi yêu cầu chấm điểm AI quá giới hạn. Vui lòng thử lại sau 15 phút.',
})

module.exports = {
  createSubmitRateLimiter,
  objectiveSubmitLimiter,
  aiSubmitLimiter,
  defaultKeyGenerator,
  DEFAULT_WINDOW_MS,
  DEFAULT_OBJECTIVE_MAX,
  DEFAULT_AI_MAX,
}
