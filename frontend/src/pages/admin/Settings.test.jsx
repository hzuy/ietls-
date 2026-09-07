import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminLayout from '../../components/AdminLayout'
import * as authContext from '../../context/AuthContext'
import * as adminService from '../../services/adminService'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

describe('Admin System Settings Removal & Redirection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      role: 'admin',
      user: { id: 1, name: 'Admin', email: 'admin@test.com' },
      handleLogout: vi.fn(),
    })
    vi.spyOn(adminService, 'getTrashCount').mockResolvedValue(0)
    vi.spyOn(adminService, 'onTrashChanged').mockReturnValue(() => {})
  })

  it('does NOT render "Hệ thống" menu item in Admin sidebar navigation', () => {
    const qc = createTestQueryClient()
    rtlRender(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/admin']}>
          <AdminLayout />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // "Hệ thống" should not exist anywhere in navigation links
    expect(screen.queryByRole('link', { name: /Hệ thống/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Hệ thống')).not.toBeInTheDocument()

    // Other valid links should still exist
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Người dùng').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Quản lý nhân sự').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cài đặt').length).toBeGreaterThan(0) // Profile/password page
  })

  it('redirects /admin/settings to /admin (Dashboard)', () => {
    const qc = createTestQueryClient()
    rtlRender(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/admin/settings']}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<div>Admin Dashboard Content</div>} />
              <Route path="settings" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Should have redirected to dashboard content
    expect(screen.getByText('Admin Dashboard Content')).toBeInTheDocument()
  })
})
