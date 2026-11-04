import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

// Mock lib/groqClient để không gọi AI thật trong test tích hợp dịch vụ.
const geminiJsonMock = vi.fn()
const groqCreateMock = vi.fn()
const groqClientPath = require.resolve('../lib/groqClient')
require.cache[groqClientPath] = {
  id: groqClientPath,
  filename: groqClientPath,
  loaded: true,
  exports: {
    getGroqClient: () => ({ chat: { completions: { create: groqCreateMock } } }),
    getGroqModel: () => 'test-model',
    getGroqVisionModel: () => 'test-vision-model',
    requestGeminiJson: geminiJsonMock,
    requestGroqGradingJson: vi.fn(),
  },
}

const { isAnswerMatch, generateForExam, generateForPracticeExam } = require('./explanationGeneratorService')

describe('explanationGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geminiJsonMock.mockReset()
    groqCreateMock.mockReset()
  })

  describe('isAnswerMatch', () => {
    it('matches exact strings', () => {
      expect(isAnswerMatch('True', 'True')).toBe(true)
      expect(isAnswerMatch('TRUE', 'true')).toBe(true)
    })

    it('matches trimmed and normalized strings', () => {
      expect(isAnswerMatch('  FALSE  ', 'false')).toBe(true)
      expect(isAnswerMatch('“timber”', 'timber')).toBe(true)
    })

    it('matches slash separated alternatives', () => {
      expect(isAnswerMatch('center/centre', 'centre')).toBe(true)
      expect(isAnswerMatch('theater | theatre', 'theater')).toBe(true)
    })

    it('matches TFNG canonical abbreviations', () => {
      expect(isAnswerMatch('T', 'TRUE')).toBe(true)
      expect(isAnswerMatch('f', 'False')).toBe(true)
      expect(isAnswerMatch('NG', 'NOT GIVEN')).toBe(true)
      expect(isAnswerMatch('y', 'Yes')).toBe(true)
      expect(isAnswerMatch('n', 'NO')).toBe(true)
      expect(isAnswerMatch('T', 'FALSE')).toBe(false)
    })

    it('resolves option letters and option texts correctly', () => {
      const options = ['peers', 'patients', 'students', 'teachers']
      // Matching cases
      expect(isAnswerMatch('students', 'C. students', options)).toBe(true)
      expect(isAnswerMatch('C', 'C. students', options)).toBe(true)
      expect(isAnswerMatch('C. students', 'students', options)).toBe(true)
      expect(isAnswerMatch('C', 'students', options)).toBe(true)

      // Mismatch / Conflict cases (like user entering 'patients' instead of 'students')
      expect(isAnswerMatch('patients', 'C. students', options)).toBe(false)
      expect(isAnswerMatch('B', 'C. students', options)).toBe(false)
      expect(isAnswerMatch('patients', 'students', options)).toBe(false)
      expect(isAnswerMatch('peers', 'C. students', options)).toBe(false)
    })

    it('Batch 1a: handles trailing punctuation on correctAnswer or AI response for MCQ (Ekman Q1 reproduction)', () => {
      const options = ['A. peers', 'B. patients', 'C. students', 'D. teachers']
      const correctAnswer = 'students.'

      // AI returns 'C' -> must match
      expect(isAnswerMatch(correctAnswer, 'C', options, 'mcq')).toBe(true)
      // AI returns 'C. students' -> must match
      expect(isAnswerMatch(correctAnswer, 'C. students', options, 'mcq')).toBe(true)
      // AI returns 'students' -> must match
      expect(isAnswerMatch(correctAnswer, 'students', options, 'mcq')).toBe(true)

      // Counter-tests: must NOT falsely match
      expect(isAnswerMatch('3.5', '35', null, 'fill_blank')).toBe(false)
      expect(isAnswerMatch('U.S.', 'US', null, 'fill_blank')).toBe(false)
      expect(isAnswerMatch('Mr.', 'Mr', null, 'fill_blank')).toBe(true)
      expect(isAnswerMatch('FALSE.', 'FALSE', null, 'true_false_ng')).toBe(true)
      expect(isAnswerMatch('patients.', 'C. students', options, 'mcq')).toBe(false)
    })

    it('handles JSON string options and object options', () => {
      const jsonOptions = JSON.stringify(['peers', 'patients', 'students', 'teachers'])
      expect(isAnswerMatch('patients', 'C. students', jsonOptions)).toBe(false)
      expect(isAnswerMatch('students', 'C. students', jsonOptions)).toBe(true)

      const objectOptions = [
        { optionLetter: 'A', optionText: 'peers' },
        { optionLetter: 'B', optionText: 'patients' },
        { optionLetter: 'C', optionText: 'students' },
      ]
      expect(isAnswerMatch('patients', 'C. students', objectOptions)).toBe(false)
      expect(isAnswerMatch('C', 'students', objectOptions)).toBe(true)
    })

    describe('MCQ Multi normalization (Set-based comparison)', () => {
      const options = [
        'A. Agricultural pesticides',
        'B. Climate variation',
        'C. Coastal urban development',
        'D. Marine tourism',
        'E. Invasive predators',
      ]

      it('matches multi-choice regardless of letter order', () => {
        expect(isAnswerMatch('A, C', 'C, A', options, 'mcq_multi')).toBe(true)
        expect(isAnswerMatch('A,C', 'C,A', options, 'mcq_multi')).toBe(true)
      })

      it('matches various separators: and, &, và, newlines', () => {
        expect(isAnswerMatch('A, C', 'A and C', options, 'mcq_multi')).toBe(true)
        expect(isAnswerMatch('A, C', 'A & C', options, 'mcq_multi')).toBe(true)
        expect(isAnswerMatch('A, C', 'A và C', options, 'mcq_multi')).toBe(true)
        expect(isAnswerMatch('A, C', 'AC', options, 'mcq_multi')).toBe(true)
      })

      it('matches letters against AI answers with prefixed option texts', () => {
        expect(isAnswerMatch(
          'A, C',
          'A. Agricultural pesticides, C. Coastal urban development',
          options,
          'mcq_multi'
        )).toBe(true)
        expect(isAnswerMatch(
          'A, C',
          'A. Agricultural pesticides và C. Coastal urban development',
          options,
          'mcq_multi'
        )).toBe(true)
      })

      it('negative tests: rejects incorrect or incomplete multi-choice selections', () => {
        expect(isAnswerMatch('A, C', 'A, D', options, 'mcq_multi')).toBe(false)
        expect(isAnswerMatch('A, C', 'A', options, 'mcq_multi')).toBe(false)
        expect(isAnswerMatch('A, B, C', 'A, B', options, 'mcq_multi')).toBe(false)
        expect(isAnswerMatch('A, C', 'B, D', options, 'mcq_multi')).toBe(false)
      })
    })

    describe('TFNG & YNNG family normalization', () => {
      it('equates YES=TRUE and NO=FALSE when question belongs to TFNG or YNNG', () => {
        expect(isAnswerMatch('NO', 'FALSE', null, 'yes_no_ng')).toBe(true)
        expect(isAnswerMatch('FALSE', 'NO', null, 'yes_no_ng')).toBe(true)
        expect(isAnswerMatch('YES', 'TRUE', null, 'yes_no_ng')).toBe(true)
        expect(isAnswerMatch('TRUE', 'YES', null, 'true_false_ng')).toBe(true)
        expect(isAnswerMatch('NO', 'FALSE', null, 'true_false_ng')).toBe(true)
        expect(isAnswerMatch('NG', 'NOT GIVEN', null, 'true_false_ng')).toBe(true)
        expect(isAnswerMatch('NOT_GIVEN', 'not given', null, 'yes_no_ng')).toBe(true)
      })

      it('does NOT equate YES=TRUE or NO=FALSE when question is NOT in TFNG family', () => {
        expect(isAnswerMatch('NO', 'FALSE', null, 'fill_blank')).toBe(false)
        expect(isAnswerMatch('YES', 'TRUE', null, 'short_answer')).toBe(false)
        expect(isAnswerMatch('yes', 'true', null, 'mcq')).toBe(false)
      })

      it('negative tests: rejects opposite truth values in TFNG/YNNG', () => {
        expect(isAnswerMatch('TRUE', 'FALSE', null, 'true_false_ng')).toBe(false)
        expect(isAnswerMatch('YES', 'NO', null, 'yes_no_ng')).toBe(false)
        expect(isAnswerMatch('TRUE', 'NOT GIVEN', null, 'true_false_ng')).toBe(false)
        expect(isAnswerMatch('NO', 'NOT GIVEN', null, 'yes_no_ng')).toBe(false)
      })
    })

    describe('Matching Headings & Roman numerals normalization', () => {
      const headingOptions = [
        { optionLetter: 'i', optionText: 'The commercial adoption of automated farm machinery' },
        { optionLetter: 'ii', optionText: 'Environmental damage from industrial chemicals' },
        { optionLetter: 'iii', optionText: 'Traditional farming methods in ancient Europe' },
        { optionLetter: 'iv', optionText: 'Government subsidies for manual farmworkers' },
      ]

      it('matches Roman numerals case-insensitively', () => {
        expect(isAnswerMatch('iv', 'IV', null, 'matching_headings')).toBe(true)
        expect(isAnswerMatch('i', 'I', null, 'matching_headings')).toBe(true)
        expect(isAnswerMatch('ix', 'IX', null, 'matching_headings')).toBe(true)
      })

      it('matches Roman numeral with prefixed heading text', () => {
        expect(isAnswerMatch(
          'iv',
          'iv. Government subsidies for manual farmworkers',
          headingOptions,
          'matching_headings'
        )).toBe(true)
        expect(isAnswerMatch(
          'IV',
          'iv. Government subsidies for manual farmworkers',
          headingOptions,
          'matching_headings'
        )).toBe(true)
      })

      it('negative tests: rejects mismatched Roman numerals or letters', () => {
        expect(isAnswerMatch('iv', 'v', null, 'matching_headings')).toBe(false)
        expect(isAnswerMatch('i', 'ii', null, 'matching_headings')).toBe(false)
        expect(isAnswerMatch('iv', 'i', headingOptions, 'matching_headings')).toBe(false)
      })
    })

    describe('Completion normalization (articles, numbers, plural parentheses, hyphens)', () => {
      it('normalizes number words vs digits', () => {
        expect(isAnswerMatch('two', '2', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('2', 'two', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('one', '1', null, 'table_completion')).toBe(true)
      })

      it('strips leading articles a, an, the', () => {
        expect(isAnswerMatch('the library', 'library', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('library', 'the library', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('a student', 'student', null, 'fill_blank')).toBe(true)
      })

      it('handles optional plural parentheses like student(s)', () => {
        expect(isAnswerMatch('student(s)', 'students', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('student(s)', 'student', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('students', 'student(s)', null, 'fill_blank')).toBe(true)
      })

      it('normalizes hyphens between words', () => {
        expect(isAnswerMatch('well-known', 'well known', null, 'fill_blank')).toBe(true)
        expect(isAnswerMatch('part-time', 'part time', null, 'fill_blank')).toBe(true)
      })

      it('negative tests: rejects close spellings or substring mismatches', () => {
        expect(isAnswerMatch('timber', 'timbre', null, 'fill_blank')).toBe(false)
        expect(isAnswerMatch('library', 'central library', null, 'fill_blank')).toBe(false)
        expect(isAnswerMatch('center/centre', 'central', null, 'fill_blank')).toBe(false)
        expect(isAnswerMatch('student(s)', 'teacher', null, 'fill_blank')).toBe(false)
        expect(isAnswerMatch('two', 'three', null, 'fill_blank')).toBe(false)
      })
    })

    it('returns false for mismatched answers without options', () => {
      expect(isAnswerMatch('True', 'False')).toBe(false)
      expect(isAnswerMatch('apple', 'banana')).toBe(false)
      expect(isAnswerMatch(null, 'test')).toBe(false)
      expect(isAnswerMatch('', 'test')).toBe(false)
    })
  })

  describe('generateForExam', () => {
    it('throws error if exam not found', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce(null)
      await expect(generateForExam(999)).rejects.toThrow('Không tìm thấy đề thi #999')
    })

    it('skips questions that already have explanation when force is false', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 1, title: 'Cam 19 Test 1', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 10,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          explanation: { answer: 'A' },
        },
      ])

      const res = await generateForExam(1, { force: false })
      expect(res.ok).toBe(true)
      expect(res.generatedCount).toBe(0)
      expect(res.hasConflicts).toBe(false)
    })

    it('throws error if questions are missing correctAnswer', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 2, title: 'Exam Without Answer', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 11,
          number: 5,
          type: 'mcq',
          correctAnswer: '',
        },
      ])

      await expect(generateForExam(2)).rejects.toThrow('chưa có đáp án đúng: Câu 5')
    })

    it('throws error if questions needing generation have no passage', async () => {
      prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 3, title: 'Exam Without Passage', skill: 'reading' })
      prismaMock.question.findMany.mockResolvedValueOnce([
        {
          id: 12,
          number: 1,
          type: 'mcq',
          correctAnswer: 'A',
          explanation: null,
          passage: null,
          group: null,
        },
      ])

      await expect(generateForExam(3)).rejects.toThrow('chưa có nội dung bài đọc (Passage) cho câu 1')
    })

    describe('gộp nhóm câu hình ảnh vào một lần gọi Gemini', () => {
      const IMAGE_URI = 'data:image/png;base64,AAAA'
      const TRANSCRIPT = 'The shop is in the old stables. The cafe is next to the car park.'
      const imageGroup = {
        imageUrl: IMAGE_URI,
        section: { transcript: TRANSCRIPT },
        passage: null,
        matchingOptions: [],
        noteSections: [],
      }
      const imageQuestion = (id, number, text, answer) => ({
        id,
        number,
        type: 'map_diagram',
        questionText: text,
        correctAnswer: answer,
        explanation: null,
        options: null,
        imageUrl: null,
        passage: null,
        listeningSection: null,
        group: imageGroup,
      })
      const batchItem = (number, answer) => ({
        number,
        question_chunks: [{ text: `marker ${number}`, label: 'vị trí trên bản đồ' }],
        predict: 'Cần xác định vị trí trên bản đồ.',
        locate_note: 'Đối chiếu mô tả với hình.',
        locate_keywords: [],
        evidence_quote: '',
        evidence_chunks: [],
        answer,
        reasoning: `Vị trí ${answer} khớp với mô tả trong transcript.`,
        paraphrases: [],
        distractors: [],
      })

      it('2 câu cùng một bản đồ chỉ gọi AI MỘT lần và lưu đủ 2 giải thích', async () => {
        prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 14, title: 'Cam 19 Test 1', skill: 'listening' })
        prismaMock.question.findMany.mockResolvedValueOnce([
          imageQuestion(1, 16, 'Farm shop', 'G'),
          imageQuestion(2, 17, 'Disabled entry', 'C'),
        ])
        prismaMock.question.update.mockResolvedValue({})
        process.env.GEMINI_API_KEY = 'test_key'
        process.env.ENABLE_GEMINI_IN_TEST = 'true'
        geminiJsonMock.mockResolvedValueOnce({
          data: { explanations: [batchItem(16, 'G'), batchItem(17, 'C')] },
          provider: 'Gemini',
          model: 'gemini-test',
        })
        try {
          const res = await generateForExam(14, { force: true })
          expect(geminiJsonMock).toHaveBeenCalledTimes(1)
          expect(geminiJsonMock.mock.calls[0][1].images).toEqual([IMAGE_URI])
          expect(geminiJsonMock.mock.calls[0][1].responseSchema.required).toEqual(['explanations'])
          expect(res.generatedCount).toBe(2)
          expect(res.hasConflicts).toBe(false)
          expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
        } finally {
          delete process.env.ENABLE_GEMINI_IN_TEST
          delete process.env.GEMINI_API_KEY
        }
      })

      it('câu bị thiếu trong kết quả gộp được hỏi lại ngay trong batch (không gọi riêng)', async () => {
        prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 15, title: 'Cam 19 Test 2', skill: 'listening' })
        prismaMock.question.findMany.mockResolvedValueOnce([
          imageQuestion(3, 16, 'Farm shop', 'G'),
          imageQuestion(4, 17, 'Disabled entry', 'C'),
        ])
        prismaMock.question.update.mockResolvedValue({})
        process.env.GEMINI_API_KEY = 'test_key'
        process.env.ENABLE_GEMINI_IN_TEST = 'true'
        geminiJsonMock
          .mockResolvedValueOnce({
            data: { explanations: [batchItem(16, 'G')] }, // thiếu câu 17
            provider: 'Gemini',
            model: 'gemini-test',
          })
          .mockResolvedValueOnce({
            data: { explanations: [batchItem(17, 'C')] },
            provider: 'Gemini',
            model: 'gemini-test',
          })
        try {
          const res = await generateForExam(15, { force: true })
          expect(geminiJsonMock).toHaveBeenCalledTimes(2)
          // Lần 2 vẫn là batch nhưng chỉ còn câu 17
          const retryPrompt = geminiJsonMock.mock.calls[1][0]
          expect(retryPrompt).toContain('- Câu 17')
          expect(retryPrompt).not.toContain('- Câu 16')
          expect(retryPrompt).toContain('"explanations"')
          expect(retryPrompt).not.toContain('THÔNG TIN CÂU HỎI')
          expect(res.generatedCount).toBe(2)
          expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
        } finally {
          delete process.env.ENABLE_GEMINI_IN_TEST
          delete process.env.GEMINI_API_KEY
        }
      })

      it('câu vẫn thiếu sau khi hỏi lại batch sẽ được gọi riêng (fallback) thay vì bỏ sót', async () => {
        prismaMock.exam.findUnique.mockResolvedValueOnce({ id: 16, title: 'Cam 19 Test 3', skill: 'listening' })
        prismaMock.question.findMany.mockResolvedValueOnce([
          imageQuestion(5, 16, 'Farm shop', 'G'),
          imageQuestion(6, 17, 'Disabled entry', 'C'),
        ])
        prismaMock.question.update.mockResolvedValue({})
        process.env.GEMINI_API_KEY = 'test_key'
        process.env.ENABLE_GEMINI_IN_TEST = 'true'
        geminiJsonMock
          .mockResolvedValueOnce({
            data: { explanations: [batchItem(16, 'G')] },
            provider: 'Gemini',
            model: 'gemini-test',
          })
          .mockResolvedValueOnce({
            data: { explanations: [batchItem(16, 'G')] }, // vẫn thiếu câu 17
            provider: 'Gemini',
            model: 'gemini-test',
          })
          .mockResolvedValueOnce({
            data: batchItem(17, 'C'), // gọi riêng câu 17
            provider: 'Gemini',
            model: 'gemini-test',
          })
        try {
          const res = await generateForExam(16, { force: true })
          expect(geminiJsonMock).toHaveBeenCalledTimes(3)
          expect(geminiJsonMock.mock.calls[2][0]).toContain('THÔNG TIN CÂU HỎI')
          expect(geminiJsonMock.mock.calls[2][0]).toContain('Số câu: 17')
          expect(res.generatedCount).toBe(2)
          expect(prismaMock.question.update).toHaveBeenCalledTimes(2)
        } finally {
          delete process.env.ENABLE_GEMINI_IN_TEST
          delete process.env.GEMINI_API_KEY
        }
      })
    })
  })

  describe('generateForPracticeExam', () => {
    it('throws error if reading practice exam has no passage', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValueOnce({
        id: 10,
        skill: 'reading',
        passage: '',
        questions: [],
      })
      await expect(generateForPracticeExam(10)).rejects.toThrow('chưa có nội dung đề bài (Passage)')
    })

    it('throws error if practice exam questions are missing correctAnswer', async () => {
      prismaMock.practiceExam.findUnique.mockResolvedValueOnce({
        id: 11,
        skill: 'reading',
        passage: 'Valid passage',
        questions: [
          {
            id: 101,
            content: JSON.stringify({
              type: 'true_false_ng',
              questions: [
                { number: 3, questionText: 'Statement 3', correctAnswer: '' },
              ],
            }),
          },
        ],
      })
      await expect(generateForPracticeExam(11)).rejects.toThrow('chưa có đáp án đúng: Câu 3')
    })
  })
})
