import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ExamExplanationOverviewBadge from './ExamExplanationOverviewBadge'

describe('ExamExplanationOverviewBadge', () => {
  it('renders nothing when stats are empty', () => {
    const { container } = render(<ExamExplanationOverviewBadge stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the aggregate attention badge when some explanations need attention', () => {
    const stats = {
      totalSlots: 40,
      supportedSlots: 40,
      explainedSlots: 40,
      unsupportedSlots: 0,
      attentionSlots: 3,
      hasAttention: true,
      hasUnsupported: false,
      attentionReasons: ['3 câu Chờ duyệt (Lệch)'],
    }

    render(<ExamExplanationOverviewBadge stats={stats} />)

    expect(screen.getByTestId('exam-explanation-overview-badge')).toHaveTextContent('40/40')
    expect(screen.getByTestId('exam-explanation-attention-badge')).toHaveTextContent('3 câu cần chú ý')
    expect(screen.getByTestId('exam-explanation-attention-badge')).toHaveAttribute(
      'title',
      expect.stringContaining('3 câu Chờ duyệt (Lệch)')
    )
  })

  it('shows the run report chip with error and attention counts', () => {
    const stats = {
      totalSlots: 10,
      supportedSlots: 10,
      explainedSlots: 8,
      unsupportedSlots: 0,
      attentionSlots: 0,
      hasAttention: false,
      hasUnsupported: false,
      attentionReasons: [],
    }
    const onOpenRunPanel = vi.fn()

    render(
      <ExamExplanationOverviewBadge
        stats={stats}
        runErrorCount={2}
        runAttentionCount={1}
        onOpenRunPanel={onOpenRunPanel}
      />
    )

    const chip = screen.getByTestId('exam-explanation-run-issues')
    expect(chip).toHaveTextContent('2 câu lỗi · 1 câu cần kiểm tra')
    fireEvent.click(chip)
    expect(onOpenRunPanel).toHaveBeenCalledTimes(1)
  })

  it('uses the same compact count style and omits attention summaries', () => {
    const stats = {
      totalSlots: 13,
      supportedSlots: 13,
      explainedSlots: 10,
      unsupportedSlots: 0,
      attentionSlots: 1,
      hasAttention: true,
      hasUnsupported: false,
      attentionReasons: ['1 câu Cần sinh lại'],
    }

    const { container } = render(<ExamExplanationOverviewBadge stats={stats} compact />)
    const badge = container.firstChild
    expect(badge).toHaveTextContent('10/13 lời giải')
    expect(badge).toHaveClass('w-28', 'h-7')
    expect(screen.queryByText(/cần chú ý/i)).not.toBeInTheDocument()
  })

  it('keeps unsupported image information in the explanation count', () => {
    const stats = {
      totalSlots: 40,
      supportedSlots: 35,
      explainedSlots: 35,
      unsupportedSlots: 5,
      attentionSlots: 0,
      hasAttention: false,
      hasUnsupported: true,
      attentionReasons: [],
    }

    render(<ExamExplanationOverviewBadge stats={stats} />)
    expect(screen.getByText('(-5 thiếu ảnh)')).toBeInTheDocument()
  })
})
