import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MCQGroupEditor from './MCQGroupEditor'
import AdditionalTaskEditor from './AdditionalTaskEditor'

function Editor({ initialAnswer = '', maxChoices = 2, themeSource = 'admin', type = 'mcq_multi', changed = () => {}, options = ['Alpha', 'Beta', 'Gamma', 'Delta'] }) {
  const [group, setGroup] = useState({ type, maxChoices, qNumberStart: 1, qNumberEnd: maxChoices,
    questions: [{ number: 1, questionText: 'Choose the correct answers.', options, correctAnswer: initialAnswer }],
  })
  const Component = type === 'list_selection' ? AdditionalTaskEditor : MCQGroupEditor
  return <Component group={group} themeSource={themeSource} onChange={next => { changed(next); setGroup(next) }} />
}

describe('admin multiple-choice selection limit', () => {
  for (const themeSource of ['admin', 'practice']) {
    it(`${themeSource}: selects A and the comma-containing last option E, then can deselect E`, () => {
      const changed = vi.fn()
      const options = ['Scholars do not all agree on how many years he was on the throne', 'Second', 'Third', 'Fourth', 'When his tomb was uncovered, a small number of his belongings still remained']
      render(<Editor themeSource={themeSource} changed={changed} options={options} />)
      const [a, b, , , e] = screen.getAllByRole('checkbox')
      fireEvent.click(a)
      expect(e).toBeEnabled()
      fireEvent.click(e)
      expect(a).toBeChecked()
      expect(e).toBeChecked()
      expect(e).toBeEnabled()
      expect(b).toBeDisabled()
      expect(changed.mock.lastCall[0].questions[0].correctAnswer).toBe(`${options[0]},${options[4]}`)
      fireEvent.click(e)
      expect(e).not.toBeChecked()
      expect(b).toBeEnabled()
    })
    it(`${themeSource}: locks unselected answers at the limit and unlocks after deselection`, () => {
      const changed = vi.fn()
      render(<Editor themeSource={themeSource} changed={changed} />)
      const [a, b, c, d] = screen.getAllByRole('checkbox')
      fireEvent.click(a)
      expect(c).toBeEnabled()
      fireEvent.click(b)
      expect(a).toBeEnabled()
      expect(b).toBeEnabled()
      expect(c).toBeDisabled()
      expect(d).toBeDisabled()
      fireEvent.click(c)
      expect(changed).toHaveBeenCalledTimes(2)
      expect(screen.queryByText(/chọn thừa/)).not.toBeInTheDocument()
      fireEvent.click(a)
      expect(c).toBeEnabled()
      fireEvent.click(c)
      expect(changed.mock.lastCall[0].questions[0].correctAnswer).toBe('Beta,Gamma')
      expect(a).toBeDisabled()
    })
  }
  it('uses the configured limit instead of hardcoding two', () => {
    render(<Editor maxChoices={3} initialAnswer="Alpha,Beta" />)
    const [, , c, d] = screen.getAllByRole('checkbox')
    expect(c).toBeEnabled()
    fireEvent.click(c)
    expect(d).toBeDisabled()
  })
  it('lets an admin repair an existing over-limit answer without selecting more', () => {
    render(<Editor initialAnswer="Alpha,Beta,Gamma" />)
    const [a, , c, d] = screen.getAllByRole('checkbox')
    expect(d).toBeDisabled()
    expect(a).toBeEnabled()
    fireEvent.click(c)
    expect(d).toBeDisabled()
    expect(screen.queryByText(/chọn thừa/)).not.toBeInTheDocument()
    fireEvent.click(a)
    expect(d).toBeEnabled()
  })
  it('applies the same limit to List Selection', () => {
    render(<Editor type="list_selection" initialAnswer="Alpha,Beta" />)
    expect(screen.getAllByRole('checkbox')[2]).toBeDisabled()
  })
})
