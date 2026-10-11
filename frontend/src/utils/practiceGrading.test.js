import { describe, it, expect } from 'vitest'
import { gradePractice } from './practiceGrading'

const readingExam = {
  title: 'Kakapo',
  questions: {
    groups: [
      { type: 'true_false_ng', qNumberStart: 1, qNumberEnd: 2, questions: [{ number: 1, correctAnswer: 'FALSE' }, { number: 2, correctAnswer: 'TRUE' }], explanations: { 1: { v: 2 } } },
      { type: 'note_completion', qNumberStart: 3, qNumberEnd: 4, questions: [{ number: 3, correctAnswer: 'discs/disks' }, { number: 4, correctAnswer: 'soil' }] },
    ],
  },
}

describe('gradePractice', () => {
  it('grades reading answers, accepts alternatives and keeps explanations', () => {
    const { result, correct, total } = gradePractice('reading', readingExam, { 1: 'FALSE', 2: 'FALSE', 3: 'disks' })
    expect([correct, total]).toEqual([2, 4])
    expect(result.sections[0].questions.map(q => q.status)).toEqual(['correct', 'wrong', 'correct', 'missed'])
    expect(result.sections[0].questions[0].explanation).toEqual({ v: 2 })
    expect(result.sections[0].to).toBe(4)
    expect(result.questionTypes.find(t => t.name === 'True False Ng')).toMatchObject({ correct: 1, wrong: 1 })
  })

  it('grades listening answers keyed by question number, ignoring case for fill-in types', () => {
    const exam = { questions: { groups: [{ type: 'note_completion', qNumberStart: 1, qNumberEnd: 2, questions: [{ number: 1, correctAnswer: 'rats' }, { number: 2, correctAnswer: 'Snakes' }] }] } }
    const { correct, result } = gradePractice('listening', exam, { 1: ' Rats ', 2: 'snake' })
    expect(correct).toBe(1)
    expect(result.sections[0].questions[0].userAnswer).toBe('Rats')
  })

  it('handles an empty exam', () => {
    expect(gradePractice('reading', {}, {})).toMatchObject({ correct: 0, total: 0 })
  })
})
