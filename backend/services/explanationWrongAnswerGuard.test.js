'use strict'

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * HỒI QUY: CHẶN "AI BỊA DẪN CHỨNG" KHI ĐÁP ÁN NHẬP VÀO BỊ SAI
 *
 * Bối cảnh lỗi: giáo viên nhập đáp án sai (bài đọc ủng hộ A nhưng nhập B). Ở "chế độ
 * cố định", AI được yêu cầu giải thích cho B nên thường "cố" bịa dẫn chứng để bảo vệ B.
 *
 * Đã kiểm chứng thực tế: hỏi AI "đáp án bạn tự suy luận" ngay trong CÙNG prompt có chứa
 * đáp án đã chốt thì AI bị "neo" theo đáp án đó -> KHÔNG đáng tin. Vì vậy tín hiệu
 * đáng tin là:
 *   1. Giải mù ở LƯỢT GỌI RIÊNG (không chứa đáp án đã chốt) — `solveBlindWithGeminiRetry`
 *   2. Kết quả xung đột đã biết trước đó (`explanation.aiAnswer`)
 *   3. `no_support` do AI khai báo (tín hiệu phụ, miễn phí)
 *
 * Nếu bất kỳ tín hiệu nào cho thấy đáp án không được bài ủng hộ thì TUYỆT ĐỐI không lưu
 * lời giải ở trạng thái hiển thị cho học sinh (ai_generated).
 */

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const generateExpModulePath = require.resolve('../scripts/generate-explanations')
const originalGenerateExpModule = require(generateExpModulePath)
const generateExplanationMock = vi.fn()

require.cache[generateExpModulePath] = {
  id: generateExpModulePath,
  filename: generateExpModulePath,
  loaded: true,
  exports: {
    ...originalGenerateExpModule,
    generateExplanation: generateExplanationMock,
  },
}

const {
  generateForExam,
  generateForPracticeExam,
  regenerateQuestionExplanation,
  evaluateFixedModeSupport,
} = require('./explanationGeneratorService')

beforeEach(() => {
  // Tránh rò rỉ mockResolvedValueOnce chưa dùng giữa các test
  generateExplanationMock.mockReset()
})

const PASSAGE = 'Urban beekeeping has grown rapidly in recent years. Hives now sit on rooftops across the city.'

function practiceExamFixture({ number = 1, correctAnswer = 'B', byNumber = null } = {}) {
  return {
    id: 30,
    skill: 'reading',
    passage: PASSAGE,
    questions: [
      {
        id: 3001,
        content: JSON.stringify({
          type: 'mcq',
          questions: [
            {
              number,
              questionText: 'What has grown rapidly?',
              options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
              correctAnswer,
            },
          ],
        }),
        explanation: byNumber ? { byNumber } : null,
      },
    ],
  }
}

describe('0. evaluateFixedModeSupport — đánh giá tín hiệu độc lập', () => {
  it('no_support=true -> không được ủng hộ', () => {
    const res = evaluateFixedModeSupport({
      explanation: { no_support: true, supportNote: 'Bài đọc nói về ong trên sân thượng.' },
      targetAnswer: 'B',
      rawOptions: null,
      qType: 'mcq',
    })
    expect(res.supported).toBe(false)
    expect(res.reason).toContain('ong trên sân thượng')
  })

  it('đáp án giải mù khác đáp án đã chốt -> không được ủng hộ', () => {
    const res = evaluateFixedModeSupport({
      explanation: { no_support: false },
      targetAnswer: 'B',
      rawOptions: ['A. Farming', 'B. Urban beekeeping'],
      qType: 'mcq',
      independentAnswer: 'A',
    })
    expect(res.supported).toBe(false)
    expect(res.aiAnswer).toBe('A')
  })

  it('đáp án giải mù trùng đáp án đã chốt -> được ủng hộ', () => {
    const res = evaluateFixedModeSupport({
      explanation: { no_support: false },
      targetAnswer: 'B',
      rawOptions: ['A. Farming', 'B. Urban beekeeping'],
      qType: 'mcq',
      independentAnswer: 'B',
    })
    expect(res.supported).toBe(true)
  })

  it('không có tín hiệu độc lập (dữ liệu cũ) -> vẫn được ủng hộ', () => {
    const res = evaluateFixedModeSupport({
      explanation: { no_support: false },
      targetAnswer: 'B',
      rawOptions: null,
      qType: 'mcq',
    })
    expect(res.supported).toBe(true)
  })

  it('matching_headings: so sánh số La Mã đúng chuẩn', () => {
    const options = ['i. Ecosystem variety', 'ii. Deception studies']
    const ok = evaluateFixedModeSupport({
      explanation: { no_support: false },
      targetAnswer: 'i',
      rawOptions: options,
      qType: 'matching_headings',
      independentAnswer: 'i',
    })
    expect(ok.supported).toBe(true)

    const bad = evaluateFixedModeSupport({
      explanation: { no_support: false },
      targetAnswer: 'i',
      rawOptions: options,
      qType: 'matching_headings',
      independentAnswer: 'ii',
    })
    expect(bad.supported).toBe(false)
  })
})

