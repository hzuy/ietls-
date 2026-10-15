import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination'

const labels = () => screen.getAllByRole('button', { name: /^Trang \d+$/ }).map(b => b.textContent)

describe('Pagination', () => {
  it('lists every page when there are few pages', () => {
    render(<Pagination page={2} pages={5} onChange={() => {}} />)
    expect(labels()).toEqual(['1', '2', '3', '4', '5'])
    expect(screen.getByRole('button', { name: 'Trang 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('collapses distant pages with ellipses around the current page', () => {
    render(<Pagination page={30} pages={64} onChange={() => {}} />)
    expect(labels()).toEqual(['1', '29', '30', '31', '64'])
    expect(screen.getAllByText('…')).toHaveLength(2)
  })

  it('shows the first pages in full when the current page is near the start or end', () => {
    const { rerender } = render(<Pagination page={1} pages={64} onChange={() => {}} />)
    expect(labels()).toEqual(['1', '2', '3', '4', '5', '64'])
    rerender(<Pagination page={63} pages={64} onChange={() => {}} />)
    expect(labels()).toEqual(['1', '60', '61', '62', '63', '64'])
  })

  it('navigates by number, arrows and the jump box, clamping to the valid range', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pages={64} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Trang 64' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    const jump = screen.getByLabelText('Đến trang')
    fireEvent.change(jump, { target: { value: '999' } })
    fireEvent.submit(jump.closest('form'))
    expect(onChange.mock.calls).toEqual([[64], [2], [64]])
  })

  it('shows only the summary when there is a single page', () => {
    render(<Pagination page={1} pages={1} onChange={() => {}} summary="Hiển thị 1–3 / 3" />)
    expect(screen.getByText('Hiển thị 1–3 / 3')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
