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

// 6. Attempts Query Filter Schema (Band score & Pagination validation)
const attemptsQuerySchema = z.object({
  scoreMin: z.coerce.number({ message: 'scoreMin phải là số' }).min(0, 'Band tối thiểu là 0.0').max(9, 'Band tối đa là 9.0').optional(),
  scoreMax: z.coerce.number({ message: 'scoreMax phải là số' }).min(0, 'Band tối thiểu là 0.0').max(9, 'Band tối đa là 9.0').optional(),
})

module.exports = {
  readingSubmitSchema,
  listeningSubmitSchema,
  writingSubmitSchema,
  speakingSubmitSchema,
  transcribeSchema,
  attemptsQuerySchema,
}
