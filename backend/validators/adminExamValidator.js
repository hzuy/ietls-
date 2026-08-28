const { z } = require('zod')

// ─── BASE GROUP FIELDS ───────────────────────────────────────────────────────
const baseGroupFields = {
  qNumberStart: z.coerce.number({ message: 'qNumberStart phải là số' }),
  qNumberEnd: z.coerce.number({ message: 'qNumberEnd phải là số' }),
  instruction: z.string().optional().default(''),
  imageUrl: z.string().nullable().optional(),
  sortOrder: z.coerce.number().optional(),
  canReuse: z.boolean().optional().default(false),
  maxChoices: z.coerce.number().optional().default(2),
}

// ─── HELPER SCHEMAS FOR 14 QUESTION GROUP TYPES ─────────────────────────────
const createTrueFalseSchema = (typeLiteral) => z.object({
  ...baseGroupFields,
  type: z.literal(typeLiteral),
  questions: z.array(z.object({
    number: z.coerce.number(),
    questionText: z.string().optional().default(''),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const createNoteCompletionSchema = (typeLiteral) => z.object({
  ...baseGroupFields,
  type: z.literal(typeLiteral),
  noteSections: z.array(z.object({
    title: z.string().optional().default(''),
    sortOrder: z.coerce.number().optional(),
    lines: z.array(z.object({
      content: z.string().optional().default(''),
      lineType: z.enum(['header', 'bullet', 'content']).optional().default('content'),
      sortOrder: z.coerce.number().optional(),
    })).optional().default([]),
  })).optional().default([]),
  questions: z.array(z.object({
    number: z.coerce.number(),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const createMatchingSchema = (typeLiteral) => z.object({
  ...baseGroupFields,
  type: z.literal(typeLiteral),
  matchingOptions: z.array(z.object({
    letter: z.string().optional().default(''),
    text: z.string().optional().default(''),
  })).optional().default([]),
  questions: z.array(z.object({
    number: z.coerce.number(),
    questionText: z.string().optional().default(''),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const dragWordBankGroupSchema = z.object({
  ...baseGroupFields,
  type: z.literal('drag_word_bank'),
  noteSections: z.array(z.object({
    title: z.string().optional().default(''),
    lines: z.array(z.object({
      content: z.string().optional().default(''),
      lineType: z.string().optional().default('content'),
    })).optional().default([]),
  })).optional().default([]),
  matchingOptions: z.array(z.object({
    letter: z.string().optional().default(''),
    text: z.string().optional().default(''),
  })).optional().default([]),
  questions: z.array(z.object({
    number: z.coerce.number(),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const matchingDragGroupSchema = z.object({
  ...baseGroupFields,
  type: z.literal('matching_drag'),
  matchingOptions: z.array(z.object({
    letter: z.string().optional().default(''),
    text: z.string().optional().default(''),
  })).optional().default([]),
  questions: z.array(z.object({
    number: z.coerce.number(),
    questionText: z.string().optional().default(''),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const diagramLabelGroupSchema = z.object({
  ...baseGroupFields,
  type: z.literal('diagram_label'),
  questions: z.array(z.object({
    number: z.coerce.number(),
    hint: z.string().optional(),
    questionText: z.string().optional(),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const matchingHeadingsGroupSchema = z.object({
  ...baseGroupFields,
  type: z.literal('matching_headings'),
  matchingOptions: z.array(z.object({
    letter: z.string().optional().default(''),
    text: z.string().optional().default(''),
  })).optional().default([]),
  questions: z.array(z.object({
    number: z.coerce.number(),
    questionText: z.string().optional().default(''),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

const createMcqSchema = (typeLiteral) => z.object({
  ...baseGroupFields,
  type: z.literal(typeLiteral),
  questions: z.array(z.object({
    number: z.coerce.number(),
    questionText: z.string().optional().default(''),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional().default(''),
  })).optional().default([]),
})

// Union of ALL 14 questionGroup types
const questionGroupSchema = z.discriminatedUnion('type', [
  createTrueFalseSchema('true_false_ng'),
  createTrueFalseSchema('yes_no_ng'),
  createNoteCompletionSchema('note_completion'),
  createNoteCompletionSchema('table_completion'),
  createMatchingSchema('matching_information'),
  createMatchingSchema('matching'),
  createMatchingSchema('map_diagram'),
  dragWordBankGroupSchema,
  matchingDragGroupSchema,
  diagramLabelGroupSchema,
  matchingHeadingsGroupSchema,
  createMcqSchema('mcq'),
  createMcqSchema('mcq_multi'),
  createMcqSchema('short_answer'),
]).superRefine((group, ctx) => {
  // MCQ correctAnswer is stored/scored by matching option TEXT, so two options
  // with identical trimmed text in the same question are ambiguous (ticking one
  // reads as ticking all, and scoring can't tell them apart). Reject them.
  if (group.type !== 'mcq' && group.type !== 'mcq_multi') return
  ;(group.questions || []).forEach((q, qi) => {
    const seen = new Set()
    ;(q.options || []).forEach((opt) => {
      const t = String(opt || '').trim()
      if (!t) return
      if (seen.has(t)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', qi, 'options'],
          message: `Câu ${q.number ?? qi + 1}: các lựa chọn không được trùng nội dung ("${t}")`,
        })
      }
      seen.add(t)
    })
  })
})

// ─── PASSAGE & SECTION SCHEMAS ───────────────────────────────────────────────
const passageSchema = z.object({
  number: z.coerce.number(),
  title: z.string().optional().default(''),
  subtitle: z.string().nullable().optional(),
  letteredParagraphs: z.boolean().optional().default(false),
  body: z.string().optional().default(''),
  questionGroups: z.array(questionGroupSchema).optional().default([]),
  questions: z.array(z.any()).optional().default([]),
})

const sectionSchema = z.object({
  number: z.coerce.number(),
  context: z.string().optional().default(''),
  audioUrl: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  questionGroups: z.array(questionGroupSchema).optional().default([]),
  questions: z.array(z.any()).optional().default([]),
})

// ─── EXAM COMMON FIELDS ──────────────────────────────────────────────────────
const examCommonFields = {
  title: z.string({ message: 'Tên đề thi là bắt buộc' }).trim().min(1, { message: 'Tên đề thi không được để trống' }),
  bookNumber: z.coerce.number().nullable().optional(),
  testNumber: z.coerce.number().nullable().optional(),
  seriesId: z.coerce.number().nullable().optional(),
}

// ─── CREATE SCHEMAS ──────────────────────────────────────────────────────────
const createReadingExamSchema = z.object({
  ...examCommonFields,
  passages: z.array(passageSchema).optional().default([]),
})

const createListeningExamSchema = z.object({
  ...examCommonFields,
  sections: z.array(sectionSchema).optional().default([]),
})

const createWritingExamSchema = z.object({
  ...examCommonFields,
  task1: z.object({
    prompt: z.string().optional().default(''),
    imageUrl: z.string().nullable().optional(),
  }).optional().default({ prompt: '' }),
  task2: z.object({
    prompt: z.string().optional().default(''),
  }).optional().default({ prompt: '' }),
})

const createSpeakingExamSchema = z.object({
  ...examCommonFields,
  part1: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional().default({ questions: [] }),
  part2: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional().default({ questions: [] }),
  part3: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional().default({ questions: [] }),
})

// ─── UPDATE SCHEMA ───────────────────────────────────────────────────────────
const updateExamSchema = z.object({
  title: z.string().trim().min(1, { message: 'Tên đề thi không được để trống' }).optional(),
  bookNumber: z.coerce.number().nullable().optional(),
  testNumber: z.coerce.number().nullable().optional(),
  seriesId: z.coerce.number().nullable().optional(),
  passages: z.array(passageSchema).optional(),
  sections: z.array(sectionSchema).optional(),
  task1: z.object({
    prompt: z.string().optional().default(''),
    imageUrl: z.string().nullable().optional(),
  }).optional(),
  task2: z.object({
    prompt: z.string().optional().default(''),
  }).optional(),
  part1: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional(),
  part2: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional(),
  part3: z.object({
    cueCard: z.string().nullable().optional(),
    questions: z.array(z.string()).optional().default([]),
  }).optional(),
})

// ─── CAMBRIDGE EXTRACT SCHEMAS ───────────────────────────────────────────────
const cambridgeExtractBase = z.object({
  dataFile: z.string({ message: 'dataFile là bắt buộc' }).min(1, { message: 'dataFile không được để trống' }),
  skill: z.enum(['reading', 'listening', 'writing', 'speaking'], { message: 'Skill không hợp lệ' }),
  testNumber: z.coerce.number().optional(),
  bookNumber: z.coerce.number().optional(),
  startPage: z.coerce.number().optional(),
  endPage: z.coerce.number().optional(),
  answerStart: z.coerce.number().optional(),
  answerEnd: z.coerce.number().optional(),
  seriesId: z.coerce.number().optional(),
  bookTitle: z.string().optional(),
})

const cambridgeRefine = data => {
  if (data.startPage && data.endPage) {
    return data.startPage <= data.endPage
  }
  return true
}

const cambridgeRefineOpts = {
  message: 'Trang bắt đầu phải nhỏ hơn hoặc bằng trang kết thúc',
  path: ['startPage'],
}

const cambridgeExtractSchema = cambridgeExtractBase.refine(cambridgeRefine, cambridgeRefineOpts)
const cambridgeExtractSaveSchema = cambridgeExtractBase.refine(cambridgeRefine, cambridgeRefineOpts)

module.exports = {
  createReadingExamSchema,
  createListeningExamSchema,
  createWritingExamSchema,
  createSpeakingExamSchema,
  updateExamSchema,
  cambridgeExtractSchema,
  cambridgeExtractSaveSchema,
}
