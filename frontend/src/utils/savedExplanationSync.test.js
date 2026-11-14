import { describe, expect, it } from 'vitest'
import { acknowledgePracticeExplanation, withSavedExplanation } from './savedExplanationSync'

describe('server-confirmed explanation baseline', () => {
  const old = { status: 'ai_generated', reasoning: 'Old' }
  const saved = { status: 'teacher_edited', reasoning: 'Saved' }
  const group = { instruction: 'Original instruction', questions: [
    { number: 1, correctAnswer: 'one', explanation: old },
    { number: 2, correctAnswer: 'two', explanation: old },
  ], explanations: { 1: old, 2: old } }
  it('keeps question and group explanation copies synchronized', () => {
    const result = withSavedExplanation(group, 1, saved)
    expect(result.questions[0].explanation).toEqual(saved)
    expect(result.explanations[1]).toEqual(saved)
    expect(result.questions[1]).toBe(group.questions[1])
    expect(group.questions[0].explanation).toEqual(old)
  })
  it.each([2, 3])('acknowledges only the saved question in practice signature slot %i', index => {
    const baseline = ['Saved title', 'Saved passage', null, null]
    baseline[index] = [group]
    const signature = acknowledgePracticeExplanation(JSON.stringify(baseline), index, 1, saved)
    const parsed = JSON.parse(signature)
    expect(parsed[0]).toBe('Saved title')
    expect(parsed[index][0]).toEqual(withSavedExplanation(group, 1, saved))
    // An unrelated pending content/explanation edit must still differ from baseline.
    const draft = { ...parsed[index][0], instruction: 'Unsaved instruction',
      explanations: { ...parsed[index][0].explanations, 2: { reasoning: 'Unsaved second question' } } }
    expect(JSON.stringify(draft)).not.toBe(JSON.stringify(parsed[index][0]))
  })
  it('does not reset an unavailable baseline to the current draft', () => {
    expect(acknowledgePracticeExplanation('invalid', 2, 1, saved)).toBe('invalid')
  })
})
