import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ReadingTab from './ReadingTab'
import WritingTab from './WritingTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() }
}))

vi.mock('./ExamList', () => ({
  default: ({ onEdit, skill }) => (
    <button type="button" onClick={() => onEdit(skill === 'writing' ? 20 : 10)}>
      Edit {skill}
    </button>
  )
}))

vi.mock('./editors/ReadingGroupEditor', () => ({
  default: () => <div data-testid="mock-reading-group-editor" />
}))

const READING_EXAM = {
  id: 10,
  title: 'Cambridge 18 Test 1 Reading',
  bookNumber: 18,
  testNumber: 1,
  seriesId: null,
  passages: [
    {
      id: 101,
      number: 1,
      passageNumber: 1,
      title: 'Passage 1',
      subtitle: '',
      body: 'Body 1',
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
        }
      ]
    },
    { id: 102, number: 2, passageNumber: 2, title: 'Passage 2', body: 'Body 2', questionGroups: [] },
    { id: 103, number: 3, passageNumber: 3, title: 'Passage 3', body: 'Body 3', questionGroups: [] }
  ]
}

const WRITING_EXAM = {
  id: 20,
  title: 'IELTS Writing Practice Test 1',
  bookNumber: 1,
  testNumber: 1,
  seriesId: null,
  writingTasks: [
    { number: 1, prompt: 'Task 1 prompt', imageUrl: '' },
    { number: 2, prompt: 'Task 2 prompt' }
  ]
}

// Autosave nháp debounce 2000ms → chờ dư để chắc chắn timer đã kịp chạy.
const waitForAutosaveWindow = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2600))
  })

describe('Autosave nháp admin — chỉ lưu khi form thực sự khác mốc (dữ liệu DB)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    window.confirm = vi.fn().mockReturnValue(true)
    Element.prototype.scrollIntoView = vi.fn()
    api.get.mockImplementation((url) => {
      if (url === '/admin/exams/10') return Promise.resolve({ data: READING_EXAM })
      if (url === '/admin/exams/20') return Promise.resolve({ data: WRITING_EXAM })
      return Promise.resolve({ data: [] })
    })
  })

  it('ReadingTab: vừa mở đề để sửa mà chưa sửa gì thì KHÔNG ghi "nháp ma"', async () => {
    render(<ReadingTab exams={[{ id: 10, title: 'Cambridge 18 Test 1 Reading' }]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit reading'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Cambridge 19 Test 1 Reading/i)).toHaveValue('Cambridge 18 Test 1 Reading')
    )

    await waitForAutosaveWindow()

    expect(localStorage.getItem('draft_reading_10')).toBeNull()
    expect(screen.queryByText(/Đã lưu bản nháp/)).not.toBeInTheDocument()
  }, 20000)

  it('ReadingTab: khi giáo viên sửa thật thì vẫn autosave nháp như trước', async () => {
    render(<ReadingTab exams={[{ id: 10, title: 'Cambridge 18 Test 1 Reading' }]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit reading'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Cambridge 19 Test 1 Reading/i)).toHaveValue('Cambridge 18 Test 1 Reading')
    )

    fireEvent.change(screen.getByPlaceholderText(/Cambridge 19 Test 1 Reading/i), {
      target: { value: 'Cambridge 18 Test 1 Reading (đã sửa)' }
    })

    await waitForAutosaveWindow()

    expect(localStorage.getItem('draft_reading_10')).not.toBeNull()
  }, 20000)

  it('WritingTab: vừa mở đề để sửa mà chưa sửa gì thì KHÔNG ghi "nháp ma"', async () => {
    render(<WritingTab exams={[{ id: 20, title: 'IELTS Writing Practice Test 1' }]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit writing'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/VD: IELTS Writing Practice Test 1/i)).toHaveValue(
        'IELTS Writing Practice Test 1'
      )
    )

    await waitForAutosaveWindow()

    expect(localStorage.getItem('draft_writing_20')).toBeNull()
    expect(screen.queryByText(/Đã lưu bản nháp/)).not.toBeInTheDocument()
  }, 20000)

  it('WritingTab: khi giáo viên sửa thật thì vẫn autosave nháp như trước', async () => {
    render(<WritingTab exams={[{ id: 20, title: 'IELTS Writing Practice Test 1' }]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Edit writing'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/VD: IELTS Writing Practice Test 1/i)).toHaveValue(
        'IELTS Writing Practice Test 1'
      )
    )

    fireEvent.change(screen.getByPlaceholderText(/VD: IELTS Writing Practice Test 1/i), {
      target: { value: 'IELTS Writing Practice Test 1 (đã sửa)' }
    })

    await waitForAutosaveWindow()

    expect(localStorage.getItem('draft_writing_20')).not.toBeNull()
  }, 20000)
})
