const prisma = require('./prisma')
const { logAuditEvent } = require('./auditLog')
const { AUDIT_ACTIONS } = require('./auditActions')

// Thời hạn lưu giữ AuditLog — nhật ký quản trị cần giá trị truy vết dài hạn hơn
// hẳn Thùng rác (30 ngày, xem routes/admin/trash.js), nên đặt dài hơn nhiều.
// Đổi thời hạn: sửa đúng hằng số này, không cần sửa gì khác.
const AUDIT_LOG_RETENTION_DAYS = 365

// Khoảng cách tối thiểu giữa 2 lần chạy dọn dẹp thực sự — tránh mỗi admin mở
// trang Nhật ký hoạt động đều kích hoạt lại toàn bộ deleteMany (khác Trash:
// Trash không cần chặn vì deleteMany trên tập rỗng vốn đã rẻ, còn ở đây có
// thêm phần chống-chạy-trùng nên tách hẳn thành bước "claim" riêng bên dưới).
const AUDIT_LOG_PURGE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 giờ

// Lưu "lần dọn gần nhất" trong bảng Setting có sẵn (key/value) thay vì thêm
// bảng/migration mới — đủ dùng cho một cờ trạng thái đơn giản.
const LAST_PURGE_SETTING_KEY = 'audit_log_last_purge_at'

// Giành quyền chạy dọn dẹp lần này bằng compare-and-swap trên Setting.key (unique):
// updateMany với điều kiện value cũ đã đủ "hết hạn" đảm bảo chỉ 1 trong nhiều
// request gần-như-đồng-thời thắng claim (Postgres khóa hàng trong updateMany).
// So sánh value dạng chuỗi ISO 8601 vẫn đúng thứ tự thời gian (sort lexicographic).
async function claimPurgeRun(now) {
  const staleBeforeIso = new Date(now.getTime() - AUDIT_LOG_PURGE_MIN_INTERVAL_MS).toISOString()
  const nowIso = now.toISOString()

  const updated = await prisma.setting.updateMany({
    where: { key: LAST_PURGE_SETTING_KEY, value: { lt: staleBeforeIso } },
    data: { value: nowIso },
  })
  if (updated.count > 0) return true

  const existing = await prisma.setting.findUnique({ where: { key: LAST_PURGE_SETTING_KEY } })
  if (existing) return false // đã có lần chạy khác gần đây, chưa đủ khoảng cách tối thiểu

  try {
    await prisma.setting.create({ data: { key: LAST_PURGE_SETTING_KEY, value: nowIso } })
    return true // lần chạy đầu tiên
  } catch (err) {
    if (err.code === 'P2002') return false // race: request khác vừa tạo trước
    throw err
  }
}

// Dọn AuditLog quá hạn lưu giữ. Fire-and-forget — nơi gọi KHÔNG được await hàm
// này. Không bao giờ throw ra ngoài: lỗi dọn dẹp không được làm hỏng request
// đang đọc danh sách log.
async function purgeOldAuditLogs() {
  try {
    const now = new Date()
    const claimed = await claimPurgeRun(now)
    if (!claimed) return

    const cutoff = new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

    // Chỉ ghi log khi thực sự dọn được gì — tránh mỗi lần trigger (kể cả không
    // có gì hết hạn) đều tạo 1 bản ghi audit rỗng (xem cùng lý do ở trash.js).
    if (result.count > 0) {
      await logAuditEvent(null, {
        action: AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE,
        entityType: 'AuditLog',
        metadata: { deletedCount: result.count, cutoff: cutoff.toISOString() },
      })
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [AuditLog] Tác vụ "Auto-purge audit log" bị lỗi:`, err.message || err)
  }
}

module.exports = {
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_LOG_PURGE_MIN_INTERVAL_MS,
  LAST_PURGE_SETTING_KEY,
  claimPurgeRun,
  purgeOldAuditLogs,
}
