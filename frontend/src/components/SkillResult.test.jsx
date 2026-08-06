import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SkillResult from './SkillResult'

describe('SkillResult Component', () => {
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
    expect(screen.queryByText('Bảng thống kê theo loại câu hỏi')).not.toBeInTheDocument()
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
})
