import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageWithFallback from './ImageWithFallback'
import { IMG_FALLBACK } from '../../utils/media'

describe('ImageWithFallback', () => {
  it('renders image with valid src and alt', () => {
    render(<ImageWithFallback src="https://example.com/test.jpg" alt="Test image" />)
    const img = screen.getByAltText('Test image')
    expect(img).toHaveAttribute('src', 'https://example.com/test.jpg')
  })

  it('renders fallback placeholder when src is missing', () => {
    render(<ImageWithFallback src={null} alt="Missing image" />)
    const img = screen.getByAltText('Missing image')
    expect(img).toHaveAttribute('src', IMG_FALLBACK)
  })

  it('switches to fallback placeholder when onError is triggered', () => {
    render(<ImageWithFallback src="https://example.com/broken.jpg" alt="Broken image" />)
    const img = screen.getByAltText('Broken image')
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', IMG_FALLBACK)
  })
})
