import { describe, expect, it } from 'vitest'
import { paragraphMatchingOptions, syncParagraphGroups } from './readingParagraphs'
import { buildExamPayload, hydrateExamForm } from './examAuthoring'
import { validatePracticeReading, validateExamReading } from './questionValidation'

const group = { id: 8, type: 'matching_information', qNumberStart: 1, qNumberEnd: 1, matchingOptions: [{ letter: 'A', text: 'Outdated duplicate' }], questions: [{ id: 30, number: 1, questionText: 'A statement', correctAnswer: 'B', explanation: { steps: ['Keep'] } }] }
const passage = 'First line\r\nwrapped line\r\n \r\nSecond paragraph'

describe('source paragraph matching choices', () => {
  it('derives letters from paragraphs rather than wrapped lines and accepts API option shapes', () => {
    expect(paragraphMatchingOptions(passage, [{ id: 9, optionLetter: 'B', optionText: 'Old' }])).toEqual([{ letter: 'A', text: '' }, { id: 9, letter: 'B', text: '' }])
    expect(paragraphMatchingOptions('')).toEqual([])
  })
  it('updates choices without deleting questions, answers, IDs or explanations', () => {
    const [next] = syncParagraphGroups([group], passage, true)
    expect(next.matchingOptions.map(o => o.letter)).toEqual(['A', 'B'])
    expect(next.questions).toBe(group.questions)
    expect(syncParagraphGroups([next], 'Only one paragraph', true)[0].questions[0]).toEqual(group.questions[0])
    expect(group.matchingOptions[0].text).toBe('Outdated duplicate')
    expect(syncParagraphGroups([next], passage, true)[0]).toBe(next)
  })
  it('preserves manual matching types and disabled paragraph mode', () => {
    const manual = { ...group, type: 'matching_drag' }
    expect(syncParagraphGroups([manual], passage, true)[0]).toBe(manual)
    const groups = [group]
    expect(syncParagraphGroups(groups, passage, false)).toBe(groups)
  })
  it('synchronizes exam payload and hydration while keeping persisted question IDs', () => {
    const form = { title: 'Test', passages: [{ number: 1, title: 'Source', body: passage, letteredParagraphs: true, questionGroups: [group] }] }
    const payload = buildExamPayload(form, 'reading')
    expect(payload.passages[0].questionGroups[0].matchingOptions.map(o => o.letter)).toEqual(['A', 'B'])
    expect(payload.passages[0].questionGroups[0].questions[0].id).toBe(30)
    const loaded = hydrateExamForm(form, 'reading', form)
    expect(loaded.passages[0].questionGroups[0].matchingOptions.map(o => o.letter)).toEqual(['A', 'B'])
  })
  it('rejects removed paragraph answers in exam and practice without altering them', () => {
    const practice = { title: 'Practice', passage: 'One paragraph', questionGroups: [group] }
    expect(validatePracticeReading(practice).errors).toContain('Câu 1: đoạn B không còn trong bài đọc')
    const exam = { title: 'Exam', passages: [{ title: 'P1', body: 'One paragraph', questionGroups: [group] }] }
    expect(validateExamReading(exam).errors).toContain('Câu 1: đoạn B không còn trong bài đọc')
    expect(group.questions[0].correctAnswer).toBe('B')
    expect(validatePracticeReading({ ...practice, passage }).isValid).toBe(true)
  })
})
