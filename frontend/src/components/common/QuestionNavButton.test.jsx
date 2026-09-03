import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuestionNavButton from './QuestionNavButton'

describe('QuestionNavButton', () => {
  it('chưa làm: nền trắng / viền --border / chữ --ink, radius 8px, size mặc định 32px', () => {
    render(<QuestionNavButton number={7} status="unanswered" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Câu 7' })
    expect(btn).toHaveTextContent('7')
    expect(btn.style.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(btn.style.border).toBe('1px solid var(--border)')
    expect(btn.style.color).toBe('var(--ink)')
    expect(btn.style.borderRadius).toBe('var(--radius-sm)')
    expect(btn.style.fontSize).toBe('var(--fs-xs)')
    expect(btn.style.width).toBe('32px')
    expect(btn.style.height).toBe('32px')
  })

  it('đã làm: nền --ink / viền --ink / chữ trắng, aria-label ghi rõ đã trả lời', () => {
    render(<QuestionNavButton number={12} status="answered" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Câu 12 — đã trả lời' })
    expect(btn.style.backgroundColor).toBe('var(--ink)')
    expect(btn.style.border).toBe('1px solid var(--ink)')
    expect(btn.style.color).toBe('rgb(255, 255, 255)')
  })

  it('hover khi chưa làm → viền + chữ chuyển sang --primary', () => {
    render(<QuestionNavButton number={3} status="unanswered" onClick={() => {}} />)
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    expect(btn.style.border).toBe('1px solid var(--primary)')
    expect(btn.style.color).toBe('var(--primary)')
    fireEvent.mouseLeave(btn)
    expect(btn.style.border).toBe('1px solid var(--border)')
  })

  it('hover khi đã làm → giữ nguyên tông --ink (không đổi)', () => {
    render(<QuestionNavButton number={5} status="answered" onClick={() => {}} />)
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    expect(btn.style.backgroundColor).toBe('var(--ink)')
    expect(btn.style.color).toBe('rgb(255, 255, 255)')
  })

  it('click gọi onClick', () => {
    const onClick = vi.fn()
    render(<QuestionNavButton number={1} status="unanswered" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('size tuỳ biến → width/height theo px truyền vào', () => {
    render(<QuestionNavButton number={9} status="unanswered" onClick={() => {}} size={28} />)
    const btn = screen.getByRole('button')
    expect(btn.style.width).toBe('28px')
    expect(btn.style.height).toBe('28px')
  })
})
