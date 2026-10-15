import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryClient as appQueryClient } from '../lib/queryClient'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FullTestDetail from './FullTestDetail'
import * as draftService from '../services/draftService'
import * as historyService from '../services/historyService'

const render = ui => {
  appQueryClient.clear()
  return rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
  )
}

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
    useLocation: () => ({ pathname: '/full-test/1', search: '?book=19' }),
  }
})

let mockCurrentUser = { id: 123, role: 'user' }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser, openAuthModal: vi.fn() }),
}))

describe('FullTestDetail — ActionDropdown with "Làm tiếp" and "Làm lại"', () => {
  const mockApiData = [
    {
      seriesId: 1,
      seriesName: 'IELTS Mock Test',
      bookNumber: 19,
      coverImageUrl: null,
      testNumber: 1,
      exams: {
        listening: { id: 101, title: 'Listening Test 1' },
        reading: { id: 102, title: 'Reading Test 1' },
      },
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    mockCurrentUser = { id: 123, role: 'user' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiData,
    })
    vi.spyOn(historyService, 'getMyHistory').mockResolvedValue({
      history: [{ examId: 101, bandScore: 6.5 }],
      writingAttemptsByExam: {},
      speakingAttemptsByExam: {},
    })
  })

  it('renders "Làm tiếp" dropdown with "Làm lại" option when a draft exists', async () => {
    vi.spyOn(draftService, 'checkDraft').mockImplementation((userId, examId, skill) => {
      if (examId === 101 && skill === 'listening') {
        return { hasDraft: true, savedAt: '2026-10-13T00:00:00Z', timeRemaining: 1800 }
      }
      return { hasDraft: false }
    })
    const clearDraftSpy = vi.spyOn(draftService, 'clearDraft').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/full-test/1?book=19']}>
        <FullTestDetail />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('IELTS Mock Test 19').length).toBeGreaterThan(0)
    })

    // "Làm tiếp" should be displayed for listening
    const continueBtn = await screen.findByText('Làm tiếp')
    expect(continueBtn).toBeInTheDocument()

    // Clicking the dropdown chevron next to "Làm tiếp"
    const dropdownToggle = screen.getByRole('button', { name: 'Tùy chọn khác' })
    fireEvent.click(dropdownToggle)

    // Both "Làm lại từ đầu" and history should now be present in the dropdown menu
    const retakeOption = screen.getByRole('menuitem', { name: 'Làm lại từ đầu' })
    expect(retakeOption).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Lịch sử các lần làm' })).toBeInTheDocument()

    // "Làm lại từ đầu" asks for confirmation before clearing the draft
    fireEvent.click(retakeOption)
    expect(clearDraftSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }))
    expect(clearDraftSpy).toHaveBeenCalledWith(123, 101, 'listening')
    expect(mockNavigate).toHaveBeenCalledWith('/listening/101')
  })
})
