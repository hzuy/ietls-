import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ExamExplanationOverviewBadge from './ExamExplanationOverviewBadge'

describe('ExamExplanationOverviewBadge', () => {
  it('renders nothing when stats are empty', () => {
    const { container } = render(<ExamExplanationOverviewBadge stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows explanation progress without an aggregate attention badge', () => {
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
    expect(screen.queryByText(/cần chú ý/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('exam-explanation-attention-badge')).not.toBeInTheDocument()
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