describe('1. BATCH PRACTICE — giáo viên chọn "giữ đáp án của tôi" (choice=input)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.practiceQuestion.findUnique.mockImplementation(async () => ({
      id: 3001,
      content: practiceExamFixture().questions[0].content,
      explanation: { byNumber: {} },
    }))
    prismaMock.practiceQuestion.update.mockResolvedValue({})
  })

  it('AI đã tự giải ra đáp án khác ở lần xung đột trước -> KHÔNG gọi AI lại, KHÔNG lưu ai_generated', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValue(
      practiceExamFixture({
        correctAnswer: 'B',
        byNumber: { 1: { status: 'conflict_pending', aiAnswer: 'A', answer: 'B' } },
      })
    )

    const res = await generateForPracticeExam(30, { force: true, resolveChoices: { 1: 'input' } })

    expect(res.ok).toBe(true)
    // Không tốn thêm lượt gọi AI nào
    expect(generateExplanationMock).not.toHaveBeenCalled()
    expect(prismaMock.practiceQuestion.update).toHaveBeenCalledTimes(1)
    const savedExp = prismaMock.practiceQuestion.update.mock.calls[0][0].data.explanation.byNumber[1]
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.teacherKeptAnswer).toBe('B')
    expect(savedExp.needsRegenerationReason).toContain('"A"')
    // Đáp án chuẩn của giáo viên KHÔNG bị đổi
    expect(prismaMock.practiceQuestion.update.mock.calls[0][0].data.content).toBeUndefined()
  })

  it('chưa có tín hiệu độc lập -> chạy giải mù; khớp + AI khai no_support=true -> needs_regeneration', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValue(practiceExamFixture({ correctAnswer: 'B' }))

    // Lượt giải mù (không chứa đáp án đã chốt) -> B (khớp)
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      reasoning: 'Beekeeping grew rapidly.',
      provider: 'Gemini',
    })

    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: true,
      supportNote: 'Bài đọc không hề nhắc tới nông nghiệp.',
      reasoning: 'Không đủ căn cứ.',
      provider: 'Gemini',
    })

    const res = await generateForPracticeExam(30, { force: true, resolveChoices: { 1: 'input' } })

    expect(res.ok).toBe(true)
    expect(generateExplanationMock).toHaveBeenCalledTimes(2)
    const savedExp = prismaMock.practiceQuestion.update.mock.calls[0][0].data.explanation.byNumber[1]
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.teacherKeptAnswer).toBe('B')
    expect(savedExp.teacher_note).toContain('AI không tìm thấy bằng chứng ủng hộ đáp án')
  })

  it('chưa có tín hiệu độc lập + giải mù ra đáp án khác -> KHÔNG gọi AI sinh lời giải', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValue(practiceExamFixture({ correctAnswer: 'B' }))

    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'A',
      reasoning: 'The passage is about farming.',
      provider: 'Gemini',
    })

    const res = await generateForPracticeExam(30, { force: true, resolveChoices: { 1: 'input' } })

    expect(res.ok).toBe(true)
    // Chỉ 1 lượt gọi (giải mù); không gọi lượt sinh lời giải nào
    expect(generateExplanationMock).toHaveBeenCalledTimes(1)
    const savedExp = prismaMock.practiceQuestion.update.mock.calls[0][0].data.explanation.byNumber[1]
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.needsRegenerationReason).toContain('"A"')
  })

  it('đáp án được bài ủng hộ -> vẫn lưu ai_generated như cũ', async () => {
    prismaMock.practiceExam.findUnique.mockResolvedValue(practiceExamFixture({ correctAnswer: 'B' }))

    // Giải mù -> B (khớp)
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      reasoning: 'Beekeeping grew rapidly.',
      provider: 'Gemini',
    })
    // Sinh lời giải theo đáp án đã chốt
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: false,
      reasoning: 'Hives sit on rooftops.',
      evidence: { parts: [{ text: 'Hives now sit on rooftops across the city.' }] },
      provider: 'Gemini',
    })

    const res = await generateForPracticeExam(30, { force: true, resolveChoices: { 1: 'input' } })

    expect(res.ok).toBe(true)
    const savedExp = prismaMock.practiceQuestion.update.mock.calls[0][0].data.explanation.byNumber[1]
    expect(savedExp.status).toBe('ai_generated')
    expect(savedExp.answer).toBe('B')
  })
})

