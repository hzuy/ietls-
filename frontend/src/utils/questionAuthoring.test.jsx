import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { READING_GROUP_TYPES, LISTENING_GROUP_TYPES, TEXT_COMPLETION_TYPES, questionMechanic } from './questionTypes'
import { emptyReadingGroupOf, emptyGroupOf, READING_GROUP_TYPES as testReading, GROUP_TYPES, recalcAllGroupNumbers } from '../components/admin/adminConstants'
import { emptyReadingGroupOf as practiceReading, emptyListeningGroupOf, READING_GROUP_TYPES as practiceTypes, LISTENING_GROUP_TYPES as practiceListening, recalcGroups } from './practiceConfig'
import { getGroupSlots } from './questionCount'
import { gradePractice } from './practiceGrading'
import { toLearnerGroup } from './questionTypes'
import AdditionalTaskEditor from '../components/admin/editors/AdditionalTaskEditor'
import AdminGroupPreview from '../components/practice/AdminGroupPreview'
import ListeningContentPreview from '../components/practice/ListeningContentPreview'
import ReadingGroup from '../components/exam/GroupBlock'
import { GroupBlock as ListeningGroup } from '../components/exam/listening/OtherGroups'
import ReadingPracticeGroup from '../components/practice/ReadingPracticeGroupBlock'
import ListeningPracticeGroup from '../components/practice/ListeningPracticeGroupBlock'
import { buildPracticeReviewExam } from './practiceReview'

const sample = (factory, type) => {
  const group = factory(type)
  const multi = ['mcq_multi', 'list_selection'].includes(type)
  const answer = multi ? 'Alpha,Beta' : ['matching_information', 'matching', 'map_diagram', 'matching_drag', 'matching_endings', 'categorisation', 'drag_word_bank'].includes(type) ? 'A' : type === 'matching_headings' ? 'i' : type === 'true_false_ng' ? 'TRUE' : type === 'yes_no_ng' ? 'YES' : 'Alpha'
  return { ...group, qNumberEnd: multi ? 2 : 1, imageUrl: type === 'diagram_label' || type === 'map_diagram' ? '/image.png' : '',
    noteSections: group.noteSections.map(s => ({ ...s, lines: type === 'table_completion' ? [{ lineType: 'heading', content: 'Name|Answer' }, { content: 'Item|[Q:1]' }] : [{ content: 'Detail [Q:1]' }] })),
    questions: [{ number: 1, questionText: type === 'matching_headings' ? 'A|Paragraph A' : 'Question prompt', hint: 'Label hint', options: ['Alpha', 'Beta', 'Gamma'], correctAnswer: answer }],
  }
}

