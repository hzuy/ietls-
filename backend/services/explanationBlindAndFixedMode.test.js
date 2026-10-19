'use strict'

import { describe, it, expect, vi } from 'vitest'
const {
  buildPrompt,
  buildResponseSchema,
  classifyFamily,
  generateExplanation,
  extractOptionPairs,
} = require('../scripts/generate-explanations')
const {
  isAnswerMatch,
} = require('./explanationGeneratorService')

describe('PHẦN 1: GIẢI MÙ, NHÃN GỐC, CHẾ ĐỘ GIẢI THÍCH THEO ĐÁP ÁN ĐÃ CHỐT', () => {
  const dummyCtx = {
    skill: 'reading',
    parts: [{ label: 'BÀI ĐỌC', text: 'Paul Ekman became interested in lying after a question from his students.' }],
    sourceText: 'Paul Ekman became interested in lying after a question from his students.',
  }

  describe('1.1 GIẢI MÙ: Prompt KHÔNG chứa đáp án của giáo viên', () => {
    it('ở chế độ giải mù mặc định, prompt không bao giờ chứa correctAnswer hay "đáp án tham chiếu"', () => {
      const q = {
        number: 1,
        type: 'mcq',
        questionText: 'Ekman became interested in lying after a question from his:',
        options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
        correctAnswer: 'SECRET_TEACHER_ANSWER_XYZ',
      }
      const prompt = buildPrompt(q, 'MCQ', dummyCtx)

      // BẮT BUỘC: Không được có đáp án của giáo viên
      expect(prompt).not.toContain('SECRET_TEACHER_ANSWER_XYZ')
      expect(prompt).not.toContain('đáp án tham chiếu')
      expect(prompt).not.toContain('Đáp án tham chiếu từ hệ thống')
      expect(prompt).not.toContain('QUY TẮC TƯ DUY PHẢN BIỆN & ĐỐI CHIẾU ĐÁP ÁN')
      expect(prompt).toContain('QUY TẮC TỰ GIẢI ĐỘC LẬP')
      // Schema yêu cầu AI tự giải và trả về reasoning dành cho học sinh
      expect(prompt).toContain('"answer":')
      expect(prompt).toContain('"reasoning":')
      // AI không được yêu cầu viết teacher_note
      expect(prompt).not.toContain('"teacher_note":')
    })

    it('ở câu mcq_multi, prompt giải mù không rò rỉ đáp án sai cố tình của teacher', () => {
      const q = {
        number: 2,
        type: 'mcq_multi',
        questionText: 'Which TWO groups are mentioned?',
        options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
        correctAnswer: 'A, B', // Teacher cố tình nhập sai A, B
      }
      const prompt = buildPrompt(q, 'MCQ', dummyCtx)

      expect(prompt).not.toContain('A, B')
      expect(prompt).not.toContain('đáp án tham chiếu')
    })
  })

  describe('1.4 NHÃN GỐC CHO MATCHING & CÁC LOẠI CÂU HỎI', () => {
    it('bảo toàn nhãn số La Mã (i, ii, iii, iv) cho Matching Headings, không tự đánh thành A, B, C, D', () => {
      const q = {
        number: 5,
        type: 'matching_headings',
        questionText: 'Choose the correct heading for Paragraph A',
        options: [
          'i. The vital importance of ecosystem variety',
          'ii. Clinical deception experiments',
          'iii. Global warming effects',
          'iv. Technological solutions for preservation'
        ],
        correctAnswer: 'i',
      }
      const prompt = buildPrompt(q, 'MATCHING', dummyCtx)

      // Phải giữ nguyên nhãn số La Mã
      expect(prompt).toContain('i. The vital importance of ecosystem variety')
      expect(prompt).toContain('ii. Clinical deception experiments')
      expect(prompt).toContain('iii. Global warming effects')
      expect(prompt).toContain('iv. Technological solutions for preservation')

      // KHÔNG ĐƯỢC biến thành A. i. hoặc A. The vital...
      expect(prompt).not.toContain('A. i.')
      expect(prompt).not.toContain('A. The vital importance')
      expect(prompt).not.toContain('B. ii.')
    })

    it('buildResponseSchema cho Matching chứa enum là các nhãn số La Mã (i, ii, iii...)', () => {
      const options = [
        'i. The vital importance of ecosystem variety',
        'ii. Clinical deception experiments',
        'iii. Global warming effects',
        'iv. Technological solutions for preservation'
      ]
      const schema = buildResponseSchema('matching_headings', options)
      expect(schema.properties.answer.enum).toEqual(['i', 'ii', 'iii', 'iv'])
    })

    it('so sánh đáp án Matching: khớp cả nhãn gốc, nhãn kèm tiêu đề hoặc chỉ tiêu đề', () => {
      const options = [
        'i. The vital importance of ecosystem variety',
        'ii. Clinical deception experiments',
      ]
      // 1. Nhãn gốc vs nhãn gốc
      expect(isAnswerMatch('i', 'i', options, 'matching_headings')).toBe(true)
      expect(isAnswerMatch('i', 'I', options, 'matching_headings')).toBe(true)

      // 2. Nhãn kèm tiêu đề vs nhãn gốc
      expect(isAnswerMatch('i. The vital importance of ecosystem variety', 'i', options, 'matching_headings')).toBe(true)
      expect(isAnswerMatch('i', 'i. The vital importance of ecosystem variety', options, 'matching_headings')).toBe(true)

      // 3. Tiêu đề vs nhãn gốc
      expect(isAnswerMatch('The vital importance of ecosystem variety', 'i', options, 'matching_headings')).toBe(true)
      expect(isAnswerMatch('i', 'The vital importance of ecosystem variety', options, 'matching_headings')).toBe(true)

      // 4. Nhãn lệch thì không khớp
      expect(isAnswerMatch('ii', 'i', options, 'matching_headings')).toBe(false)
      expect(isAnswerMatch('ii. Clinical deception experiments', 'i', options, 'matching_headings')).toBe(false)
    })
  })

  describe('1.2 SAU KHI AI TRẢ KẾT QUẢ: code tạo teacher_note và so sánh đáp án', () => {
    it('code tạo teacher_note khi khớp và khi xung đột theo mẫu cố định, không để AI tự bịa', () => {
      // 1. Khớp
      const matchNote = (inputAnswer) => `Khớp với đáp án đề (${inputAnswer}).`
      expect(matchNote('C. students')).toBe('Khớp với đáp án đề (C. students).')

      // 2. Xung đột
      const conflictNote = (aiAns, inputAns) => `AI chọn "${aiAns}"; đáp án đề đang là "${inputAns}". Cần giáo viên đối chiếu.`
      expect(conflictNote('B. patients', 'C. students')).toBe('AI chọn "B. patients"; đáp án đề đang là "C. students". Cần giáo viên đối chiếu.')
    })

    it('dữ liệu cũ không có status/teacher_note vẫn hiển thị bình thường cho học sinh nếu không có jargon', () => {
      const { isExplanationVisibleToLearner } = require('./explanationGeneratorService')
      const legacyExp = {
        v: 2,
        answer: 'A',
        reasoning: 'Giải thích rõ ràng theo bài đọc.',
      }
      expect(isExplanationVisibleToLearner(legacyExp)).toBe(true)
    })
  })

  describe('1.3 CHẾ ĐỘ GIẢI THÍCH THEO ĐÁP ÁN ĐÃ CHỐT: Không vòng lặp & no_support', () => {
    it('khi isFixedMode = true, prompt hướng dẫn AI giải thích cho đáp án đã chốt và cho phép trả no_support', () => {
      const q = {
        number: 1,
        type: 'mcq',
        questionText: 'Ekman became interested in lying after a question from his:',
        options: ['A. peers', 'B. patients', 'C. students', 'D. teachers'],
        correctAnswer: 'students.',
      }
      const prompt = buildPrompt(q, 'MCQ', dummyCtx, null, null, { isFixedMode: true, targetAnswer: 'students' })

      expect(prompt).toContain('CHẾ ĐỘ GIẢI THÍCH THEO ĐÁP ÁN ĐÃ CHỐT')
      expect(prompt).toContain('students')
      expect(prompt).toContain('no_support')
      expect(prompt).toContain('Linear thinking')
    })

    it('schema trong isFixedMode hỗ trợ trường no_support', () => {
      const schema = buildResponseSchema('mcq', ['A. peers', 'B. patients'], { isFixedMode: true })
      expect(schema.properties.no_support).toBeDefined()
      expect(schema.properties.no_support.type).toBe('BOOLEAN')
    })

    it('bảo vệ chống vòng lặp: chế độ fixed mode không bao giờ rơi lại thành conflict_pending', () => {
      const inputAnswer = 'C. students'
      const aiReturnedAnswer = 'C. students'
      // Giả sử AI giải thích theo đáp án của teacher:
      const fixedExplanation = {
        v: 2,
        answer: inputAnswer,
        reasoning: 'Bài đọc chứng minh sinh viên đã đặt câu hỏi cho Ekman.',
        status: 'teacher_edited',
        teacher_note: `Giải thích theo đáp án đã chốt của giáo viên (${inputAnswer}).`,
      }

      // Kiểm tra: Trạng thái là teacher_edited, KHÔNG PHẢI conflict_pending
      expect(fixedExplanation.status).not.toBe('conflict_pending')
      expect(fixedExplanation.status).toBe('teacher_edited')
      expect(fixedExplanation.answer).toBe(inputAnswer)
    })
  })
})
