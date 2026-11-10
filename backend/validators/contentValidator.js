const { z } = require('zod')

// Practice-exam `questions` is an array of question GROUPS. For MCQ groups,
// correctAnswer matches options by TEXT, so two options with identical trimmed
// text in one question are ambiguous — reject them (mirrors the MCQGroupEditor
// guard and adminExamValidator).
function checkNoDuplicateOptions(questions, ctx) {
  ;(questions || []).forEach((group, gi) => {
    if (!group || !['mcq', 'mcq_multi', 'list_selection', 'choose_title'].includes(group.type)) return
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
// Speaking samples may carry a nested Part/Question graph (TC-036). Writing
// samples simply omit `parts`; unknown fields are stripped by Zod.
const speakingSampleQuestionSchema = z.object({
  orderNum: z.coerce.number().int().positive().optional(),
  questionText: z.string({ message: 'Thiếu nội dung câu hỏi' }).trim().min(1, { message: 'Nội dung câu hỏi không được để trống' }),
})

const speakingSamplePartSchema = z.object({
  partNumber: z.coerce.number().int().min(1).max(10).optional(),
  number: z.coerce.number().int().min(1).max(10).optional(), // alias tương thích
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  questions: z.array(speakingSampleQuestionSchema).max(100).optional().default([]),
}).superRefine((part, ctx) => {
  if (part.partNumber == null && part.number == null) {
    ctx.addIssue({ code: 'custom', path: ['partNumber'], message: 'Thiếu số thứ tự Part' })
  }
}).transform(part => ({
  ...part,
  partNumber: part.partNumber ?? part.number,
  questions: part.questions || [],
}))

const speakingSamplePartsSchema = z.array(speakingSamplePartSchema).max(10).superRefine((parts, ctx) => {
  const seen = new Set()
  parts.forEach((part, index) => {
    if (seen.has(part.partNumber)) {
      ctx.addIssue({ code: 'custom', path: [index, 'partNumber'], message: `Part ${part.partNumber} bị trùng` })
    }
    seen.add(part.partNumber)
  })
})

const createSampleSchema = z.object({
  title: z.string({ message: 'Thiếu tiêu đề' }).trim().min(1, { message: 'Thiếu tiêu đề' }),
  level: z.string().nullable().optional(),
  examType: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional().default([]),
  parts: speakingSamplePartsSchema.optional(),
})

// 2. Update Sample Schema (routes/samples.js)
const updateSampleSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề không được để trống' }).optional(),
  level: z.string().nullable().optional(),
  examType: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  // `parts: []` xoá toàn bộ Part; bỏ hẳn field thì giữ nguyên graph cũ.
  parts: speakingSamplePartsSchema.optional(),
})

// 3. Create Practice Schema (routes/practice.js)
const createPracticeSchema = z.object({
  title: z.string({ message: 'Thiếu tiêu đề bài thi' }).trim().min(1, { message: 'Thiếu tiêu đề bài thi' }),
  level: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  passage: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  questions: z.array(z.union([z.string().max(100000), z.record(z.string(), z.unknown())])).max(1000).optional().default([]),
}).superRefine((data, ctx) => checkNoDuplicateOptions(data.questions, ctx))

// 4. Update Practice Schema (routes/practice.js)
const updatePracticeSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề bài thi không được để trống' }).optional(),
  level: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  passage: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  questions: z.array(z.union([z.string().max(100000), z.record(z.string(), z.unknown())])).max(1000).optional(),
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

const practiceAttemptSchema = z.object({
  answers: z.record(z.string(), z.string().max(500)).refine(a => Object.keys(a).length <= 200, { message: 'Quá nhiều câu trả lời' }),
  // Legacy clients may send correct/total. Zod strips those untrusted fields;
  // only the answer map reaches the grading route.
})

module.exports = {
  practiceAttemptSchema,
  createSampleSchema,
  updateSampleSchema,
  createPracticeSchema,
  updatePracticeSchema,
  transcribeUploadSchema,
  bookCoverSchema,
  examSeriesSchema,
  updateBookNumberSchema,
}
