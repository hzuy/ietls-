import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ListeningPractice from './ListeningPractice'
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

describe('ListeningPractice — double-click protection on delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(practiceService, 'getListeningPracticeList').mockResolvedValue([
      { id: 21, title: 'Bài nghe cần xóa', thumbnailUrl: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('disables the ConfirmDeleteModal "Xóa" button while deleting, so a double-click sends only one delete request', async () => {
    let resolveDelete
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
    vi.spyOn(practiceService, 'deleteListeningPractice').mockReturnValue(deletePromise)

    render(<ListeningPractice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa' }))
    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: 'Xóa' })
    fireEvent.click(confirmBtn)

    const pendingBtn = await within(dialog).findByRole('button', { name: /Đang xóa/i })
    expect(pendingBtn).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(practiceService.deleteListeningPractice).toHaveBeenCalledTimes(1)

    resolveDelete()
    await waitFor(() => expect(practiceService.getListeningPracticeList).toHaveBeenCalledTimes(2))
  })

  it('populates transcript when AI Phiên âm / Tách voice is clicked', async () => {
    vi.spyOn(practiceService, 'getListeningPractice').mockResolvedValue({
      id: 21,
      title: 'Bài nghe mẫu',
      passage: 'Ngữ cảnh',
      transcript: '',
      audioUrl: '/uploads/audio/sample.mp3',
      questions: { groups: [{ _id: 'g1', type: 'note_completion', qNumberStart: 1, qNumberEnd: 2, instruction: 'Complete notes', lines: [], questions: [{ number: 1, correctAnswer: 'cat' }] }] },
    })

    const axios = (await import('../../utils/axios')).default
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { transcript: '[00:00 - 00:05] Speaker A\nHello world' }
    })

    render(<ListeningPractice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    const transcribeBtn = await screen.findByRole('button', { name: /AI Phiên âm/i })
    expect(transcribeBtn).toBeEnabled()

    fireEvent.click(transcribeBtn)

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/admin/transcribe', {
        audioUrl: '/uploads/audio/sample.mp3'
      })
    })

    const textarea = await screen.findByDisplayValue(/Hello world/i)
    expect(textarea.value).toBe('[00:00 - 00:05] Speaker A\nHello world')
  })

  it('renders preview modal with audio player and without Xem Transcript button', async () => {
    vi.spyOn(practiceService, 'getListeningPractice').mockResolvedValue({
      id: 21,
      title: 'Bài nghe có transcript',
      passage: 'Ngữ cảnh',
      transcript: '[00:00 - 00:05] Speaker A\nHello world',
      audioUrl: '/uploads/audio/sample.mp3',
      questions: { groups: [] },
    })

    render(<ListeningPractice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    const previewBtn = await screen.findByRole('button', { name: /Preview nội dung đề/i })
    fireEvent.click(previewBtn)

    expect(await screen.findByText(/Preview — Bài nghe có transcript/i)).toBeInTheDocument()
    // Đảm bảo không còn nút Xem Transcript trong preview modal
    expect(screen.queryByRole('button', { name: /Xem Transcript/i })).toBeNull()
  })

  it('renders balanced 2-column editor layout with audio & question groups when opening form view', async () => {
    render(<ListeningPractice />)

    const addBtn = await screen.findByRole('button', { name: /\+ Thêm mới/i })
    fireEvent.click(addBtn)

    // Verify top action bar
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument()

    // Verify left column inputs
    expect(screen.getByPlaceholderText(/VD: Listening — Section 1/i)).toBeInTheDocument()
    expect(screen.getByText('File Audio bài nghe')).toBeInTheDocument()
    expect(screen.getByText('Transcript (Lời thoại)')).toBeInTheDocument()

    // Verify right column question groups
    expect(screen.getByText('Nhóm câu hỏi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Thêm nhóm/i })).toBeInTheDocument()
  })
})

describe('ListeningPractice — search, filter and sort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(practiceService, 'getListeningPracticeList').mockResolvedValue([
      { id: 101, title: 'Library Registration Section 1', audioUrl: '/audio/lib.mp3', questionCount: 10, createdAt: '2026-03-01T00:00:00.000Z' },
      { id: 102, title: 'Campus Tour Guide Section 2', audioUrl: null, questionCount: 0, createdAt: '2026-02-01T00:00:00.000Z' },
      { id: 103, title: 'Ocean Conservation Section 4', audioUrl: '/audio/ocean.mp3', questionCount: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('filters items by search query and shows matching count', async () => {
    render(<ListeningPractice />)
    expect(await screen.findByText('Library Registration Section 1')).toBeInTheDocument()
    expect(screen.getByText('Campus Tour Guide Section 2')).toBeInTheDocument()
    expect(screen.getByText('Ocean Conservation Section 4')).toBeInTheDocument()

    const searchInput = screen.getByLabelText('Tìm kiếm')
    fireEvent.change(searchInput, { target: { value: 'Campus' } })

    expect(screen.getByText('Campus Tour Guide Section 2')).toBeInTheDocument()
    expect(screen.queryByText('Library Registration Section 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Ocean Conservation Section 4')).not.toBeInTheDocument()
    expect(screen.getByText('1 bài khớp bộ lọc')).toBeInTheDocument()
  })

  it('filters items by audio status (has_audio vs no_audio)', async () => {
    render(<ListeningPractice />)
    await screen.findByText('Library Registration Section 1')

    fireEvent.click(screen.getByLabelText('Lọc theo trạng thái'))
    fireEvent.click(screen.getByRole('option', { name: 'Chưa có audio' }))

    expect(screen.getByText('Campus Tour Guide Section 2')).toBeInTheDocument()
    expect(screen.queryByText('Library Registration Section 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Ocean Conservation Section 4')).not.toBeInTheDocument()

    // Reset via Reset button
    const resetBtn = screen.getByRole('button', { name: 'Reset' })
    fireEvent.click(resetBtn)

    expect(screen.getByText('Library Registration Section 1')).toBeInTheDocument()
    expect(screen.getByText('Campus Tour Guide Section 2')).toBeInTheDocument()
    expect(screen.getByText('Ocean Conservation Section 4')).toBeInTheDocument()
  })

  it('shows empty filter state with reset action when no items match', async () => {
    render(<ListeningPractice />)
    await screen.findByText('Library Registration Section 1')

    const searchInput = screen.getByLabelText('Tìm kiếm')
    fireEvent.change(searchInput, { target: { value: 'non-existing-keyword-xyz' } })

    expect(screen.getByText('Không tìm thấy bài nào khớp với bộ lọc.')).toBeInTheDocument()
    const resetFilterBtn = screen.getByRole('button', { name: 'Reset bộ lọc' })
    fireEvent.click(resetFilterBtn)

    expect(screen.getByText('Library Registration Section 1')).toBeInTheDocument()
  })
})

