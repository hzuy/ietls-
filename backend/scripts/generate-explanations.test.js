import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

process.env.GROQ_API_KEY = 'test_key'

const prismaMock = {
  question: { findMany: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), update: vi.fn() },
  $disconnect: vi.fn(),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const PASSAGE = 'A shipping magnate made his fortune in the timber and shipping trades.\nHis granddaughters became collectors.'

const VALID_EXPLANATION = {
  question_chunks: [{ text: 'the grandfather', label: 'người ông' }, { text: '[Q:1]', label: 'nguồn còn thiếu' }],
  predict: 'STEP 1 — Cần một danh từ chỉ nguồn của cải.',
  locate_note: 'Tìm ý gây dựng của cải.',
  locate_keywords: ['made his fortune', 'không có trong bài'],
  evidence_quote: 'A shipping magnate made his fortune in the timber and shipping trades.',
  evidence_chunks: [
    { text: 'in the timber and shipping trades', label: 'ngành gỗ và vận tải biển' },
    { text: 'made his fortune', label: 'gây dựng cơ nghiệp' },
    { text: 'cụm bịa', label: 'x' },
  ],
  answer: 'timber',
  full_sentence: 'the grandfather built his wealth on timber',
  translation: 'người ông gây dựng của cải từ gỗ',
  reasoning: 'Bài nêu ngành gỗ.',
  paraphrases: [
    { question: 'built his wealth', question_label: 'gây dựng của cải', passage: 'made his fortune', passage_label: 'tạo dựng cơ nghiệp' },
    { question: 'x', question_label: 'x', passage: 'không có trong bài', passage_label: 'x' },
  ],
  distractors: [
    { option: 'shipping', label: 'vận tải biển', reason: 'Đề đã cho ngành này.' },
    { option: 'weights', label: 'trọng lượng', reason: 'Không có trong bài.' },
  ],
}

const COMPLETION_Q = { id: 42, number: 1, type: 'fill_blank', questionText: null, correctAnswer: 'timber', group: { passage: { body: PASSAGE } } }

// Mock trực tiếp lib/groqClient.js (cùng kỹ thuật require.cache override như
// prismaMock ở trên) thay vì vi.mock('groq-sdk') — tránh phụ thuộc vào cách
// Vitest hoist/interop mock cho một package được require() gián tiếp qua
// module trung gian (lib/groqClient.js → groq-sdk).
const groqCreateMock = vi.fn()
const groqClientPath = require.resolve('../lib/groqClient')
require.cache[groqClientPath] = {
  id: groqClientPath,
  filename: groqClientPath,
  loaded: true,
  exports: {
    getGroqClient: () => ({ chat: { completions: { create: groqCreateMock } } }),
    getGroqModel: () => 'test-model',
  },
}

const mod = require('./generate-explanations')
const {
  classifyFamily,
  findNoteSectionContext,
  buildContext,
  enrichExplanation,
  normalizeText,
  processQuestion,
  processPracticeQuestion,
  SKIP_FAMILIES,
} = mod

function mockGroqResponse(content, finishReason = 'stop') {
  groqCreateMock.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: finishReason }],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('classifyFamily', () => {
  it('nhận diện đúng từng họ loại câu hỏi', () => {
    expect(classifyFamily('mcq')).toBe('MCQ')
    expect(classifyFamily('mcq_multi')).toBe('MCQ')
    expect(classifyFamily('true_false_ng')).toBe('TFNG')
    expect(classifyFamily('yes_no_ng')).toBe('TFNG')
    expect(classifyFamily('matching')).toBe('MATCHING')
    expect(classifyFamily('matching_paragraph')).toBe('MATCHING')
    expect(classifyFamily('fill_blank')).toBe('COMPLETION')
    expect(classifyFamily('table_completion')).toBe('COMPLETION')
    expect(classifyFamily('map_diagram')).toBe('IMAGE')
    expect(classifyFamily('diagram_label')).toBe('IMAGE')
  })

  it('trả về GENERIC cho loại không xác định', () => {
    expect(classifyFamily('unknown_type_xyz')).toBe('GENERIC')
    expect(classifyFamily(null)).toBe('GENERIC')
  })

  it('nhóm IMAGE nằm trong SKIP_FAMILIES', () => {
    expect(SKIP_FAMILIES.has('IMAGE')).toBe(true)
    expect(SKIP_FAMILIES.has('MCQ')).toBe(false)
  })
})

