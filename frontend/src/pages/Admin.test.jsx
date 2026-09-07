import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Admin from './Admin'
import * as examService from '../services/examService'
import * as adminService from '../services/adminService'

describe('Admin Page — Cache Invalidation & Sync', () => {
  let trashListener = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(examService, 'getExamCounts').mockResolvedValue({
      cambridge: 5,
      reading: 10,
      listening: 8,
      writing: 6,
      speaking: 4,
    })
    vi.spyOn(examService, 'getExamSeries').mockResolvedValue([
      { id: 1, name: 'Cambridge IELTS 18', _count: { exams: 4 } },
      { id: 2, name: 'Cambridge IELTS 19', _count: { exams: 4 } },
    ])
    vi.spyOn(adminService, 'onTrashChanged').mockImplementation((cb) => {
      trashListener = cb
      return () => { trashListener = null }
    })
  })

  const renderAdmin = (initialEntry = '/admin/exams/cambridge') => {
    const testClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={testClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/admin/exams/*" element={<Admin />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('subscribes to onTrashChanged and loads counts and series on mount', async () => {
    renderAdmin()

    expect(adminService.onTrashChanged).toHaveBeenCalled()
    await waitFor(() => {
      expect(examService.getExamCounts).toHaveBeenCalled()
      expect(examService.getExamSeries).toHaveBeenCalled()
    })
  })

  it('refreshes counts and series when onTrashChanged event fires', async () => {
    renderAdmin()

    await waitFor(() => expect(examService.getExamSeries).toHaveBeenCalledTimes(1))

    // Simulate trash event (e.g. restoring an exam/series or purging)
    expect(trashListener).toBeInstanceOf(Function)
    await act(async () => {
      trashListener()
    })

    await waitFor(() => {
      expect(examService.getExamCounts).toHaveBeenCalledTimes(2)
      expect(examService.getExamSeries).toHaveBeenCalledTimes(2)
    })
  })

  it('hiển thị tiêu đề các tab sạch sẽ, không đính kèm số đếm bài tập bên cạnh', async () => {
    renderAdmin()

    await waitFor(() => {
      expect(examService.getExamCounts).toHaveBeenCalled()
    })

    const tabs = ['IELTS Test', 'Reading', 'Listening', 'Writing', 'Speaking']
    tabs.forEach(tabName => {
      const tabLink = screen.getByRole('link', { name: tabName })
      expect(tabLink).toBeInTheDocument()
      expect(tabLink.textContent.trim()).toBe(tabName)
    })

    // Xác nhận không có badge số xuất hiện cạnh tiêu đề tab
    expect(screen.queryByText('10')).not.toBeInTheDocument()
    expect(screen.queryByText('8')).not.toBeInTheDocument()
    expect(screen.queryByText('6')).not.toBeInTheDocument()
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })
})