describe('2. BATCH EXAM — choice=input cũng phải được bảo vệ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.question.update.mockResolvedValue({})
  })

  it('AI đã tự giải ra đáp án khác -> needs_regeneration, không đổi đáp án chuẩn', async () => {
    prismaMock.exam.findUnique.mockResolvedValue({ id: 40, title: 'Exam 40', skill: 'reading' })
    prismaMock.question.findMany.mockResolvedValue([
      {
        id: 4001,
        number: 1,
        type: 'mcq',
        questionText: 'What has grown rapidly?',
        options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
        correctAnswer: 'B',
        explanation: { status: 'conflict_pending', aiAnswer: 'A', answer: 'B' },
        passage: { body: PASSAGE },
      },
    ])

    const res = await generateForExam(40, { force: true, resolveChoices: { 1: 'input' } })

    expect(res.ok).toBe(true)
    expect(generateExplanationMock).not.toHaveBeenCalled()
    expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
    const savedExp = prismaMock.question.update.mock.calls[0][0].data.explanation
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.teacherKeptAnswer).toBe('B')
    expect(savedExp.needsRegenerationReason).toContain('"A"')
  })
})

describe('3. TẠO LẠI 1 CÂU — lời giải cũ đã bị sửa tay (teacher_edited)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.question.update.mockResolvedValue({})
  })

  it('giải mù ra đáp án khác đáp án đang lưu -> trả conflict, KHÔNG ghi DB', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 5001,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
      correctAnswer: 'B',
      explanation: { status: 'teacher_edited', v: 2, answer: 'B', reasoning: 'Giáo viên tự viết.' },
      passage: { body: PASSAGE, examId: 50 },
    })

    // Giải mù (không biết đáp án đang lưu) -> A
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'A',
      reasoning: 'The passage is about farming.',
      evidence: { parts: [{ text: 'Urban beekeeping has grown rapidly' }] },
      provider: 'Gemini',
    })

    const res = await regenerateQuestionExplanation({
      examId: 50,
      questionNumber: 1,
      isPractice: false,
    })

    expect(res.ok).toBe(true)
    expect(res.conflict).toBe(true)
    expect(res.aiBlindAnswer).toBe('A')
    expect(res.currentAnswer).toBe('B')
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('chỉ truyền questionNumber -> KHÔNG tra theo id (tránh ghi nhầm câu của đề khác)', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 5099,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping'],
      correctAnswer: 'B',
      explanation: { status: 'ai_generated', v: 2, answer: 'B' },
      passage: { body: PASSAGE, examId: 52 },
    })
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      reasoning: 'Beekeeping grew rapidly.',
      provider: 'Gemini',
    })
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: false,
      reasoning: 'Hives sit on rooftops.',
      provider: 'Gemini',
    })

    await regenerateQuestionExplanation({ examId: 52, questionNumber: 1, isPractice: false })

    const where = prismaMock.question.findFirst.mock.calls[0][0].where
    expect(JSON.stringify(where)).not.toContain('"id"')
    expect(JSON.stringify(where)).toContain('"number":1')
  })

  it('có truyền questionId -> vẫn tra theo id như trước', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 5100,
      number: 7,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping'],
      correctAnswer: 'B',
      explanation: { status: 'ai_generated', v: 2, answer: 'B' },
      passage: { body: PASSAGE, examId: 53 },
    })
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      reasoning: 'Beekeeping grew rapidly.',
      provider: 'Gemini',
    })
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: false,
      reasoning: 'Hives sit on rooftops.',
      provider: 'Gemini',
    })

    await regenerateQuestionExplanation({ examId: 53, questionId: 5100, isPractice: false })

    const where = prismaMock.question.findFirst.mock.calls[0][0].where
    expect(where.OR.some((c) => c.id === 5100)).toBe(true)
  })

  it('giải mù khớp đáp án đang lưu -> sinh lời giải bình thường', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 5002,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
      correctAnswer: 'B',
      explanation: { status: 'teacher_edited', v: 2, answer: 'B', reasoning: 'Giáo viên tự viết.' },
      passage: { body: PASSAGE, examId: 51 },
    })

    // Lần 1: giải mù -> B (khớp)
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      reasoning: 'Beekeeping grew rapidly.',
      provider: 'Gemini',
    })
    // Lần 2: chế độ cố định cho B -> B (khớp)
    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: false,
      reasoning: 'Hives now sit on rooftops across the city.',
      evidence: { parts: [{ text: 'Hives now sit on rooftops across the city.' }] },
      provider: 'Gemini',
    })

    const res = await regenerateQuestionExplanation({
      examId: 51,
      questionNumber: 1,
      isPractice: false,
    })

    expect(res.ok).toBe(true)
    expect(res.status).toBe('ai_generated')
    expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
    const savedExp = prismaMock.question.update.mock.calls[0][0].data.explanation
    expect(savedExp.status).toBe('ai_generated')
  })
})

