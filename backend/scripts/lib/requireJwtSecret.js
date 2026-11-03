'use strict'

/**
 * Lấy JWT_SECRET cho các script ký token thủ công (verify/capture/screenshot local).
 *
 * KHÔNG hardcode secret trong repo. Thứ tự tìm:
 *   1. process.env.JWT_SECRET — khi chạy qua server/compose/CI đã set sẵn.
 *   2. backend/.env — nạp thêm (không ghi đè) nếu biến chưa có, giống server.js.
 *
 * Nếu vẫn không có secret, script phải DỪNG với thông báo rõ ràng, thay vì âm
 * thầm dùng một secret mặc định nằm trong mã nguồn.
 *
 * @param {{ loadEnv?: boolean, envPath?: string }} [options]
 *   loadEnv=false để bỏ bước nạp .env (dùng khi test).
 *   envPath để chỉ định file .env khác (dùng khi test, mặc định backend/.env).
 */
function requireJwtSecret({
  loadEnv = true,
  envPath = require('path').join(__dirname, '..', '..', '.env'),
} = {}) {
  if (!process.env.JWT_SECRET && loadEnv) {
    try {
      require('dotenv').config({
        path: envPath,
        quiet: true,
      })
    } catch {
      // dotenv không bắt buộc — thiếu secret sẽ báo lỗi ngay bên dưới
    }
  }

  const secret = process.env.JWT_SECRET
  if (!secret || !String(secret).trim()) {
    throw new Error(
      'Thiếu JWT_SECRET: hãy set biến môi trường JWT_SECRET hoặc tạo backend/.env (xem backend/.env.example) trước khi chạy script này.'
    )
  }
  return secret
}

module.exports = { requireJwtSecret }
