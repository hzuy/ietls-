import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CurriculumSection from './CurriculumSection'

describe('CurriculumSection Component', () => {
  it('renders default 4 sessions before clicking show all button', () => {
    render(<CurriculumSection />)
    expect(screen.getByText('Chương trình học 9 tuần')).toBeInTheDocument()
    
    // Default showAll is false: courseSessions.slice(0, 4) renders 4 items
    const viewMoreBtn = screen.getByRole('button', { name: /Xem thêm/i })
    expect(viewMoreBtn).toBeInTheDocument()
    expect(viewMoreBtn).toHaveTextContent('Xem thêm 23 buổi ▼')
  })

  it('expands list to full sessions on "Xem thêm" click and collapses on "Thu gọn" click', () => {
    render(<CurriculumSection />)
    const btn = screen.getByRole('button', { name: /Xem thêm/i })
    
    fireEvent.click(btn)
    expect(btn).toHaveTextContent('Thu gọn ▲')

    fireEvent.click(btn)
    expect(btn).toHaveTextContent('Xem thêm 23 buổi ▼')
  })

  it('toggles accordion session items when header is clicked', () => {
    const { container } = render(<CurriculumSection />)
    
    // First item is open by default (openSection = 1)
    const firstAccItem = container.querySelector('.cd-acc-item')
    expect(firstAccItem).toHaveClass('open')

    // Click header to toggle closed
    const header = firstAccItem.querySelector('.cd-acc-header')
    fireEvent.click(header)
    expect(firstAccItem).not.toHaveClass('open')
  })
})
