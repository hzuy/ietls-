import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import ErrorReports from './ErrorReports'
import { ToastProvider } from '../../context/ToastContext'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

const report = (over = {}) => ({
  id: 1,
  issueType: 'content_wrong',
  skill: 'reading',
  location: 'Reading Test 1 · Câu 1',
  description: 'Đáp án A bị sai, bài nói B',
  status: 'pending',
  createdAt: new Date().toISOString(),
  user: { id: 10, name: 'Nguyễn Văn A', email: 'a@test.com' },
  ...over,
})

const renderPage = () => render(
  <ToastProvider>
    <ErrorReports />
  </ToastProvider>
)

describe('ErrorReports Admin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state and then reports list', async () => {
    api.get.mockResolvedValueOnce({ data: { total: 1, reports: [report()] } })

    renderPage()

    expect(screen.getByText(/Đang tải danh sách báo lỗi/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Báo lỗi đề thi/i })).toBeInTheDocument()
      expect(screen.getByText('Đáp án A bị sai, bài nói B')).toBeInTheDocument()
      expect(screen.getByText('Đáp án sai')).toBeInTheDocument()
      expect(screen.getByText(/Nguyễn Văn A/i)).toBeInTheDocument()
    })
  })

  it('lọc được đủ 4 kỹ năng (Reading/Listening/Writing/Speaking), không còn "Chung"', async () => {
    api.get.mockResolvedValue({ data: { total: 0, reports: [] } })

    renderPage()

    for (const label of ['Reading', 'Listening', 'Writing', 'Speaking']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Chung' })).not.toBeInTheDocument()

    // Không còn chấm màu trang trí trong các nút lọc kỹ năng
    const writingBtn = screen.getByRole('button', { name: 'Writing' })
    expect(writingBtn.querySelector('span')).toBeNull()

    fireEvent.click(writingBtn)

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/reports/admin', {
        params: { page: 1, limit: 15, status: 'pending', skill: 'writing' },
      })
    })
  })

  it('hiển thị badge kỹ năng Writing/Speaking và nhãn "Chung" cho general', async () => {
    api.get.mockResolvedValue({
      data: {
        total: 2,
        reports: [
          report({ id: 1, skill: 'writing', description: 'Thiếu ảnh Task 1' }),
          report({ id: 2, skill: 'general', description: 'Lỗi chung' }),
        ],
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Thiếu ảnh Task 1')).toBeInTheDocument()
      expect(screen.getByText('Lỗi chung')).toBeInTheDocument()
    })

    // Badge nằm trong card, tách biệt với nút lọc cùng nhãn
    const writingCard = screen.getByText('Thiếu ảnh Task 1').closest('article')
    expect(within(writingCard).getByText('Writing')).toBeInTheDocument()
    const generalCard = screen.getByText('Lỗi chung').closest('article')
    expect(within(generalCard).getByText('Chung')).toBeInTheDocument()
  })

  it('phân trang khi có nhiều hơn 15 báo lỗi', async () => {
    api.get.mockResolvedValue({ data: { total: 40, reports: [report()] } })

    renderPage()

    await screen.findByText('Đáp án A bị sai, bài nói B')
    expect(screen.getByText(/Trang 1 \/ 3/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Trang 2' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/reports/admin', {
        params: { page: 2, limit: 15, status: 'pending' },
      })
    })
  })

  it('allows teacher/admin to mark a report as resolved', async () => {
    api.get.mockResolvedValue({ data: { total: 1, reports: [report({ description: 'Lỗi' })] } })
    api.patch.mockResolvedValueOnce({ data: { ok: true } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Đánh dấu đã sửa')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Đánh dấu đã sửa'))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/reports/admin/1', { status: 'resolved', adminNote: null })
    })
  })
})
