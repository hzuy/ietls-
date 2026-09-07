import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExamList from './ExamList'

describe('ExamList — Speaking Part Badge & Validation Count', () => {
  it('hiển thị badge 3/3 màu xanh khi Part 1 có câu hỏi, Part 2 chỉ có Cue Card (0 câu hỏi con), và Part 3 có câu hỏi thảo luận', () => {
    const exams = [
      {
        id: 1,
        title: 'Cambridge 18 Speaking Test 1',
        skill: 'speaking',
        speakingParts: [
          { number: 1, cueCard: 'Introduction', _count: { questions: 4 } },
          { number: 2, cueCard: 'Describe a law that was introduced in your country...', _count: { questions: 0 } },
          { number: 3, cueCard: 'Discussion', _count: { questions: 5 } }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('3/3')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({
      background: '#dcfce7',
      color: '#15803d'
    })
  })

  it('hiển thị badge 3/3 khi Part 3 có câu hỏi thảo luận kể cả khi topic name để trống', () => {
    const exams = [
      {
        id: 2,
        title: 'Cambridge 17 Speaking Test 2',
        skill: 'speaking',
        speakingParts: [
          { number: 1, cueCard: '', _count: { questions: 3 } },
          { number: 2, cueCard: 'Describe an interesting person you met recently', _count: { questions: 0 } },
          // Part 3 có câu hỏi nhưng không có topic label (unlabelled topics)
          { number: 3, cueCard: '', _count: { questions: 3 } }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('3/3')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({
      background: '#dcfce7',
      color: '#15803d'
    })
  })

  it('hiển thị badge 2/3 khi Part 2 thiếu cả Cue Card lẫn câu hỏi', () => {
    const exams = [
      {
        id: 3,
        title: 'Incomplete Speaking Exam',
        skill: 'speaking',
        speakingParts: [
          { number: 1, cueCard: '', _count: { questions: 4 } },
          { number: 2, cueCard: '', _count: { questions: 0 } },
          { number: 3, cueCard: '', _count: { questions: 4 } }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('2/3')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({
      background: '#f1f5f9',
      color: '#64748b'
    })
  })

  it('hiển thị badge 2/3 khi Part 3 không có câu hỏi nào', () => {
    const exams = [
      {
        id: 4,
        title: 'Speaking Exam Missing Part 3',
        skill: 'speaking',
        speakingParts: [
          { number: 1, cueCard: '', _count: { questions: 4 } },
          { number: 2, cueCard: 'Describe a gift you received', _count: { questions: 0 } },
          { number: 3, cueCard: '', _count: { questions: 0 } }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('2/3')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({
      background: '#f1f5f9',
      color: '#64748b'
    })
  })

  it('hỗ trợ cấu trúc mảng questions đầy đủ (chế độ in-memory hoặc detail exam)', () => {
    const exams = [
      {
        id: 5,
        title: 'Full Object Speaking Exam',
        skill: 'speaking',
        speakingParts: [
          { number: 1, questions: [{ id: 1, questionText: 'Q1' }, { id: 2, questionText: 'Q2' }] },
          { number: 2, cueCard: 'Describe a website you often visit', questions: [] },
          { number: 3, questions: [{ id: 3, questionText: '##TOPIC##:Internet' }, { id: 4, questionText: 'Q3' }] }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('3/3')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({
      background: '#dcfce7',
      color: '#15803d'
    })
  })

  it('fallback linh hoạt khi không có number (dữ liệu mock legacy)', () => {
    const exams = [
      {
        id: 6,
        title: 'Legacy Speaking Exam',
        skill: 'speaking',
        speakingParts: [
          { _count: { questions: 3 } },
          { cueCard: 'Describe a traditional festival' },
          { _count: { questions: 4 } }
        ]
      }
    ]

    render(<ExamList exams={exams} skill="speaking" onRefresh={vi.fn()} />)

    const badge = screen.getByText('3/3')
    expect(badge).toBeInTheDocument()
  })
})
