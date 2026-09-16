import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Home from './Home'

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
  getUserStats: vi.fn().mockResolvedValue({ streak: 5 }),
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
      expect(screen.getByText('Bộ đề Cambridge Academic')).toBeInTheDocument()
    })

    // Initially on Cambridge tab
    expect(screen.getByText('IELTS Cambridge Academic 19')).toBeInTheDocument()
    expect(screen.queryByText('IELTS Practice Test Plus 3')).not.toBeInTheDocument()

    // Switch to Practice Plus tab
    const practicePlusTabBtn = screen.getByRole('button', { name: 'Practice Plus' })
    fireEvent.click(practicePlusTabBtn)

    expect(screen.getByText('Bộ đề IELTS Practice Test Plus')).toBeInTheDocument()
    expect(screen.getByText('IELTS Practice Test Plus 3')).toBeInTheDocument()
    expect(screen.queryByText('IELTS Cambridge Academic 19')).not.toBeInTheDocument()
  })

  it('renders interactive skills (Reading & Listening) and reference libraries (Writing & Speaking)', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Khám phá thêm')).toBeInTheDocument()
    })

    // Interactive skills (Đợt 3 — Việc 5: gộp chung 1 section "Khám phá thêm"
    // với thư viện bài mẫu, không còn heading "Luyện tập theo Kỹ năng" riêng)
    expect(screen.getByText('Reading Practice')).toBeInTheDocument()
    expect(screen.getByText('Listening Practice')).toBeInTheDocument()
    expect(screen.getAllByText('ĐỀ THI TƯƠNG TÁC')).toHaveLength(2)

    // Reference libraries (cùng lưới "Khám phá thêm", không còn heading
    // "Thư viện bài mẫu học thuật" riêng)
    expect(screen.getByText('Writing Samples')).toBeInTheDocument()
    expect(screen.getByText('Speaking Samples')).toBeInTheDocument()
    expect(screen.getAllByText('THƯ VIỆN THAM KHẢO')).toHaveLength(2)
  })
})
