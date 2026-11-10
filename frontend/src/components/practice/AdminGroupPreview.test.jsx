import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminGroupPreview from './AdminGroupPreview'

describe('AdminGroupPreview', () => {
  it.each([['reading', false], ['listening', false], ['reading', true], ['listening', true]])('%s practice=%s previews A/E as two selected answers when E has a comma', (skill, practice) => {
    const options = ['First answer', 'Second', 'Third', 'Fourth', 'When his tomb was uncovered, a small number of his belongings still remained']
    const group = { type: 'mcq_multi', maxChoices: 2, qNumberStart: 25, qNumberEnd: 26, questions: [{ id: 42, number: 25, questionText: 'Choose TWO', options, correctAnswer: `${options[0]},${options[4]}` }] }
    render(<AdminGroupPreview group={group} skill={skill} practice={practice} showAnswers />)
    const checks = screen.getAllByRole('checkbox')
    expect(checks[0]).toBeChecked()
    expect(checks[4]).toBeChecked()
    expect(checks.filter(el => el.checked)).toHaveLength(2)
  })
  const baseGroup = {
    type: 'mcq',
    qNumberStart: 1,
    qNumberEnd: 2,
    instruction: 'Choose the correct letter A, B, C or D.',
    questions: [
      {
        number: 1,
        questionText: 'What is the capital of France?',
        options: ['London', 'Paris', 'Berlin', 'Madrid'],
        correctAnswer: 'Paris',
        explanation: {
          restatement: 'Tìm thủ đô của nước Pháp.',
          reasoning: 'Paris là thủ đô chính thức của Pháp.'
        }
      },
      {
        number: 2,
        questionText: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        explanation: {
          restatement: 'Cộng hai số 2 và 2.',
          reasoning: '2 + 2 = 4 theo số học.'
        }
      }
    ]
  }

  it('hiển thị các control học viên, không thêm badge quản trị vào nội dung câu hỏi', () => {
    render(<AdminGroupPreview group={baseGroup} showAnswers={false} showExplanations={false} />)

    // Badge thông báo tồn tại
    expect(screen.queryByText(/Đã có giải thích/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(8)

    // Tuyệt đối không có nút hay liên kết "Xem chi tiết" / "Ẩn"
    expect(screen.queryByText(/Xem chi tiết/)).not.toBeInTheDocument()
    expect(screen.queryByText(/— Ẩn/)).not.toBeInTheDocument()
  })

  it('khi showExplanations = false, KHÔNG hiển thị khung giải thích chi tiết', () => {
    render(<AdminGroupPreview group={baseGroup} showAnswers={true} showExplanations={false} />)

    // Khung giải thích chi tiết không được render
    expect(screen.queryByText(/Giải thích chi tiết/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Xem trước giải thích chi tiết/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Paris là thủ đô chính thức của Pháp/)).not.toBeInTheDocument()
  })

  it('khi showAnswers = true và showExplanations = false, câu hỏi hiển thị đáp án nhưng giải thích vẫn ẩn', () => {
    render(<AdminGroupPreview group={baseGroup} showAnswers={true} showExplanations={false} />)

    // Đáp án Paris được chọn/tô màu xanh emerald
    const parisChoice = screen.getByRole('radio', { name: 'Paris' })
    expect(parisChoice).toBeChecked()
    expect(parisChoice).toBeDisabled()

    // Giải thích chi tiết vẫn ẩn
    expect(screen.queryByText(/Giải thích chi tiết/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Paris là thủ đô chính thức của Pháp/)).not.toBeInTheDocument()
  })

  it('khi showExplanations = true, hiển thị đầy đủ phần giải thích chi tiết của các câu', () => {
    render(<AdminGroupPreview group={baseGroup} showAnswers={true} showExplanations={true} />)

    // Khung giải thích chi tiết hiển thị
    expect(screen.getByText(/Giải thích chi tiết \(2 câu hỏi\)/)).toBeInTheDocument()
    expect(screen.getByText('Paris là thủ đô chính thức của Pháp.')).toBeInTheDocument()
    expect(screen.getByText('2 + 2 = 4 theo số học.')).toBeInTheDocument()
  })
})
