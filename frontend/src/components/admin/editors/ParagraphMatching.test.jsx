import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MatchingEditor from './MatchingEditor'
import ReadingGroupEditor from './ReadingGroupEditor'
import AdditionalTaskEditor from './AdditionalTaskEditor'
import PracticeGroupCard from '../PracticeGroupCard'

const initial = { id: 8, type: 'matching_information', qNumberStart: 4, qNumberEnd: 4, instruction: 'Find the paragraph', matchingOptions: [{ letter: 'A', text: 'Old source copy' }], questions: [{ id: 30, number: 4, questionText: 'A description', correctAnswer: 'B' }] }
const source = 'First paragraph\nwrapped line\n\nSecond paragraph\n\nThird paragraph'

function Harness({ renderEditor, onChange = () => {} }) {
  const [group, setGroup] = useState(initial)
  return renderEditor(group, next => { setGroup(next); onChange(next) })
}

describe('Matching Information follows marked source paragraphs', () => {
  it('updates available paragraphs after edits without copying prose or silently clearing stale answers', () => {
    const change = vi.fn()
    const props = { group: initial, onChange: change, letteredParagraphs: true }
    const { rerender } = render(<MatchingEditor {...props} passage={source} />)
    expect(screen.getByLabelText('Danh sách đoạn văn').textContent).toBe('Đoạn AĐoạn BĐoạn C')
    expect(screen.queryByDisplayValue('Old source copy')).toBeNull()
    expect(screen.queryByText('+ Thêm lựa chọn')).toBeNull()
    expect(screen.getByRole('button', { name: 'Đáp án' })).toHaveTextContent('Đoạn B')
    rerender(<MatchingEditor {...props} passage="Only one paragraph" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Đoạn B không còn')
    expect(screen.getByRole('button', { name: 'Đáp án' })).toHaveTextContent('Đoạn B — không còn tồn tại')
    expect(change).not.toHaveBeenCalled()
  })
  for (const context of ['exam', 'practice']) {
    it(`connects source-based choices through the Reading ${context} wrapper and preserves question identity on selection`, () => {
      const change = vi.fn()
      render(<Harness onChange={change} renderEditor={(group, onChange) => context === 'exam'
        ? <ReadingGroupEditor group={group} onChange={onChange} passage={source} letteredParagraphs />
        : <PracticeGroupCard skill="reading" group={group} onChange={onChange} passage={source} letteredParagraphs />} />)
      fireEvent.click(screen.getByRole('button', { name: 'Đáp án' }))
      fireEvent.click(screen.getByRole('option', { name: 'Đoạn C' }))
      expect(change.mock.lastCall[0].questions[0]).toMatchObject({ id: 30, number: 4, correctAnswer: 'C' })
      expect(change.mock.lastCall[0].matchingOptions.map(o => o.letter)).toEqual(['A', 'B', 'C'])
    })
  }
  it('retains legacy choices when paragraph marking is disabled and explains how to enable source mode', () => {
    render(<MatchingEditor group={initial} onChange={vi.fn()} passage="" />)
    expect(screen.getByText(/Bật “Đoạn văn có ký hiệu/)).toBeInTheDocument()
    expect(screen.getByLabelText('Danh sách đoạn văn')).toHaveTextContent('Đoạn A')
  })
})

describe('Matching editors use consistent lettered choices', () => {
  it('adds a unique choice when an unresolved legacy answer reserves a letter', () => {
    const initial = { type: 'matching_drag', qNumberStart: 4, qNumberEnd: 5,
      matchingOptions: [{ letter: 'A', text: 'First' }, { letter: 'C', text: 'Third' }],
      questions: [{ id: 30, number: 4, questionText: 'Valid', correctAnswer: 'C' }, { id: 31, number: 5, questionText: 'Orphan', correctAnswer: 'B' }] }
    const change = vi.fn()
    function Editor() {
      const [group, setGroup] = useState(initial)
      return <MatchingEditor group={group} onChange={next => { setGroup(next); change(next) }} />
    }
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm lựa chọn' }))
    fireEvent.change(screen.getByLabelText('Nội dung lựa chọn D'), { target: { value: 'New option' } })
    const next = change.mock.lastCall[0]
    expect(next.matchingOptions).toEqual([{ letter: 'A', text: 'First' }, { letter: 'C', text: 'Third' }, { letter: 'D', text: 'New option' }])
    expect(next.questions.map(question => question.correctAnswer)).toEqual(['C', 'B'])
    expect(next.questions.map(question => question.id)).toEqual([30, 31])
  })
  it('relabels choices after deletion and preserves the surviving answer instead of assigning another option', () => {
    const group = { ...initial, type: 'matching_drag', matchingOptions: ['First', 'Second', 'Third'].map((text, i) => ({ letter: String.fromCharCode(65 + i), text })), questions: [{ id: 30, number: 4, questionText: 'A statement', correctAnswer: 'C' }] }
    const onChange = vi.fn()
    render(<MatchingEditor group={group} onChange={onChange} />)
    expect(screen.getByLabelText('Ký hiệu lựa chọn A').tagName).toBe('SPAN')
    fireEvent.click(screen.getByLabelText('Xóa lựa chọn A'))
    expect(onChange.mock.lastCall[0].matchingOptions).toEqual([{ letter: 'A', text: 'Second' }, { letter: 'B', text: 'Third' }])
    expect(onChange.mock.lastCall[0].questions[0]).toMatchObject({ id: 30, correctAnswer: 'B' })
  })
})

describe('Listening headings do not depend on hidden transcript paragraphs', () => {
  for (const context of ['exam', 'practice']) {
    it(`allows adding targets and selecting headings in Listening ${context}`, () => {
      const headingGroup = { ...initial, type: 'matching_headings', questions: [], matchingOptions: [{ letter: 'i', text: 'Travel plans' }, { letter: 'ii', text: 'Work arrangements' }] }
      const change = vi.fn()
      function Editor() {
        const [group, setGroup] = useState(headingGroup)
        const props = { group, onChange: next => { setGroup(next); change(next) }, passage: 'Hidden transcript\n\nAnother speaker' }
        return context === 'exam' ? <AdditionalTaskEditor {...props} sourceMode="manual" /> : <PracticeGroupCard {...props} skill="listening" />
      }
      render(<Editor />)
      expect(screen.queryByText('Hidden transcript')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '+ Thêm đoạn hoặc đối tượng' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Nội dung mục A' }), { target: { value: 'Speaker one' } })
      fireEvent.click(screen.getByRole('button', { name: 'Heading đúng cho mục A' }))
      fireEvent.click(screen.getByRole('option', { name: 'ii — Work arrangements' }))
      expect(change.mock.lastCall[0].questions).toEqual([{ number: 4, questionText: 'A|Speaker one', correctAnswer: 'ii' }])
      fireEvent.click(screen.getByLabelText('Xóa mục A'))
      expect(change.mock.lastCall[0].questions).toEqual([])
    })
  }
})
