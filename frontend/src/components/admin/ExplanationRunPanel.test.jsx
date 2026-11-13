import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExplanationRunPanel from './ExplanationRunPanel'
import { createBlockedReport, createRunReport, addRunOutcome, finishRunReport } from '../../utils/explanationRunReport'

const group = { id: 201, qNumberStart: 1, qNumberEnd: 2 }

function partialReport() {
  return finishRunReport(addRunOutcome(
    createRunReport({ examId: 10, skill: 'reading', totalGroups: 1, totalQuestions: 2 }),
    {
      group,
      sentNumbers: [1, 2],
      loopResult: {
        totalGenerated: 1,
        errors: [{ number: 2, message: 'AI phản hồi quá lâu nên chưa có kết quả cho phần này.' }],
        needsRetryQuestions: [{ number: 1, reason: 'Kết quả dự phòng chưa đủ tin cậy.' }],
      },
    }
  ))
}

describe('ExplanationRunPanel', () => {
  it('does not claim a successful copy when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<ExplanationRunPanel report={partialReport()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép chi tiết' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không sao chép được')
    expect(screen.queryByText('Đã sao chép')).not.toBeInTheDocument()
  })
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders nothing without a report and while idle', () => {
    const { container } = render(<ExplanationRunPanel report={null} isGenerating={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows live progress and a cancel button while generating', () => {
    const onCancel = vi.fn()
    render(
      <ExplanationRunPanel
        report={createRunReport({ examId: 10, skill: 'reading', totalGroups: 2, totalQuestions: 4 })}
        isGenerating
        progress={{ current: 1, total: 4, groupLabel: 'nhóm 1/2 (Câu 1–2)' }}
        onCancel={onCancel}
      />
    )

    const panel = screen.getByTestId('explanation-run-panel')
    expect(panel).toHaveAttribute('data-status', 'running')
    expect(screen.getByText(/Đang sinh giải thích AI/i)).toBeInTheDocument()
    expect(screen.getByText(/nhóm 1\/2 \(Câu 1–2\)/)).toBeInTheDocument()
    expect(screen.getByText(/mục tiêu 4 câu/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Hủy sinh/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables the cancel button while cancelling', () => {
    render(
      <ExplanationRunPanel
        report={createRunReport({ examId: 10, skill: 'reading', totalQuestions: 2 })}
        isGenerating
        isCancelling
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Đang dừng/i })).toBeDisabled()
    expect(screen.getByText(/Đang dừng tiến trình sinh AI/i)).toBeInTheDocument()
  })

  it('lists failed questions with plain-language causes and retries only retryable numbers', () => {
    const onRetryFailed = vi.fn()
    const onOpenGroup = vi.fn()
    render(
      <ExplanationRunPanel
        report={partialReport()}
        onRetryFailed={onRetryFailed}
        onOpenGroup={onOpenGroup}
      />
    )

    expect(screen.getByTestId('explanation-run-panel')).toHaveAttribute('data-status', 'partial')
    expect(screen.getByText(/Đã sinh xong một phần/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Câu 2/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AI phản hồi quá lâu/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Cần kiểm tra lại \(kết quả dự phòng/)).toBeInTheDocument()
    expect(screen.getByText(/Câu 1 — Kết quả dự phòng chưa đủ tin cậy/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Thử lại 1 câu lỗi/i }))
    expect(onRetryFailed).toHaveBeenCalledWith([2])

    const openGroupButtons = screen.getAllByRole('button', { name: /Mở nhóm/i })
    fireEvent.click(openGroupButtons[0])
    expect(onOpenGroup).toHaveBeenCalledWith(201)
  })

  it('keeps raw infrastructure messages inside a collapsed technical section', () => {
    const report = finishRunReport(addRunOutcome(
      createRunReport({ examId: 10, skill: 'reading', totalQuestions: 1 }),
      {
        group: { ...group, qNumberEnd: 1 },
        sentNumbers: [1],
        loopResult: { totalGenerated: 0, errors: [{ number: 1, message: '429 Too Many Requests from gemini' }] },
      }
    ))

    render(<ExplanationRunPanel report={report} />)

    const summary = screen.getByText(/Chi tiết kỹ thuật/i)
    expect(summary).toBeInTheDocument()
    expect(summary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText(/429 Too Many Requests from gemini/)).toBeInTheDocument()
  })

  it('shows blocked validation reports without a retry button', () => {
    const report = createBlockedReport({
      examId: 10,
      skill: 'reading',
      message: 'Có 1 lỗi cần sửa trước khi sinh giải thích.',
      details: ['Câu 1 chưa có đáp án đúng'],
    })
    render(<ExplanationRunPanel report={report} />)

    expect(screen.getByTestId('explanation-run-panel')).toHaveAttribute('data-status', 'blocked')
    expect(screen.getByText(/Chưa thể sinh giải thích/i)).toBeInTheDocument()
    expect(screen.getByText(/Có 1 lỗi cần sửa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thử lại/i })).not.toBeInTheDocument()
  })

  it('copies a plain-text report and confirms it', async () => {
    render(<ExplanationRunPanel report={partialReport()} />)

    fireEvent.click(screen.getByRole('button', { name: /Sao chép chi tiết/i }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const text = navigator.clipboard.writeText.mock.calls[0][0]
    expect(text).toContain('Câu 2')
    await waitFor(() => expect(screen.getByText(/Đã sao chép/)).toBeInTheDocument())
  })

  it('dismisses a finished report', () => {
    const onDismiss = vi.fn()
    render(<ExplanationRunPanel report={partialReport()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /Đóng báo cáo sinh giải thích/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
