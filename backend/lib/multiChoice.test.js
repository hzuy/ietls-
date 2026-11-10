import { describe, it, expect } from 'vitest'
const { scoreMultiChoice } = require('./multiChoice')
describe('multiple-choice score integrity', () => {
  it('scores the Djoser A/E answers as two options even though E contains a comma', () => {
    const options = ['Scholars do not all agree on how many years he was on the throne', 'Second', 'Third', 'Fourth', 'When his tomb was uncovered, a small number of his belongings still remained']
    const expected = `${options[0]},${options[4]}`
    expect(scoreMultiChoice(expected, expected, 2, JSON.stringify(options))).toMatchObject({ correct: 2, total: 2 })
    expect(scoreMultiChoice(options[4], expected, 2, options)).toMatchObject({ correct: 1, total: 2 })
    expect(() => scoreMultiChoice(`${expected},Second`, expected, 2, options)).toThrow()
  })
  it.each(['A,B', 'B,A', ' a, A, b ', 'A,A,A,B'])('counts distinct correct slots for %s', input => {
    expect(scoreMultiChoice(input, 'A,B', 2, ['A','B','C'])).toMatchObject({ correct: 2, total: 2 })
  })
  it('accepts partial credit and blank without awarding empty answer keys', () => {
    expect(scoreMultiChoice('A', 'A,B', 2).correct).toBe(1)
    expect(scoreMultiChoice('', '', 2).correct).toBe(0)
  })
  it.each(['A,B,C', 'Z'])('rejects invalid picks %s before storage', value => {
    expect(() => scoreMultiChoice(value,'A,B',2,['A','B','C'])).toThrow()
  })
  it.each([[], {}, 123, null])('rejects nonstring values', value => {
    expect(() => scoreMultiChoice(value,'A,B',2)).toThrow()
  })
  it('keeps legacy letter keys with text options, and practice text keys', () => {
    expect(scoreMultiChoice('B,A','A,B',2,['Red','Blue','Green']).correct).toBe(2)
    expect(scoreMultiChoice('red,blue','Red,Blue',2,['Red','Blue','Green']).correct).toBe(2)
    expect(() => scoreMultiChoice('A','Red,Blue',2,['Red','Blue'])).toThrow()
  })
})
