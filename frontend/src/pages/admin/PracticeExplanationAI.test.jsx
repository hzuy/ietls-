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
    vi.spyOn(window, 'alert').mockImplementation(() => {}).mockClear()
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

  async function revealRunErrors() {
    const trigger = await screen.findByText(/^C\u1ea7n ki\u1ec3m tra l\u1eddi gi\u1ea3i/)
    if (!trigger.closest('details').open) fireEvent.click(trigger)
  }

  it('preserves persisted question six when its note token precedes question one', async () => {
    const old = number => ({ v: 2, status: 'ai_generated', answer: number === 6 ? 'six' : 'one', reasoning: `Old persisted ${number}` })
    const item = { ...practice, questions: { groups: [{ ...groups[0], qNumberEnd: 6, lines: ['First [6]', 'Then [1]'],
      questions: [{ id: 301, number: 1, correctAnswer: 'one', explanation: old(1) }, { id: 306, number: 6, correctAnswer: 'six', explanation: old(6) }],
    }] } }
    service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValue(item)
    api.post.mockImplementation(async (_url, body) => {
      expect(body.questionNumbers).toEqual([6])
      const fresh = structuredClone(item)
      fresh.questions.groups[0].questions[1].explanation = { ...old(6), reasoning: 'Fresh persisted six' }
      service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValue(fresh)
      return { data: { generatedCount: 1, remainingQuestionNumbers: [] } }
    })
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^Câu 6/ }))
    expect(screen.getByText('Old persisted 6')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lại giải thích AI' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dừng tạo' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Câu 6/ }))
    expect(screen.getByText('Fresh persisted six')).toBeInTheDocument()
  })

  it('opens a persisted answer conflict for confirmation without calling AI first', async () => {
    const pending = { v: 2, status: 'conflict_pending', answer: 'three', aiAnswer: 'three', reasoning: 'Independent result' }
    service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValue({
      ...practice, questions: { groups: [{ ...groups[0], explanations: { 2: pending } }] },
    })
    api.post.mockResolvedValue({ data: { generatedCount: 1, remainingQuestionNumbers: [] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^Câu 2/i }))
    expect(screen.queryByRole('button', { name: /Duyệt giải thích câu/ })).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lại theo đáp án đề' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post.mock.calls[0][1]).toMatchObject({ questionNumbers: [2], force: true })
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('resolveChoices')
  })

  it('marks an individually saved explanation as saved and retains it on reopening', async () => {
    const old = { v: 2, status: 'ai_generated', answer: 'one', reasoning: 'Old reasoning' }
    const saved = { ...old, status: 'teacher_edited', manualEdit: true, reasoning: 'Saved teacher reasoning' }
    service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValue({
      ...practice, questions: { groups: [{ ...groups[0],
        questions: groups[0].questions.map(q => q.number === 1 ? { ...q, explanation: old } : q),
        explanations: { 1: old },
      }] },
    })
    vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true, explanation: saved } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^Câu 1/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Sửa trực tiếp/i }))
    fireEvent.change(screen.getByPlaceholderText(/Lập luận vì sao đáp án này đúng/i), { target: { value: saved.reasoning } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/i }))
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(saved.reasoning)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    const chip = screen.getByRole('button', { name: /^Câu 1/i })
    expect(chip).toHaveTextContent('Đã sửa')
    expect(chip).not.toHaveTextContent('Chưa lưu')
    fireEvent.click(chip)
    expect(screen.getByText(saved.reasoning)).toBeInTheDocument()
  })

  it('shows a partial timeout and retries only the unfinished question', async () => {
    api.post
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 2, remainingQuestionNumbers: [2] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 1, remainingQuestionNumbers: [] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    await revealRunErrors()
    const retry = await screen.findByRole('button', { name: 'Thử lại 1 câu lỗi' })
    expect(screen.getByRole('button', { name: /^Câu 2/i })).toHaveTextContent('Lỗi')
    expect(screen.getByRole('button', { name: /^Câu 1/i })).not.toHaveTextContent('Lỗi')
    fireEvent.click(retry)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3))
    expect(api.post.mock.calls[2][0]).toBe(`/practice/admin/${skill}/11/generate-explanations`)
    expect(api.post.mock.calls[2][1]).toMatchObject({ questionNumbers: [2], force: true })
    await waitFor(() => expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument())
    expect(sessionStorage.getItem(`ai_exp_report_practice_${skill}_11`)).toBeNull()
    expect(window.alert).toHaveBeenCalledTimes(1)

  })

  it('opens a live numbered error in its question modal without unlocking writes', async () => {
    service[reading ? 'getReadingPractice' : 'getListeningPractice'].mockResolvedValue({
      ...practice, questions: { groups: [{ ...groups[0], qNumberEnd: 3,
        questions: [...groups[0].questions, { number: 3, correctAnswer: 'three' }], lines: ['One [1]', 'Two [2]', 'Three [3]'] }] },
    })
    api.post.mockResolvedValueOnce({ data: { generatedCount: 1, totalQuestions: 3,
      errors: [{ number: 2, code: 'AI_QUESTION_TIMEOUT', message: 'timeout' }], remainingQuestionNumbers: [3] } })
      .mockImplementationOnce((_url, _body, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
      }))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const errors = await screen.findByText(/^C\u1ea7n ki\u1ec3m tra l\u1eddi gi\u1ea3i/)
    fireEvent.click(errors)
    expect(screen.getByTestId('explanation-run-panel')).toHaveAttribute('data-status', 'running')
    expect(screen.getByText(/2\/3.*67%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại 1 câu lỗi' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Xem c\u00e2u 2/  }))
    expect(await screen.findByRole('alert')).toHaveTextContent('AI phản hồi quá lâu')
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dừng tạo' }))
    await waitFor(() => expect(screen.getByTestId('explanation-run-panel')).toHaveAttribute('data-status', 'cancelled'))
    expect(api.post).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: /D\u1eebng t\u1ea1o/ })).not.toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('renders provider errors with original details visible immediately', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { message: '429 gemini provider quota' } } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const panel = await screen.findByTestId('explanation-run-panel')
    await waitFor(() => expect(panel).not.toHaveAttribute('data-status', 'running'))
    await revealRunErrors()
    expect(within(panel).getAllByRole('button', { name: /^Xem câu.*Hệ thống AI đang quá tải/ })).toHaveLength(2)
    expect(within(panel).getByText(/^C\u1ea7n ki\u1ec3m tra l\u1eddi gi\u1ea3i/).closest('details')).toHaveAttribute('open')
    expect(within(panel).queryByText('Chi tiết kỹ thuật')).not.toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Thử lại 2 câu lỗi' })).toBeEnabled()
    expect(window.alert).not.toHaveBeenCalled()

  })

  it('does not loop after a 409 conflict and releases the editor', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Another task is running' } } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const panel = await screen.findByTestId('explanation-run-panel')
    await waitFor(() => expect(panel).not.toHaveAttribute('data-status', 'running'))
    await revealRunErrors()
    expect(within(panel).getAllByRole('button', { name: /^Xem câu.*Đang có một tiến trình sinh AI khác/ })).toHaveLength(2)
    expect(api.post).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeEnabled())
  })

  it('cancels an in-flight request without leaving generating chips behind', async () => {
    api.post.mockImplementationOnce((_url, _body, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })
    }))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    const cancel = await screen.findByRole('button', { name: /Dừng tạo/ })
    expect(screen.getByRole('button', { name: 'Lưu bài' })).toBeDisabled()
    fireEvent.click(cancel)
    await waitFor(() => expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^Câu 2/i })).not.toHaveTextContent('Đang sinh')
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
    await waitFor(() => expect(panel).not.toHaveAttribute('data-status', 'running'))
    expect(panel).toHaveAttribute('data-status', 'blocked')
    expect(api.post).not.toHaveBeenCalled()
    expect(within(panel).queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()

  })

  it('starts fresh after remount without restoring the failure report', async () => {
    api.post.mockRejectedValueOnce(new Error('timeout'))
    const first = await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    await revealRunErrors()
    await screen.findByRole('button', { name: 'Thử lại 2 câu lỗi' })
    expect(sessionStorage.getItem(`ai_exp_report_${skill}_11`)).toBeNull()
    expect(sessionStorage.getItem(`ai_exp_report_practice_${skill}_11`)).toBeNull()
    first.unmount()
    await open()
    expect(screen.queryByTestId('explanation-run-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^C\u00e2u 2/i })).not.toHaveTextContent('L\u1ed7i')
    expect(screen.getByRole('button', { name: 'AI gi\u1ea3i th\u00edch' })).toBeEnabled()
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('flags fallback results for review instead of announcing full success', async () => {
    api.post.mockResolvedValueOnce({ data: { generatedCount: 2, remainingQuestionNumbers: [], needsRetryQuestions: [{ number: 2, reason: 'Fallback' }] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI giải thích' }))
    await waitFor(() => expect(screen.getByTestId('explanation-run-panel')).not.toHaveAttribute('data-status', 'running'))
    expect(screen.getByRole('button', { name: /^Câu 2/i })).toHaveTextContent('Cần kiểm tra')
    expect(screen.queryByText(/Đã tạo giải thích 4 bước thành công/)).not.toBeInTheDocument()
  })

  it('does not expose answer selection when a draft needs evidence review', async () => {
    api.post.mockResolvedValueOnce({ data: { generatedCount: 1, remainingQuestionNumbers: [], needsRetryQuestions: [{ number: 2, reason: 'Missing evidence' }] } })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'AI gi\u1ea3i th\u00edch' }))
    await waitFor(() => expect(screen.getByTestId('explanation-run-panel')).not.toHaveAttribute('data-status', 'running'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^C\u00e2u 2/i })).toHaveTextContent('C\u1ea7n ki\u1ec3m tra')
    expect(window.alert).not.toHaveBeenCalled()
  })
})
