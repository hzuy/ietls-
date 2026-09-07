import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FullTestResult from './FullTestResult'
import * as examService from '../services/examService'
import * as chatbotDrawer from '../components/common/AIChatbotDrawer'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Student' }, openAuthModal: vi.fn() })
}))

describe('FullTestResult Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockCompleteData = {
    seriesName: 'Cambridge 19',
    overallBand: 7.5,
    isComplete: true,
    skills: {
      listening: { done: true, score: 8.0, available: true },
      reading:   { done: true, score: 7.5, available: true },
      writing:   { done: true, score: 7.0, available: true },
      speaking:  { done: true, score: 7.0, available: true },
    }
  }

  const mockIncompleteData = {
    seriesName: 'Cambridge 19',
    overallBand: null,
    isComplete: false,
    skills: {
      listening: { done: true, score: 7.5, available: true },
      reading:   { done: true, score: 7.0, available: true },
      writing:   { done: false, score: null, available: true },
      speaking:  { done: false, score: null, available: false },
    }
  }

  it('renders complete full test result in Bento Grid with overall band and skill breakdown', async () => {
    vi.spyOn(examService, 'getFullTestResult').mockResolvedValue(mockCompleteData)

    render(
      <MemoryRouter initialEntries={['/full-test/result?seriesId=1&bookNumber=19&testNumber=1']}>
        <FullTestResult />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Kết quả Full Test')).toBeInTheDocument()
      expect(screen.getByText(/Cambridge 19 — Test 1/i)).toBeInTheDocument()
      expect(screen.getAllByText('7.5').length).toBeGreaterThan(0)
      expect(screen.getByText(/Đủ 4 kỹ năng/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Hỏi AI Tutor lộ trình/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Xem bảng phân tích/i })).toBeInTheDocument()
    })
  })

  it('renders incomplete full test status gracefully', async () => {
    vi.spyOn(examService, 'getFullTestResult').mockResolvedValue(mockIncompleteData)

    render(
      <MemoryRouter initialEntries={['/full-test/result?seriesId=1&bookNumber=19&testNumber=1']}>
        <FullTestResult />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Chưa hoàn thành')).toBeInTheDocument()
      expect(screen.getAllByText(/2\/4/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Chưa làm').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Không có đề').length).toBeGreaterThan(0)
    })

  })


  it('triggers askAITutor when "Hỏi AI Tutor lộ trình" button is clicked', async () => {
    vi.spyOn(examService, 'getFullTestResult').mockResolvedValue(mockCompleteData)
    const askSpy = vi.spyOn(chatbotDrawer, 'askAITutor').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/full-test/result?seriesId=1&bookNumber=19&testNumber=1']}>
        <FullTestResult />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hỏi AI Tutor lộ trình/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Hỏi AI Tutor lộ trình/i }))
    expect(askSpy).toHaveBeenCalledWith(expect.stringContaining('Overall Band là 7.5'))
  })
})