describe('findNoteSectionContext', () => {
  const group = {
    noteSections: [
      { lines: [{ contentWithTokens: 'Name: [Q:1]' }, { contentWithTokens: 'Age: [Q:2]' }] },
      { lines: [{ contentWithTokens: 'Address: [Q:3]' }] },
    ],
  }

  it('tìm đúng đoạn NoteSection chứa token [Q:n]', () => {
    const ctx = findNoteSectionContext(group, 2)
    expect(ctx).toContain('[Q:2]')
    expect(ctx).toContain('Name: [Q:1]')
  })

  it('trả về null nếu không tìm thấy token', () => {
    expect(findNoteSectionContext(group, 99)).toBeNull()
  })

  it('trả về null nếu group không có noteSections', () => {
    expect(findNoteSectionContext({}, 1)).toBeNull()
    expect(findNoteSectionContext(null, 1)).toBeNull()
  })
})

describe('buildContext', () => {
  it('câu MCQ lấy đoạn văn qua group.passage khi Question.passageId trực tiếp rỗng', () => {
    const q = { type: 'mcq', group: { passage: { body: 'Đoạn văn thật' } } }
    const ctx = buildContext(q, 'MCQ')
    expect(ctx.skill).toBe('reading')
    expect(ctx.parts.some(p => p.text.includes('Đoạn văn thật'))).toBe(true)
  })

  it('câu MATCHING gửi kèm danh sách matchingOptions', () => {
    const q = { type: 'matching', group: { passage: { body: 'x' }, matchingOptions: [{ optionLetter: 'A', optionText: 'Option A' }] } }
    const ctx = buildContext(q, 'MATCHING')
    expect(ctx.parts.some(p => p.text.includes('A. Option A'))).toBe(true)
  })

  it('câu COMPLETION gửi kèm đúng đoạn NoteSection chứa token của câu đó', () => {
    const q = {
      type: 'fill_blank', number: 5,
      group: {
        listeningSection: null,
        noteSections: [{ lines: [{ contentWithTokens: 'Postcode: [Q:5]' }] }],
      },
    }
    const ctx = buildContext(q, 'COMPLETION')
    expect(ctx.parts.some(p => p.text.includes('[Q:5]'))).toBe(true)
  })

  it('câu IMAGE không có ngữ cảnh thì không thêm dòng "(không có...)"', () => {
    const q = { type: 'map_diagram', group: {} }
    const ctx = buildContext(q, 'IMAGE')
    expect(ctx.parts.length).toBe(0)
  })
})

describe('processQuestion', () => {
  it('bỏ qua (skip) câu thuộc họ IMAGE, không gọi Groq, không ghi DB', async () => {
    const q = { id: 1, type: 'map_diagram', group: {} }
    const result = await processQuestion(q, { dryRun: false })
    expect(result).toEqual({ skipped: true })
    expect(groqCreateMock).not.toHaveBeenCalled()
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('sinh giải thích hợp lệ và ghi vào DB qua cột explanation', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    const result = await processQuestion(COMPLETION_Q, { dryRun: false })
    expect(result.skipped).toBe(false)
    expect(result.explanation.v).toBe(2)
    expect(prismaMock.question.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { explanation: result.explanation } })
  })

  it('--dry-run gọi Groq nhưng KHÔNG ghi vào DB', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    await processQuestion(COMPLETION_Q, { dryRun: true })
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('JSON thiếu trường bắt buộc → gọi lại 1 lần rồi bỏ, không ghi DB', async () => {
    mockGroqResponse({ predict: 'a' })
    mockGroqResponse({ predict: 'a' })
    await expect(processQuestion(COMPLETION_Q, { dryRun: false })).rejects.toThrow()
    expect(groqCreateMock).toHaveBeenCalledTimes(2)
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('câu trích không có trong bài → gọi lại kèm lý do, lần 2 đúng thì dùng', async () => {
    mockGroqResponse({ ...VALID_EXPLANATION, evidence_quote: 'He was a famous painter.' })
    mockGroqResponse(VALID_EXPLANATION)
    const result = await processQuestion(COMPLETION_Q, { dryRun: false })
    expect(groqCreateMock).toHaveBeenCalledTimes(2)
    expect(groqCreateMock.mock.calls[1][0].messages[0].content).toContain('LẦN TRẢ LỜI TRƯỚC BỊ LOẠI')
    expect(result.explanation.evidence.parts[0].paragraph).toBe(0)
  })

  it('ném lỗi khi Groq trả JSON không hợp lệ (không parse được)', async () => {
    groqCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: 'not json at all' }, finish_reason: 'stop' }] })
    await expect(processQuestion(COMPLETION_Q, { dryRun: false })).rejects.toThrow()
  })

  it('Groq báo 429 → chờ rồi gọi lại, không bỏ câu', async () => {
    vi.useFakeTimers()
    const rateErr = Object.assign(new Error('Rate limit reached. Please try again in 10ms.'), { status: 429 })
    groqCreateMock.mockRejectedValueOnce(rateErr)
    mockGroqResponse(VALID_EXPLANATION)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const promise = processQuestion(COMPLETION_Q, { dryRun: true })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.explanation.v).toBe(2)
    expect(groqCreateMock).toHaveBeenCalledTimes(2)
    logSpy.mockRestore()
    vi.useRealTimers()
  })
})

