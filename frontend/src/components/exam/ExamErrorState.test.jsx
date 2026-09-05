import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExamErrorState from './ExamErrorState'

describe('ExamErrorState', () => {
  it('renders default title and message', () => {
    render(<ExamErrorState />)
    expect(screen.getByText('Không thể tải đề thi')).toBeInTheDocument()
    expect(screen.getByText('Đã có lỗi xảy ra hoặc đề thi không tồn tại. Vui lòng kiểm tra lại kết nối mạng và thử lại.')).toBeInTheDocument()
  })

  it('renders custom title and message', () => {
    render(<ExamErrorState title="Lỗi Reading" message="Mất kết nối tới máy chủ" />)
    expect(screen.getByText('Lỗi Reading')).toBeInTheDocument()
    expect(screen.getByText('Mất kết nối tới máy chủ')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ExamErrorState onRetry={onRetry} />)
    const retryBtn = screen.getByRole('button', { name: /thử lại/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onBack when back button is clicked with custom label', () => {
    const onBack = vi.fn()
    render(<ExamErrorState onBack={onBack} backLabel="Trở về trang chủ" />)
    const backBtn = screen.getByRole('button', { name: /trở về trang chủ/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
