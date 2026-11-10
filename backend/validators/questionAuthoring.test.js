import { describe, it, expect } from 'vitest'
const { createReadingExamSchema, createListeningExamSchema } = require('./adminExamValidator')
const { gradePractice } = require('../lib/practiceGrading')
const { classifyFamily } = require('../scripts/generate-explanations')

describe('additional authoring task contracts', () => {
  it('retains the correct explanation family for newly exposed tasks', () => {
    expect(classifyFamily('form_completion')).toBe('COMPLETION')
    expect(classifyFamily('categorisation')).toBe('MATCHING')
  })
  for (const type of ['form_completion','summary_completion','flow_chart_completion','sentence_completion','short_answer','matching_endings','categorisation','choose_title','list_selection','matching_headings']) {
    for (const skill of ['reading', 'listening']) {
      it(`${skill} ${type}: preserves the payload required by its renderer`, () => {
        const group = { type, qNumberStart: 1, qNumberEnd: type === 'list_selection' ? 2 : 1, maxChoices: 2,
          instruction: 'Test instruction', questions: [{ number: 1, questionText: 'A prompt', correctAnswer: 'Alpha', options: ['Alpha', 'Beta'] }],
          noteSections: [{ title: 'Details', lines: [{ content: 'Value [Q:1]' }] }], matchingOptions: [{ letter: 'A', text: 'Option A' }],
        }
        const field = skill === 'reading' ? 'passages' : 'sections'
        const schema = skill === 'reading' ? createReadingExamSchema : createListeningExamSchema
        const parsed = schema.parse({ title: 'Test', [field]: [{ number: 1, questionGroups: [group] }] })[field][0].questionGroups[0]
        expect(parsed.type).toBe(type)
        expect(parsed.questions[0].correctAnswer).toBe('Alpha')
        if (['form_completion','summary_completion','flow_chart_completion'].includes(type)) expect(parsed.noteSections[0].lines[0].content).toBe('Value [Q:1]')
        if (['matching_endings','categorisation','matching_headings'].includes(type)) expect(parsed.matchingOptions[0].text).toBe('Option A')
        if (['choose_title','list_selection'].includes(type)) expect(parsed.questions[0].options).toEqual(['Alpha', 'Beta'])
      })
    }
  }
  it('rejects duplicate options for title and list selection', () => {
    for (const type of ['choose_title','list_selection']) expect(createReadingExamSchema.safeParse({ title: 'Test', passages: [{ number: 1, questionGroups: [{ type, qNumberStart: 1, qNumberEnd: 2, questions: [{ number: 1, options: ['same', 'same'] }] }] }] }).success).toBe(false)
  })
  it('grades list selection per slot and completion alternatives', () => {
    const list = { type: 'list_selection', qNumberStart: 1, qNumberEnd: 2, maxChoices: 2, questions: [{ number: 1, options: ['Alpha','Beta','Gamma'], correctAnswer: 'Alpha,Beta' }] }
    expect(gradePractice('reading', { title: 'Test' }, [list], { 1: 'Alpha,Gamma' })).toMatchObject({ correct: 1, total: 2 })
    for (const type of ['form_completion','summary_completion','flow_chart_completion','sentence_completion','short_answer']) expect(gradePractice('listening', { title: 'Test' }, [{ type, questions: [{ number: 1, correctAnswer: 'Alpha/Beta' }] }], { 1: 'beta' }).correct).toBe(1)
  })
})
