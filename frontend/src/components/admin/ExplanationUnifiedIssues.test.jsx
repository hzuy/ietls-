import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ExplanationRunPanel from './ExplanationRunPanel'

const groups = [{ id: 7, questions: [
  { number: 1, explanation: { status: 'conflict_pending' } },
  { number: 2, explanation: { status: 'needs_regeneration' } },
  { number: 3, explanation: { status: 'possibly_stale' } },
  { number: 6, explanation: { status: 'draft_ready' } },
] }]
const report = { startedAt: '2026-11-15T10:00:00Z', status: 'done', generated: 1, scope: 'retry', totalQuestions: 5,
  rows: [{ number: 2, groupId: 7, message: 'Thiếu dữ liệu', retryable: false }, { number: 4, groupId: 7, message: 'AI phản hồi quá lâu', retryable: true }],
  needsRetry: [{ number: 1, message: 'Cần đối chiếu' }, { number: 5, message: 'Chưa đủ bằng chứng' }],
}

describe('one compact explanation issue list', () => {
  it('merges saved and current-run issues once per question without a second report', () => {
    const open = vi.fn()
    render(<ExplanationRunPanel groups={groups} report={report} onOpenQuestion={open} onRetryFailed={vi.fn()} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (5)'))
    expect(screen.getAllByRole('button', { name: /^Xem câu / })).toHaveLength(5)
    expect(screen.queryByText('Còn câu cần kiểm tra')).not.toBeInTheDocument()
    expect(screen.queryByText('Đã lưu 1 câu')).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm vi: thử lại các câu đã chọn')).not.toBeInTheDocument()
    expect(screen.queryByText('Lỗi và câu cần kiểm tra')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem câu 6/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Xem câu 4/ }))
    expect(open).toHaveBeenCalledWith(4, 7)
  })
  it('retries only eligible failures and never retries just by opening the list', () => {
    const retry = vi.fn()
    render(<ExplanationRunPanel groups={groups} report={report} onRetryFailed={retry} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (5)'))
    expect(retry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' }))
    expect(retry).toHaveBeenCalledWith([4])
  })
  it('keeps one list during generation and locks retries', () => {
    render(<ExplanationRunPanel groups={groups} report={report} isGenerating onRetryFailed={vi.fn()} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (5)'))
    expect(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' })).toBeDisabled()
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  })
  it('renders saved issues even with no generation report', () => {
    render(<ExplanationRunPanel groups={groups} />)
    expect(screen.getByText('Cần kiểm tra lời giải (3)')).toBeInTheDocument()
  })
  it('counts thirteen unique questions instead of separate saved and retry totals', () => {
    const saved = [{ questions: Array.from({ length: 11 }, (_, index) => ({ number: index + 1, explanation: { status: 'needs_regeneration' } })) }]
    render(<ExplanationRunPanel groups={saved} report={{ ...report, rows: [], needsRetry: [11, 12, 13].map(number => ({ number, message: 'Cần đối chiếu' })) }} />)
    fireEvent.click(screen.getByText('Cần kiểm tra lời giải (13)'))
    expect(screen.getAllByRole('button', { name: /^Xem câu / })).toHaveLength(13)
    expect(screen.queryByText(/3 câu cần kiểm tra/)).not.toBeInTheDocument()
  })
  it('preserves validation errors that do not refer to a specific question', () => {
    render(<ExplanationRunPanel report={{ status: 'blocked', rows: [{ number: null, message: 'Thiếu transcript', validationIssues: ['Bổ sung transcript trước khi tạo.'] }] }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Thiếu transcript')
    expect(screen.getByText('Bổ sung transcript trước khi tạo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
  })
  it('does not leave a success report or saved-count summary after completion', () => {
    const { container } = render(<ExplanationRunPanel report={{ ...report, rows: [], needsRetry: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('removes an obsolete run error after a newer question save', () => {
    const saved = [{ questions: [{ number: 4, explanation: { status: 'draft_ready', updatedAt: '2026-11-15T11:00:00Z' } }] }]
    const { container } = render(<ExplanationRunPanel groups={saved} report={{ ...report, finishedAt: '2026-11-15T10:30:00Z', needsRetry: [], rows: [report.rows[1]] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
