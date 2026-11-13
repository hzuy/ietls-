import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReadingTab from './ReadingTab'
import ListeningTab from './ListeningTab'
import { ToastProvider } from '../../context/ToastContext'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn()
  }
}))

vi.mock('./ExamList', () => ({
  default: ({ onEdit }) => (
    <div data-testid="exam-list">
      <button onClick={() => onEdit(10)}>Edit Reading 10</button>
      <button onClick={() => onEdit(20)}>Edit Listening 20</button>
    </div>
  )
}))

describe('Batch 3: Group AI generation & Sequential generation with cancel & 409 conflict', () => {
  // Toast context thật để không rơi về window.alert (fallback khi thiếu provider).
  const renderTab = (ui) => render(<ToastProvider>{ui}</ToastProvider>)

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
        body: 'Passage 1 text',
        questionGroups: [
          {
            id: 201,
            type: 'true_false_not_given',
            qNumberStart: 1,
            qNumberEnd: 2,
            instruction: 'Do the following statements agree...',
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
      { id: 102, title: 'Passage 2', passageNumber: 2, body: 'Passage 2 text', questionGroups: [] },
      { id: 103, title: 'Passage 3', passageNumber: 3, body: 'Passage 3 text', questionGroups: [] }
    ]
  }

  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    window.scrollTo = vi.fn()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') return Promise.resolve({ data: mockReadingExam })
      return Promise.resolve({ data: [] })
    })
  })

  it.each(['reading', 'listening'])('retries only unfinished questions after a partial %s group times out', async (skill) => {
    const isReading = skill === 'reading'
    const examId = isReading ? 10 : 20
    const exam = isReading ? mockReadingExam : {
      ...mockReadingExam, id: 20,
      listeningSections: mockReadingExam.passages.map((passage, index) => ({
        ...passage, number: index + 1, context: 'Context', transcript: 'Transcript', audioUrl: '/test-audio.mp3',
      })),
    }
    api.get.mockImplementation(url => Promise.resolve({ data: url === `/admin/exams/${examId}` ? exam : [] }))
    api.post
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 2, remainingQuestionNumbers: [2] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 1, remainingQuestionNumbers: [] } })
    renderTab(isReading ? <ReadingTab exams={[]} onRefresh={vi.fn()} /> : <ListeningTab exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText(isReading ? 'Edit Reading 10' : 'Edit Listening 20'))
    const buttons = await screen.findAllByRole('button', { name: /Sinh AI nhóm này/i })
    fireEvent.click(buttons[0])
    const retry = await screen.findByRole('button', { name: 'Thử lại 1 câu lỗi' })
    fireEvent.click(retry)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3))
    expect(api.post.mock.calls[2][0]).toBe(`/admin/exams/${examId}/groups/201/generate-explanations`)
    expect(api.post.mock.calls[2][1].questionNumbers).toEqual([2])
    await waitFor(() => expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument())
    expect(window.alert).not.toHaveBeenCalled()
  })

  it.each(['reading', 'listening'])('asks before retrying against unsaved %s content and retains the retry scope', async skill => {
    const reading = skill === 'reading'
    const examId = reading ? 10 : 20
    const exam = reading ? mockReadingExam : {
      ...mockReadingExam, id: 20,
      listeningSections: mockReadingExam.passages.map((passage, index) => ({
        ...passage, number: index + 1, context: 'Context', transcript: `Transcript ${index + 1}`, audioUrl: '/test-audio.mp3',
      })),
    }
    sessionStorage.setItem(`ai_exp_report_${skill}_${examId}`, JSON.stringify({
      version: 1, status: 'partial', totalQuestions: 2, generated: 1,
      rows: [{ id: 'failed-2', number: 2, retryable: true, message: 'Timeout' }], needsRetry: [],
    }))
    api.get.mockImplementation(url => Promise.resolve({ data: url === `/admin/exams/${examId}` ? exam : [] }))
    api.post.mockResolvedValue({ data: { generatedCount: 1, remainingQuestionNumbers: [] } })
    renderTab(reading ? <ReadingTab exams={[]} onRefresh={vi.fn()} /> : <ListeningTab exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText(reading ? 'Edit Reading 10' : 'Edit Listening 20'))
    const source = await screen.findByDisplayValue(reading ? 'Passage 1 text' : 'Transcript 1')
    await waitFor(() => expect(screen.getByRole('button', { name: /AI giải thích/i })).toBeEnabled())
    fireEvent.change(source, { target: { value: 'Unsaved teacher content' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại 1 câu lỗi' }))
    expect(await screen.findByText('Đề thi có thay đổi chưa lưu')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục sinh AI theo CSDL hiện tại/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post.mock.calls[0][1].questionNumbers).toEqual([2])
    await waitFor(() => expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument())
    expect(screen.getByDisplayValue('Unsaved teacher content')).toBeInTheDocument()
  })

  it('triggers single group AI generation when "Sinh AI nhóm này" is clicked', async () => {
    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    // Load exam 10
    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Đã tạo giải thích cho nhóm thành công',
        generatedCount: 2
      }
    })

    const singleGroupButtons = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    expect(singleGroupButtons.length).toBeGreaterThan(0)

    // Click "Sinh AI nhóm này" on group 201
    fireEvent.click(singleGroupButtons[0])

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/exams/10/groups/201/generate-explanations',
        expect.objectContaining({ force: true, overwriteProtected: false }),
        expect.anything()
      )
    })
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('runs sequential generation across multiple groups and shows progress label', async () => {
    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    // Prepare sequential responses for group 201 and 202
    let resolveGroup201
    const p201 = new Promise((resolve) => { resolveGroup201 = resolve })
    api.post.mockImplementation((url) => {
      if (url.includes('/groups/201/')) {
        return p201
      }
      if (url.includes('/groups/202/')) {
        return Promise.resolve({ data: { success: true, generatedCount: 2 } })
      }
      return Promise.resolve({ data: {} })
    })

    // Click Toolbar "AI giải thích" button
    const allAIButtons = screen.getAllByRole('button', { name: /AI giải thích/i })
    const toolbarAIBtn = allAIButtons.find(b => b.title && b.title.includes('tuần tự theo nhóm'))
    expect(toolbarAIBtn).toBeDefined()
    await waitFor(() => expect(toolbarAIBtn).toBeEnabled())
    fireEvent.click(toolbarAIBtn)

    // Verify progress label is displayed during group 1
    await waitFor(() => {
      expect(screen.getByText(/Đang sinh AI/)).toBeInTheDocument()
    })

    // Nhãn nhóm câu chỉ nằm trong tooltip để thanh trạng thái luôn gọn 1 dòng
    expect(screen.getByText(/Đang sinh AI/).parentElement).toHaveAttribute(
      'title',
      expect.stringContaining('Câu 1–2')
    )

    // Chỉ còn 1 nút hủy sinh trong thanh tiến độ (đã bỏ nút Hủy trùng cạnh Preview)
    expect(screen.getByRole('button', { name: /Hủy sinh/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Hủy$/ })).not.toBeInTheDocument()

    // Resolve group 1
    resolveGroup201({ data: { success: true, generatedCount: 2 } })

    // Verify group 2 was called after group 1
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/exams/10/groups/202/generate-explanations',
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('gracefully cancels sequential generation: displays completing message and finishes in-flight group before stopping', async () => {
    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    let resolveGroup201
    const p201 = new Promise((resolve) => { resolveGroup201 = resolve })

    api.post.mockImplementation((url) => {
      if (url.includes('/groups/201/')) return p201
      if (url.includes('/groups/202/')) return Promise.resolve({ data: { success: true } })
      return Promise.resolve({ data: {} })
    })

    const allAIButtons = screen.getAllByRole('button', { name: /AI giải thích/i })
    const toolbarAIBtn = allAIButtons.find(b => b.title && b.title.includes('tuần tự theo nhóm'))
    await waitFor(() => expect(toolbarAIBtn).toBeEnabled())
    fireEvent.click(toolbarAIBtn)

    await waitFor(() => {
      expect(screen.getByText(/Đang sinh AI/)).toBeInTheDocument()
    })

    // Click Hủy sinh (nút duy nhất, nằm trong thanh tiến độ)
    const cancelBtn = screen.getByRole('button', { name: /Hủy sinh/i })
    fireEvent.click(cancelBtn)

    // Displays "Đang dừng…" until in-flight finishes
    await waitFor(() => {
      expect(screen.getAllByText(/Đang dừng/).length).toBeGreaterThan(0)
    })

    // Now resolve in-flight group 201
    resolveGroup201({ data: { success: true, generatedCount: 2 } })

    // UI returns to idle and group 202 was NEVER called!
    await waitFor(() => {
      expect(screen.queryAllByText(/Đang dừng/)).toHaveLength(0)
    })
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/groups/202/'),
      expect.anything(),
      expect.anything()
    )
  })

  it('locks Save, Cancel Edit, and single group buttons throughout sequential AI generation (Requirement A.3)', async () => {
    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    let resolveGroup201
    const p201 = new Promise((resolve) => { resolveGroup201 = resolve })
    api.post.mockImplementation((url) => {
      if (url.includes('/groups/201/')) return p201
      return Promise.resolve({ data: { success: true } })
    })

    const allAIButtons = screen.getAllByRole('button', { name: /AI giải thích/i })
    const toolbarAIBtn = allAIButtons.find(b => b.title && b.title.includes('tuần tự theo nhóm'))
    await waitFor(() => expect(toolbarAIBtn).toBeEnabled())
    fireEvent.click(toolbarAIBtn)

    await waitFor(() => {
      expect(screen.getByText(/Đang sinh AI/)).toBeInTheDocument()
    })

    // "Hủy sửa" button must be disabled
    const cancelEditBtn = screen.getByRole('button', { name: /Hủy sửa/i })
    expect(cancelEditBtn).toBeDisabled()

    // "Cập nhật đề Reading" submit button must be disabled
    const submitBtn = screen.getByRole('button', { name: /Cập nhật đề Reading/i })
    expect(submitBtn).toBeDisabled()

    // Group buttons "Sinh AI nhóm này" must be disabled
    const singleGroupButtons = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    singleGroupButtons.forEach(btn => {
      expect(btn).toBeDisabled()
    })

    // Resolve group 1
    resolveGroup201({ data: { success: true, generatedCount: 2 } })
    await waitFor(() => {
      expect(cancelEditBtn).not.toBeDisabled()
      expect(submitBtn).not.toBeDisabled()
    })
  })

  it('accumulates conflicts when middle group has conflict and opens conflict modal once at end (Requirement A.4)', async () => {
    const mock3GroupsExam = {
      ...mockReadingExam,
      passages: [
        {
          id: 101,
          title: 'Passage 1',
          passageNumber: 1,
          body: 'Passage 1 text',
          questionGroups: [
            {
              id: 201,
              type: 'true_false_not_given',
              qNumberStart: 1,
              qNumberEnd: 2,
              questions: [{ id: 301, number: 1, questionText: 'Q1', correctAnswer: 'TRUE' }, { id: 302, number: 2, questionText: 'Q2', correctAnswer: 'FALSE' }]
            },
            {
              id: 202,
              type: 'summary_completion',
              qNumberStart: 3,
              qNumberEnd: 4,
              questions: [{ id: 303, number: 3, questionText: 'Q3', correctAnswer: 'word1' }, { id: 304, number: 4, questionText: 'Q4', correctAnswer: 'word2' }]
            },
            {
              id: 203,
              type: 'mcq',
              qNumberStart: 5,
              qNumberEnd: 6,
              questions: [{ id: 305, number: 5, questionText: 'Q5', correctAnswer: 'A' }, { id: 306, number: 6, questionText: 'Q6', correctAnswer: 'B' }]
            }
          ]
        }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') return Promise.resolve({ data: mock3GroupsExam })
      return Promise.resolve({ data: [] })
    })

    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    api.post.mockImplementation((url) => {
      if (url.includes('/groups/201/')) return Promise.resolve({ data: { success: true, generatedCount: 2 } })
      if (url.includes('/groups/202/')) {
        return Promise.resolve({
          data: {
            success: false,
            hasConflicts: true,
            conflicts: [{ number: 3, aiAnswer: 'diff_word', inputAnswer: 'word1', type: 'summary_completion' }],
            generatedCount: 1
          }
        })
      }
      if (url.includes('/groups/203/')) return Promise.resolve({ data: { success: true, generatedCount: 2 } })
      return Promise.resolve({ data: {} })
    })

    const allAIButtons = screen.getAllByRole('button', { name: /AI giải thích/i })
    const toolbarAIBtn = allAIButtons.find(b => b.title && b.title.includes('tuần tự theo nhóm'))
    await waitFor(() => expect(toolbarAIBtn).toBeEnabled())
    fireEvent.click(toolbarAIBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/groups/203/'), expect.anything(), expect.anything())
    })

    await waitFor(() => {
      expect(screen.getByText(/Phát hiện lệch đáp án/i)).toBeInTheDocument()
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/Câu 3/i)).toBeInTheDocument()
    })
  })

  it('triggers single group AI generation and sequential generation in ListeningTab', async () => {
    const mockListeningExam = {
      id: 20,
      title: 'Cambridge 19 Test 1 Listening',
      listeningSections: [
        {
          id: 501,
          number: 1,
          context: 'Context 1',
          transcript: 'Transcript 1',
          questionGroups: [
            {
              id: 601,
              type: 'note_completion',
              qNumberStart: 1,
              qNumberEnd: 2,
              instruction: 'Fill blanks',
              questions: [
                { id: 701, number: 1, questionText: 'Q1', correctAnswer: 'word1', explanation: null },
                { id: 702, number: 2, questionText: 'Q2', correctAnswer: 'word2', explanation: null }
              ]
            }
          ]
        },
        { id: 502, number: 2, questionGroups: [] },
        { id: 503, number: 3, questionGroups: [] },
        { id: 504, number: 4, questionGroups: [] }
      ]
    }

    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/20') return Promise.resolve({ data: mockListeningExam })
      return Promise.resolve({ data: [] })
    })

    renderTab(<ListeningTab exams={[]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByText('Edit Listening 20'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    api.post.mockResolvedValueOnce({
      data: { success: true, message: 'Đã tạo giải thích nhóm', generatedCount: 2 }
    })

    const groupBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    expect(groupBtns.length).toBeGreaterThan(0)
    fireEvent.click(groupBtns[0])

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/exams/20/groups/601/generate-explanations',
        expect.objectContaining({ force: true, overwriteProtected: false }),
        expect.anything()
      )
    })
  })

  it('handles 409 Conflict gracefully when another AI task is already running', async () => {
    renderTab(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    fireEvent.click(screen.getByText('Edit Reading 10'))
    await waitFor(() => {
      expect(screen.getByText(/Đang sửa đề/i)).toBeInTheDocument()
    })

    const conflictErr = new Error('Conflict')
    conflictErr.response = {
      status: 409,
      data: { message: 'Đang có một tác vụ AI khác đang chạy cho đề thi này.' }
    }
    api.post.mockRejectedValueOnce(conflictErr)

    const groupBtns = screen.getAllByRole('button', { name: /Sinh AI nhóm này/i })
    fireEvent.click(groupBtns[0])

    // Should reset generating state and not crash
    await waitFor(() => {
      expect(screen.queryByText(/Đang tạo.../i)).not.toBeInTheDocument()
    })
    expect(window.alert).not.toHaveBeenCalled()
  })
})
