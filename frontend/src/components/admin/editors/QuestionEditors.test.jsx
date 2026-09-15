import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MCQGroupEditor from './MCQGroupEditor'
import MatchingEditor from './MatchingEditor'
import NoteCompletionEditor from './NoteCompletionEditor'
import TableCompletionEditor from './TableCompletionEditor'

// Mock ToastContext
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() })
}))

describe('Consolidated Question Editors', () => {
  describe('MCQGroupEditor', () => {
    it('hiển thị cảnh báo số lượng đáp án khi số đáp án chọn khác maxChoices trong mcq_multi', () => {
      const group = {
        type: 'mcq_multi',
        maxChoices: 2,
        qNumberStart: 1,
        qNumberEnd: 2,
        questions: [
          {
            number: 1,
            questionText: 'Which two are correct?',
            options: ['Opt A', 'Opt B', 'Opt C', 'Opt D', 'Opt E'],
            correctAnswer: 'Opt A', // Only 1 selected, needs 2
          }
        ]
      }
      render(<MCQGroupEditor group={group} onChange={vi.fn()} />)
      expect(screen.getByText(/Đang chọn 1\/2 đáp án đúng/)).toBeInTheDocument()
      expect(screen.getByText(/cần chọn thêm 1/)).toBeInTheDocument()
    })

    it('tự động cảnh báo khi có các lựa chọn trùng nội dung text', () => {
      const group = {
        type: 'mcq',
        qNumberStart: 1,
        qNumberEnd: 1,
        questions: [
          {
            number: 1,
            questionText: 'Single MCQ question',
            options: ['Duplicate text', 'Duplicate text', 'Unique C', 'Unique D'],
            correctAnswer: 'Unique C',
          }
        ]
      }
      render(<MCQGroupEditor group={group} onChange={vi.fn()} />)
      expect(screen.getByText(/Các lựa chọn không được trùng nội dung/)).toBeInTheDocument()
    })

    it('khi xóa option, tự động reindex correctAnswer và loại bỏ option đã xóa', () => {
      const onChange = vi.fn()
      const group = {
        type: 'mcq_multi',
        maxChoices: 2,
        qNumberStart: 1,
        qNumberEnd: 2,
        questions: [
          {
            number: 1,
            questionText: 'Multi Q',
            options: ['A', 'B', 'C'],
            correctAnswer: 'A,C',
          }
        ]
      }
      render(<MCQGroupEditor group={group} onChange={onChange} />)

      // Click remove button of the second option (B)
      const removeButtons = screen.getAllByRole('button', { name: '✕' })
      // Option A: removeButtons[0], Option B: removeButtons[1], Option C: removeButtons[2]
      fireEvent.click(removeButtons[1])

      expect(onChange).toHaveBeenCalled()
      const updatedGroup = onChange.mock.calls[0][0]
      expect(updatedGroup.questions[0].options).toEqual(['A', 'C'])
      expect(updatedGroup.questions[0].correctAnswer).toBe('A,C')
    })
  })

  describe('MatchingEditor', () => {
    it('hiển thị đúng placeholder gợi ý theo loại map_diagram vs matching thường', () => {
      const mapGroup = {
        type: 'map_diagram',
        qNumberStart: 1,
        qNumberEnd: 1,
        matchingOptions: [{ letter: 'A', text: 'Front Gate' }],
        questions: [{ number: 1, questionText: '', correctAnswer: '' }]
      }
      const { rerender } = render(<MatchingEditor group={mapGroup} onChange={vi.fn()} />)
      expect(screen.getByPlaceholderText(/Farm shop, Disabled entry/)).toBeInTheDocument()

      const standardGroup = {
        type: 'matching',
        qNumberStart: 1,
        qNumberEnd: 1,
        matchingOptions: [{ letter: 'A', text: 'Category 1' }],
        questions: [{ number: 1, questionText: '', correctAnswer: '' }]
      }
      rerender(<MatchingEditor group={standardGroup} onChange={vi.fn()} />)
      expect(screen.getByPlaceholderText(/Đối tượng cần matching/)).toBeInTheDocument()
    })

    it('chọn đáp án qua dropdown (Select dùng chung) cập nhật đúng correctAnswer', () => {
      const onChange = vi.fn()
      const group = {
        type: 'matching',
        qNumberStart: 1,
        qNumberEnd: 1,
        matchingOptions: [{ letter: 'A', text: 'Category 1' }, { letter: 'B', text: 'Category 2' }],
        questions: [{ number: 1, questionText: '', correctAnswer: '' }]
      }
      render(<MatchingEditor group={group} onChange={onChange} />)

      fireEvent.click(screen.getByRole('button', { name: 'Đáp án' }))
      fireEvent.click(screen.getByRole('option', { name: 'B - Category 2' }))

      expect(onChange).toHaveBeenCalled()
      const updatedGroup = onChange.mock.calls[0][0]
      expect(updatedGroup.questions[0].correctAnswer).toBe('B')
    })
  })

  describe('NoteCompletionEditor', () => {
    it('tự động loại bỏ câu hỏi mồ côi khi người dùng xóa token [Q:n]', () => {
      const onChange = vi.fn()
      const group = {
        type: 'note_completion',
        qNumberStart: 1,
        qNumberEnd: 2,
        noteSections: [
          {
            title: 'Section 1',
            lines: [
              { content: 'Line with [Q:1] and [Q:2]', lineType: 'content' }
            ]
          }
        ],
        questions: [
          { number: 1, correctAnswer: 'ans1' },
          { number: 2, correctAnswer: 'ans2' }
        ]
      }
      render(<NoteCompletionEditor group={group} onChange={onChange} />)

      // Edit line text to remove [Q:2]
      const textarea = screen.getByDisplayValue('Line with [Q:1] and [Q:2]')
      fireEvent.change(textarea, { target: { value: 'Line with only [Q:1]' } })

      expect(onChange).toHaveBeenCalled()
      const updatedGroup = onChange.mock.calls[0][0]
      // Question 2 should be cleaned up because its token is gone
      expect(updatedGroup.questions.map(q => q.number)).toEqual([1])
    })
  })

  describe('TableCompletionEditor', () => {
    it('cho phép thêm/bớt cột và cập nhật header an toàn', () => {
      const onChange = vi.fn()
      const group = {
        type: 'table_completion',
        qNumberStart: 1,
        qNumberEnd: 1,
        noteSections: [
          {
            title: 'Table 1',
            lines: [
              { content: 'Col 1|Col 2|Col 3', lineType: 'heading' },
              { content: 'Val 1|[Q:1]|Val 3', lineType: 'content' }
            ]
          }
        ],
        questions: [{ number: 1, correctAnswer: 'target' }]
      }
      render(<TableCompletionEditor group={group} onChange={onChange} />)

      // Click + button to increase columns to 4
      const addColBtn = screen.getByRole('button', { name: '+' })
      fireEvent.click(addColBtn)

      expect(onChange).toHaveBeenCalled()
      const updatedLines = onChange.mock.calls[0][0].noteSections[0].lines
      expect(updatedLines[0].content).toBe('Col 1|Col 2|Col 3|Cột 4')
    })
  })
})
