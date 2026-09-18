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

const VALID_EXPLANATION = {
  restatement: 'a', evidence: 'b', reasoning: 'c', conclusion: 'd',
}

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
    const q = { id: 42, type: 'mcq', questionText: 'Q?', correctAnswer: 'A', group: { passage: { body: 'ctx' } } }
    const result = await processQuestion(q, { dryRun: false })
    expect(result).toEqual({ skipped: false, explanation: VALID_EXPLANATION })
    expect(prismaMock.question.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { explanation: VALID_EXPLANATION } })
  })

  it('--dry-run gọi Groq nhưng KHÔNG ghi vào DB', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    const q = { id: 42, type: 'mcq', questionText: 'Q?', correctAnswer: 'A', group: { passage: { body: 'ctx' } } }
    await processQuestion(q, { dryRun: true })
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('ném lỗi khi Groq trả JSON thiếu trường bắt buộc — không ghi DB', async () => {
    mockGroqResponse({ restatement: 'a', evidence: 'b' }) // thiếu reasoning/conclusion
    const q = { id: 42, type: 'mcq', questionText: 'Q?', correctAnswer: 'A', group: { passage: { body: 'ctx' } } }
    await expect(processQuestion(q, { dryRun: false })).rejects.toThrow()
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('ném lỗi khi Groq trả JSON không hợp lệ (không parse được)', async () => {
    groqCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: 'not json at all' }, finish_reason: 'stop' }] })
    const q = { id: 42, type: 'mcq', questionText: 'Q?', correctAnswer: 'A', group: { passage: { body: 'ctx' } } }
    await expect(processQuestion(q, { dryRun: false })).rejects.toThrow()
  })
})

describe('processPracticeQuestion', () => {
  it('trích được questionText từ content dạng JSON.stringify object', async () => {
    mockGroqResponse(VALID_EXPLANATION)
    const pq = { id: 7, type: 'mcq', content: JSON.stringify({ questionText: 'Hidden question' }), correctAnswer: 'A', exam: { skill: 'reading', passage: 'ctx' } }
    const result = await processPracticeQuestion(pq, { dryRun: false })
    expect(result.skipped).toBe(false)
    expect(prismaMock.practiceQuestion.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { explanation: VALID_EXPLANATION } })
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
      { id: 1, type: 'mcq', questionText: 'Q1', correctAnswer: 'A', group: { passage: { body: 'ctx' } } },
      { id: 2, type: 'mcq', questionText: 'Q2', correctAnswer: 'B', group: { passage: { body: 'ctx' } } },
      { id: 3, type: 'mcq', questionText: 'Q3', correctAnswer: 'C', group: { passage: { body: 'ctx' } } },
    ])
    mockGroqResponse(VALID_EXPLANATION) // câu 1 OK
    groqCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: 'broken json' }, finish_reason: 'stop' }] }) // câu 2 lỗi
    mockGroqResponse(VALID_EXPLANATION) // câu 3 OK

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    process.argv = ['node', 'generate-explanations.js', '--delay=0']
    await mod.main()

    expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.question.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { explanation: VALID_EXPLANATION } })
    expect(prismaMock.question.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { explanation: VALID_EXPLANATION } })

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
