import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { recalcGroups } from './practiceConfig'
import { recalcAllGroupNumbers, recalcAllListeningNumbers } from '../components/admin/adminConstants'
import NoteCompletionEditor from '../components/admin/editors/NoteCompletionEditor'
import TableCompletionEditor from '../components/admin/editors/TableCompletionEditor'

const normalizers = [
  ['practice', recalcGroups],
  ['reading exam', groups => recalcAllGroupNumbers([{ questionGroups: groups }])[0].questionGroups],
  ['listening exam', groups => recalcAllListeningNumbers([{ questionGroups: groups }])[0].questionGroups],
]

describe.each(normalizers)('%s question numbering', (_, normalize) => {
  it('closes deleted-number gaps and counts every multi-choice answer slot', () => {
    const groups = [
      { type: 'mcq_multi', maxChoices: 2, questions: [{ id: 2, number: 3, correctAnswer: 'A,C' }] },
      { type: 'true_false_ng', questions: [{ id: 3, number: 8, correctAnswer: 'TRUE' }, { id: 4, number: 10, correctAnswer: 'FALSE' }] },
    ]
    const result = normalize(groups)
    expect(result.map(g => [g.qNumberStart, g.qNumberEnd])).toEqual([[1, 2], [3, 4]])
    expect(result[1].questions.map(q => q.number)).toEqual([3, 4])
    expect(groups[0].questions[0].number).toBe(3)
  })

  it('does not reserve a number for an emptied group', () => {
    const result = normalize([
      { type: 'mcq', questions: [] },
      { type: 'mcq', questions: [{ id: 2, number: 7, correctAnswer: 'B' }] },
    ])
    expect(result[1].questions).toEqual([{ id: 2, number: 1, correctAnswer: 'B' }])
  })

  it('reserves slots for pasted tokens before numbering the next group', () => {
    const result = normalize([
      { type: 'note_completion', questions: [], noteSections: [{ lines: [{ content: '[Q:8] [Q:9]' }] }] },
      { type: 'mcq', questions: [{ number: 12 }] },
    ])
    expect(result[0].qNumberEnd).toBe(2)
    expect(result[1].questions[0].number).toBe(3)
  })

  it('keeps answers and explanations attached when token order changes', () => {
    const result = normalize([{
      type: 'note_completion',
      questions: [{ id: 1, number: 4, correctAnswer: 'first' }, { id: 2, number: 9, correctAnswer: 'second' }],
      explanations: { 4: { text: 'first explanation' }, 9: { text: 'second explanation' }, 10: { text: 'deleted' } },
      noteSections: [{ lines: [{ content: '[Q:9] then [Q:4]' }] }],
    }])[0]
    expect(result.questions.map(q => [q.id, q.number, q.correctAnswer])).toEqual([[2, 1, 'second'], [1, 2, 'first']])
    expect(result.explanations).toEqual({ 1: { text: 'second explanation' }, 2: { text: 'first explanation' } })
    expect(normalize([result])).toEqual([result])
  })

  it.each([
    ['note_completion', NoteCompletionEditor],
    ['table_completion', TableCompletionEditor],
  ])('does not resurrect deleted %s tokens after delete and re-add', (type, Editor) => {
    const onChange = vi.fn()
    const group = {
      type, qNumberStart: 1, qNumberEnd: 2,
      questions: [{ number: 1, correctAnswer: 'deleted' }, { id: 2, number: 2, correctAnswer: 'kept' }],
      noteSections: [{ lines: [
        ...(type === 'table_completion' ? [{ content: 'A|B', lineType: 'heading' }] : []),
        { content: '[Q:1] [Q:2]', contentWithTokens: '[Q:1] [Q:2]', lineType: 'content' },
      ] }],
    }
    const view = render(<Editor group={group} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('[Q:1] [Q:2]'), { target: { value: '[Q:2]' } })
    const updated = normalize([onChange.mock.calls.at(-1)[0]])[0]
    expect(updated.questions).toEqual([{ id: 2, number: 1, correctAnswer: 'kept' }])
    const content = type === 'table_completion' ? '[Q:1]|' : '[Q:1]'
    expect(updated.noteSections[0].lines.at(-1)).toMatchObject({ content, contentWithTokens: content })
    view.rerender(<Editor group={updated} onChange={onChange} />)
    const field = screen.getByDisplayValue('[Q:1]')
    field.focus()
    field.setSelectionRange(0, 0)
    fireEvent.click(screen.getAllByRole('button').find(button => button.textContent.includes('trống')))
    const readded = normalize([onChange.mock.calls.at(-1)[0]])[0]
    expect(readded.questions.map(q => q.number)).toEqual([1, 2])
    expect(readded.questions[1]).toMatchObject({ id: 2, correctAnswer: 'kept' })
    cleanup()
  })
})
