import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SkillResult, { splitQuestionsForTwoColumns } from './SkillResult'

describe('SkillResult Component', () => {
  // ScoreRing đếm số tăng dần bằng requestAnimationFrame (Đợt 2) — ép
  // prefers-reduced-motion để band score/số câu đúng hiện giá trị cuối ngay,
  // giống trải nghiệm thật của người dùng bật giảm chuyển động.
  beforeEach(() => {
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })


  const mockValidData = {
    bookName: 'Cambridge 19',
    testNumber: 1,
    bandScore: 7.5,
    sections: [
      {
        number: 1,
        questions: [
          { number: 1, status: 'correct', userAnswer: 'TRUE', correctAnswer: 'TRUE' },
          { number: 2, status: 'wrong', userAnswer: 'FALSE', correctAnswer: 'TRUE' }
        ]
      }
    ],
    questionTypes: [
      { name: 'True/False/Not Given', total: 2, correct: 1, wrong: 1, missed: 0 }
    ]
  }

  it('renders Reading/Listening result props correctly with band score and stats', () => {
    render(
      <MemoryRouter>
        <SkillResult skillType="reading" examId={1} dataProp={mockValidData} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Answer key — Reading/i)).toBeInTheDocument()
    expect(screen.getByText(/Cambridge 19 · Test 1/i)).toBeInTheDocument()
    expect(screen.getByText('7.5')).toBeInTheDocument()
    expect(screen.getByText('True/False/Not Given')).toBeInTheDocument()
    expect(screen.getByText('Bảng thống kê')).toBeInTheDocument()
  })

  it('handles missing questionTypes array without crashing', () => {
    const dataWithoutTypes = {
      ...mockValidData,
      questionTypes: undefined
    }

    render(
      <MemoryRouter>
        <SkillResult skillType="listening" examId={1} dataProp={dataWithoutTypes} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Answer key — Listening/i)).toBeInTheDocument()
    expect(screen.queryByText('Phân tích theo dạng câu hỏi')).not.toBeInTheDocument()
  })

  it('handles missing sections array gracefully without crashing', () => {
    const dataWithoutSections = {
      bookName: 'Cambridge 19',
      testNumber: 1,
      bandScore: 6.0,
      // sections is undefined
    }

    render(
      <MemoryRouter>
        <SkillResult skillType="reading" examId={1} dataProp={dataWithoutSections} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Answer key — Reading/i)).toBeInTheDocument()
    expect(screen.getByText('Không có dữ liệu chi tiết cho bài thi này.')).toBeInTheDocument()
  })

  it('renders navigation CTA (Làm lại đề này) and does not render Hỏi AI Tutor', () => {
    render(
      <MemoryRouter>
        <SkillResult skillType="reading" examId={1} dataProp={mockValidData} />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /Làm lại đề này/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hỏi AI Tutor/i })).not.toBeInTheDocument()
  })

  it('renders Answer key with all questions (no filter tabs)', () => {
    render(
      <MemoryRouter>
        <SkillResult skillType="reading" examId={1} dataProp={mockValidData} />
      </MemoryRouter>
    )

    // No filter tabs present
    expect(screen.queryByRole('button', { name: /Tất cả/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Câu sai cần sửa/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Câu đúng/i })).not.toBeInTheDocument()

    // Answer key heading present
    expect(screen.getByText('Answer key')).toBeInTheDocument()

    // Question rows still rendered
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)

    // Verify "Hỏi AI Tutor" is NOT rendered
    expect(screen.queryByRole('button', { name: /Hỏi AI Tutor/i })).not.toBeInTheDocument()
  })

  it('correctly maps long MCQ options to single letters in AnswerRow', () => {
    const mcqOptions = [
      'The speakers are communicating in different languages.',
      'Neither of the speakers is familiar with their environment.',
      'The topic of the conversation is difficult for both speakers.',
      'Aspects of the conversation are challenging for both speakers.'
    ]

    const mcqData = {
      bookName: 'Cambridge 19',
      testNumber: 3,
      bandScore: 6.5,
      sections: [
        {
          number: 3,
          questions: [
            {
              number: 26,
              status: 'wrong',
              userAnswer: 'The speakers are communicating in different languages.',
              correctAnswer: 'Aspects of the conversation are challenging for both speakers.',
              options: mcqOptions,
              type: 'mcq'
            }
          ]
        }
      ],
      questionTypes: [{ name: 'Multiple Choice', total: 1, correct: 0, wrong: 1, missed: 0 }]
    }

    render(
      <MemoryRouter>
        <SkillResult skillType="reading" examId={20} dataProp={mcqData} />
      </MemoryRouter>
    )

    // User answer index 0 -> 'A'
    expect(screen.getByText('A')).toBeInTheDocument()
    // Correct answer index 3 -> 'D'
    expect(screen.getByText('D')).toBeInTheDocument()
    // The raw text should NOT be visible directly in the text node, but preserved in title attribute
    expect(screen.queryByText('Aspects of the conversation are challenging for both speakers.')).not.toBeInTheDocument()
    expect(screen.getByTitle('Aspects of the conversation are challenging for both speakers.')).toBeInTheDocument()
  })

  it('renders clean Answer Sheet modal without hero score card or history banner when isAnswerSheet=true', () => {
    const mock3Passages = {
      bookName: 'Cambridge 19',
      testNumber: 1,
      bandScore: 7.0,
      sections: [
        {
          number: 1,
          from: 1,
          to: 13,
          questions: Array.from({ length: 13 }, (_, i) => ({
            number: i + 1,
            status: 'correct',
            userAnswer: 'A',
            correctAnswer: 'A',
          })),
        },
        {
          number: 2,
          from: 14,
          to: 26,
          questions: Array.from({ length: 13 }, (_, i) => ({
            number: 14 + i,
            status: 'missed',
            userAnswer: null,
            correctAnswer: 'B',
          })),
        },
        {
          number: 3,
          from: 27,
          to: 40,
          questions: Array.from({ length: 14 }, (_, i) => ({
            number: 27 + i,
            status: 'wrong',
            userAnswer: 'C',
            correctAnswer: 'D',
          })),
        },
      ],
      questionTypes: [{ name: 'True/False/Not Given', total: 40, correct: 13, wrong: 14, missed: 13 }],
    }

    render(
      <MemoryRouter initialEntries={['/reading/13/explanation?attemptId=391']}>
        <SkillResult skillType="reading" examId={13} dataProp={mock3Passages} isAnswerSheet={true} onClose={() => {}} />
      </MemoryRouter>
    )

    // Should display "Answer Sheet" in header
    expect(screen.getByText('Answer Sheet')).toBeInTheDocument()

    // Should NOT display "Bạn đang xem lại lượt làm bài trước đó"
    expect(screen.queryByText(/Bạn đang xem lại lượt làm bài trước đó/i)).not.toBeInTheDocument()

    // Should NOT display hero score elements
    expect(screen.queryByText('Band Score')).not.toBeInTheDocument()
    expect(screen.queryByText('Tổng quan kết quả')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Làm lại đề này/i })).not.toBeInTheDocument()

    // SHOULD display Bảng thống kê and Answer key
    expect(screen.getByText('Bảng thống kê')).toBeInTheDocument()
    expect(screen.getByText('Answer key')).toBeInTheDocument()

    // Passage 3 header is present
    expect(screen.getByText(/PASSAGE 3 \(QUESTION 27 – 40\)/i)).toBeInTheDocument()
    // Question 27 and Question 40 are both rendered
    expect(screen.getAllByText('27').length).toBeGreaterThan(0)
    expect(screen.getAllByText('40').length).toBeGreaterThan(0)
  })

  it('splitQuestionsForTwoColumns splits evenly and preserves all questions', () => {
    const list = Array.from({ length: 14 }, (_, i) => ({ number: 27 + i }))
    const { col1, col2 } = splitQuestionsForTwoColumns(list)
    expect(col1.length).toBe(7)
    expect(col2.length).toBe(7)
    expect(col1[0].number).toBe(27)
    expect(col1[6].number).toBe(33)
    expect(col2[0].number).toBe(34)
    expect(col2[6].number).toBe(40)
  })
})


