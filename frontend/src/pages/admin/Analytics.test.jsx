import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Analytics from './Analytics'
import * as adminService from '../../services/adminService'

// Mock adminService
vi.mock('../../services/adminService', () => ({
  getAdminAnalytics: vi.fn(),
  getAdminUser: vi.fn(),
}))

// ResizeObserver/scrollIntoView đã được mock chung ở src/setupTests.js

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderWithClient(ui) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const mockAnalyticsData = {
  overview: {
    totalAttempts: 135,
    totalUsers: 18,
    totalUsersAll: 25,
    avgBand: 6.0,
  },
  skillBreakdown: [
    { skill: 'reading', count: 54, avgScore: 6.5 },
    { skill: 'listening', count: 47, avgScore: 6.0 },
    { skill: 'writing', count: 20, avgScore: 5.5 },
    { skill: 'speaking', count: 14, avgScore: 5.5 },
  ],
  topUsers: [
    { id: 1, name: 'Đỗ Minh Châu', email: 'chau.do@ielts.vn', avgScore: 8.0, attemptCount: 5 },
    { id: 2, name: 'Nguyễn Hoàng Nam', email: 'nam.nguyen@ielts.vn', avgScore: 7.5, attemptCount: 4 },
    { id: 3, name: 'Lê Quốc Anh', email: 'quocanh.le@ielts.vn', avgScore: 7.5, attemptCount: 4 },
    { id: 4, name: 'Trần Thị Mai', email: 'mai.tran@ielts.vn', avgScore: 7.0, attemptCount: 5 },
    { id: 5, name: 'Phan Thảo Nguyên', email: 'thaonguyen.phan@ielts.vn', avgScore: 7.0, attemptCount: 4 },
    { id: 6, name: 'Vũ Phương Linh', email: 'phuonglinh.vu@ielts.vn', avgScore: 6.5, attemptCount: 3 },
  ],
  attemptsByDay: [
    { date: '2026-09-01', count: 5 },
    { date: '2026-09-02', count: 8 },
  ],
  bandDistribution: [
    { range: '<4.0', count: 7 },
    { range: '4.0–4.9', count: 20 },
    { range: '5.0–5.9', count: 40 },
    { range: '6.0–6.9', count: 41 },
    { range: '7.0–7.9', count: 20 },
    { range: '8.0–9.0', count: 7 },
  ],
}