describe('enrichExplanation — chỉ giữ thông tin có thật trong bài', () => {
  const ctx = { sourceText: PASSAGE }
  const out = enrichExplanation(VALID_EXPLANATION, ctx, 'timber', 'COMPLETION')

  it('tính số đoạn từ vị trí câu trích', () => {
    expect(out.evidence.paragraph).toBe(0)
    expect(out.locate.paragraph).toBe(0)
  })

  it('bỏ cụm trích, từ khoá, paraphrase không có trong bài; sắp cụm theo thứ tự xuất hiện', () => {
    expect(out.evidence.chunks.map(c => c.text)).toEqual(['made his fortune', 'in the timber and shipping trades'])
    expect(out.locate.keywords).toEqual(['made his fortune'])
    expect(out.paraphrases).toHaveLength(1)
  })

  it('câu điền từ: bỏ lựa chọn nhiễu không có trong bài', () => {
    expect(out.distractors.map(d => d.option)).toEqual(['shipping'])
  })

  it('bỏ tiền tố "STEP n —" và đổi [Q:n] thành "n. ___"', () => {
    expect(out.predict).toBe('Cần một danh từ chỉ nguồn của cải.')
    expect(out.question_chunks[1].text).toBe('1. ___')
  })

  it('câu trích nhiều chỗ ngăn bởi " | " được tách thành nhiều phần', () => {
    const multi = enrichExplanation({ ...VALID_EXPLANATION, evidence_quote: 'His granddaughters became collectors. | A shipping magnate made his fortune' }, ctx, 'x')
    expect(multi.evidence.parts.map(p => p.paragraph)).toEqual([1, 0])
  })

  it('so khớp bỏ qua khác biệt dấu nháy, gạch nối, khoảng trắng', () => {
    expect(normalizeText('“Well‑being,”  he said')).toBe(normalizeText("'Well-being,' he said"))
  })

  it('NOT GIVEN không có câu trích → evidence null, không lỗi', () => {
    const ng = enrichExplanation({ ...VALID_EXPLANATION, evidence_quote: '' }, ctx, 'NOT GIVEN', 'TFNG')
    expect(ng.evidence).toBeNull()
  })
})

describe('processPracticeQuestion', () => {
  it('trích được questionText từ content dạng JSON.stringify object', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    const pq = { id: 7, type: 'mcq', content: JSON.stringify({ questionText: 'Hidden question' }), correctAnswer: 'A', exam: { skill: 'reading', passage: PASSAGE } }
    const result = await processPracticeQuestion(pq, { dryRun: false })
    expect(result.skipped).toBe(false)
    expect(prismaMock.practiceQuestion.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { explanation: result.explanation } })
  })

  it('dùng nguyên văn content khi không phải JSON', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    const pq = { id: 8, type: 'mcq', content: 'Plain text question', correctAnswer: 'A', exam: { skill: 'reading', passage: null } }
    await processPracticeQuestion(pq, { dryRun: false })
    const promptArg = groqCreateMock.mock.calls[0][0].messages[0].content
    expect(promptArg).toContain('Plain text question')
  })
})

describe('main — cô lập lỗi từng câu, không dừng cả script', () => {
  it('một câu lỗi không chặn các câu còn lại (2 OK, 1 lỗi trong số 3 câu)', async () => {
    prismaMock.question.findMany.mockResolvedValueOnce([
      { ...COMPLETION_Q, id: 1 },
      { ...COMPLETION_Q, id: 2 },
      { ...COMPLETION_Q, id: 3 },
    ])
    mockGroqResponse(VALID_EXPLANATION) // câu 1 OK
    groqCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: 'broken json' }, finish_reason: 'stop' }] }) // câu 2 lỗi
    mockGroqResponse(VALID_EXPLANATION) // câu 3 OK

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    process.argv = ['node', 'generate-explanations.js', '--delay=0']
    await mod.main()

    expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.question.update.mock.calls.map(c => c[0].where.id)).toEqual([1, 3])

    logSpy.mockRestore()
    errSpy.mockRestore()
  })
})

describe('fetchQuestions — điều kiện lọc cho phép chạy lại không sinh trùng', () => {
  it('lọc theo explanation IS NULL bằng Prisma.DbNull (không phải JSON null)', async () => {
    prismaMock.question.findMany.mockResolvedValueOnce([])
    process.argv = ['node', 'generate-explanations.js', '--delay=0']
    await mod.main()
    const args = prismaMock.question.findMany.mock.calls[0][0]
    expect(args.where.explanation.equals).toBe(Prisma.DbNull)
  })
})
