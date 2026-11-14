import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import QuestionExplanationModal from './QuestionExplanationModal'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({ default: { put: vi.fn(), post: vi.fn() } }))
const question = { id: 101, number: 1, type: 'fill_blank', correctAnswer: 'one' }
const published = { v: 2, status: 'teacher_reviewed', answer: 'one', reasoning: 'Previously published explanation' }
const draft = { v: 2, workflowVersion: 3, status: 'draft_ready', answer: 'one', reasoning: 'New draft explanation',
  hasDraft: true, draftVersion: 'draft-1', sourceHash: 'source-1', publishedExplanation: published }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {}).mockClear()
})

describe.each(['reading', 'listening'])('%s shared draft workflow', skill => {
  it.each([false, true])('saves a versioned draft then explicitly publishes it (practice: %s)', async isPractice => {
    const saved = { ...draft, reasoning: 'Teacher saved draft', draftVersion: 'draft-2' }
    const used = { ...saved, status: 'published', hasDraft: false, draftVersion: null, publishedExplanation: null }
    api.put.mockResolvedValue({ data: { explanation: saved } })
    api.post.mockResolvedValue({ data: { explanation: used } })
    const updated = vi.fn()
    render(<QuestionExplanationModal isOpen onClose={vi.fn()} examId={10} isPractice={isPractice} skill={skill}
      question={question} initialExplanation={draft} onExplanationUpdated={updated} />)
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đang sử dụng' }))
    expect(screen.getByText(published.reasoning)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sử dụng lời giải' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bản nháp' }))
    expect(screen.getByText(draft.reasoning)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Sửa trực tiếp' }))
    fireEvent.change(screen.getByPlaceholderText(/Lập luận vì sao đáp án này đúng/), { target: { value: saved.reasoning } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    expect(api.put.mock.calls[0][1]).toMatchObject({ expectedDraftVersion: 'draft-1', expectedSourceHash: 'source-1', reasoning: saved.reasoning })
    await screen.findByText(saved.reasoning)
    expect(api.post).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledExactlyOnceWith('Đã lưu bản nháp.')
    fireEvent.click(screen.getByRole('button', { name: 'Sử dụng lời giải' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const endpoint = isPractice ? `/practice/admin/${skill}/10/questions/1/review-explanation` : '/admin/exams/10/questions/101/review-explanation'
    expect(api.post).toHaveBeenCalledWith(endpoint, { draftVersion: 'draft-2', sourceHash: 'source-1' })
    await screen.findByText('Học sinh đang xem lời giải này.')
    expect(window.alert).toHaveBeenLastCalledWith('Đã cập nhật lời giải cho học sinh.')
    expect(updated).toHaveBeenLastCalledWith(used, 1)
    expect(api.put).toHaveBeenCalledTimes(1)
  })
})

it('does not offer publish for an unsupported or invalid draft', () => {
  render(<QuestionExplanationModal isOpen onClose={vi.fn()} examId={10} question={question}
    initialExplanation={{ ...draft, status: 'needs_regeneration', validationIssue: 'Missing source evidence' }} />)
  expect(screen.getByText('Missing source evidence')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sử dụng lời giải' })).not.toBeInTheDocument()
  expect(api.post).not.toHaveBeenCalled()
})

it('keeps the saved draft and published version intact when a save fails', async () => {
  api.put.mockRejectedValue({ response: { status: 409, data: { message: 'Nội dung đề đã thay đổi. Tải lại trước khi lưu.' } } })
  const updated = vi.fn()
  render(<QuestionExplanationModal isOpen onClose={vi.fn()} examId={10} question={question}
    initialExplanation={draft} onExplanationUpdated={updated} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Sửa trực tiếp' }))
  fireEvent.change(screen.getByPlaceholderText(/Lập luận vì sao đáp án này đúng/), { target: { value: 'Uncommitted edit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
  await screen.findByText('Nội dung đề đã thay đổi. Tải lại trước khi lưu.')
  expect(updated).not.toHaveBeenCalled()
  expect(api.post).not.toHaveBeenCalled()
  expect(window.alert).not.toHaveBeenCalled()
  expect(screen.getByPlaceholderText(/Lập luận vì sao đáp án này đúng/)).toHaveValue('Uncommitted edit')
})
