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
const summary = () => screen.getByText(/^Cần kiểm tra lời giải/)
const openIssues = () => fireEvent.click(summary())

describe('ExplanationRunPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {}).mockClear()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })
  it('renders nothing while idle or after terminal success without issues', () => {
    const { container, rerender } = render(<ExplanationRunPanel />)
    expect(container.firstChild).toBeNull()
    rerender(<ExplanationRunPanel report={finishRunReport(createRunReport({ examId: 10 }))} />)
    expect(container.firstChild).toBeNull()
  })
  it('uses one progress line and one issue summary, excluding review warnings from progress', () => {
    render(<ExplanationRunPanel report={partialReport()} isGenerating />)
    expect(screen.getByText('Đang sinh giải thích AI · Đã xử lý 19/38 câu · 50%')).toBeInTheDocument()
    expect(screen.queryByText('Đã lưu 17 câu')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '19')
    expect(summary()).toHaveTextContent('Cần kiểm tra lời giải (3)')
  })
  it('opens live issues and questions while retry remains locked', async () => {
    const open = vi.fn()
    render(<ExplanationRunPanel report={partialReport()} isGenerating onOpenQuestion={open} onRetryFailed={vi.fn()} />)
    expect(summary().closest('details')).not.toHaveAttribute('open')
    openIssues()
    await waitFor(() => expect(summary().closest('details')).toHaveAttribute('open'))
    fireEvent.click(screen.getByRole('button', { name: /^Xem câu 8/ }))
    expect(open).toHaveBeenCalledWith(8, 201)
    expect(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' })).toBeDisabled()
    expect(window.alert).not.toHaveBeenCalled()
  })
  it('does not interrupt or scroll and preserves disclosure through progress and finish', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockClear(), report = partialReport()
    const { rerender } = render(<ExplanationRunPanel report={report} isGenerating />)
    openIssues()
    await waitFor(() => expect(summary().closest('details')).toHaveAttribute('open'))
    rerender(<ExplanationRunPanel report={{ ...report }} />)
    expect(summary().closest('details')).toHaveAttribute('open')
    openIssues()
    await waitFor(() => expect(summary().closest('details')).not.toHaveAttribute('open'))
    rerender(<ExplanationRunPanel report={{ ...report }} />)
    expect(summary().closest('details')).not.toHaveAttribute('open')
    expect(scroll).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
  })
  it('retries only eligible failures and keeps validation questions available for editing', () => {
    const retry = vi.fn()
    render(<ExplanationRunPanel report={partialReport()} onRetryFailed={retry} />)
    openIssues()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' }))
    expect(retry).toHaveBeenCalledWith([8])
    expect(screen.getByRole('button', { name: /^Xem câu 12/ })).toHaveAttribute('title', expect.stringMatching(/chưa có đáp án đúng/))
  })
  it('folds and redacts technical details, including clipboard output', async () => {
    const report = partialReport()
    report.rows[0].technical = 'https://example.com?key=secret-value Bearer private-token'
    render(<ExplanationRunPanel report={report} />)
    openIssues()
    const technical = screen.getByText('Chi tiết kỹ thuật')
    expect(technical.closest('details')).not.toHaveAttribute('open')
    fireEvent.click(technical)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    expect(navigator.clipboard.writeText.mock.calls[0][0]).not.toMatch(/secret-value|private-token/)
    expect(screen.getByText(/https:\/\/example.com/)).not.toHaveTextContent('secret-value')
  })
  it('reports clipboard failures honestly', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<ExplanationRunPanel report={partialReport()} />)
    openIssues()
    fireEvent.click(screen.getByText('Chi tiết kỹ thuật'))
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không sao chép được')
  })
  it('expands blocked validation without offering retry', () => {
    render(<ExplanationRunPanel report={createBlockedReport({ examId: 10, skill: 'reading', message: 'Có 1 lỗi cần sửa.', details: ['Thiếu đáp án câu 1'] })} />)
    expect(summary().closest('details')).toHaveAttribute('open')
    expect(screen.getByRole('alert')).toHaveTextContent('Có 1 lỗi cần sửa.')
    expect(screen.queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
  })
  it('has one stop button and disables it while cancelling', () => {
    const stop = vi.fn()
    const { rerender } = render(<ExplanationRunPanel isGenerating onCancel={stop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dừng tạo' }))
    expect(stop).toHaveBeenCalledTimes(1)
    rerender(<ExplanationRunPanel isGenerating isCancelling onCancel={stop} />)
    expect(screen.getByRole('button', { name: 'Đang dừng…' })).toBeDisabled()
  })
})
