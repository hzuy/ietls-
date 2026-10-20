import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReadingPractice from './ReadingPractice'
import { ToastProvider } from '../../context/ToastContext'
import * as practiceService from '../../services/practiceService'

function render(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  )
}

describe('ReadingPractice — double-click protection on delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(practiceService, 'getReadingPracticeList').mockResolvedValue([
      { id: 11, title: 'Bài đọc cần xóa', thumbnailUrl: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('disables the ConfirmDeleteModal "Xóa" button while deleting, so a double-click sends only one delete request', async () => {
    let resolveDelete
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
    vi.spyOn(practiceService, 'deleteReadingPractice').mockReturnValue(deletePromise)

    render(<ReadingPractice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }, { timeout: 4000 }))
    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    const confirmBtn = within(dialog).getByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmBtn)

    const pendingBtn = await within(dialog).findByRole('button', { name: /Đang xóa/i })
    expect(pendingBtn).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(practiceService.deleteReadingPractice).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(practiceService.getReadingPracticeList).toHaveBeenCalledTimes(2))
  })

  it('renders balanced 2-column editor layout with top actions when opening form view', async () => {
    render(<ReadingPractice />)

    const addBtn = await screen.findByRole('button', { name: /\+ Thêm mới/i })
    fireEvent.click(addBtn)

    // Verify top action bar
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument()

    // Verify left column inputs
    expect(screen.getByPlaceholderText(/VD: Academic Reading/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nhập hoặc dán nội dung bài đọc/i)).toBeInTheDocument()

    // Verify right column question groups
    expect(screen.getByText('Nhóm câu hỏi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Thêm nhóm/i })).toBeInTheDocument()
  })
})

describe('ReadingPractice — search, filter and sort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(practiceService, 'getReadingPracticeList').mockResolvedValue([
      { id: 1, title: 'Climate Change Effects', questionCount: 13, createdAt: '2026-02-01T00:00:00.000Z' },
      { id: 2, title: 'Artificial Intelligence History', questionCount: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 3, title: 'Deep Sea Exploration', questionCount: 10, createdAt: '2026-03-01T00:00:00.000Z' },
    ])
  })

  it('filters items by search query and shows matching count', async () => {
    render(<ReadingPractice />)
    expect(await screen.findByText('Climate Change Effects')).toBeInTheDocument()
    expect(screen.getByText('Artificial Intelligence History')).toBeInTheDocument()
    expect(screen.getByText('Deep Sea Exploration')).toBeInTheDocument()

    const searchInput = screen.getByLabelText('Tìm kiếm')
    fireEvent.change(searchInput, { target: { value: 'Climate' } })

    expect(screen.getByText('Climate Change Effects')).toBeInTheDocument()
    expect(screen.queryByText('Artificial Intelligence History')).not.toBeInTheDocument()
    expect(screen.queryByText('Deep Sea Exploration')).not.toBeInTheDocument()
    expect(screen.getByText('1 bài khớp bộ lọc')).toBeInTheDocument()
  })

  it('filters items by question status (has_questions vs no_questions)', async () => {
    render(<ReadingPractice />)
    await screen.findByText('Climate Change Effects')

    fireEvent.click(screen.getByLabelText('Lọc theo trạng thái câu hỏi'))
    fireEvent.click(screen.getByRole('option', { name: 'Chưa có câu hỏi' }))

    expect(screen.getByText('Artificial Intelligence History')).toBeInTheDocument()
    expect(screen.queryByText('Climate Change Effects')).not.toBeInTheDocument()
    expect(screen.queryByText('Deep Sea Exploration')).not.toBeInTheDocument()

    // Reset via Reset button
    const resetBtn = screen.getByRole('button', { name: 'Reset' })
    fireEvent.click(resetBtn)

    expect(screen.getByText('Climate Change Effects')).toBeInTheDocument()
    expect(screen.getByText('Artificial Intelligence History')).toBeInTheDocument()
    expect(screen.getByText('Deep Sea Exploration')).toBeInTheDocument()
  })

  it('shows empty filter state with reset action when no items match', async () => {
    render(<ReadingPractice />)
    await screen.findByText('Climate Change Effects')

    const searchInput = screen.getByLabelText('Tìm kiếm')
    fireEvent.change(searchInput, { target: { value: 'non-existing-keyword-xyz' } })

    expect(screen.getByText('Không tìm thấy bài nào khớp với bộ lọc.')).toBeInTheDocument()
    const resetFilterBtn = screen.getByRole('button', { name: 'Reset bộ lọc' })
    fireEvent.click(resetFilterBtn)

    expect(screen.getByText('Climate Change Effects')).toBeInTheDocument()
  })
})
