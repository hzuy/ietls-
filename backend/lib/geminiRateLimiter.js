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

let telemetryListeners = []
function addGeminiTelemetryListener(fn) { telemetryListeners.push(fn) }
function removeGeminiTelemetryListener(fn) { telemetryListeners = telemetryListeners.filter(l => l !== fn) }
function notifyTelemetry(event) { for (const l of telemetryListeners) { try { l(event) } catch {} } }

function scheduleGeminiCall(fn, { signal = null } = {}) {
  const queuedAt = Date.now()
  if (signal?.aborted) {
    const err = new Error('Yêu cầu AI đã bị hủy trước khi vào hàng đợi')
    err.name = 'AbortError'
    return Promise.reject(err)
  }

  const executeCall = async () => {
    if (signal?.aborted) {
      const err = new Error('Yêu cầu AI đã bị hủy trước khi chạy')
      err.name = 'AbortError'
      throw err
    }

    const queueStart = Date.now()
    if (cooldownUntil > queueStart) {
      await sleep(cooldownUntil - queueStart)
      if (signal?.aborted) {
        const err = new Error('Yêu cầu AI đã bị hủy trong khi chờ cooldown')
        err.name = 'AbortError'
        throw err
      }
    }

    const timeSinceLast = Date.now() - lastRequestTime
    const minInterval = getMinIntervalMs()

    if (lastRequestTime > 0 && timeSinceLast < minInterval) {
      await sleep(minInterval - timeSinceLast)
      if (signal?.aborted) {
        const err = new Error('Yêu cầu AI đã bị hủy trong khi chờ rate limit')
        err.name = 'AbortError'
        throw err
      }
    }

    const queueWaitMs = Date.now() - queuedAt
    lastRequestTime = Date.now()
    const apiStart = Date.now()
    try {
      const res = await fn()
      const apiMs = Date.now() - apiStart
      notifyTelemetry({ type: 'call', queueWaitMs, apiMs, ok: true })
      return res
    } catch (err) {
      const apiMs = Date.now() - apiStart
      notifyTelemetry({ type: 'call', queueWaitMs, apiMs, ok: false, error: err.message, status: err.status })
      throw err
    }
  }

  const nextCall = queuePromise.then(executeCall, executeCall)
  queuePromise = nextCall.catch(() => {})

  if (!signal) {
    return nextCall
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      const err = new Error('Yêu cầu AI đã bị hủy trong hàng đợi')
      err.name = 'AbortError'
      reject(err)
    }
    signal.addEventListener('abort', onAbort)

    nextCall.then(
      (res) => {
        signal.removeEventListener('abort', onAbort)
        resolve(res)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      }
    )
  })
}

function recordGeminiCooldown(waitMs) {
  if (typeof waitMs === 'number' && waitMs > 0) {
    const capped = Math.min(MAX_ACCEPTABLE_RETRY_WAIT_MS, waitMs)
    cooldownUntil = Math.max(cooldownUntil, Date.now() + capped)
    notifyTelemetry({ type: 'cooldown', waitMs: capped })
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
  addGeminiTelemetryListener,
  removeGeminiTelemetryListener,
}

