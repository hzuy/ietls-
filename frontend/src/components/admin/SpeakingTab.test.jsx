import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SpeakingTab from './SpeakingTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }))
vi.mock('./ExamList', () => ({ default: ({ onEdit }) => <button onClick={() => onEdit(42)}>Edit speaking</button> }))
vi.mock('./ReadingTab', () => ({ SpeakingFormPreview: () => null }))
vi.mock('./adminConstants', async importOriginal => ({
  ...await importOriginal(), useExamSeriesList: () => [], useSeriesBooks: () => [],
}))

const question = (id, questionText) => ({ id, questionText, audioUrl: `/custom-${id}.mp3`, ttsScript: `Custom narration ${id}` })
const exam = {
  id: 42, title: 'Speaking metadata test', seriesId: null, bookNumber: null, testNumber: null,
  speakingParts: [
    { number: 1, cueCard: 'Part 1 instructions', introAudioUrl: '/intro1.mp3', introTtsScript: 'Custom intro one', questions: [question(101, 'First question?'), question(102, 'Second question?')] },
    { number: 2, cueCard: 'Part 2 instructions\n===\nOriginal cue card', introAudioUrl: '/intro2.mp3', introTtsScript: 'Custom intro two', questions: [question(201, 'Follow-up question?')] },
    { number: 3, cueCard: 'Part 3 instructions', introAudioUrl: '/intro3.mp3', introTtsScript: 'Custom intro three', questions: [question(301, '##TOPIC##:Technology'), question(302, 'Discussion question?'), question(303, '##TOPIC##:Future')] },
  ],
}

async function openEditor() {
  render(<SpeakingTab exams={[exam]} onRefresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit speaking' }))
  await waitFor(() => expect(screen.getByDisplayValue(exam.title)).toBeInTheDocument())
}
async function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật đề Speaking' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledOnce())
  return api.put.mock.calls[0][1]
}

describe('Speaking editor round trips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    window.scrollTo = vi.fn()
    api.get.mockResolvedValue({ data: exam })
    api.put.mockResolvedValue({ data: {} })
  })

  it('preserves every part intro, question audio/script and topic header when only renaming an exam', async () => {
    await openEditor()
    fireEvent.change(screen.getByDisplayValue(exam.title), { target: { value: 'Renamed speaking exam' } })
    const payload = await save()
    expect(payload.title).toBe('Renamed speaking exam')
    exam.speakingParts.forEach(part => {
      expect(payload[`part${part.number}`]).toEqual({
        cueCard: part.cueCard, introAudioUrl: part.introAudioUrl, introTtsScript: part.introTtsScript, questions: part.questions,
      })
    })
  })

  it('removes a question without shifting its audio onto another question', async () => {
    await openEditor()
    const row = screen.getByDisplayValue('First question?').parentElement
    fireEvent.click(within(row).getByRole('button', { name: '×' }))
    const payload = await save()
    expect(payload.part1.questions).toEqual([exam.speakingParts[0].questions[1]])
    expect(payload.part3.questions).toEqual(exam.speakingParts[2].questions)
  })

  it('does not silently retain old audio or a custom script after changing question text', async () => {
    await openEditor()
    fireEvent.change(screen.getByDisplayValue('First question?'), { target: { value: 'New first question?' } })
    const payload = await save()
    expect(payload.part1.questions[0]).toEqual({ id: 101, questionText: 'New first question?', audioUrl: null, ttsScript: null })
    expect(payload.part1.questions[1]).toEqual(exam.speakingParts[0].questions[1])
  })
})
