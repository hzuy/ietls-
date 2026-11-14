import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExplanationRunPanel from './ExplanationRunPanel'
import { createBlockedReport, createRunReport, addRunOutcome, finishRunReport } from '../../utils/explanationRunReport'

function partialReport() {
  return finishRunReport(addRunOutcome(createRunReport({ examId: 10, skill: 'reading', totalQuestions: 38 }), {
    group: { id: 201 }, sentNumbers: [8, 12], loopResult: { totalGenerated: 17,
      errors: [{ number: 8, message: 'timeout' }, { number: 12, message: 'Câu 12 chưa có đáp án đúng' }],
      needsRetryQuestions: [{ number: 1, reason: 'Kết quả dự phòng chưa đủ tin cậy.' }],
    },
  }))
}

const openErrors = () => fireEvent.click(screen.getByRole('button', { name: /câu lỗi — xem chi tiết/ }))

describe('ExplanationRunPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {}).mockClear()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })
  it('renders nothing without a report while idle', () => {
    expect(render(<ExplanationRunPanel />).container.firstChild).toBeNull()
  })
  it('counts saved and failed questions once, excluding review warnings from progress', () => {
    render(<ExplanationRunPanel report={partialReport()} isGenerating />)
    expect(screen.getByText('Đã xử lý 19/38 câu · 50%')).toBeInTheDocument()
    expect(screen.getByText('Đã lưu 17 câu')).toBeInTheDocument()
    expect(screen.getByText('Còn 19 câu')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '19')
  })
  it('lets the teacher open live errors and view a question while retries are locked', async () => {
    const open = vi.fn()
    render(<ExplanationRunPanel report={partialReport()} isGenerating onOpenQuestion={open} onRetryFailed={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /2 câu lỗi — xem chi tiết/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(screen.getByText('Lỗi và câu cần kiểm tra')).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Xem câu 8' }))
    expect(open).toHaveBeenCalledWith(8, 201)
    expect(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' })).toBeDisabled()
    expect(window.alert).not.toHaveBeenCalled()
  })
  it('does not interrupt or scroll when errors arrive or the run finishes', () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockClear()
    const report = partialReport()
    const { rerender } = render(<ExplanationRunPanel report={report} isGenerating />)
    rerender(<ExplanationRunPanel report={report} />)
    expect(scroll).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
    expect(screen.getByText('Lỗi và câu cần kiểm tra')).not.toBeVisible()
  })
  it('preserves an explicit disclosure choice across progress updates and finish', () => {
    const report = partialReport()
    const { rerender } = render(<ExplanationRunPanel report={report} isGenerating />)
    fireEvent.click(screen.getByRole('button', { name: /2 câu lỗi/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }))
    rerender(<ExplanationRunPanel report={{ ...report }} />)
    expect(screen.getByText('Lỗi và câu cần kiểm tra')).not.toBeVisible()
  })
  it('retries only retryable failures and leaves validation failures for editing', () => {
    const retry = vi.fn()
    render(<ExplanationRunPanel report={partialReport()} onRetryFailed={retry} />)
    openErrors()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' }))
    expect(retry).toHaveBeenCalledWith([8])
    expect(screen.getByText(/Các câu 12 chưa có đáp án đúng/)).toBeInTheDocument()
  })
  it('collapses and redacts technical details, including clipboard output', async () => {
    const report = partialReport()
    report.rows[0].technical = 'https://example.com?key=secret-value Bearer private-token'
    render(<ExplanationRunPanel report={report} />)
    openErrors()
    expect(screen.getByText('Chi tiết kỹ thuật').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    expect(navigator.clipboard.writeText.mock.calls[0][0]).not.toMatch(/secret-value|private-token/)
    expect(screen.getByText(/https:\/\/example.com/)).not.toHaveTextContent('secret-value')
  })
  it('shows clipboard failures honestly', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<ExplanationRunPanel report={partialReport()} />)
    openErrors()
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không sao chép được')
  })
  it('uses an inline alert for blocked validation without offering retry', () => {
    render(<ExplanationRunPanel report={createBlockedReport({ examId: 10, skill: 'reading', message: 'Có 1 lỗi cần sửa.', details: ['Thiếu đáp án câu 1'] })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Có 1 lỗi cần sửa.')
    expect(screen.queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
  })
  it('has one stop control and disables it while cancelling', () => {
    const stop = vi.fn()
    const { rerender } = render(<ExplanationRunPanel isGenerating onCancel={stop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dừng tạo' }))
    expect(stop).toHaveBeenCalledTimes(1)
    rerender(<ExplanationRunPanel isGenerating isCancelling onCancel={stop} />)
    expect(screen.getByRole('button', { name: 'Đang dừng…' })).toBeDisabled()
  })
  it('keeps a quiet success result and supports dismiss', () => {
    const close = vi.fn()
    render(<ExplanationRunPanel report={finishRunReport(createRunReport({ examId: 10 }))} onDismiss={close} />)
    expect(screen.getByText('Không có câu nào cần sinh (có thể đã có lời giải).')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng báo cáo sinh giải thích' }))
    expect(close).toHaveBeenCalledTimes(1)
  })
})
