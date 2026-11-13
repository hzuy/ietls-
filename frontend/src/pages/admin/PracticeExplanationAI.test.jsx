import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReadingPractice from './ReadingPractice'
import ListeningPractice from './ListeningPractice'
import { ToastProvider } from '../../context/ToastContext'
import * as service from '../../services/practiceService'
import api from '../../utils/axios'

const groups = [{
  _id: 'practice-group', type: 'note_completion', qNumberStart: 1, qNumberEnd: 2,
  instruction: 'Complete the notes', lines: ['One [1]', 'Two [2]'],
  questions: [{ number: 1, correctAnswer: 'one' }, { number: 2, correctAnswer: 'two' }],
}]

describe.each(['reading', 'listening'])('%s Practice AI reports', skill => {
  const reading = skill === 'reading'
  const practice = { id: 11, title: 'Practice AI fixture', passage: 'A sample passage.', transcript: 'A sample transcript.', audioUrl: '/audio/test.mp3', questions: { groups } }

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    window.scrollTo = vi.fn()
    vi.spyOn(service, reading ? 'getReadingPracticeList' : 'getListeningPracticeList').mockResolvedValue([practice])
    vi.spyOn(service, reading ? 'getReadingPractice' : 'getListeningPractice').mockResolvedValue(practice)
    vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Unexpected API request'))
  })

  async function open() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const result = render(<MemoryRouter><QueryClientProvider client={client}><ToastProvider>
      {reading ? <ReadingPractice /> : <ListeningPractice />}
    </ToastProvider></QueryClientProvider></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    const generate = await screen.findByRole('button', { name: 'AI giải thích' })
    await waitFor(() => expect(generate).toBeEnabled())
    return result
  }

  it('shows a partial timeout and retries only the unfinished question', async () => {
    api.post
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 2, remainingQuestionNumbers: [2] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 1, remainingQuestionNumbers: [] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const retry = await screen.findByRole('button', { name: 'Thử lại 1 câu lỗi' })
    expect(screen.getByRole('button', { name: /Câu 2/i })).toHaveTextContent('Lỗi')
    expect(screen.getByRole('button', { name: /Câu 1/i })).not.toHaveTextContent('Lỗi')
    fireEvent.click(retry)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3))
    expect(api.post.mock.calls[2][0]).toBe(`/practice/admin/${skill}/11/generate-explanations`)
    expect(api.post.mock.calls[2][1]).toMatchObject({ questionNumbers: [2], overwriteProtected: false })
    await waitFor(() => expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument())
    expect(JSON.parse(sessionStorage.getItem(`ai_exp_report_practice_${skill}_11`))).toMatchObject({ status: 'done', scope: 'retry', generated: 1 })
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('renders provider errors in the report and keeps raw details collapsed', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { message: '429 gemini provider quota' } } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const panel = await screen.findByTestId('explanation-run-panel')
    expect(within(panel).getAllByText(/Hệ thống AI đang quá tải/)).toHaveLength(2)
    expect(panel.querySelector('details')).not.toHaveAttribute('open')
    expect(within(panel).getByRole('button', { name: 'Thử lại 2 câu lỗi' })).toBeEnabled()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('does not loop after a 409 conflict and releases the editor', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Another task is running' } } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const panel = await screen.findByTestId('explanation-run-panel')
    expect(within(panel).getAllByText(/Đang có một tiến trình sinh AI khác/)).toHaveLength(2)
    expect(api.post).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeEnabled())
  })

  it('cancels an in-flight request without leaving generating chips behind', async () => {
    api.post.mockImplementationOnce((_url, _body, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
    }))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const cancel = await screen.findByRole('button', { name: /Hủy sinh/ })
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeDisabled()
    fireEvent.click(cancel)
    const panel = await screen.findByTestId('explanation-run-panel')
    expect(panel).toHaveAttribute('data-status', 'cancelled')
    expect(screen.getByRole('button', { name: /Câu 2/i })).not.toHaveTextContent('Đang sinh')
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeEnabled()
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('shows blocked validation without sending an AI request', async () => {
    service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValueOnce({
      ...practice, questions: { groups: [{ ...groups[0], questions: [{ number: 1, correctAnswer: '' }] }] },
    })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const panel = await screen.findByTestId('explanation-run-panel')
    expect(panel).toHaveAttribute('data-status', 'blocked')
    expect(api.post).not.toHaveBeenCalled()
    expect(within(panel).queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('restores the failure report after remount without sharing an exam report key', async () => {
    api.post.mockRejectedValueOnce(new Error('timeout'))
    const first = await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    await screen.findByRole('button', { name: 'Thử lại 2 câu lỗi' })
    expect(sessionStorage.getItem(`ai_exp_report_${skill}_11`)).toBeNull()
    expect(sessionStorage.getItem(`ai_exp_report_practice_${skill}_11`)).not.toBeNull()
    first.unmount()
    await open()
    expect(await screen.findByRole('button', { name: 'Thử lại 2 câu lỗi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Câu 2/i })).toHaveTextContent('Lỗi')
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('flags fallback results for review instead of announcing full success', async () => {
    api.post.mockResolvedValueOnce({ data: { generatedCount: 2, remainingQuestionNumbers: [], needsRetryQuestions: [{ number: 2, reason: 'Fallback' }] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    await screen.findByTestId('explanation-run-panel')
    expect(screen.getByRole('button', { name: /Câu 2/i })).toHaveTextContent('Cần kiểm tra')
    expect(screen.queryByText(/Đã tạo giải thích 4 bước thành công/)).not.toBeInTheDocument()
  })

  it('keeps conflict resolution scoped to the question being confirmed', async () => {
    api.post
      .mockResolvedValueOnce({ data: { generatedCount: 1, remainingQuestionNumbers: [], conflicts: [{ number: 2, inputAnswer: 'two', aiAnswer: 'three' }] } })
      .mockResolvedValueOnce({ data: { generatedCount: 1, remainingQuestionNumbers: [] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const confirm = await screen.findByRole('button', { name: 'Xác nhận & Lưu giải thích' })
    fireEvent.click(confirm)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    expect(api.post.mock.calls[1][1]).toMatchObject({ questionNumbers: [2], resolveChoices: { 2: 'ai' }, overwriteProtected: false })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