describe('4. ĐỔI ĐÁP ÁN CÓ XÁC NHẬN (Luồng Y) — không bao giờ công bố lời giải bịa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.question.update.mockResolvedValue({})
  })

  it('giáo viên xác nhận đổi sang đáp án AI cũng đồng ý -> ai_generated bình thường', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 6001,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
      correctAnswer: 'A',
      explanation: { status: 'conflict_pending', v: 2, answer: 'A', aiAnswer: 'B' },
      passage: { body: PASSAGE, examId: 60 },
    })

    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: false,
      reasoning: 'Beekeeping is the subject of the passage.',
      evidence: { parts: [{ text: 'Urban beekeeping has grown rapidly in recent years.' }] },
      provider: 'Gemini',
    })

    const res = await regenerateQuestionExplanation({
      examId: 60,
      questionNumber: 1,
      isPractice: false,
      proposedAnswer: 'B',
      confirmChangeAnswer: true,
    })

    expect(res.ok).toBe(true)
    expect(res.status).toBe('ai_generated')
    expect(res.updatedCorrectAnswer).toBe('B')
    const expUpdate = prismaMock.question.update.mock.calls.find((c) => c[0].data.explanation)
    expect(expUpdate[0].data.explanation.status).toBe('ai_generated')
  })

  it('AI vẫn tự suy luận ra đáp án cũ -> đổi đáp án nhưng KHÔNG sinh lời giải bịa', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 6002,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
      correctAnswer: 'A',
      explanation: { status: 'conflict_pending', v: 2, answer: 'A', aiAnswer: 'A' },
      passage: { body: PASSAGE, examId: 61 },
    })

    const res = await regenerateQuestionExplanation({
      examId: 61,
      questionNumber: 1,
      isPractice: false,
      proposedAnswer: 'B',
      confirmChangeAnswer: true,
    })

    expect(res.ok).toBe(true)
    expect(res.status).toBe('needs_regeneration')
    // Không tốn lượt gọi AI nào để "bảo vệ" đáp án sai
    expect(generateExplanationMock).not.toHaveBeenCalled()
    const expUpdate = prismaMock.question.update.mock.calls.find((c) => c[0].data.explanation)
    const savedExp = expUpdate[0].data.explanation
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.teacherKeptAnswer).toBe('B')
    // Đáp án vẫn được đổi theo quyết định rõ ràng của giáo viên
    const answerUpdate = prismaMock.question.update.mock.calls.find((c) => c[0].data.correctAnswer)
    expect(answerUpdate[0].data.correctAnswer).toBe('B')
    expect(res.message).not.toContain('thành công')
  })

  it('AI khai no_support=true sau khi đổi đáp án -> needs_regeneration', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 6003,
      number: 1,
      type: 'mcq',
      questionText: 'What has grown rapidly?',
      options: ['A. Farming', 'B. Urban beekeeping', 'C. Rooftop gardens', 'D. City traffic'],
      correctAnswer: 'A',
      explanation: { status: 'conflict_pending', v: 2, answer: 'A', aiAnswer: 'B' },
      passage: { body: PASSAGE, examId: 62 },
    })

    generateExplanationMock.mockResolvedValueOnce({
      v: 2,
      answer: 'B',
      no_support: true,
      supportNote: 'Bài đọc không hề nhắc tới nông nghiệp.',
      reasoning: 'Không đủ căn cứ.',
      provider: 'Gemini',
    })

    const res = await regenerateQuestionExplanation({
      examId: 62,
      questionNumber: 1,
      isPractice: false,
      proposedAnswer: 'B',
      confirmChangeAnswer: true,
    })

    expect(res.ok).toBe(true)
    expect(res.status).toBe('needs_regeneration')
    const expUpdate = prismaMock.question.update.mock.calls.find((c) => c[0].data.explanation)
    const savedExp = expUpdate[0].data.explanation
    expect(savedExp.status).toBe('needs_regeneration')
    expect(savedExp.teacherKeptAnswer).toBe('B')
    expect(savedExp.needsRegenerationReason).toContain('nông nghiệp')
  })
})

