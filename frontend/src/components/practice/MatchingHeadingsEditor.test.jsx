import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MatchingHeadingsEditor from './MatchingHeadingsEditor'
import { validateHeadingSource } from '../../utils/questionValidation'
import { buildExamPayload, hydrateExamForm } from '../../utils/examAuthoring'
import { readingParagraphs, practiceParagraphLetters, needsParagraphLetters } from '../../utils/readingParagraphs'

const initial = { id: 7, type: 'matching_headings', qNumberStart: 4, qNumberEnd: 4,
  matchingOptions: [{ letter: 'i', text: 'First heading' }, { letter: 'ii', text: 'Second heading' }, { letter: 'iii', text: 'Third heading' }],
  questions: [{ id: 20, number: 4, questionText: 'B|Old duplicated text', correctAnswer: 'iii' }] }
function Harness({ onChange, passage = 'First paragraph\n\nSecond paragraph\n\nThird paragraph', letteredParagraphs = true }) {
  const [group, setGroup] = useState(initial)
  return <MatchingHeadingsEditor group={group} passage={passage} letteredParagraphs={letteredParagraphs} onChange={g => { setGroup(g); onChange(g) }} />
}
describe('Matching headings from source passage', () => {
  it('keeps explanation ownership when removing a middle manual target', () => {
    const group = { ...initial, questions: [
      { id: 10, number: 4, questionText: 'A|First', correctAnswer: 'i' },
      { id: 20, number: 5, questionText: 'B|Second', correctAnswer: 'ii' },
      { id: 30, number: 6, questionText: 'C|Third', correctAnswer: 'iii' },
    ], explanations: { 4: { marker: 'first' }, 5: { marker: 'second' }, 6: { marker: 'third' } } }
    const onChange = vi.fn()
    render(<MatchingHeadingsEditor group={group} onChange={onChange} sourceMode="manual" />)
    fireEvent.click(screen.getByLabelText('Xóa mục B'))
    const next = onChange.mock.lastCall[0]
    expect(next.questions.map(q => [q.id, q.number])).toEqual([[10, 4], [30, 5]])
    expect(next.explanations).toEqual({ 4: { marker: 'first' }, 5: { marker: 'third' } })
  })
  it('preserves an explicit Practice toggle and counts CRLF paragraphs consistently', () => {
    expect(readingParagraphs('First\r\nwrapped\r\n \r\nSecond\r\nwrapped')).toEqual(['First\nwrapped', 'Second\nwrapped'])
    expect(practiceParagraphLetters([{ type: 'matching_headings', letteredParagraphs: false }])).toBe(false)
    expect(practiceParagraphLetters([{ type: 'matching_headings', letteredParagraphs: true }])).toBe(true)
    expect(practiceParagraphLetters([{ type: 'matching_headings' }])).toBe(true)
    for (const type of ['matching_headings', 'matching_information', 'matching_paragraph']) expect(needsParagraphLetters(type)).toBe(true)
    expect(needsParagraphLetters('matching_drag')).toBe(false)
  })
  it('hides mappings until letters are enabled and counts paragraphs instead of wrapped lines', () => {
    const props = { onChange: vi.fn(), passage: 'First line\nwrapped line\n\nSecond paragraph\nwrapped line' }
    const { rerender } = render(<Harness {...props} letteredParagraphs={false} />)
    expect(screen.queryByRole('button', { name: /Heading đúng cho đoạn/ })).toBeNull()
    rerender(<Harness {...props} letteredParagraphs />)
    expect(screen.getAllByRole('button', { name: /Heading đúng cho đoạn/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Heading đúng cho đoạn C' })).toBeNull()
  })
  it('shows compact mappings without duplicated source text or checkboxes and preserves question IDs', async () => {
    const change = vi.fn()
    render(<Harness onChange={change} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
    expect(screen.queryByDisplayValue('Old duplicated text')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('First paragraph')).toBeNull()
    expect(screen.queryByText(/Tích các đoạn cần hỏi/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Heading đúng cho đoạn A' }))
    fireEvent.click(await screen.findByRole('option', { name: 'i — First heading' }))
    const next = change.mock.lastCall[0]
    expect(next.questions).toEqual([{ number: 4, questionText: 'A|', correctAnswer: 'i' }, expect.objectContaining({ id: 20, number: 5, correctAnswer: 'iii' })])
    expect(next.qNumberEnd).toBe(5)
    fireEvent.click(screen.getByRole('button', { name: 'Heading đúng cho đoạn A' }))
    fireEvent.click(await screen.findByRole('option', { name: '-- Không hỏi đoạn này --' }))
    expect(change.mock.lastCall[0].questions[0]).toMatchObject({ id: 20, number: 4 })
  })
  it('reindexes headings and remaps answers when removing an earlier heading', () => {
    const change = vi.fn()
    render(<Harness onChange={change} />)
    fireEvent.click(screen.getByLabelText('Xóa heading i'))
    expect(change.mock.lastCall[0].matchingOptions.map(h => h.letter)).toEqual(['i', 'ii'])
    expect(change.mock.lastCall[0].questions[0]).toMatchObject({ id: 20, correctAnswer: 'ii' })
    fireEvent.click(screen.getByLabelText('Xóa heading ii'))
    expect(change.mock.lastCall[0].questions[0].correctAnswer).toBe('')
    fireEvent.click(screen.getByText('+ Thêm heading'))
    expect(change.mock.lastCall[0].matchingOptions.map(h => h.letter)).toEqual(['i', 'ii'])
  })
  it('keeps removed source references visible until explicitly removed and blocks invalid saving', () => {
    const change = vi.fn()
    render(<Harness passage="Only paragraph" onChange={change} />)
    expect(validateHeadingSource(initial, 'Only paragraph')).toHaveLength(1)
    fireEvent.click(screen.getByText('Bỏ câu 4'))
    expect(change.mock.lastCall[0].questions).toEqual([])
  })
  it('roundtrips selected paragraph keys, headings and persisted question IDs', () => {
    const form = { title: 'Test', passages: [{ number: 1, title: 'Source', body: 'First\n\nSecond', questionGroups: [initial] }] }
    const payload = buildExamPayload(form, 'reading')
    expect(payload.passages[0].letteredParagraphs).toBe(false)
    expect(buildExamPayload({ ...form, passages: [{ ...form.passages[0], letteredParagraphs: true }] }, 'reading').passages[0].letteredParagraphs).toBe(true)
    const loaded = hydrateExamForm(payload, 'reading', form)
    expect(loaded.passages[0].questionGroups[0].questions[0]).toMatchObject({ id: 20, questionText: 'B|Old duplicated text', correctAnswer: 'iii' })
    expect(validateHeadingSource(initial, form.passages[0].body)).toEqual([])
    expect(validateHeadingSource({ ...initial, type: 'matching_information' }, '')).toEqual([])
  })
})
