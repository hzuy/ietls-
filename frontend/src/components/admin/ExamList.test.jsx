import { describe, it, expect, vi } from 'vitest'
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExamList from './ExamList'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function render(ui) {
  const queryClient = createTestQueryClient()
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('ExamList — double-click protection on delete', () => {
  it('disables the row "Xóa" action while a delete is in flight, so re-opening the confirm modal cannot send a second delete request', async () => {
    const exams = [{ id: 1, title: 'Cambridge 18 Reading Test 1', skill: 'reading', createdAt: '2026-01-01T00:00:00.000Z' }]
    let resolveDelete
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
    const onDelete = vi.fn().mockReturnValue(deletePromise)

    render(<ExamList exams={exams} skill="reading" onDelete={onDelete} onEdit={vi.fn()} onRefresh={vi.fn()} />)

    const deleteBtn = screen.getByRole('button', { name: 'Xóa' })
    fireEvent.click(deleteBtn)
    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmBtn)

    // Modal closes immediately; the row action must stay disabled (and show progress)
    // until the delete settles, so a second click cannot re-open the modal and delete again.
    expect(screen.queryByText('Xác nhận xóa')).not.toBeInTheDocument()
    const pendingBtn = await screen.findByRole('button', { name: 'Đang xóa...' })
    expect(pendingBtn).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(onDelete).toHaveBeenCalledTimes(1)

    resolveDelete()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Xóa' })).not.toBeDisabled())
  })
})

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

  it('hiển thị thông tin số lượng bài ở chân danh sách / thanh phân trang', () => {
    const exams = [
      { id: 10, title: 'Exam 1', skill: 'reading' },
      { id: 11, title: 'Exam 2', skill: 'reading' },
    ]

    render(<ExamList exams={exams} skill="reading" paginationData={{ total: 20, page: 1, pages: 10 }} />)

    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(/trên tổng số/)).toBeInTheDocument()
  })

  it('gọi fetchExams với tham số đúng khi đổi bộ lọc bộ đề/sắp xếp qua dropdown', () => {
    const fetchExams = vi.fn()
    const examSeries = [{ id: 5, name: 'Cambridge 18' }]

    render(<ExamList
      exams={[]}
      skill="reading"
      examSeries={examSeries}
      fetchExams={fetchExams}
      paginationData={{ total: 0, page: 1, pages: 1 }}
    />)

    fireEvent.click(screen.getByLabelText('Lọc theo bộ đề'))
    fireEvent.click(screen.getByRole('option', { name: 'Cambridge 18' }))
    expect(fetchExams).toHaveBeenCalledWith(expect.objectContaining({ seriesId: '5' }))

    fireEvent.click(screen.getByLabelText('Sắp xếp'))
    fireEvent.click(screen.getByRole('option', { name: 'Band cao nhất' }))
    expect(fetchExams).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'score', sortOrder: 'desc' }))
  })
})
