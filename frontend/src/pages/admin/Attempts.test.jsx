import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Attempts from './Attempts'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

const mockAttemptsData = {
  attempts: [],
  total: 0,
  pages: 1,
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderAttempts() {
  return rtlRender(
    <QueryClientProvider client={createTestQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <Attempts />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Attempts page — filter/sort dropdowns (Select dùng chung)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getAdminExamSeriesForFilter').mockResolvedValue([{ id: 9, name: 'Cambridge 19' }])
    vi.spyOn(adminService, 'getAdminAttempts').mockResolvedValue(mockAttemptsData)
  })

  it('re-queries with sortBy/sortOrder when the sort dropdown changes', async () => {
    renderAttempts()

    await waitFor(() => {
      expect(adminService.getAdminAttempts).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Band cao nhất' }))

    await waitFor(() => {
      expect(adminService.getAdminAttempts).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'score', sortOrder: 'desc' })
      )
    })
  })

  it('re-queries with the selected skill when the Kỹ năng dropdown changes', async () => {
    renderAttempts()
    await waitFor(() => expect(adminService.getAdminAttempts).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Kỹ năng' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Reading' }))

    await waitFor(() => {
      expect(adminService.getAdminAttempts).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'reading' })
      )
    })
  })

  it('re-queries with the selected series when the Bộ đề dropdown changes', async () => {
    renderAttempts()
    await waitFor(() => expect(adminService.getAdminExamSeriesForFilter).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Bộ đề' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Cambridge 19' }))

    await waitFor(() => {
      expect(adminService.getAdminAttempts).toHaveBeenCalledWith(
        expect.objectContaining({ seriesId: '9' })
      )
    })
  })
})
