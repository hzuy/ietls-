import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReadingTab from './ReadingTab'
import ListeningTab from './ListeningTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }))
vi.mock('../../hooks/useExplanationGenerationLock', () => ({ useExplanationGenerationLock: () => ({ isLockedOperation: false, isLockedGenerate: false }) }))
vi.mock('../../hooks/useAIExitGuard', () => ({ useAIExitGuard: () => {} }))
vi.mock('./ExamList', () => ({ default: ({ onEdit }) => <><button type="button" onClick={() => onEdit(10)}>Open exam</button><button type="button" onClick={() => onEdit(11)}>Open second exam</button></> }))

const exam = skill => ({ id: 10, title: 'Saved exam', [skill === 'reading' ? 'passages' : 'listeningSections']: [{ id: 100, number: 1, title: 'Passage', body: 'A passage body', context: '', audioUrl: '/audio.mp3', transcript: 'Audio transcript', questionGroups: [{ id: 200, type: 'mcq', qNumberStart: 1, qNumberEnd: 1, instruction: 'Choose one', questions: [{ id: 300, number: 1, questionText: 'Original question', options: ['Alpha', 'Beta'], correctAnswer: 'Alpha' }], noteSections: [], matchingOptions: [] }] }] })
const response = (skill, payload) => ({ data: { ...payload, id: 10, [skill === 'reading' ? 'passages' : 'listeningSections']: payload[skill === 'reading' ? 'passages' : 'sections'].map(p => ({ ...p, id: p.id || 100, questionGroups: p.questionGroups.map((g, i) => ({ ...g, id: g.id || 201 + i, questions: g.questions.map((q, j) => ({ ...q, id: q.id || 301 + j, options: JSON.stringify(q.options) })) })) })) } })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.alert = vi.fn()
  window.confirm = vi.fn(() => true)
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

for (const skill of ['reading', 'listening']) {
  const Component = skill === 'reading' ? ReadingTab : ListeningTab
  const key = skill === 'reading' ? 'passages' : 'sections'
  const submitName = skill === 'reading' ? 'Cập nhật đề Reading' : 'Cập nhật đề Listening'
  it(`${skill}: saves a new group once, adopts server IDs, then saves subsequent edits by ID`, async () => {
    api.get.mockImplementation(url => Promise.resolve({ data: url === '/admin/exams/10' ? exam(skill) : [] }))
    let finish
    api.put.mockImplementation((url, payload) => Promise.resolve(response(skill, payload)))
    api.put.mockImplementationOnce((url, payload) => new Promise(resolve => { finish = () => resolve(response(skill, payload)) }))
    render(<Component exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open exam', exact: true }))
    await screen.findByDisplayValue('Saved exam')
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm nhóm câu hỏi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Short-answer Questions', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm câu hỏi', exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: /Nội dung câu hỏi/ }), { target: { value: 'New short question' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Đáp án đúng', exact: true }), { target: { value: 'answer' } })
    const save = screen.getByRole('button', { name: submitName })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(api.put).toHaveBeenCalledOnce())
    expect(screen.getByDisplayValue('Saved exam')).toBeDisabled()
    const first = api.put.mock.calls[0][1][key][0].questionGroups
    expect(first[1]).toMatchObject({ isNew: true })
    expect(first[1].id).toBeUndefined()
    finish()
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.change(screen.getByDisplayValue('Saved exam'), { target: { value: 'Edited after save' } })
    fireEvent.click(save)
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
    const second = api.put.mock.calls[1][1][key][0].questionGroups
    expect(second[1].id).toBe(202)
    expect(second[1].isNew).toBeUndefined()
    expect(second[1].questions[0].id).toBe(301)
  })

  it(`${skill}: failed save retains edits and allows retry`, async () => {
    api.get.mockImplementation(url => Promise.resolve({ data: url === '/admin/exams/10' ? exam(skill) : [] }))
    api.put.mockImplementation((url, payload) => Promise.resolve(response(skill, payload)))
    api.put.mockRejectedValueOnce({ response: { data: { message: 'Save rejected' } } })
    render(<Component exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open exam', exact: true }))
    const title = await screen.findByDisplayValue('Saved exam')
    fireEvent.change(title, { target: { value: 'Keep my edits' } })
    fireEvent.click(screen.getByRole('button', { name: submitName }))
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Save rejected'))
    expect(title).toHaveValue('Keep my edits')
    expect(title).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: submitName }))
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
  })

  it(`${skill}: a slow older load cannot replace the most recently opened exam`, async () => {
    let resolveFirst
    api.get.mockImplementation(url => {
      if (url === '/admin/exams/10') return new Promise(resolve => { resolveFirst = resolve })
      if (url === '/admin/exams/11') return Promise.resolve({ data: { ...exam(skill), id: 11, title: 'Most recent exam' } })
      return Promise.resolve({ data: [] })
    })
    render(<Component exams={[]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open exam', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Open second exam', exact: true }))
    await screen.findByDisplayValue('Most recent exam')
    resolveFirst({ data: exam(skill) })
    await waitFor(() => expect(screen.getByDisplayValue('Most recent exam')).toBeEnabled())
    expect(screen.queryByDisplayValue('Saved exam')).not.toBeInTheDocument()
  })
}
