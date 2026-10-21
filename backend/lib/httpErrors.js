'use strict'

/**
 * Phản hồi lỗi 500 thống nhất cho client.
 *
 * VÌ SAO CẦN: rất nhiều route trước đây trả
 *   res.status(500).json({ message: 'Lỗi server', error: err.message })
 * tức là đẩy nguyên thông báo lỗi nội bộ (Prisma / axios / fs / Gemini …) ra cho
 * người dùng: lộ tên bảng và cột, câu SQL, đường dẫn file, chi tiết hạ tầng. Những
 * thông tin đó chỉ hữu ích trong log server, không giúp gì người dùng cuối và là
 * rủi ro information disclosure.
 *
 * Cách dùng trong route:
 *   } catch (err) { sendServerError(res, err, 'Lỗi upload') }
 *
 * - Chi tiết lỗi (kèm stack) được ghi log ở server để còn debug.
 * - Client CHỈ nhận thông điệp tiếng Việt ngắn gọn (mặc định 'Lỗi server').
 */

const DEFAULT_MESSAGE = 'Lỗi server'

function sendServerError(res, error, message = DEFAULT_MESSAGE) {
  const detail = (error && (error.stack || error.message)) || String(error)
  console.error(`[SERVER_ERROR] ${message}: ${detail}`)

  if (res.headersSent) return undefined
  return res.status(500).json({ message: message || DEFAULT_MESSAGE })
}

module.exports = { sendServerError, DEFAULT_MESSAGE }
