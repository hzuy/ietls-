import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderFeedbackList } from './feedbackList'

describe('feedbackList - renderFeedbackList', () => {
  it('handles string input correctly', () => {
    const stringInput = 'Good vocabulary usage.\nClear paragraph structure.'
    render(renderFeedbackList(stringInput))

    expect(screen.getByText('Good vocabulary usage.')).toBeInTheDocument()
    expect(screen.getByText('Clear paragraph structure.')).toBeInTheDocument()
  })

  it('handles array input from AI without crashing', () => {
    const arrayInput = ['Strong introduction', 'Well-developed arguments']
    render(renderFeedbackList(arrayInput))

    expect(screen.getByText('Strong introduction')).toBeInTheDocument()
    expect(screen.getByText('Well-developed arguments')).toBeInTheDocument()
  })

  it('handles object input from AI without crashing', () => {
    const objectInput = { point1: 'Uses complex sentences', point2: 'Accurate word choice' }
    render(renderFeedbackList(objectInput))

    expect(screen.getByText('Uses complex sentences')).toBeInTheDocument()
    expect(screen.getByText('Accurate word choice')).toBeInTheDocument()
  })

  it('returns null when input is null or undefined', () => {
    const { container: c1 } = render(renderFeedbackList(null))
    expect(c1).toBeEmptyDOMElement()

    const { container: c2 } = render(renderFeedbackList(undefined))
    expect(c2).toBeEmptyDOMElement()
  })
})
