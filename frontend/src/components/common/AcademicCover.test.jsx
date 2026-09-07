import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AcademicCover from './AcademicCover'

describe('AcademicCover Component', () => {
  it('renders default academic cover with title and official badge', () => {
    render(<AcademicCover title="IELTS Practice 1" />)
    expect(screen.getByText('IELTS ACADEMIC')).toBeInTheDocument()
    expect(screen.getByText('OFFICIAL')).toBeInTheDocument()
    expect(screen.getByText('4K VECTOR')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('correctly parses Cambridge book numbers from title', () => {
    render(<AcademicCover title="Cambridge IELTS 19 Academic" />)
    expect(screen.getByText('CAMBRIDGE')).toBeInTheDocument()
    expect(screen.getByText('19')).toBeInTheDocument()
  })

  it('renders custom volume and series name when explicitly provided', () => {
    render(
      <AcademicCover
        title="Custom Title"
        volume="18"
        seriesName="CAMBRIDGE"
        subtitle="4 Academic Tests"
        skill="reading"
      />
    )
    expect(screen.getByText('CAMBRIDGE')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('4 Academic Tests')).toBeInTheDocument()
    expect(screen.getByText('READING')).toBeInTheDocument()
  })

  it('renders compact mode for thumbnail / sidebar usage', () => {
    const { container } = render(
      <AcademicCover
        title="Cambridge IELTS 16"
        compact={true}
        subtitle="Tests"
      />
    )
    expect(screen.getByText('CAMB')).toBeInTheDocument()
    expect(screen.getByText('#16')).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByText('Tests')).toBeInTheDocument()
    // In compact mode, 4K VECTOR badge is not rendered
    expect(screen.queryByText('4K VECTOR')).not.toBeInTheDocument()
    expect(container.firstChild).toHaveClass('border-l-2')
  })

  it('applies hardware accelerated crisp rendering styles', () => {
    const { container } = render(<AcademicCover title="IELTS Test" />)
    const element = container.firstChild
    expect(element.style.transform).toBe('translateZ(0)')
    expect(element.style.backfaceVisibility).toBe('hidden')
  })
})