describe('shared authoring catalog and answer contracts', () => {
  it('uses identical catalogs for Test and Practice', () => {
    expect(testReading).toBe(READING_GROUP_TYPES)
    expect(practiceTypes).toBe(READING_GROUP_TYPES)
    expect(GROUP_TYPES).toBe(LISTENING_GROUP_TYPES)
    expect(practiceListening).toBe(LISTENING_GROUP_TYPES)
    expect(READING_GROUP_TYPES.map(t => t.value)).toEqual(expect.arrayContaining(['matching_headings','matching_information','matching_drag','matching_endings','sentence_completion','summary_completion','flow_chart_completion','short_answer','list_selection','choose_title','categorisation']))
    expect(LISTENING_GROUP_TYPES.map(t => t.value)).toEqual(expect.arrayContaining(['form_completion','note_completion','table_completion','flow_chart_completion','summary_completion','sentence_completion','short_answer','map_diagram']))
  })
  for (const [skill, factory, types] of [['reading', emptyReadingGroupOf, READING_GROUP_TYPES], ['listening', emptyGroupOf, LISTENING_GROUP_TYPES]]) {
    for (const { value: type } of types) {
      it(`${skill} ${type}: initializes instructions and renders controls in both previews`, () => {
        const group = sample(factory, type)
        expect(group.instruction).toBeTruthy()
        for (const practice of [false, true]) {
          const { container, unmount } = render(<AdminGroupPreview group={group} skill={skill} practice={practice} showAnswers />)
          expect(container.querySelector('input, select, button, [draggable], table')).toBeTruthy()
          expect(container.querySelector('fieldset')).toBeDisabled()
          unmount()
        }
      })
    }
  }
  it('renumbers List Selection slots before token completion and preserves explanations', () => {
    const list = sample(emptyReadingGroupOf, 'list_selection')
    const text = { ...sample(emptyReadingGroupOf, 'summary_completion'), explanations: { 1: { reasoning: 'Keep me' } } }
    const groups = recalcAllGroupNumbers([{ questionGroups: [list, text] }])[0].questionGroups
    expect(groups[1].questions[0].number).toBe(3)
    expect(groups[1].noteSections[0].lines[0].content).toBe('Detail [Q:3]')
    expect(groups[1].explanations[3].reasoning).toBe('Keep me')
    expect(getGroupSlots(toLearnerGroup(groups[0]))).toHaveLength(2)
    expect(getGroupSlots(toLearnerGroup(groups[0]))[1].qId).toBe(1)
    expect(recalcGroups([list, text])[1].qNumberStart).toBe(3)
  })
  it('scores each selected answer and slash alternatives for all free text types', () => {
    const list = sample(practiceReading, 'list_selection')
    const result = gradePractice('reading', { questions: { groups: [list] } }, { 1: 'Alpha,Gamma' })
    expect(result.correct).toBe(1)
    for (const type of [...TEXT_COMPLETION_TYPES, 'short_answer', 'sentence_completion']) {
      const group = { ...sample(emptyListeningGroupOf, type), questions: [{ number: 1, correctAnswer: 'Alpha/Beta' }] }
      expect(gradePractice('listening', { questions: { groups: [group] } }, { 1: 'beta' }).correct).toBe(1)
    }
  })
  it('preserves explicit task type after editing mechanics', () => {
    const change = vi.fn()
    render(<AdditionalTaskEditor group={sample(emptyReadingGroupOf, 'sentence_completion')} onChange={change} />)
    fireEvent.change(screen.getByLabelText(/Nội dung câu hỏi/), { target: { value: 'Updated prompt' } })
    expect(change.mock.calls[0][0]).toMatchObject({ type: 'sentence_completion', questions: [{ questionText: 'Updated prompt' }] })
    expect(questionMechanic('list_selection')).toBe('mcq_multi')
  })
  it('normalizes sentence and title questions when opening practice history', () => {
    const groups = ['sentence_completion', 'choose_title'].map(type => sample(practiceReading, type))
    const result = buildPracticeReviewExam({ questions: { groups } }, 'reading')
    expect(result.passages[0].questionGroups.map(g => g.questions[0].type)).toEqual(['short_answer', 'mcq'])
    expect(result.passages[0].questionGroups.map(g => g.type)).toEqual(['sentence_completion', 'choose_title'])
  })
  it('hides the transcript in the Listening learner preview', () => {
    cleanup()
    render(<ListeningContentPreview section={{ number: 1, transcript: 'SECRET ANSWER IN TRANSCRIPT', questionGroups: [] }} />)
    expect(screen.queryByText('SECRET ANSWER IN TRANSCRIPT')).not.toBeInTheDocument()
  })
  for (const [Component, numberKeys] of [[ReadingGroup, false], [ListeningGroup, false], [ReadingPracticeGroup, false], [ListeningPracticeGroup, true]]) {
    for (const type of ['summary_completion', 'short_answer']) {
      it(`${Component.name || 'memoized renderer'} ${type}: keeps learner answer keys`, () => {
        const answer = vi.fn()
        const group = toLearnerGroup(sample(emptyReadingGroupOf, type))
        group.questions[0].id = 501
        const { unmount } = render(<Component group={group} answers={{}} onAnswer={answer} globalOffset={0} />)
        fireEvent.change(screen.getByRole('textbox', { name: 'Answer 1' }), { target: { value: 'London' } })
        expect(answer).toHaveBeenCalledWith(numberKeys ? 1 : 501, 'London')
        unmount()
      })
    }
  }
})
