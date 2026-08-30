const { z } = require('zod')

// Practice-exam `questions` is an array of question GROUPS. For MCQ groups,
// correctAnswer matches options by TEXT, so two options with identical trimmed
// text in one question are ambiguous — reject them (mirrors the MCQGroupEditor
// guard and adminExamValidator).
function checkNoDuplicateOptions(questions, ctx) {
  ;(questions || []).forEach((group, gi) => {
    if (!group || (group.type !== 'mcq' && group.type !== 'mcq_multi')) return
    ;(group.questions || []).forEach((q, qi) => {
      const seen = new Set()
      ;(q.options || []).forEach((opt) => {
        const t = String(opt || '').trim()
        if (!t) return
        if (seen.has(t)) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', gi, 'questions', qi, 'options'],
            message: `Nhóm ${gi + 1}, câu ${q.number ?? qi + 1}: các lựa chọn không được trùng nội dung ("${t}")`,
          })
        }
        seen.add(t)
      })
    })
  })
}

// 1. Create Sample Schema (routes/samples.js for Writing & Speaking)
const createSampleSchema = z.object({
  title: z.string({ message: 'Thiếu tiêu đề' }).trim().min(1, { message: 'Thiếu tiêu đề' }),
  level: z.string().nullable().optional(),
  examType: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional().default([]),
})

// 2. Update Sample Schema (routes/samples.js)
const updateSampleSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề không được để trống' }).optional(),
  level: z.string().nullable().optional(),
  examType: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
})

// 3. Create Practice Schema (routes/practice.js)
const createPracticeSchema = z.object({
  title: z.string({ message: 'Thiếu tiêu đề bài thi' }).trim().min(1, { message: 'Thiếu tiêu đề bài thi' }),
  level: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  passage: z.string().nullable().optional(),
  questions: z.array(z.any()).optional().default([]),
}).superRefine((data, ctx) => checkNoDuplicateOptions(data.questions, ctx))

// 4. Update Practice Schema (routes/practice.js)
const updatePracticeSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề bài thi không được để trống' }).optional(),
  level: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  passage: z.string().nullable().optional(),
  questions: z.array(z.any()).optional(),
}).superRefine((data, ctx) => checkNoDuplicateOptions(data.questions, ctx))

// 5. Transcribe Upload Schema (routes/admin/uploads.js) - Path Traversal Protection
const transcribeUploadSchema = z.object({
  audioUrl: z.string({ message: 'Thiếu audioUrl' }).min(1, { message: 'Thiếu audioUrl' }).refine(
    url => !url.includes('..'),
    { message: 'audioUrl không hợp lệ (phát hiện đường dẫn tương đối không an toàn)' }
  ),
})

// 6. Book Cover Schema (routes/admin/uploads.js)
const bookCoverSchema = z.object({
  seriesId: z.coerce.number({ message: 'seriesId phải là số' }).int({ message: 'seriesId phải là số nguyên' }).positive({ message: 'seriesId phải là số nguyên dương' }),
})

// 7. Exam Series Schema (routes/admin/examSeries.js)
const examSeriesSchema = z.object({
  name: z.string({ message: 'Tên bộ đề không được để trống' }).trim().min(1, { message: 'Tên bộ đề không được để trống' }),
})

// 8. Update Book Number Schema (routes/admin/examSeries.js)
const updateBookNumberSchema = z.object({
  bookNumber: z.coerce.number({ message: 'Số cuốn không hợp lệ' }).int({ message: 'Số cuốn phải là số nguyên' }).positive({ message: 'Số cuốn không hợp lệ' }),
})

module.exports = {
  createSampleSchema,
  updateSampleSchema,
  createPracticeSchema,
  updatePracticeSchema,
  transcribeUploadSchema,
  bookCoverSchema,
  examSeriesSchema,
  updateBookNumberSchema,
}
