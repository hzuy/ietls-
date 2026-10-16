import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReportIssueButton from './ReportIssueButton'
import ReportIssueModal from './ReportIssueModal'
import { ToastProvider } from '../../context/ToastContext'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

function renderWithToast(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('ReportIssue Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ReportIssueButton and shows tooltip on hover', async () => {
    renderWithToast(<ReportIssueButton location="Reading Test 1 · Câu 1" />)
    const btn = screen.getByRole('button', { name: 'Báo lỗi' })
    expect(btn).toBeInTheDocument()

    // Hover
    fireEvent.mouseEnter(btn)
    expect(screen.getByText('Gửi phản hồi về câu hỏi hoặc bài này cho IELTS Pro')).toBeInTheDocument()

    // Leave
    fireEvent.mouseLeave(btn)
    expect(screen.queryByText('Gửi phản hồi về câu hỏi hoặc bài này cho IELTS Pro')).not.toBeInTheDocument()
  })

  it('opens ReportIssueModal when clicking ReportIssueButton', () => {
    renderWithToast(<ReportIssueButton location="Reading Test 1 · Câu 1" />)
    const btn = screen.getByRole('button', { name: 'Báo lỗi' })
    fireEvent.click(btn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Gửi phản hồi báo lỗi')).toBeInTheDocument()
    expect(screen.getByText(/Gửi kèm vị trí:/i)).toBeInTheDocument()
  })

  it('allows user to type description and submit report', async () => {
    api.post.mockResolvedValueOnce({ data: { ok: true, message: 'Đã gửi' } })
    const onClose = vi.fn()

    renderWithToast(
      <ReportIssueModal
        isOpen={true}
        onClose={onClose}
        location="Reading Test 1 · Câu 1"
        skill="reading"
      />
    )

    const textarea = screen.getByPlaceholderText(/Bạn gặp lỗi gì/i)
    fireEvent.change(textarea, { target: { value: 'Đáp án câu 1 không chính xác' } })

    const submitBtn = screen.getByRole('button', { name: 'Gửi báo lỗi' })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/reports', expect.any(FormData), expect.any(Object))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