const mockStudentDetail = {
  user: {
    id: 1,
    name: 'Đỗ Minh Châu',
    email: 'chau.do@ielts.vn',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  skillStats: {
    reading: 8.5,
    listening: 8.0,
    writing: 7.5,
    speaking: 7.5,
  },
  attempts: [
    {
      id: 101,
      examId: 18,
      score: 8.5,
      createdAt: '2026-09-05T09:00:00.000Z',
      finishedAt: '2026-09-05T09:40:00.000Z',
      exam: { title: 'Cambridge 19 Test 2 Reading', skill: 'reading' },
    },
    {
      id: 102,
      examId: 14,
      score: 8.0,
      createdAt: '2026-09-04T14:00:00.000Z',
      finishedAt: '2026-09-04T14:35:00.000Z',
      exam: { title: 'Cambridge 19 Test 1 Listening', skill: 'listening' },
    },
  ],
  totalAttempts: 5,
}

describe('Admin Analytics Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminService.getAdminAnalytics.mockResolvedValue(mockAnalyticsData)
    adminService.getAdminUser.mockResolvedValue(mockStudentDetail)
  })

  it('renders analytics title and key overview statistics', async () => {
    renderWithClient(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Thống kê & Phân tích')).toBeInTheDocument()
    })

    expect(screen.getByText('Phân bố Band Score')).toBeInTheDocument()
    expect(screen.getByText('Phân tích theo kỹ năng')).toBeInTheDocument()
  })

  it('renders skill breakdown with accurate synchronized colors for each of the 4 skills', async () => {
    const { container } = renderWithClient(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Phân tích theo kỹ năng')).toBeInTheDocument()
    })

    // Reading
    const readingBadges = screen.getAllByText('Reading')
    const readingBadge = readingBadges.find(el => el.classList.contains('border-blue-200'))
    expect(readingBadge).toBeDefined()
    expect(readingBadge.className).toContain('text-blue-700')

    // Listening
    const listeningBadges = screen.getAllByText('Listening')
    const listeningBadge = listeningBadges.find(el => el.classList.contains('border-emerald-200'))
    expect(listeningBadge).toBeDefined()
    expect(listeningBadge.className).toContain('text-emerald-700')

    // Writing
    const writingBadges = screen.getAllByText('Writing')
    const writingBadge = writingBadges.find(el => el.classList.contains('border-purple-200'))
    expect(writingBadge).toBeDefined()
    expect(writingBadge.className).toContain('text-purple-700')

    // Speaking
    const speakingBadges = screen.getAllByText('Speaking')
    const speakingBadge = speakingBadges.find(el => el.classList.contains('border-amber-200'))
    expect(speakingBadge).toBeDefined()
    expect(speakingBadge.className).toContain('text-amber-700')

    // Verify progress bars have correct skill colors
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument()
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument()
    expect(container.querySelector('.bg-purple-500')).toBeInTheDocument()
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument()

    // Verify progress bar tracks have dark mode rounded styling
    const tracks = container.querySelectorAll('.bg-zinc-100.dark\\:bg-zinc-800')
    expect(tracks.length).toBeGreaterThanOrEqual(4)
  })

  it('renders Top 10 in split columns with rank badges and allows clicking to open StudentDetailModal', async () => {
    renderWithClient(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('Top Tier (Hạng 1 – 5)')).toBeInTheDocument()
      expect(screen.getByText('Hạng 6 – 10')).toBeInTheDocument()
    })

    // Rank 1 badge has gold styling
    const rank1Card = screen.getByText('Đỗ Minh Châu')
    expect(rank1Card).toBeInTheDocument()

    // Click on Rank 1 student to open modal
    fireEvent.click(rank1Card)

    await waitFor(() => {
      expect(adminService.getAdminUser).toHaveBeenCalledWith(1)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Modal contents
    expect(screen.getByText('Điểm trung bình theo kỹ năng')).toBeInTheDocument()
    expect(screen.getByText('Cambridge 19 Test 2 Reading')).toBeInTheDocument()
    expect(screen.getByText('Kỹ năng thế mạnh')).toBeInTheDocument()

    // Close modal
    const closeBtn = screen.getByText('Đóng')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('defaults the period dropdown to "Hôm nay" and queries with period=today', async () => {
    renderWithClient(<Analytics />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument()
    })
    expect(adminService.getAdminAnalytics).toHaveBeenCalledWith({ period: 'today' })
  })

  it('switches period via the dropdown and re-queries with the selected preset', async () => {
    renderWithClient(<Analytics />)

    const trigger = await screen.findByRole('button', { name: 'Hôm nay' })
    fireEvent.click(trigger)

    const allOption = await screen.findByRole('option', { name: 'Tất cả' })
    fireEvent.click(allOption)

    await waitFor(() => {
      expect(adminService.getAdminAnalytics).toHaveBeenCalledWith({ period: 'all' })
    })
    expect(await screen.findByRole('button', { name: 'Tất cả' })).toBeInTheDocument()
  })

  it('opens the custom date popover from the dropdown without changing period until Apply', async () => {
    renderWithClient(<Analytics />)

    const trigger = await screen.findByRole('button', { name: 'Hôm nay' })
    fireEvent.click(trigger)

    const customOption = await screen.findByRole('option', { name: 'Tùy chỉnh' })
    fireEvent.click(customOption)

    // Popover mở, nhưng nhãn nút vẫn giữ nguyên vì period chưa đổi
    expect(await screen.findByLabelText('Từ ngày')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(adminService.getAdminAnalytics).not.toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.anything() })
    )

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminService.getAdminAnalytics).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-10' })
    })
    expect(await screen.findByRole('button', { name: '01/09 – 10/09' })).toBeInTheDocument()
  })
})
