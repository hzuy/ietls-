import { describe, expect, it } from 'vitest'
import { relabelMatchingChoices } from './matchingChoices'

describe('author-defined matching choice letters', () => {
  it('never supplies an answer for blank or missing legacy option keys and keeps API key fallback', () => {
    for (const [option, question] of [[{ letter: '', text: 'First' }, { correctAnswer: '' }], [{ text: 'First' }, {}], [{ letter: null, text: 'First' }, { correctAnswer: null }]]) {
      expect(relabelMatchingChoices({ matchingOptions: [option], questions: [question] }).questions[0].correctAnswer).toBe(question.correctAnswer)
    }
    const next = relabelMatchingChoices({ matchingOptions: [{ letter: '', optionLetter: 'F', optionText: 'First' }], questions: [{ correctAnswer: 'F' }, { correctAnswer: '' }] })
    expect(next.questions.map(q => q.correctAnswer)).toEqual(['A', ''])
  })
  it('does not recycle an unresolved legacy answer as another option key', () => {
    const group = { matchingOptions: [{ letter: 'A', text: 'First' }, { letter: 'C', text: 'Third' }], questions: [{ id: 9, correctAnswer: 'B' }] }
    const next = relabelMatchingChoices(group)
    expect(next.questions[0].correctAnswer).toBe('B')
    expect(next.matchingOptions.some(option => option.letter === 'B')).toBe(false)
  })
  it('normalizes API and legacy labels without losing question identity or custom option text', () => {
    const group = { matchingOptions: [{ optionLetter: 'C', optionText: 'Coffee, tea' }, { letter: 'F', text: 'Museum' }], questions: [{ id: 3, number: 7, correctAnswer: 'F', explanation: { keep: true } }] }
    const next = relabelMatchingChoices(group)
    expect(next.matchingOptions).toEqual([{ letter: 'A', text: 'Coffee, tea' }, { letter: 'B', text: 'Museum' }])
    expect(next.questions[0]).toEqual({ ...group.questions[0], correctAnswer: 'B' })
    expect(group.questions[0].correctAnswer).toBe('F')
  })
  it('remaps surviving choices, clears only removed-choice answers, and preserves unresolved legacy answers', () => {
    const group = { matchingOptions: ['A', 'B', 'C'].map(letter => ({ letter, text: letter })), questions: ['A', 'B', 'C', 'X', ''].map((correctAnswer, i) => ({ id: i + 1, correctAnswer })) }
    const next = relabelMatchingChoices(group, group.matchingOptions.slice(1))
    expect(next.questions.map(q => q.correctAnswer)).toEqual(['', 'A', 'B', 'X', ''])
    expect(next.questions.map(q => q.id)).toEqual([1, 2, 3, 4, 5])
  })
})
