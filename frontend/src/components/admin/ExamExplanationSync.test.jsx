import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReadingTab from './ReadingTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

vi.mock('./ExamList', () => ({
  default: ({ onEdit }) => (
    <div data-testid="mock-exam-list">
      <button type="button" onClick={() => onEdit(10)}>Edit Exam 10</button>
      <button type="button" onClick={() => onEdit(20)}>Edit Exam 20</button>
    </div>
  )
}))

vi.mock('./editors/ReadingGroupEditor', () => ({
  default: ({ group, onChange }) => (
    <div data-testid="mock-reading-group-editor">
      <span data-testid="group-exp-count">{Object.keys(group.explanations || {}).length}</span>
      {group.questions?.map(q => (
        <div key={q.id || q.number} data-testid={`question-row-${q.number}`}>
          <span data-testid={`q-text-${q.number}`}>{q.questionText}</span>
          <span data-testid={`q-ans-${q.number}`}>{q.correctAnswer}</span>
          <span data-testid={`q-status-${q.number}`}>{q.explanation?.status || 'none'}</span>
        </div>
      ))}
    </div>
  )
}))

describe('Exam Explanation Sync & Dirty Handling (Batch 1)', () => {
  const mockExamData = {
    id: 10,
    title: 'Cambridge 19 Test 1 Reading',
    bookNumber: 19,
    testNumber: 1,
    seriesId: 1,
    passages: [
      {
        id: 101,
        number: 1,
        title: 'Passage 1',
        subtitle: '',
        body: 'Original passage text in database',
        letteredParagraphs: false,
        questionGroups: [
          {
            id: 201,
            type: 'tfng',
            qNumberStart: 1,
            qNumberEnd: 2,
            instruction: 'Do the statements agree...',
            questions: [
              {
                id: 301,
                number: 1,
                questionText: 'Q1 Text in DB',
                options: ['', '', '', ''],
                correctAnswer: 'TRUE',
                explanation: null
              },
              {
                id: 302,
                number: 2,
                questionText: 'Q2 Text in DB',
                options: ['', '', '', ''],
                correctAnswer: 'FALSE',
                explanation: null
              }
            ]
          }
        ]
      },
      {
        id: 102,
        number: 2,
        title: 'Passage 2',
        body: 'Passage 2 text',
        questionGroups: []
      },
      {
        id: 103,
        number: 3,
        title: 'Passage 3',
        body: 'Passage 3 text',
        questionGroups: []
      }
    ]
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.confirm = vi.fn().mockReturnValue(true)
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('keeps unsaved edits when AI finishes and merges explanations (Requirement 3.1 & 3.2)', async () => {
    // 1. Initial load for edit
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') {
        return Promise.resolve({ data: mockExamData })
      }
      return Promise.resolve({ data: [] })
    })

    render(<ReadingTab exams={[{ id: 10, title: 'Cambridge 19 Test 1 Reading' }]} onRefresh={vi.fn()} />)

    // Click Edit Exam 10
    fireEvent.click(screen.getByRole('button', { name: 'Edit Exam 10' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Cambridge 19 Test 1 Reading')).toBeInTheDocument()
    })

    // 2. Teacher makes unsaved changes to Passage 1 body
    const passageBodyTextarea = screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i)
    fireEvent.change(passageBodyTextarea, {
      target: { value: 'TEACHER EDITED PASSAGE 1 TEXT (UNSAVED DRAFT)' }
    })
    expect(passageBodyTextarea.value).toBe('TEACHER EDITED PASSAGE 1 TEXT (UNSAVED DRAFT)')

    // 3. Teacher clicks "AI giải thích"
    const aiBtn = screen.getByRole('button', { name: /AI giải thích/i })
    // Mount inspection temporarily disables generation while it checks the
    // concurrency lock. A click before that check finishes is correctly ignored.
    await waitFor(() => expect(aiBtn).toBeEnabled())
    fireEvent.click(aiBtn)

    // 4. Because form is dirty, UnsavedChangesAIModal MUST open
    await waitFor(() => {
      expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    }, { timeout: 10000 })

    // 5. Mock AI generation API and fresh fetch
    api.post.mockResolvedValueOnce({
      data: { message: 'Đã tạo giải thích thành công!', hasConflicts: false }
    })
    const freshExamWithExplanations = {
      ...mockExamData,
      passages: [
        {
          ...mockExamData.passages[0],
          questionGroups: [
            {
              ...mockExamData.passages[0].questionGroups[0],
              questions: [
                {
                  id: 301,
                  number: 1,
                  questionText: 'Q1 Text in DB',
                  correctAnswer: 'TRUE',
                  explanation: { status: 'ai_generated', steps: [{ stepNumber: 1, title: 'Analysis' }] }
                },
                {
                  id: 302,
                  number: 2,
                  questionText: 'Q2 Text in DB',
                  correctAnswer: 'FALSE',
                  explanation: { status: 'ai_generated', steps: [{ stepNumber: 1, title: 'Analysis' }] }
                }
              ]
            }
          ]
        },
        mockExamData.passages[1],
        mockExamData.passages[2]
      ]
    }
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') {
        return Promise.resolve({ data: freshExamWithExplanations })
      }
      return Promise.resolve({ data: [] })
    })

    // Teacher chooses: "Tiếp tục sinh AI theo CSDL hiện tại"
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục sinh AI theo CSDL hiện tại/i }))

    // 6. Verify AI generation was triggered (sequential group endpoint in Batch 3)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/exams/10/groups/201/generate-explanations',
        expect.objectContaining({ force: true, overwriteProtected: false }),
        expect.objectContaining({ signal: expect.anything() })
      )
    })

    // 7. Verify TARGETED MERGE:
    // Passage body MUST STILL BE teacher's unsaved draft!
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i).value).toBe(
        'TEACHER EDITED PASSAGE 1 TEXT (UNSAVED DRAFT)'
      )
    })

    // Questions MUST have explanation status updated to 'ai_generated'
    expect(screen.getByTestId('q-status-1')).toHaveTextContent('ai_generated')
    expect(screen.getByTestId('q-status-2')).toHaveTextContent('ai_generated')
    expect(screen.getByTestId('group-exp-count')).toHaveTextContent('2')
  }, 15000)

  it('handles listening exam explanation sync and preserves audioUrl and transcript draft', async () => {
    const mockListeningData = {
      id: 20,
      title: 'Cambridge 19 Test 1 Listening',
      bookNumber: 19,
      testNumber: 1,
      seriesId: 1,
      listeningSections: [
        {
          id: 501,
          number: 1,
          context: 'Advising session',
          audioUrl: 'https://example.com/audio1.mp3',
          transcript: 'Original transcript in DB',
          questionGroups: [
            {
              id: 601,
              type: 'note_completion',
              qNumberStart: 1,
              qNumberEnd: 1,
              instruction: 'Write ONE WORD',
              questions: [
                {
                  id: 701,
                  number: 1,
                  questionText: 'Address: [1]',
                  options: ['','','',''],
                  correctAnswer: 'Park',
                  explanation: null
                }
              ]
            }
          ]
        },
        { id: 502, number: 2, transcript: 'Transcript section 2', questionGroups: [] },
        { id: 503, number: 3, transcript: 'Transcript section 3', questionGroups: [] },
        { id: 504, number: 4, transcript: 'Transcript section 4', questionGroups: [] }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/20') {
        return Promise.resolve({ data: mockListeningData })
      }
      return Promise.resolve({ data: [] })
    })

    const { default: ListeningTab } = await import('./ListeningTab')
    render(<ListeningTab exams={[{ id: 20, title: 'Cambridge 19 Test 1 Listening' }]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Exam 20' })) // ExamList mock button calls onEdit

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Cambridge 19 Test 1 Listening')).toBeInTheDocument()
    })

    // Modify transcript
    const transcriptTextarea = screen.getByDisplayValue('Original transcript in DB')
    fireEvent.change(transcriptTextarea, {
      target: { value: 'TEACHER EDITED TRANSCRIPT (UNSAVED DRAFT)' }
    })
    expect(transcriptTextarea.value).toBe('TEACHER EDITED TRANSCRIPT (UNSAVED DRAFT)')

    // Click AI explain
    const aiBtn = screen.getByRole('button', { name: /AI giải thích/i })
    await waitFor(() => expect(aiBtn).toBeEnabled())
    fireEvent.click(aiBtn)

    // Unsaved changes modal opens
    await waitFor(() => {
      expect(screen.getByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Mock AI return
    api.post.mockResolvedValueOnce({
      data: { message: 'Đã tạo giải thích thành công!', hasConflicts: false }
    })
    const freshListening = {
      ...mockListeningData,
      listeningSections: [
        {
          ...mockListeningData.listeningSections[0],
          questionGroups: [
            {
              ...mockListeningData.listeningSections[0].questionGroups[0],
              questions: [
                {
                  id: 701,
                  number: 1,
                  questionText: 'Address: [1]',
                  options: ['','','',''],
                  correctAnswer: 'Park',
                  explanation: { status: 'ai_generated' }
                }
              ]
            }
          ]
        },
        mockListeningData.listeningSections[1],
        mockListeningData.listeningSections[2],
        mockListeningData.listeningSections[3]
      ]
    }
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/20') {
        return Promise.resolve({ data: freshListening })
      }
      return Promise.resolve({ data: [] })
    })

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục sinh AI theo CSDL hiện tại/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/exams/20/groups/601/generate-explanations',
        expect.objectContaining({ force: true }),
        expect.objectContaining({ signal: expect.anything() })
      )
    })

    // Transcript draft is preserved!
    await waitFor(() => {
      expect(screen.getByDisplayValue('TEACHER EDITED TRANSCRIPT (UNSAVED DRAFT)')).toBeInTheDocument()
    })
  }, 15000)
})
