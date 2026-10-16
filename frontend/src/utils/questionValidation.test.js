import { describe, it, expect } from 'vitest'
import {
  hasValidAnswer,
  validateQuestionItem,
  validatePracticeReading,
  validatePracticeListening,
  validateExamReading,
  validateExamListening,
  formatValidationAlert,
} from './questionValidation'

describe('questionValidation utility', () => {
  describe('hasValidAnswer', () => {
    it('returns false for null, undefined, empty strings, and empty arrays', () => {
      expect(hasValidAnswer(null)).toBe(false)
      expect(hasValidAnswer(undefined)).toBe(false)
      expect(hasValidAnswer('')).toBe(false)
      expect(hasValidAnswer('   ')).toBe(false)
      expect(hasValidAnswer([])).toBe(false)
      expect(hasValidAnswer([''])).toBe(false)
      expect(hasValidAnswer(['  '])).toBe(false)
    })

    it('returns true for non-empty strings and valid arrays', () => {
      expect(hasValidAnswer('TRUE')).toBe(true)
      expect(hasValidAnswer('A')).toBe(true)
      expect(hasValidAnswer(['A', 'C'])).toBe(true)
      expect(hasValidAnswer(0)).toBe(true)
    })
  })

  describe('validateQuestionItem', () => {
    it('flags missing answer when correctAnswer is empty', () => {
      const res = validateQuestionItem({ number: 1, questionText: 'Statement', correctAnswer: '' }, 'true_false_ng')
      expect(res.missing).toContain('answer')
      expect(res.missing).not.toContain('text')
    })

    it('flags missing text when questionText is empty for prompt-required types', () => {
      const res = validateQuestionItem({ number: 2, questionText: '', correctAnswer: 'TRUE' }, 'true_false_ng')
      expect(res.missing).toContain('text')
      expect(res.missing).not.toContain('answer')
    })

    it('does not flag missing text for completion types where questionText is part of note text', () => {
      const res = validateQuestionItem({ number: 3, correctAnswer: 'water' }, 'note_completion')
      expect(res.missing).toEqual([])
    })
  })

  describe('validatePracticeReading', () => {
    it('detects missing title, missing passage, and incomplete questions', () => {
      const form = {
        title: '',
        passage: '',
        questionGroups: [
          {
            type: 'true_false_ng',
            questions: [
              { number: 1, questionText: '', correctAnswer: '' },
              { number: 2, questionText: 'Valid statement', correctAnswer: 'FALSE' },
            ],
          },
        ],
      }
      const res = validatePracticeReading(form)
      expect(res.isValid).toBe(false)
      expect(res.missingAnswers).toContain(1)
      expect(res.missingTexts).toContain(1)
      expect(res.errors.some(e => e.includes('Chưa nhập tên bài đọc'))).toBe(true)
      expect(res.errors.some(e => e.includes('Chưa nhập nội dung bài đọc'))).toBe(true)
      expect(res.errors.some(e => e.includes('Các câu hỏi chưa có đáp án đúng: Câu 1'))).toBe(true)
    })

    it('passes for complete Reading Practice form', () => {
      const form = {
        title: 'The Art of Deception',
        passage: 'Full passage content here...',
        questionGroups: [
          {
            type: 'true_false_ng',
            questions: [
              { number: 1, questionText: 'Statement 1', correctAnswer: 'TRUE' },
            ],
          },
        ],
      }
      const res = validatePracticeReading(form)
      expect(res.isValid).toBe(true)
      expect(res.errors).toHaveLength(0)
    })
  })

  describe('validatePracticeListening', () => {
    it('detects missing audio and transcript for AI generation', () => {
      const form = {
        title: 'Listening Practice 1',
        audioUrl: '',
        audioFile: null,
        transcript: '',
        context: '',
        questionGroups: [
          {
            type: 'note_completion',
            questions: [{ number: 1, correctAnswer: 'library' }],
          },
        ],
      }
      const resSave = validatePracticeListening(form, { isForAI: false })
      expect(resSave.isValid).toBe(false)
      expect(resSave.errors.some(e => e.includes('Chưa có file âm thanh'))).toBe(true)

      const resAI = validatePracticeListening(form, { isForAI: true })
      expect(resAI.errors.some(e => e.includes('Bài nghe chưa có transcript'))).toBe(true)
    })
  })

  describe('formatValidationAlert', () => {
    it('formats bullet points nicely', () => {
      const alert = formatValidationAlert('Không thể lưu bài', ['Thiếu tiêu đề', 'Thiếu đáp án câu 1'])
      expect(alert).toContain('Không thể lưu bài:')
      expect(alert).toContain('• Thiếu tiêu đề')
      expect(alert).toContain('• Thiếu đáp án câu 1')
    })
  })
})