describe('5. CLIENT NGẮT KẾT NỐI — server phải dừng, không ghi dữ liệu "ma"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.question.update.mockResolvedValue({})
  })

  it('signal đã abort trước khi chạy -> không gọi AI, không ghi DB', async () => {
    prismaMock.exam.findUnique.mockResolvedValue({ id: 70, title: 'Exam 70', skill: 'reading' })
    prismaMock.question.findMany.mockResolvedValue([
      {
        id: 7001,
        number: 1,
        type: 'mcq',
        questionText: 'What has grown rapidly?',
        options: ['A. Farming', 'B. Urban beekeeping'],
        correctAnswer: 'B',
        explanation: null,
        passage: { body: PASSAGE },
      },
      {
        id: 7002,
        number: 2,
        type: 'mcq',
        questionText: 'Where do hives sit?',
        options: ['A. On rooftops', 'B. In gardens'],
        correctAnswer: 'A',
        explanation: null,
        passage: { body: PASSAGE },
      },
    ])

    const controller = new AbortController()
    controller.abort()

    const res = await generateForExam(70, { force: true, signal: controller.signal })

    expect(res.ok).toBe(true)
    expect(res.generatedCount).toBe(0)
    expect(generateExplanationMock).not.toHaveBeenCalled()
    expect(prismaMock.question.update).not.toHaveBeenCalled()
  })

  it('abort giữa chừng -> dừng ngay, chỉ lưu kết quả đã sinh xong', async () => {
    prismaMock.exam.findUnique.mockResolvedValue({ id: 71, title: 'Exam 71', skill: 'reading' })
    prismaMock.question.findMany.mockResolvedValue([
      {
        id: 7101,
        number: 1,
        type: 'mcq',
        questionText: 'What has grown rapidly?',
        options: ['A. Farming', 'B. Urban beekeeping'],
        correctAnswer: 'B',
        explanation: null,
        passage: { body: PASSAGE },
      },
      {
        id: 7102,
        number: 2,
        type: 'mcq',
        questionText: 'Where do hives sit?',
        options: ['A. On rooftops', 'B. In gardens'],
        correctAnswer: 'A',
        explanation: null,
        passage: { body: PASSAGE },
      },
    ])

    const controller = new AbortController()
    generateExplanationMock.mockImplementationOnce(async () => {
      // Mô phỏng: câu 1 sinh xong thì client đóng tab
      controller.abort()
      return {
        v: 2,
        answer: 'B',
        reasoning: 'Beekeeping grew rapidly.',
        evidence: { parts: [{ text: 'Urban beekeeping has grown rapidly in recent years.' }] },
        provider: 'Gemini',
      }
    })

    const res = await generateForExam(71, { force: true, signal: controller.signal })

    expect(res.ok).toBe(true)
    // Chỉ 1 lượt gọi AI (câu 2 không được gọi)
    expect(generateExplanationMock).toHaveBeenCalledTimes(1)
    // Chỉ câu 1 được lưu
    expect(prismaMock.question.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.question.update.mock.calls[0][0].where.id).toBe(7101)
  })
})
