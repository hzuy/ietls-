const { z } = require('zod')

// Query string luôn là chuỗi; ô lọc rỗng ở frontend gửi lên "" — preprocess đưa
// "" về undefined để .optional()/.default() hoạt động đúng (giống submissionValidator).
const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v)

// GET /api/user/history — lịch sử làm bài Reading/Listening của user đang đăng nhập
const historyQuerySchema = z.object({
  skill: z.preprocess(emptyToUndefined, z.enum(['reading', 'listening'], { message: 'skill không hợp lệ' }).optional()),
  examId: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'examId phải là số' }).int().positive().optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'page phải là số' }).int().positive().optional().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'limit phải là số' }).int().positive().max(100).optional().default(20)),
})

module.exports = { historyQuerySchema }
