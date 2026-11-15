const rateLimit = require('express-rate-limit')

const DEFAULT_WINDOW_MS = (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000
const DEFAULT_OBJECTIVE_MAX = parseInt(process.env.RATE_LIMIT_SUBMIT_OBJECTIVE_MAX) || 20
const DEFAULT_AI_MAX = parseInt(process.env.RATE_LIMIT_SUBMIT_AI_MAX) || 10
const DEFAULT_AI_EXPLANATION_MAX = parseInt(process.env.RATE_LIMIT_AI_EXPLANATION_MAX) || 30

/**
 * Key generator distinguishing by authenticated userId when available,
 * falling back to client IP.
 */
function clientIpKey(req) {
  const cf = req.headers && req.headers['cf-connecting-ip']
  return cf || req.ip || req.socket?.remoteAddress || 'unknown'
}

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
  keyGenerator = defaultKeyGenerator,
} = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    keyGenerator,
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

// ── Rate limiter cho endpoint sinh/AI giải thích (admin exam + practice) ─────
// Mặc định: tối đa 30 lượt / user trong 15 phút. Tách riêng khỏi quota nộp bài
// để 1 tài khoản không spam sinh giải thích làm cạn quota Gemini.
const aiExplanationLimiter = createSubmitRateLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: DEFAULT_AI_EXPLANATION_MAX,
  message: 'Bạn đã yêu cầu AI giải thích quá giới hạn. Vui lòng thử lại sau 15 phút.',
})

// ── Rate limiter theo "lượt chạy" cho endpoint sinh giải thích ────────────────
// Mỗi lần bấm tạo lời giải, frontend sinh một operationId rồi gửi nhiều request
// (từng nhóm câu). Giới hạn theo request sẽ chặn nhầm một lượt chạy hợp lệ, nên
// quota được tính theo:
//   - số lượt chạy khác nhau / user / 15 phút (mặc định 30), và
//   - số request tối đa trong cùng một lượt chạy (mặc định 60).
// Client cũ không gửi operationId vẫn dùng quota request như trước.
const DEFAULT_AI_EXPLANATION_RUN_MAX = parseInt(process.env.RATE_LIMIT_AI_EXPLANATION_RUN_MAX) || 60
const MAX_TRACKED_USERS = 5000
const aiExplanationRuns = new Map() // userKey -> Map(operationId -> { count, at })

function operationIdOf(req) {
  const value = req.body && req.body.operationId
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null
}

function pruneRuns(runs, now) {
  for (const [id, entry] of runs) {
    if (now - entry.at > DEFAULT_WINDOW_MS) runs.delete(id)
  }
}

function aiExplanationRunLimiter(req, res, next) {
  if (shouldSkip(req)) return next()
  const operationId = operationIdOf(req)
  if (!operationId) return aiExplanationLimiter(req, res, next)

  const now = Date.now()
  if (aiExplanationRuns.size > MAX_TRACKED_USERS) aiExplanationRuns.clear()
  const userKey = defaultKeyGenerator(req)
  let runs = aiExplanationRuns.get(userKey)
  if (!runs) {
    runs = new Map()
    aiExplanationRuns.set(userKey, runs)
  }
  pruneRuns(runs, now)

  const entry = runs.get(operationId)
  if (!entry) {
    if (runs.size >= DEFAULT_AI_EXPLANATION_MAX) {
      return res.status(429).json({
        code: 'AI_RATE_LIMITED',
        retryAfter: Math.round(DEFAULT_WINDOW_MS / 1000),
        message: 'Bạn đã yêu cầu AI giải thích quá giới hạn. Vui lòng thử lại sau 15 phút.',
      })
    }
    runs.set(operationId, { count: 1, at: now })
    return next()
  }
  if (entry.count >= DEFAULT_AI_EXPLANATION_RUN_MAX) {
    return res.status(429).json({
      code: 'AI_RATE_LIMITED',
      retryAfter: 60,
      message: 'Một lượt tạo lời giải đã gửi quá nhiều yêu cầu. Vui lòng chờ hoàn thành rồi thử lại.',
    })
  }
  entry.count += 1
  entry.at = now
  next()
}

function resetAiExplanationRuns() {
  aiExplanationRuns.clear()
}

const authLimiter = createSubmitRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: clientIpKey,
  message: 'Bạn đã thử đăng nhập/đăng ký quá nhiều lần. Vui lòng thử lại sau 15 phút.',
})

const emailCodeLimiter = createSubmitRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: clientIpKey,
  message: 'Bạn đã thao tác với mã xác thực quá nhiều lần. Vui lòng thử lại sau 15 phút.',
})

function passwordLimiter(max, keyGenerator) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    keyGenerator,
    validate: { keyGeneratorIpFallback: false },
    skip: shouldSkip,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
      res.status(429).json({ code: 'PASSWORD_CHANGE_RATE_LIMIT', retryAfter, message: `Bạn đã thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau ${retryAfter} giây.` })
    },
  })
}

// Shared instances ensure neither endpoint can bypass the other one's quota.
const passwordChangeLimiters = [
  passwordLimiter(20, req => rateLimit.ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown')),
  passwordLimiter(5, req => `password_${req.user.userId}`),
]

module.exports = {
  passwordChangeLimiters,
  createSubmitRateLimiter,
  authLimiter,
  emailCodeLimiter,
  clientIpKey,
  objectiveSubmitLimiter,
  aiSubmitLimiter,
  aiExplanationLimiter,
  aiExplanationRunLimiter,
  resetAiExplanationRuns,
  defaultKeyGenerator,
  DEFAULT_WINDOW_MS,
  DEFAULT_OBJECTIVE_MAX,
  DEFAULT_AI_MAX,
  DEFAULT_AI_EXPLANATION_MAX,
  DEFAULT_AI_EXPLANATION_RUN_MAX,
}
