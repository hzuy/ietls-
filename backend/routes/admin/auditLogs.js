const express = require('express')
const router = express.Router()
const prisma = require('../../lib/prisma')
const authMiddleware = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { adminOnly } = require('../../lib/roles')
const { auditLogsQuerySchema } = require('../../validators/auditLogValidator')
const { AUDIT_ACTION_LABELS } = require('../../lib/auditActions')
const { sanitizeMetadata } = require('../../lib/auditLog')
const { purgeOldAuditLogs } = require('../../lib/auditLogRetention')
const { vnStartOfDay, vnEndOfDay } = require('../../lib/vnDate')

// AuditLog là log quản trị bất biến (ai làm gì, khi nào) — CHỈ admin được đọc,
// teacher không có quyền truy cập (khác /admin/attempts vốn mở cho cả teacher).
// Không có endpoint ghi/sửa/xóa ở đây — ghi log chỉ qua lib/auditLog.js#logAuditEvent.

function formatLog(log) {
  return {
    id: log.id,
    createdAt: log.createdAt,
    action: log.action,
    actionLabel: AUDIT_ACTION_LABELS[log.action] ?? log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    entityLabel: log.entityLabel,
    // Lọc lại metadata ở tầng đọc — phòng trường hợp khóa nhạy cảm lọt qua lớp
    // sanitize lúc ghi (vd log cũ ghi trước khi SENSITIVE_KEY_PATTERN được bổ sung).
    metadata: sanitizeMetadata(log.metadata),
    actorType: log.actorType,
    actorUserId: log.actorUserId,
    actorEmail: log.actorEmail,
    // actorName trong bảng luôn null theo thiết kế (xem lib/auditLog.js) — giữ
    // lại nguyên trường gốc, tên hiển thị thật nằm ở actorDisplayName bên dưới.
    actorName: log.actorName,
    actorRole: log.actorRole,
    // Ưu tiên name hiện tại qua relation actorUser (tài khoản còn tồn tại), rơi
    // về actorEmail snapshot khi tài khoản đã bị xóa (actorUser null do onDelete: SetNull).
    actorDisplayName: log.actorUser?.name ?? log.actorEmail ?? null,
  }
}

// ─── LIST ────────────────────────────────────────────────────────────────────
router.get('/audit-logs', authMiddleware, adminOnly, validate(auditLogsQuerySchema, 'query'), async (req, res) => {
  // Dọn log quá hạn lưu giữ — fire-and-forget, KHÔNG await (xem lib/auditLogRetention.js),
  // không được làm chậm request đọc log này.
  purgeOldAuditLogs()
  try {
    // req.validatedQuery — xem middleware/validate.js (Express 5: req.query getter-only)
    const { actorUserId, action, entityType, entityId, from, to, search, page, limit } = req.validatedQuery
    const skip = (page - 1) * limit

    const where = {}
    if (actorUserId !== undefined) where.actorUserId = actorUserId
    if (action && action.length) where.action = { in: action }
    if (entityType) where.entityType = entityType
    if (entityId !== undefined) where.entityId = entityId

    if (from || to) {
      where.createdAt = {}
      // Ngày lịch Việt Nam, neo tường minh — xem lib/vnDate.js + CLAUDE.md
      // mục "Quy ước timezone". from/to là chuỗi 'YYYY-MM-DD' từ <input type="date">.
      if (from) where.createdAt.gte = vnStartOfDay(from)
      if (to) where.createdAt.lte = vnEndOfDay(to)
    }

    if (search) {
      where.OR = [
        { entityLabel: { contains: search, mode: 'insensitive' } },
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actorUser: { select: { name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs: logs.map(formatLog), total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// ─── FILTERS ─────────────────────────────────────────────────────────────────
// Danh sách action luôn trả FULL từ AUDIT_ACTION_LABELS (không chỉ action đã
// từng xảy ra) — để dropdown lọc sẵn sàng cho cả action chưa phát sinh log nào.
// entityType/actor thì ngược lại: chỉ trả giá trị thực sự có trong bảng.
router.get('/audit-logs/filters', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [entityTypeRows, actorRows] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { actorUserId: { not: null } },
        distinct: ['actorUserId'],
        select: { actorUserId: true, actorEmail: true, actorUser: { select: { name: true } } },
        // DISTINCT ON (actorUserId) cần ORDER BY bắt đầu bằng actorUserId; thêm
        // createdAt desc để lấy actorEmail/name theo lần ghi log gần nhất của actor đó.
        orderBy: [{ actorUserId: 'asc' }, { createdAt: 'desc' }],
      }),
    ])

    const actions = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label }))

    res.json({
      actions,
      entityTypes: entityTypeRows.map(r => r.entityType),
      actors: actorRows.map(r => ({
        id: r.actorUserId,
        email: r.actorEmail,
        name: r.actorUser?.name ?? r.actorEmail ?? null,
      })),
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
