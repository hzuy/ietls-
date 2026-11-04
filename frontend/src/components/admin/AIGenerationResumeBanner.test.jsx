import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AIGenerationResumeBanner from './AIGenerationResumeBanner'

describe('AIGenerationResumeBanner', () => {
  it('keeps the initial status check invisible', () => {
    const { container } = render(
      <AIGenerationResumeBanner banner={{ variant: 'checking', message: 'Đang kiểm tra trạng thái sinh AI...' }} />
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/Đang kiểm tra trạng thái sinh AI/i)).not.toBeInTheDocument()
  })
})
