import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
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

  const renderAdmin = () =>
    render(
      <MemoryRouter initialEntries={['/admin/exams/cambridge']}>
        <Routes>
          <Route path="/admin/exams/*" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    )

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
})
