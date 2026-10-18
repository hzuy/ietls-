import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ExamExplanationOverviewBadge from './ExamExplanationOverviewBadge'

describe('ExamExplanationOverviewBadge (Batch 2 - Requirement 3.3)', () => {
  it('renders nothing when stats are empty', () => {
    const { container } = render(<ExamExplanationOverviewBadge stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders count pill with monochrome styling and correct numbers', () => {
    const stats = {
      totalSlots: 40,
      supportedSlots: 40,
      explainedSlots: 35,
      unsupportedSlots: 0,
      attentionSlots: 0,
      hasAttention: false,
      hasUnsupported: false,
      attentionReasons: []
    }

    render(<ExamExplanationOverviewBadge stats={stats} />)

    const badge = screen.getByTestId('exam-explanation-overview-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('35/40')
    expect(badge).toHaveTextContent('lời giải')

    // Attention badge should not be present
    expect(screen.queryByTestId('exam-explanation-attention-badge')).toBeNull()
  })

  it('renders attention badge when conflict_pending/needs_regeneration/possibly_stale exist with text labels', () => {
    const stats = {
      totalSlots: 40,
      supportedSlots: 40,
      explainedSlots: 38,
      unsupportedSlots: 0,
      attentionSlots: 2,
      hasAttention: true,
      hasUnsupported: false,
      attentionReasons: ['1 câu Chờ duyệt (Lệch)', '1 câu Có thể lỗi thời']
    }

    render(<ExamExplanationOverviewBadge stats={stats} />)

    const attentionBadge = screen.getByTestId('exam-explanation-attention-badge')
    expect(attentionBadge).toBeInTheDocument()
    expect(attentionBadge).toHaveTextContent('Cần chú ý: 2 câu')
    expect(attentionBadge).toHaveAttribute('title', 'Cần chú ý: 1 câu Chờ duyệt (Lệch), 1 câu Có thể lỗi thời')
  })

  it('renders unsupported indicator when image questions are excluded', () => {
    const stats = {
      totalSlots: 40,
      supportedSlots: 35,
      explainedSlots: 35,
      unsupportedSlots: 5,
      attentionSlots: 0,
      hasAttention: false,
      hasUnsupported: true,
      attentionReasons: []
    }

    render(<ExamExplanationOverviewBadge stats={stats} />)
    expect(screen.getByText('(-5 hình ảnh)')).toBeInTheDocument()
  })

  it('renders compact mode for tabs and accordion headers', () => {
    const stats = {
      totalSlots: 13,
      supportedSlots: 13,
      explainedSlots: 10,
      unsupportedSlots: 0,
      attentionSlots: 1,
      hasAttention: true,
      hasUnsupported: false,
      attentionReasons: ['1 câu Cần sinh lại']
    }

    const { container } = render(<ExamExplanationOverviewBadge stats={stats} compact={true} />)
    expect(container).toHaveTextContent('10/13 lời giải')
    expect(container).toHaveTextContent('1 cần chú ý')
  })
})
