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

    // Initially on Cambridge tab — kiểm tra heading và số đề hiển thị
    // (coverImageUrl=null → AcademicCover với text trong SVG)
    expect(screen.getByText('Bộ đề Cambridge Academic')).toBeInTheDocument()
    expect(screen.queryByText('Bộ đề IELTS Practice Test Plus')).not.toBeInTheDocument()

    // Kiểm tra nút Practice Plus tab tồn tại
    const practicePlusTabBtn = screen.getByRole('button', { name: 'Practice Plus' })
    fireEvent.click(practicePlusTabBtn)

    // Sau khi chuyển tab
    expect(screen.getByText('Bộ đề IELTS Practice Test Plus')).toBeInTheDocument()
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

    // Tên mới sau khi đổi (MỤC 7)
    expect(screen.getByText('Reading')).toBeInTheDocument()
    expect(screen.getByText('Listening')).toBeInTheDocument()
    expect(screen.getAllByText('Tương tác')).toHaveLength(2)

    expect(screen.getByText('Writing mẫu')).toBeInTheDocument()
    expect(screen.getByText('Speaking mẫu')).toBeInTheDocument()
    expect(screen.getAllByText('Bài mẫu')).toHaveLength(2)
  })

  it('does not show resume card when there is no draft', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Khám phá thêm')).toBeInTheDocument()
    })

    // Ca 4: không có draft → thẻ Tiếp tục bài làm không hiện
    expect(screen.queryByTestId('resume-hero-card')).not.toBeInTheDocument()
  })
})
