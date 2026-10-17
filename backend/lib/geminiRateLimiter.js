// geminiRateLimiter.js — Điều tiết tốc độ gọi Gemini API không vượt quá 15 RPM (mặc định 12 RPM)
// Đảm bảo an toàn trước lỗi 429 Resource Exhausted khi giải cả đề thi.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))


function getGeminiMaxRpm() {
  const envVal = parseInt(process.env.GEMINI_MAX_RPM || '12', 10)
  if (isNaN(envVal) || envVal <= 0) return 12
  return Math.min(60, envVal)
}

function getMinIntervalMs() {
  if (process.env.NODE_ENV === 'test' && !process.env.GEMINI_MAX_RPM) {
    return 0
  }
  return Math.ceil(60000 / getGeminiMaxRpm())
}

const MAX_ACCEPTABLE_RETRY_WAIT_MS = 25000

function sanitizeWaitMs(rawMs) {
  if (typeof rawMs !== 'number' || isNaN(rawMs) || rawMs <= 0) return null
  if (rawMs > MAX_ACCEPTABLE_RETRY_WAIT_MS) {
    // Quota bị khóa dài hạn (vd hàng giờ), không ngủ đông tiến trình mà để fallback sang Groq
    return null
  }
  return Math.ceil(rawMs)
}

function parseGeminiRetryWaitMs(headers, bodyText) {
  // 1. Kiểm tra HTTP header 'retry-after'
  const retryHeader = headers?.get
    ? headers.get('retry-after')
    : (headers?.['retry-after'] || null)

  if (retryHeader) {
    const sec = parseFloat(retryHeader)
    if (!isNaN(sec) && sec > 0) return sanitizeWaitMs(sec * 1000)
    const dateParsed = Date.parse(retryHeader)
    if (!isNaN(dateParsed)) {
      const diff = dateParsed - Date.now()
      if (diff > 0) return sanitizeWaitMs(diff)
    }
  }

  // 2. Phân tích chi tiết JSON (google.rpc.RetryInfo hoặc error.message)
  if (bodyText) {
    try {
      const data = typeof bodyText === 'object' ? bodyText : JSON.parse(bodyText)
      const details = data?.error?.details || []
      for (const d of details) {
        if (d?.['@type']?.includes('RetryInfo') && d?.retryDelay) {
          const match = /^([\d.]+)s?$/i.exec(d.retryDelay)
          if (match) return sanitizeWaitMs(parseFloat(match[1]) * 1000)
        }
      }
      if (data?.error?.message) {
        const msgMatch = /retry (?:after|in) ([\d.]+)(s|ms)?/i.exec(data.error.message)
        if (msgMatch) {
          const num = parseFloat(msgMatch[1])
          const unit = (msgMatch[2] || 's').toLowerCase()
          return sanitizeWaitMs(num * (unit === 'ms' ? 1 : 1000))
        }
      }
    } catch {
      // Body không phải JSON hợp lệ, kiểm tra regex trên chuỗi thô
    }

    const rawMatch = /retry (?:after|in) ([\d.]+)(s|ms)?/i.exec(String(bodyText))
    if (rawMatch) {
      const num = parseFloat(rawMatch[1])
      const unit = (rawMatch[2] || 's').toLowerCase()
      return sanitizeWaitMs(num * (unit === 'ms' ? 1 : 1000))
    }
  }

  return null
}

let lastRequestTime = 0
let cooldownUntil = 0
let queuePromise = Promise.resolve()

function scheduleGeminiCall(fn) {
  const executeCall = async () => {
    const now = Date.now()
    if (cooldownUntil > now) {
      await sleep(cooldownUntil - now)
    }

    const timeSinceLast = Date.now() - lastRequestTime
    const minInterval = getMinIntervalMs()

    if (lastRequestTime > 0 && timeSinceLast < minInterval) {
      await sleep(minInterval - timeSinceLast)
    }

    lastRequestTime = Date.now()
    return fn()
  }

  const nextCall = queuePromise.then(executeCall, executeCall)
  queuePromise = nextCall.catch(() => {})
  return nextCall
}

function recordGeminiCooldown(waitMs) {
  if (typeof waitMs === 'number' && waitMs > 0) {
    const capped = Math.min(MAX_ACCEPTABLE_RETRY_WAIT_MS, waitMs)
    cooldownUntil = Math.max(cooldownUntil, Date.now() + capped)
  }
}

function resetRateLimiterState() {
  lastRequestTime = 0
  cooldownUntil = 0
  queuePromise = Promise.resolve()
}

module.exports = {
  getGeminiMaxRpm,
  getMinIntervalMs,
  parseGeminiRetryWaitMs,
  scheduleGeminiCall,
  recordGeminiCooldown,
  resetRateLimiterState,
}
