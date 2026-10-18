import { describe, it, expect } from 'vitest'
import {
  INTERNAL_JARGON_PHRASES,
  normalizeJargonText,
  containsInternalJargon,
  isExplanationVisibleToLearner,
  filterLearnerExplanation,
} from './explanationGeneratorService'

describe('B.3 Content Blocker & Internal Jargon Detection', () => {
  describe('INTERNAL_JARGON_PHRASES constant', () => {
    it('contains all required internal jargon phrases', () => {
      const required = [
        'nguoi dung nhap',
        'nguoi nhap',
        'dap an nguoi dung',
        'ngo nhan',
        'thu thach',
        'giao vien nhap',
        'he thong cung cap',
      ]
      for (const phrase of required) {
        expect(INTERNAL_JARGON_PHRASES).toContain(phrase)
      }
    })
  })

  describe('normalizeJargonText', () => {
    it('normalizes diacritics, lowercases and converts đ/Đ to d', () => {
      expect(normalizeJargonText('Người dùng nhập')).toBe('nguoi dung nhap')
      expect(normalizeJargonText('ĐÁP ÁN NGƯỜI DÙNG')).toBe('dap an nguoi dung')
      expect(normalizeJargonText('Thử thách người học')).toBe('thu thach nguoi hoc')
      expect(normalizeJargonText('Ngộ nhận thường gặp')).toBe('ngo nhan thuong gap')
      expect(normalizeJargonText('Giáo viên nhập vào')).toBe('giao vien nhap vao')
      expect(normalizeJargonText('Hệ thống cung cấp đáp án')).toBe('he thong cung cap dap an')
      expect(normalizeJargonText(null)).toBe('')
      expect(normalizeJargonText(undefined)).toBe('')
    })
  })

  describe('containsInternalJargon across all learner-facing fields', () => {
    it('detects jargon in reasoning', () => {
      const exp = {
        reasoning: 'Đáp án người dùng nhập là sai do ngộ nhận giữa hai khái niệm.',
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in predict', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        predict: 'Thử thách này yêu cầu thí sinh suy luận.',
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in locate.note', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        locate: { note: 'Chỗ này là ngộ nhận của người làm.' },
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in translation', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        translation: 'Hệ thống cung cấp bản dịch chi tiết.',
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in full_sentence', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        full_sentence: 'Câu này do người nhập ghi lại.',
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in distractors reason', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        distractors: [
          { option: 'A', reason: 'Đây là ngộ nhận phổ biến khi đọc lướt.' },
        ],
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('detects jargon in paraphrase items', () => {
      const exp = {
        reasoning: 'Dựa vào đoạn văn A.',
        paraphrase: [
          { original: 'test', note: 'Giáo viên nhập đáp án này.' },
        ],
      }
      expect(containsInternalJargon(exp)).toBe(true)
    })

    it('does NOT flag jargon when it is strictly in teacher_note (teacher-only)', () => {
      const exp = {
        status: 'ai_generated',
        answer: 'C',
        reasoning: 'Đoạn văn thứ 3 chỉ rõ rằng các học sinh tham gia nghiên cứu đã phản ứng tích cực.',
        teacher_note: 'Người dùng nhập B nhưng AI xác định C mới đúng theo đoạn 3.',
        locate: { note: 'Đoạn 3, dòng 5-7' },
      }
      expect(containsInternalJargon(exp)).toBe(false)
    })

    it('returns false for clean explanations', () => {
      const exp = {
        status: 'ai_generated',
        answer: 'TRUE',
        reasoning: 'Thông tin trong đoạn 2 hoàn toàn trùng khớp với nhận định của câu hỏi.',
        locate: { note: 'Paragraph 2, line 4' },
      }
      expect(containsInternalJargon(exp)).toBe(false)
    })
  })

  describe('isExplanationVisibleToLearner & filterLearnerExplanation', () => {
    it('hides legacy explanation (no status) if it contains internal jargon', () => {
      const legacyWithJargon = {
        reasoning: 'Đáp án người dùng nhập là ngộ nhận.',
      }
      expect(isExplanationVisibleToLearner(legacyWithJargon)).toBe(false)
      expect(filterLearnerExplanation(legacyWithJargon)).toBeNull()
    })

    it('shows legacy explanation (no status) if it is clean', () => {
      const legacyClean = {
        reasoning: 'Đoạn văn nêu rõ thông tin cần tìm.',
      }
      expect(isExplanationVisibleToLearner(legacyClean)).toBe(true)
      expect(filterLearnerExplanation(legacyClean)).toEqual(legacyClean)
    })

    it('hides ai_generated, teacher_reviewed, and teacher_edited if they contain internal jargon', () => {
      const expAI = { status: 'ai_generated', reasoning: 'Do giáo viên nhập sai.' }
      const expReviewed = { status: 'teacher_reviewed', reasoning: 'Thử thách này bẫy thí sinh.' }
      const expEdited = { status: 'teacher_edited', reasoning: 'Người nhập chưa đọc kỹ.' }

      expect(isExplanationVisibleToLearner(expAI)).toBe(false)
      expect(filterLearnerExplanation(expAI)).toBeNull()

      expect(isExplanationVisibleToLearner(expReviewed)).toBe(false)
      expect(filterLearnerExplanation(expReviewed)).toBeNull()

      expect(isExplanationVisibleToLearner(expEdited)).toBe(false)
      expect(filterLearnerExplanation(expEdited)).toBeNull()
    })

    it('shows clean ai_generated explanation even if teacher_note has jargon', () => {
      const exp = {
        status: 'ai_generated',
        reasoning: 'Đoạn văn thứ 2 nêu rõ nguyên nhân.',
        teacher_note: 'Người dùng nhập đáp án A nhưng AI phát hiện đáp án đúng là B.',
      }
      expect(isExplanationVisibleToLearner(exp)).toBe(true)
      expect(filterLearnerExplanation(exp)).toEqual(exp)
    })
  })
})
