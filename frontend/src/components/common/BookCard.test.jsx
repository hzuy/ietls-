import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BookCard from './BookCard'

describe('BookCard', () => {
  const mockBook = {
    title: 'IELTS Cambridge Academic 19',
    seriesName: 'IELTS Cambridge Academic',
    bookNumber: 19,
    coverImageUrl: 'http://localhost:3001/uploads/cam19.jpg',
    testCount: 4,
  }

  it('renders book title under cover image', () => {
    render(<BookCard book={mockBook} onClick={vi.fn()} />)

    const titleEl = screen.getByText('IELTS Cambridge Academic 19')
    expect(titleEl).toBeInTheDocument()
    expect(titleEl.tagName.toLowerCase()).toBe('h3')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<BookCard book={mockBook} onClick={handleClick} />)

    const card = screen.getByText('IELTS Cambridge Academic 19').closest('.group')
    expect(card).toBeInTheDocument()
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows "Đang cập nhật" and does not call onClick when testCount is 0', () => {
    const handleClick = vi.fn()
    const emptyBook = { ...mockBook, testCount: 0 }
    render(<BookCard book={emptyBook} onClick={handleClick} />)

    expect(screen.getByText('Đang cập nhật')).toBeInTheDocument()
    const card = screen.getByText('IELTS Cambridge Academic 19').closest('.group')
    fireEvent.click(card)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders fallback AcademicCover when no cover image', () => {
    const noImgBook = { ...mockBook, coverImageUrl: null }
    render(<BookCard book={noImgBook} onClick={vi.fn()} />)

    // AcademicCover shows volume number
    expect(screen.getByText('19')).toBeInTheDocument()
  })

  it('renders formatted actual skill tests, attempts count and action link', () => {
    const detailedBook = {
      ...mockBook,
      testCount: 8,
      attemptCount: 165,
    }
    render(<BookCard book={detailedBook} onClick={vi.fn()} />)

    expect(screen.getByText('8 bài tests')).toBeInTheDocument()
    expect(screen.getByText('165 lượt làm')).toBeInTheDocument()
    expect(screen.getByText('Xem bài test')).toBeInTheDocument()
  })
})
