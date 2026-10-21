import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReadingTab from './ReadingTab'
import ListeningTab from './ListeningTab'
import api from '../../utils/axios'
import { filterLearnerExplanation } from '../../../../backend/services/explanationGeneratorService'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() }
}))

vi.mock('./ExamList', () => ({
  default: ({ onEdit }) => (
    <div data-testid="exam-list">
      <button onClick={() => onEdit(10)}>Edit Reading 10</button>
      <button onClick={() => onEdit(20)}>Edit Listening 20</button>
    </div>
  )
}))

vi.mock('./ExamAuditHistory', () => ({
  default: () => <div data-testid="exam-audit-history" />
}))

describe('Batch 4: Comprehensive test suite for Exam Explanations', () => {
  const mockReadingExam = {
    id: 10,
    title: 'Cambridge 18 Test 1 Reading',
    bookNumber: 18,
    testNumber: 1,
    seriesId: 1,
    passages: [
      {
        id: 101,
        title: 'Passage 1',
        passageNumber: 1,
        body: 'Initial passage body',
        questionGroups: [
          {
            id: 201,
            type: 'true_false_not_given',
            qNumberStart: 1,
            qNumberEnd: 2,
            instruction: 'Do statements agree...',
            questions: [
              { id: 301, number: 1, questionText: 'Q1', correctAnswer: 'TRUE', explanation: null },
              { id: 302, number: 2, questionText: 'Q2', correctAnswer: 'FALSE', explanation: null }
            ]
          },
          {
            id: 202,
            type: 'summary_completion',
            qNumberStart: 3,
            qNumberEnd: 4,
            instruction: 'Complete the summary',
            questions: [
              { id: 303, number: 3, questionText: 'Q3', correctAnswer: 'word1', explanation: null },
              { id: 304, number: 4, questionText: 'Q4', correctAnswer: 'word2', explanation: null }
            ]
          }
        ]
      },
      { id: 102, title: 'Passage 2', passageNumber: 2, body: 'Passage 2', questionGroups: [] },
      { id: 103, title: 'Passage 3', passageNumber: 3, body: 'Passage 3', questionGroups: [] }
    ]
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') return Promise.resolve({ data: mockReadingExam })
      return Promise.resolve({ data: [] })
    })
  })

  it('prevents launching two concurrent AI tasks from the frontend', async () => {
    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument())

    // Simulate slow in-flight request
    let resolveFirstTask
    const pendingPromise = new Promise(r => { resolveFirstTask = r })
    api.post.mockReturnValueOnce(pendingPromise)

    const groupBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    expect(groupBtns.length).toBeGreaterThan(1)

    // Trigger first group AI
    fireEvent.click(groupBtns[0])

    // Verify all other AI buttons are disabled immediately
    await waitFor(() => {
      const remainingBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
      remainingBtns.forEach(btn => expect(btn).toBeDisabled())
    })

    // Resolve task
    resolveFirstTask({ data: { success: true, generatedCount: 2 } })
    await waitFor(() => {
      const activeBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
      expect(activeBtns[0]).not.toBeDisabled()
    })
  }, 15000)

  it('safely handles closing modals and re-opening without stale state', async () => {
    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument())

    // Make an unsaved edit
    const bodyInput = screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i)
    fireEvent.change(bodyInput, { target: { value: 'Passage draft change' } })

    // Click "Sinh AI nhóm này" -> Unsaved modal opens
    const groupBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    fireEvent.click(groupBtns[0])

    await waitFor(() => {
      expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    })

    // Close modal by clicking "Hủy và quay lại sửa"
    const closeBtn = screen.getByRole('button', { name: /Hủy và quay lại sửa/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText('Đề thi có thay đổi chưa lưu')).not.toBeInTheDocument()
    })

    // Now try clicking another group's AI button -> should open cleanly again
    fireEvent.click(groupBtns[1])
    await waitFor(() => {
      expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    })
  }, 15000)

  it('guarantees learner never receives invalid or pending explanations', () => {
    // Valid approved statuses
    expect(filterLearnerExplanation({ status: 'teacher_reviewed', steps: [] })).not.toBeNull()
    expect(filterLearnerExplanation({ status: 'teacher_edited', steps: [] })).not.toBeNull()
    expect(filterLearnerExplanation({ status: 'ai_generated', steps: [] })).not.toBeNull()

    // Invalid / pending statuses MUST be stripped (null)
    expect(filterLearnerExplanation({ status: 'conflict_pending', steps: [] })).toBeNull()
    expect(filterLearnerExplanation({ status: 'needs_regeneration', steps: [] })).toBeNull()
    expect(filterLearnerExplanation({ status: 'possibly_stale', steps: [] })).toBeNull()
    expect(filterLearnerExplanation(null)).toBeNull()
    expect(filterLearnerExplanation(undefined)).toBeNull()
  })
})
