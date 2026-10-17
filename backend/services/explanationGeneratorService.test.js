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

const { isAnswerMatch, generateForExam, generateForPracticeExam } = require('./explanationGeneratorService')

describe('explanationGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
