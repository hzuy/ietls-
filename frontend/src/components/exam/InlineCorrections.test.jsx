import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InlineCorrections, { CorrectionSummary } from './InlineCorrections'

const text = 'I like play football with with my friend.'
const corrections = [
  { start: 7, end: 11, original: 'play', corrected: 'playing', type: 'grammar', explanation: 'Sau like dùng V-ing.' },
  { start: 26, end: 30, original: 'with', corrected: '', type: 'word_choice', explanation: 'Lặp từ.' },
]

describe('InlineCorrections', () => {
  it('renders the original text with struck-out mistakes and inserted fixes', () => {
    const { container } = render(<InlineCorrections text={text} corrections={corrections} />)
    expect(container.textContent).toBe('I like playplaying football with with my friend.')
    expect(container.querySelectorAll('del')).toHaveLength(2)
    expect(container.querySelector('ins').textContent).toBe('playing')
  })

  it('shows the explanation when a correction is clicked and hides it on Escape', () => {
    render(<InlineCorrections text={text} corrections={corrections} />)
    const btn = screen.getByRole('button', { name: /sửa "play" thành "playing"/ })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Sau like dùng V-ing.')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ngữ pháp')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('ignores corrections whose offsets no longer match the text', () => {
    const { container } = render(
      <InlineCorrections text={text} corrections={[{ start: 0, end: 4, original: 'play', corrected: 'x' }, { start: 7, end: 50, original: 'play', corrected: 'x' }]} />
    )
    expect(container.querySelector('del')).toBeNull()
    expect(container.textContent).toBe(text)
  })

  it('renders plain text when there are no corrections', () => {
    const { container } = render(<InlineCorrections text={text} />)
    expect(container.textContent).toBe(text)
  })

  it('summarises the number of corrections', () => {
    const { rerender, container } = render(<CorrectionSummary count={3} />)
    expect(container.textContent).toContain('Đã sửa 3 lỗi')
    rerender(<CorrectionSummary count={0} />)
    expect(container.textContent).toBe('')
  })
})
