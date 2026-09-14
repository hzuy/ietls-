import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SeriesPage from './SeriesPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test User' }, openAuthModal: vi.fn() }),
}))

describe('SeriesPage', () => {
  const mockBooks = [
    {
      id: 1,
      seriesId: 1,
      seriesName: 'IELTS Cambridge Academic',
      bookNumber: 19,
      testNumber: 1,
      coverImageUrl: null,
      exams: { reading: { id: 101, title: 'Cam 19 Test 1' } },
    },
    {
      id: 2,
      seriesId: 1,
      seriesName: 'IELTS Cambridge Academic',
      bookNumber: 18,
      testNumber: 1,
      coverImageUrl: null,
      exams: { reading: { id: 102, title: 'Cam 18 Test 1' } },
    },
    {
      id: 3,
      seriesId: 2,
      seriesName: 'IELTS Practice Test Plus',
      bookNumber: 3,
      testNumber: 1,
      coverImageUrl: null,
      exams: { reading: { id: 201, title: 'Plus 3 Test 1' } },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBooks,
    })
  })

  it('renders Breadcrumb with correct structure: Trang chủ / Phòng thi chuẩn hóa / Title', async () => {
    render(
      <MemoryRouter>
        <SeriesPage
          filterPattern="Cambridge"
          title="IELTS Cambridge Academic"
          description="Trọn bộ đề thi IELTS từ NXB Cambridge"
        />
      </MemoryRouter>
    )

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Phòng thi chuẩn hóa' })).toHaveAttribute('href', '/full-test')
    expect(screen.getByText('IELTS Cambridge Academic', { selector: 'span[aria-current="page"]' })).toBeInTheDocument()
  })

  it('strictly filters Cambridge books and excludes Practice Plus when filterPattern is Cambridge', async () => {
    render(
      <MemoryRouter>
        <SeriesPage
          filterPattern="Cambridge"
          title="IELTS Cambridge Academic"
          description="Trọn bộ đề thi IELTS từ NXB Cambridge"
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('IELTS Cambridge Academic 19')).toBeInTheDocument()
    })

    expect(screen.getByText('IELTS Cambridge Academic 18')).toBeInTheDocument()
    expect(screen.queryByText('IELTS Practice Test Plus 3')).not.toBeInTheDocument()
  })

  it('strictly filters Practice Plus books when filterPattern is Practice', async () => {
    render(
      <MemoryRouter>
        <SeriesPage
          filterPattern="Practice"
          title="IELTS Practice Test Plus"
          description="Dòng sách luyện đề chuyên sâu với độ khó cao"
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('IELTS Practice Test Plus 3')).toBeInTheDocument()
    })

    expect(screen.queryByText('IELTS Cambridge Academic 19')).not.toBeInTheDocument()
    expect(screen.queryByText('IELTS Cambridge Academic 18')).not.toBeInTheDocument()
  })
})
