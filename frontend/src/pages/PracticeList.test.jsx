import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PracticeList from './PracticeList'
import * as draftService from '../services/draftService'
import * as practiceService from '../services/practiceService'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

let mockCurrentUser = { id: 123, role: 'user' }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}))

describe('PracticeList — continue button & draft integration', () => {
  const mockExams = [
    {
      id: 1,
      title: 'The history of tea',
      type: 'true-false-not-given',
      questionCount: 13,
      thumbnailUrl: null,
    },
    {
      id: 2,
      title: 'The kakapo',
      type: 'true-false-not-given',
      questionCount: 13,
      thumbnailUrl: null,
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    mockCurrentUser = { id: 123, role: 'user' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExams,
    })
    vi.spyOn(practiceService, 'getPracticeAttempts').mockResolvedValue({
      2: [{ id: 10, examId: 2, correct: 1, total: 13 }],
    })
  })

  it('renders "Làm bài" when there is no draft and "Làm lại" when history exists', async () => {
    vi.spyOn(draftService, 'checkDraft').mockReturnValue({ hasDraft: false })

    render(
      <MemoryRouter>
        <PracticeList skill="reading" />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('The history of tea')).toBeInTheDocument()
      expect(screen.getByText('The kakapo')).toBeInTheDocument()
    })

    expect(screen.getByTitle('Làm bài')).toBeInTheDocument()
    expect(screen.getByTitle('Làm lại')).toBeInTheDocument()
    expect(screen.queryByTitle('Làm tiếp')).not.toBeInTheDocument()
  })

  it('renders "Làm tiếp" (PauseCircle) button with blue styling when a draft exists', async () => {
    vi.spyOn(draftService, 'checkDraft').mockImplementation((userId, examId) => {
      if (examId === 1) {
        return { hasDraft: true, savedAt: '2026-10-13T00:00:00Z', timeRemaining: 1800 }
      }
      return { hasDraft: false }
    })

    render(
      <MemoryRouter>
        <PracticeList skill="reading" />
      </MemoryRouter>
    )

    const continueBtn = await screen.findByTitle('Làm tiếp')
    expect(continueBtn).toBeInTheDocument()
    expect(continueBtn.className).toContain('text-blue-600')
    expect(continueBtn.className).toContain('border-blue-200')

    // Click continue button -> navigates to practice exam
    fireEvent.click(continueBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/practice/reading/1')
  })

  it('renders "Làm lại từ đầu" button when a draft exists and clears draft on click', async () => {
    vi.spyOn(draftService, 'checkDraft').mockImplementation((userId, examId) => {
      if (examId === 1) {
        return { hasDraft: true, savedAt: '2026-10-13T00:00:00Z', timeRemaining: 1800 }
      }
      return { hasDraft: false }
    })
    const clearDraftSpy = vi.spyOn(draftService, 'clearDraft').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <PracticeList skill="reading" />
      </MemoryRouter>
    )

    const retakeBtn = await screen.findByTitle('Làm lại từ đầu')
    expect(retakeBtn).toBeInTheDocument()

    // Click "Làm lại từ đầu" -> clears draft and navigates
    fireEvent.click(retakeBtn)
    expect(clearDraftSpy).toHaveBeenCalledWith(123, 1, 'practice-reading')
    expect(mockNavigate).toHaveBeenCalledWith('/practice/reading/1')
  })
})
