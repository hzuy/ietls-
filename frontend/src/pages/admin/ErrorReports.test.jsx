import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ErrorReports from './ErrorReports'
import { ToastProvider } from '../../context/ToastContext'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

describe('ErrorReports Admin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state and then reports list', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        total: 1,
        reports: [
          {
            id: 1,
            issueType: 'content_wrong',
            skill: 'reading',
            location: 'Reading Test 1 · Câu 1',
            description: 'Đáp án A bị sai, bài nói B',
            status: 'pending',
            createdAt: new Date().toISOString(),
            user: { id: 10, name: 'Nguyễn Văn A', email: 'a@test.com' },
          },
        ],
      },
    })

    render(
      <ToastProvider>
        <ErrorReports />
      </ToastProvider>
    )

    expect(screen.getByText(/Đang tải danh sách báo lỗi/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Phản hồi & Báo lỗi từ học viên')).toBeInTheDocument()
      expect(screen.getByText('Đáp án A bị sai, bài nói B')).toBeInTheDocument()
      expect(screen.getByText(/Đề \/ đáp án sai/i)).toBeInTheDocument()
      expect(screen.getByText(/Nguyễn Văn A/i)).toBeInTheDocument()
    })
  })

  it('allows teacher/admin to mark a report as resolved', async () => {
    api.get.mockResolvedValue({
      data: {
        total: 1,
        reports: [
          {
            id: 1,
            issueType: 'content_wrong',
            skill: 'reading',
            location: 'Reading Test 1 · Câu 1',
            description: 'Lỗi',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    })
    api.patch.mockResolvedValueOnce({ data: { ok: true } })

    render(
      <ToastProvider>
        <ErrorReports />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Đánh dấu đã sửa')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Đánh dấu đã sửa'))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/reports/admin/1', { status: 'resolved', adminNote: null })
    })
  })
})
