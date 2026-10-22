'use strict'

/**
 * Mã lỗi chấm bài AI + câu thông báo thân thiện cho học sinh.
 *
 * Bối cảnh: trước đây route chấm bài lưu nguyên `error.message` của SDK/provider
 * vào cột `error` (writingAnswer/speakingAnswer) rồi trả thẳng cho client, làm rò
 * rỉ chi tiết hạ tầng (tên model, endpoint, nội dung lỗi upstream...).
 *
 * Nay: DB chỉ lưu một mã ổn định (AI_TIMEOUT, AI_RATE_LIMIT...), chi tiết được
 * ghi log ở server, còn client nhận câu tiếng Việt thân thiện. Các bản ghi cũ
 * (đang chứa message thô) vẫn được phân loại khi đọc nên không lộ nội dung.
 */

const AI_ERROR_CODES = {
  TIMEOUT: 'AI_TIMEOUT',
  RATE_LIMIT: 'AI_RATE_LIMIT',
  SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  MODEL: 'AI_MODEL_ERROR',
  INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  UNKNOWN: 'AI_ERROR',
}

const LEARNER_MESSAGES = {
  [AI_ERROR_CODES.TIMEOUT]: 'AI chấm bài quá lâu nên chưa có kết quả. Vui lòng thử lại.',
  [AI_ERROR_CODES.RATE_LIMIT]: 'Hệ thống AI đang quá tải. Vui lòng thử lại sau ít phút.',
  [AI_ERROR_CODES.SERVICE_UNAVAILABLE]: 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau ít phút.',
  [AI_ERROR_CODES.MODEL]: 'Hệ thống chấm bài AI đang gặp sự cố. Vui lòng thử lại sau ít phút.',
  [AI_ERROR_CODES.INVALID_RESPONSE]: 'AI trả về kết quả không hợp lệ. Vui lòng thử lại.',
  [AI_ERROR_CODES.UNKNOWN]: 'Không chấm được bài bằng AI. Vui lòng thử lại.',
}

function collectText(error) {
  if (!error) return ''
  const parts = [
    error.message,
    error.error?.message,
    error.response?.data?.error?.message,
    typeof error.response?.data?.error === 'string' ? error.response.data.error : null,
  ]
  return parts.filter((p) => typeof p === 'string' && p).join(' | ').toLowerCase()
}

function statusOf(error) {
  const status = error?.status ?? error?.response?.status ?? error?.response?.data?.status
  const n = Number(status)
  return Number.isFinite(n) ? n : 0
}

function codeOf(error) {
  return String(error?.code || error?.error?.code || '').toUpperCase()
}

/**
 * Phân loại lỗi AI thành mã ổn định để lưu DB.
 * @param {unknown} error
 * @returns {string} một trong AI_ERROR_CODES
 */
function classifyAiError(error) {
  const status = statusOf(error)
  const code = codeOf(error)
  const text = collectText(error)

  if (status === 429 || code === 'RATE_LIMIT' || text.includes('rate limit') || text.includes('too many requests')) {
    return AI_ERROR_CODES.RATE_LIMIT
  }
  if (
    status === 504 ||
    code === 'ETIMEDOUT' ||
    code === 'AI_TIMEOUT' ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('aborted')
  ) {
    return AI_ERROR_CODES.TIMEOUT
  }
  if (status === 502 || status === 503 || text.includes('service unavailable') || text.includes('overloaded')) {
    return AI_ERROR_CODES.SERVICE_UNAVAILABLE
  }
  if (
    status === 404 ||
    text.includes('model_not_found') ||
    text.includes('model not found') ||
    text.includes('does not exist') ||
    text.includes('decommissioned')
  ) {
    return AI_ERROR_CODES.MODEL
  }
  if (text.includes('json') || text.includes('unexpected token') || text.includes('schema')) {
    return AI_ERROR_CODES.INVALID_RESPONSE
  }
  return AI_ERROR_CODES.UNKNOWN
}

/**
 * Chuyển giá trị đang lưu trong cột `error` thành câu hiển thị cho học sinh.
 * - Bản ghi mới: giá trị là mã (AI_*) -> tra bảng.
 * - Bản ghi cũ: giá trị là message thô -> phân loại rồi trả câu thân thiện.
 * - Rỗng/không xác định -> câu mặc định.
 * @param {string|null|undefined} storedValue
 * @returns {string}
 */
function toLearnerAiErrorMessage(storedValue) {
  if (!storedValue) return LEARNER_MESSAGES[AI_ERROR_CODES.UNKNOWN]
  const value = String(storedValue)
  if (LEARNER_MESSAGES[value]) return LEARNER_MESSAGES[value]
  return LEARNER_MESSAGES[classifyAiError({ message: value })]
}

/**
 * Ghi log chi tiết lỗi AI ở server (luôn ghi, kể cả production — vì DB không còn
 * lưu chi tiết). Không log token/key/prompt, chỉ status + code + message.
 * @param {string} tag
 * @param {unknown} error
 */
function logAiError(tag, error) {
  console.error(tag, {
    status: statusOf(error) || undefined,
    code: codeOf(error) || undefined,
    message: error?.message,
  })
}

module.exports = {
  AI_ERROR_CODES,
  LEARNER_MESSAGES,
  classifyAiError,
  toLearnerAiErrorMessage,
  logAiError,
}
