const { z } = require('zod')

// 1. Reading Submit Schema
const readingSubmitSchema = z.object({
  answers: z.record(z.string(), z.any(), { message: 'answers phải là một object' }).refine(
    val => typeof val === 'object' && val !== null && !Array.isArray(val),
    { message: 'answers phải là một object hợp lệ' }
  ),
})

// 2. Listening Submit Schema
const listeningSubmitSchema = z.object({
  answers: z.record(z.string(), z.any(), { message: 'answers phải là một object' }).refine(
    val => typeof val === 'object' && val !== null && !Array.isArray(val),
    { message: 'answers phải là một object hợp lệ' }
  ),
})

// 3. Writing Submit Schema
const writingSubmitSchema = z.object({
  taskId: z.coerce.number({ message: 'taskId phải là số' }).int({ message: 'taskId phải là số nguyên' }).positive({ message: 'taskId không hợp lệ' }),
  essay: z.string({ message: 'essay là bắt buộc' }),
  // Chỉ do client đặt = true khi tự động nộp lúc hết giờ (không phải hành động
  // tự nguyện). Cho phép bỏ qua gate tối thiểu 50 từ ở handler.
  autoSubmit: z.boolean().optional(),
})

// 4. Speaking Submit Schema
const speakingSubmitSchema = z.object({
  partId: z.coerce.number({ message: 'partId phải là số' }).int({ message: 'partId phải là số nguyên' }).positive({ message: 'partId không hợp lệ' }),
  transcript: z.string({ message: 'transcript là bắt buộc' }),
})

// 5. Transcribe Schema
const transcribeSchema = z.object({
  prompt: z.string().optional(),
})

// 6. Attempts Query Filter Schema (dùng cho GET /api/admin/attempts)
// Query string luôn là chuỗi; các ô filter rỗng ở frontend gửi lên "" —
// preprocess đưa "" về undefined để .optional()/.default() hoạt động đúng.
const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v)

const attemptsQuerySchema = z.object({
  search: z.string().optional().default(''),
  skill: z.preprocess(emptyToUndefined, z.enum(['reading', 'listening', 'writing', 'speaking']).optional()),
  seriesId: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'seriesId phải là số' }).int().positive().optional()),
  dateFrom: z.preprocess(emptyToUndefined, z.string().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.string().optional()),
  scoreMin: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'scoreMin phải là số' }).min(0, 'Band tối thiểu là 0.0').max(9, 'Band tối đa là 9.0').optional()),
  scoreMax: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'scoreMax phải là số' }).min(0, 'Band tối thiểu là 0.0').max(9, 'Band tối đa là 9.0').optional()),
  sortBy: z.preprocess(emptyToUndefined, z.enum(['date', 'score']).optional().default('date')),
  sortOrder: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).optional().default('desc')),
  page: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'page phải là số' }).int().positive().optional().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number({ message: 'limit phải là số' }).int().positive().max(100).optional().default(20)),
})

module.exports = {
  readingSubmitSchema,
  listeningSubmitSchema,
  writingSubmitSchema,
  speakingSubmitSchema,
  transcribeSchema,
  attemptsQuerySchema,
}
