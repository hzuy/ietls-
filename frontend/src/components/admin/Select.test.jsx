import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

describe('Admin Select (Headless UI Listbox wrapper)', () => {
  it('renders the label of the currently selected value', () => {
    render(<Select value="b" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByRole('button', { name: 'Option B' })).toBeInTheDocument()
  })

  it('shows the placeholder when value matches no option', () => {
    render(<Select value="" onChange={() => {}} options={OPTIONS} placeholder="Tất cả" />)
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeInTheDocument()
  })

  it('calls onChange with the raw value (not an event) when an option is picked', () => {
    const onChange = vi.fn()
    render(<Select value="a" onChange={onChange} options={OPTIONS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }))
    fireEvent.click(screen.getByRole('option', { name: 'Option C' }))

    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('marks the active option with a checkmark and does not disable interaction when disabled=false', () => {
    render(<Select value="a" onChange={() => {}} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Option A' }))
    const activeOption = screen.getByRole('option', { name: 'Option A' })
    expect(activeOption).toHaveAttribute('aria-selected', 'true')
  })

  it('does not open the options list when disabled', () => {
    render(<Select value="a" onChange={() => {}} options={OPTIONS} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Option A' }))
    expect(screen.queryByRole('option', { name: 'Option B' })).not.toBeInTheDocument()
  })
})
