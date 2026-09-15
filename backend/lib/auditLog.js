const prisma = require('./prisma')

// Khóa metadata bị chặn tuyệt đối bất kể route truyền gì vào — chặn ở tầng
// helper để không phụ thuộc từng route tự nhớ lọc. Bắt cả biến thể như
// plainPassword, resetToken, apiSecret (chứa "password"/"token"/"secret").
const SENSITIVE_KEY_PATTERN = /password|token|secret/i

function sanitizeMetadata(value) {
  if (Array.isArray(value)) return value.map(sanitizeMetadata)
  if (!value || typeof value !== 'object') return value ?? null
  const clean = {}
  for (const [key, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue
    clean[key] = sanitizeMetadata(v)
  }
  return clean
}

// Ghi 1 bản ghi AuditLog. Không bao giờ throw — lỗi ghi log không được làm
// hỏng thao tác nghiệp vụ đang gọi nó, chỉ console.error rồi bỏ qua.
//
// req: request đang xử lý, dùng để lấy actor (req.user). Truyền null/undefined
// cho tác vụ tự động (actorType "system", vd trash.auto_purge).
//
// metadata: CHỈ diff rút gọn / số lượng thay đổi — KHÔNG bao giờ truyền
// req.body hay dữ liệu nhạy cảm. sanitizeMetadata lọc thêm 1 lớp ở đây nhưng
// đừng dựa vào lớp lọc này để né việc chọn lọc đúng ở route gọi.
async function logAuditEvent(req, { action, entityType, entityId = null, entityLabel = null, metadata = null }) {
  try {
    const actor = req?.user
    await prisma.auditLog.create({
      data: {
        actorType: actor ? 'user' : 'system',
        actorUserId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        // JWT payload chỉ có { userId, email, role } (middleware/auth.js) — không
        // có name. Cố tình KHÔNG truy vấn thêm User ở đây: helper này chạy trên
        // mọi request ghi dữ liệu admin, thêm 1 query đồng bộ mỗi request sẽ cộng
        // dồn latency cho lợi ích nhỏ, trong khi actorEmail + actorRole đã đủ định
        // danh cho mục đích audit. Cần tên đầy đủ khi hiển thị thì join User qua
        // actorUserId ở tầng đọc log, không phải ở đây.
        actorName: null,
        actorRole: actor?.role ?? null,
        action,
        entityType,
        entityId,
        entityLabel,
        metadata: sanitizeMetadata(metadata)
      }
    })
  } catch (err) {
    console.error('[auditLog] Ghi audit log thất bại:', err)
  }
}

module.exports = { logAuditEvent, sanitizeMetadata }
