'use strict'

// Đọc DATABASE_URL và trả về thông tin ĐỌC ĐƯỢC (host/port/tên DB) mà không
// bao giờ để lộ user/password — dùng để in banner "đang kết nối DB nào" lúc
// khởi động server hoặc đầu mỗi script có thao tác ghi, thay vì phải đoán
// qua nội dung trả về (đã có sự cố thật: server.js chạy nhầm lên production
// mà không có cách nào nhận biết ngay từ log khởi động).
function getDbConnectionInfo(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) return { host: null, port: null, database: null, isLocal: false }
  try {
    const url = new URL(rawUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.replace(/^\//, '') || '(?)'
    const isLocal = host === '127.0.0.1' || host === 'localhost'
    return { host, port, database, isLocal }
  } catch {
    return { host: '(không đọc được DATABASE_URL)', port: null, database: null, isLocal: false }
  }
}

// In banner ngắn gọn "đang kết nối tới đâu" — luôn gọi 1 lần lúc khởi động
// (server.js) hoặc đầu mỗi script có thao tác ghi. KHÔNG in user/password.
// Nếu NODE_ENV không phải 'production' (tức đang ở chế độ phát triển — chạy
// qua nodemon/npm run dev, hoặc chạy script tay) mà DATABASE_URL lại trỏ một
// host không phải local (127.0.0.1/localhost) — rất có thể là Supabase dùng
// chung với production — in thêm cảnh báo nổi bật để không phải đoán qua nội
// dung trả về mới biết.
function printDbBanner(label = 'DB') {
  const info = getDbConnectionInfo()
  const target = info.host ? `${info.host}:${info.port}/${info.database}` : '(không xác định)'
  const kind = info.isLocal ? 'local dev (postgres-dev)' : 'REMOTE — kiểm tra kỹ trước khi ghi dữ liệu'
  console.log(`[${label}] Đang kết nối DB: ${target} — ${kind}`)

  if (process.env.NODE_ENV !== 'production' && !info.isLocal) {
    console.warn('')
    console.warn('⚠️⚠️⚠️  CẢNH BÁO — CHẾ ĐỘ PHÁT TRIỂN NHƯNG DB LÀ REMOTE  ⚠️⚠️⚠️')
    console.warn(`   NODE_ENV=${process.env.NODE_ENV || '(chưa set)'}, nhưng DATABASE_URL trỏ tới host remote "${info.host}"`)
    console.warn('   (không phải postgres-dev 127.0.0.1) — rất có thể là Supabase dùng chung với production.')
    console.warn('   Nếu đây không phải chủ đích, DỪNG LẠI và kiểm tra biến môi trường trước khi tiếp tục.')
    console.warn('')
  }

  return info
}

module.exports = { getDbConnectionInfo, printDbBanner }
