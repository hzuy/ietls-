import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Accounts from './Accounts'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

const mockAccounts = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin',
    isLocked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Teacher User',
    email: 'teacher@test.com',
    role: 'teacher',
    isLocked: false,
    createdAt: '2026-02-01T00:00:00.000Z',
  },
]

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function renderAccounts(queryClient = createTestQueryClient()) {
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Accounts />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Accounts page — TanStack Query & Skeleton caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ email: 'admin@test.com', role: 'admin' }))
  })

  it('renders accounts list when data loads', async () => {
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)

    renderAccounts()

    expect(await screen.findByText('Teacher User')).toBeInTheDocument()
    expect(screen.getByText('teacher@test.com')).toBeInTheDocument()
  })

  it('renders immediately from cache without delay', async () => {
    const qc = createTestQueryClient()
    qc.setQueryData(['admin', 'accounts'], mockAccounts)
    vi.spyOn(adminService, 'getAdminAccounts').mockResolvedValue(mockAccounts)

    renderAccounts(qc)

    expect(screen.getByText('Teacher User')).toBeInTheDocument()
    expect(screen.getByText('teacher@test.com')).toBeInTheDocument()
  })
})
