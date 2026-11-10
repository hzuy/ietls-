import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  exam: { findUnique: vi.fn() },
  practiceExam: { findUnique: vi.fn() },
  question: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceQuestion: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: prismaMock,
}

const {
  validateManualExplanation,
  updateManualExplanation,
} = require('./explanationGeneratorService')

describe('B.4: Manual Edit Steps 1-4 Tests (Sửa trực tiếp)', () => {
  const samplePassage = [
    'The global summit on climate change took place in Geneva in 1998, attracting delegates from over 120 nations.',
    'Renewable energy sources such as wind and solar have experienced unprecedented growth over the last decade.',
    'However, fossil fuels continue to dominate industrial consumption in developing countries.',
  ].join('\n\n')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reconciles a stale explanation answer with the trusted current question after teacher editing (TC-026)', async () => {
    prismaMock.question.findFirst.mockResolvedValue({id:1,type:'true_false_ng',correctAnswer:'FALSE',explanation:{v:2,status:'possibly_stale',answer:'TRUE'},passage:{body:'The sky is red.'},group:null})
    prismaMock.question.update.mockResolvedValue({})
    await updateManualExplanation({examId:1,questionId:1,fields:{reasoning:'Bài đọc mô tả bầu trời màu đỏ.'}})
    expect(prismaMock.question.update).toHaveBeenCalledWith(expect.objectContaining({data:{explanation:expect.objectContaining({answer:'FALSE'})}}))
  })

  describe('Validation of Steps 1-4 (validateManualExplanation)', () => {
    it('accepts valid Step 1, 2, 3, 4 fields and calculates correct paragraphs', () => {
      const payload = {
        predict: 'Dự đoán câu hỏi cần tìm địa điểm hội nghị.',
        question_chunks: [
          { text: 'Where did the summit take place', label: 'địa điểm diễn ra' },
          { text: 'in 1998?', label: 'năm 1998' },
        ],
        locate: {
          note: 'Tìm thông tin về hội nghị năm 1998 ở đoạn đầu.',
          keywords: ['Geneva', '1998'],
        },
        evidence: {
          parts: [
            { text: 'The global summit on climate change took place in Geneva in 1998' },
          ],
          chunks: [
            { text: 'took place in Geneva', label: 'diễn ra tại Geneva', part: 0 },
          ],
        },
        paraphrases: [
          {
            question: 'location of the summit',
            question_label: 'địa điểm hội nghị',
            passage: 'took place in Geneva',
            passage_label: 'diễn ra tại Geneva',
          },
        ],
        reasoning: 'Hội nghị toàn cầu diễn ra tại Geneva năm 1998 theo câu đầu tiên của đoạn 1.',
        translation: 'Hội nghị thượng đỉnh toàn cầu về biến đổi khí hậu đã diễn ra tại Geneva năm 1998.',
        full_sentence: 'The global summit took place in Geneva.',
        distractors: [
          { option: 'Paris', reason: 'Bài đọc không nhắc đến Paris', label: 'thủ đô nước Pháp' },
        ],
      }

      const cleaned = validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })

      // Step 1
      expect(cleaned.predict).toBe('Dự đoán câu hỏi cần tìm địa điểm hội nghị.')
      expect(cleaned.question_chunks).toHaveLength(2)
      expect(cleaned.question_chunks[0].text).toBe('Where did the summit take place')

      // Step 2: locate.paragraph is auto-calculated by server (paragraph 0)
      expect(cleaned.locate.note).toBe('Tìm thông tin về hội nghị năm 1998 ở đoạn đầu.')
      expect(cleaned.locate.keywords).toEqual(['Geneva', '1998'])
      expect(cleaned.locate.paragraph).toBe(0)

      // Step 3: evidence parts & chunks
      expect(cleaned.evidence.parts).toHaveLength(1)
      expect(cleaned.evidence.parts[0].paragraph).toBe(0)
      expect(cleaned.evidence.chunks).toHaveLength(1)
      expect(cleaned.evidence.chunks[0].text).toBe('took place in Geneva')

      // Paraphrases
      expect(cleaned.paraphrases).toHaveLength(1)
      expect(cleaned.paraphrases[0].passage).toBe('took place in Geneva')

      // Step 4
      expect(cleaned.reasoning).toBe('Hội nghị toàn cầu diễn ra tại Geneva năm 1998 theo câu đầu tiên của đoạn 1.')
      expect(cleaned.distractors).toHaveLength(1)
    })

    it('rejects locate.keywords that do not exist verbatim in the passage', () => {
      const payload = {
        locate: {
          note: 'Định vị',
          keywords: ['NonExistentKeywordXYZ'],
        },
      }

      expect(() => {
        validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })
      }).toThrow(/Từ khóa định vị "NonExistentKeywordXYZ" không tìm thấy nguyên văn/)
    })

    it('rejects evidence quotes that do not exist verbatim in the passage', () => {
      const payload = {
        evidence: {
          parts: [{ text: 'This sentence was completely invented by someone.' }],
          chunks: [],
        },
      }

      expect(() => {
        validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })
      }).toThrow(/Câu trích dẫn .* không tìm thấy nguyên văn/)
    })

    it('rejects evidence.chunks that are not contained within evidence.parts', () => {
      const payload = {
        evidence: {
          parts: [{ text: 'The global summit on climate change took place in Geneva in 1998' }],
          chunks: [{ text: 'solar energy', label: 'năng lượng mặt trời' }], // 'solar energy' is in paragraph 2, not in this part
        },
      }

      expect(() => {
        validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })
      }).toThrow(/Cụm từ trích dẫn "solar energy" không nằm trong câu trích dẫn của Bước 3/)
    })

    it('rejects paraphrases where passage phrase is not in the text', () => {
      const payload = {
        paraphrases: [
          {
            question: 'air travel',
            passage: 'flying by airplane was common',
          },
        ],
      }

      expect(() => {
        validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })
      }).toThrow(/Cụm từ đối chiếu paraphrasing "flying by airplane was common" không tìm thấy nguyên văn/)
    })

    it('correctly calculates paragraph for second paragraph quotes', () => {
      const payload = {
        evidence: {
          parts: [{ text: 'Renewable energy sources such as wind and solar' }],
          chunks: [{ text: 'wind and solar', label: 'gió và mặt trời' }],
        },
        locate: {
          note: 'Xem đoạn 2',
          keywords: ['Renewable energy'],
        },
      }

      const cleaned = validateManualExplanation(payload, { sourceText: samplePassage, family: 'MCQ' })
      expect(cleaned.evidence.parts[0].paragraph).toBe(1) // 0-indexed: Paragraph 2 is index 1
      expect(cleaned.locate.paragraph).toBe(1)
    })

    it('allows opening and saving explanations when legacy data lacks locate or evidence', () => {
      const legacyPayload = {
        reasoning: 'Simple edit on old question without touch locate/evidence',
      }

      const prevExp = { v: 2, answer: 'B', reasoning: 'Old' } // missing locate & evidence
      const cleaned = validateManualExplanation(legacyPayload, { sourceText: samplePassage, family: 'MCQ', prevExp })

      expect(cleaned.reasoning).toBe('Simple edit on old question without touch locate/evidence')
      expect(cleaned.locate).toBeUndefined()
      expect(cleaned.evidence).toBeUndefined()
    })

    it('blocks internal jargon phrases in manual edit payload', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 10,
        number: 1,
        type: 'mcq',
        correctAnswer: 'B',
        explanation: { v: 2, answer: 'B' },
      })

      await expect(
        updateManualExplanation({
          examId: 1,
          questionId: 10,
          isPractice: false,
          fields: { reasoning: 'Vì người dùng nhập đáp án A nên bị sai.' },
        })
      ).rejects.toThrow(/cụm từ nội bộ không phù hợp/)
    })

    it('ignores answer modification attempt in manual edit payload', async () => {
      prismaMock.question.findFirst.mockResolvedValue({
        id: 10,
        number: 1,
        type: 'mcq',
        correctAnswer: 'B',
        explanation: { v: 2, answer: 'B' },
      })
      prismaMock.question.update.mockResolvedValue({})

      const res = await updateManualExplanation({
        examId: 1,
        questionId: 10,
        isPractice: false,
        fields: {
          answer: 'HACKED_ANSWER_X',
          reasoning: 'Legitimate explanation reasoning',
        },
      })

      expect(res.ok).toBe(true)
      expect(res.explanation.answer).toBe('B') // Must remain unchanged!
      expect(res.explanation.status).toBe('teacher_edited')
      expect(res.explanation.manualEdit).toBe(true)
    })

    describe('Empty evidence validation (Requirement 2.3)', () => {
      it('allows empty evidence for TFNG when answer is NOT GIVEN', () => {
        const prevExp = {
          v: 2,
          answer: 'NOT GIVEN',
          evidence: { parts: [{ text: 'Some quote', paragraph: 1 }] },
        }
        const cleaned = validateManualExplanation(
          { evidence: { parts: [] } },
          { sourceText: samplePassage, family: 'TFNG', prevExp, targetAnswer: 'NOT GIVEN' }
        )
        expect(cleaned.evidence).toBeNull()
      })

      it('allows empty evidence for IMAGE family questions', () => {
        const prevExp = {
          v: 2,
          answer: 'A',
          evidence: { parts: [{ text: 'Old label', paragraph: null }] },
        }
        const cleaned = validateManualExplanation(
          { evidence: { parts: [] } },
          { sourceText: samplePassage, family: 'IMAGE', prevExp }
        )
        expect(cleaned.evidence).toBeNull()
      })

      it('allows empty evidence when source text (passage/transcript) is absent', () => {
        const prevExp = {
          v: 2,
          answer: 'B',
          evidence: { parts: [{ text: 'Old', paragraph: null }] },
        }
        const cleaned = validateManualExplanation(
          { evidence: { parts: [] } },
          { sourceText: '', family: 'MCQ', prevExp }
        )
        expect(cleaned.evidence).toBeNull()
      })

      it('blocks emptying evidence when question had evidence and requires source support', () => {
        const prevExp = {
          v: 2,
          answer: 'TRUE',
          evidence: { parts: [{ text: 'Old proof', paragraph: 0 }] },
        }
        expect(() => {
          validateManualExplanation(
            { evidence: { parts: [] } },
            { sourceText: samplePassage, family: 'TFNG', prevExp, targetAnswer: 'TRUE' }
          )
        }).toThrow(/Không thể để trống bằng chứng/)
      })
    })
  })
})
