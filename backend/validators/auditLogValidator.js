const { z } = require('zod')
const { AUDIT_ACTIONS } = require('../lib/auditActions')

// Query string luôn là chuỗi; ô lọc rỗng ở frontend gửi lên "" — preprocess đưa
// "" về undefined để .optional()/.default() hoạt động đúng (giống submissionValidator).
const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v)

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'phải có định dạng YYYY-MM-DD')

// action lọc theo nhiều giá trị: ?action=a&action=b (Express parse thành mảng)
// hoặc "a,b" (1 query string phân tách dấu phẩy) — chấp nhận cả 2 cách gọi.
const toActionArray = (v) => {
  if (v === undefined || v === null || v === '') return undefined
  const arr = Array.isArray(v) ? v : String(v).split(',')
  const cleaned = arr.map(s => String(s).trim()).filter(Boolean)
  return cleaned.length ? cleaned : undefined
}

const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS)

const auditLogsQuerySchema = z.object({
  actorUserId: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'actorUserId phải là số' }).int().positive().optional()),
  action: z.preprocess(toActionArray, z.array(z.enum(AUDIT_ACTION_VALUES, { message: 'action không hợp lệ' })).optional()),
  entityType: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  entityId: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'entityId phải là số' }).int().positive().optional()),
  from: z.preprocess(emptyToUndefined, isoDate.optional()),
  to: z.preprocess(emptyToUndefined, isoDate.optional()),
  search: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'page phải là số' }).int().positive().optional().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'limit phải là số' }).int().positive().max(100).optional().default(20)),
}).refine((data) => data.entityId === undefined || !!data.entityType, {
  message: 'entityId một mình không xác định được đối tượng nào — phải kèm entityType',
  path: ['entityType'],
})

module.exports = { auditLogsQuerySchema }
