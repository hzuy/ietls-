import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLatestDraft } from '../services/draftService'
import Home from './Home'

const render = ui => rtlRender(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
)

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test User' } }),
}))

vi.mock('../hooks/useAuthGate', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useAuthGate: () => vi.fn(),
  }
})

vi.mock('../services/userService', () => ({
  getUserStats: vi.fn().mockResolvedValue({ streak: 5, bandBySkill: { reading: 6.5, listening: 7, writing: null, speaking: null } }),
}))

vi.mock('../services/draftService', () => ({
  getLatestDraft: vi.fn().mockReturnValue(null),
  clearDraft: vi.fn(),
}))

describe('Home Page Standardization', () => {
  const mockHomeData = {
    fullTests: [
      {
        id: 1,
        seriesId: 1,
        seriesName: 'IELTS Cambridge Academic',
        bookNumber: 19,
        testNumber: 1,
        exams: { reading: { id: 101, title: 'Cam 19 Test 1 Reading' } },
        coverImageUrl: null,
      },
      {
        id: 2,
        seriesId: 2,
        seriesName: 'IELTS Practice Test Plus',
        bookNumber: 3,
        testNumber: 1,
        exams: { reading: { id: 201, title: 'Practice Plus 3 Test 1' } },
        coverImageUrl: null,
      },
    ],
    reading: [{ id: 1, title: 'Climate Change Passage' }],
    listening: [{ id: 2, title: 'University Library Audio' }],
    writingSamples: [{ id: 3, title: 'Writing Task 2 Essay' }],
    speakingSamples: [{ id: 4, title: 'Speaking Part 2 Cue Card' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getLatestDraft).mockReturnValue(null)
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHomeData,
    })
  })

  it('separates Cambridge Academic and Practice Plus books via tab switcher', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Bộ đề IELTS')).toBeInTheDocument()
    })

    // Initially on Cambridge tab — hiển thị sách Cambridge 19
    expect((await screen.findAllByText('IELTS Cambridge Academic 19')).length).toBeGreaterThan(0)
    expect(screen.queryByText('IELTS Practice Test Plus 3')).not.toBeInTheDocument()

    // Kiểm tra nút Practice Plus tab tồn tại
    const practicePlusTabBtn = screen.getByRole('button', { name: 'Practice Plus' })
    fireEvent.click(practicePlusTabBtn)

    // Sau khi chuyển tab — hiển thị sách Practice Plus 3
    expect(screen.getAllByText('IELTS Practice Test Plus 3').length).toBeGreaterThan(0)
  })

  it('renders Luyện đề (Reading & Listening) and Tham khảo (Writing & Speaking) with tab switchers', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Luyện đề')).toBeInTheDocument()
      expect(screen.getByText('Tham khảo')).toBeInTheDocument()
    })

    // Luyện đề: mặc định Reading hiển thị
    expect((await screen.findAllByText('Climate Change Passage')).length).toBeGreaterThan(0)
    // Chuyển tab sang Listening
    const listeningTabBtn = screen.getByRole('button', { name: 'Listening' })
    fireEvent.click(listeningTabBtn)
    expect(screen.getAllByText('University Library Audio').length).toBeGreaterThan(0)

    // Tham khảo: mặc định Writing hiển thị
    expect(screen.getAllByText('Writing Task 2 Essay').length).toBeGreaterThan(0)
    // Chuyển tab sang Speaking
    const speakingTabBtn = screen.getByRole('button', { name: 'Speaking' })
    fireEvent.click(speakingTabBtn)
    expect(screen.getAllByText('Speaking Part 2 Cue Card').length).toBeGreaterThan(0)
  })

  it('does not show resume card when there is no draft', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Luyện đề')).toBeInTheDocument()
    })

    // Ca 4: không có draft → thẻ Tiếp tục bài làm không hiện
    expect(screen.queryByTestId('resume-hero-card')).not.toBeInTheDocument()
  })

  it('enriches draft title from fullTestsData when draft has generic or missing title', async () => {
    vi.mocked(getLatestDraft).mockReturnValue({
      userId: 'user-1',
      examId: 101,
      skillType: 'reading',
      examTitle: 'IELTS Reading · Đề #101',
      totalQuestions: 40,
      timeRemaining: 1200,
      savedAt: '2026-10-13T09:00:00.000Z',
      data: { 1: 'A' },
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cam 19 Test 1 Reading')).toBeInTheDocument()
    })
    expect(screen.queryByText('IELTS Reading · Đề #101')).not.toBeInTheDocument()
  })

  it('renders dynamic tabs when series is renamed to IELTS Mock Test', async () => {
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fullTests: [
          {
            id: 1,
            seriesId: 1,
            seriesName: 'IELTS Mock Test',
            bookNumber: 19,
            testNumber: 1,
            exams: { reading: { id: 101, title: 'Mock 19 Test 1 Reading' } },
            coverImageUrl: null,
          },
        ],
        reading: [],
        listening: [],
        writingSamples: [],
        speakingSamples: [],
      }),
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Bộ đề IELTS')).toBeInTheDocument()
    })

    expect(await screen.findByRole('button', { name: 'IELTS Mock Test' })).toBeInTheDocument()
    expect(screen.getAllByText('IELTS Mock Test 19').length).toBeGreaterThan(0)
  })
})

