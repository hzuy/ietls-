import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UserDetail from './UserDetail'
import * as adminService from '../../services/adminService'
import { ToastProvider } from '../../context/ToastContext'

vi.mock('../../services/adminService', () => ({
  getAdminUser: vi.fn(),
  toggleUserLock: vi.fn(),
  deleteAdminUser: vi.fn(),
  resetUserPassword: vi.fn(),
}))

const mockUserData = {
  user: {
    id: 42,
    name: 'Nguyen Van A',
    email: 'nguyenvana@example.com',
    role: 'user',
    isLocked: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  attempts: [
    {
      id: 1,
      skill: 'reading',
      score: 7.0,
      createdAt: '2026-02-01T10:00:00.000Z',
      exam: { title: 'Cam 19 Test 1' }
    }
  ],
  skillStats: {
    reading: 7.0,
    listening: 6.5,
    writing: null,
    speaking: null
  },
  totalAttempts: 25,
  shownAttempts: 1
}

function renderComponent() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/admin/users/42']}>
        <Routes>
          <Route path="/admin/users/:id" element={<UserDetail />} />
          <Route path="/admin/users" element={<div>User List Page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('UserDetail — BUG-06 & BUG-07 Action Handlers & Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminService.getAdminUser.mockResolvedValue(mockUserData)
  })

  it('BUG-06: hiển thị đúng phân trang số lượt thi hiện có so với tổng số (X of Y)', async () => {
    renderComponent()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()
    // shownAttempts = 1, totalAttempts = 25
    expect(screen.getByText('Hiển thị 1 lượt thi gần nhất / tổng 25 lượt')).toBeInTheDocument()
    expect(screen.getByText('Tổng lượt thi')).toBeInTheDocument()
  })

  it('BUG-07: Khoá/Mở khoá tài khoản gọi đúng API toggleUserLock và cập nhật UI tức thì', async () => {
    adminService.toggleUserLock.mockResolvedValueOnce({ isLocked: true })
    renderComponent()

    const lockBtn = await screen.findByRole('button', { name: 'Khoá' })
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()

    fireEvent.click(lockBtn)
    await waitFor(() => expect(adminService.toggleUserLock).toHaveBeenCalledWith(42))

    // UI chuyển sang trạng thái đã khoá
    expect(await screen.findByText('Đã khoá')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở khoá' })).toBeInTheDocument()
  })

  it('BUG-07: Reset mật khẩu mở modal xác nhận, gọi resetUserPassword và hiển thị mật khẩu mới', async () => {
    adminService.resetUserPassword.mockResolvedValueOnce({ newPassword: 'TempPassword123' })
    renderComponent()

    const resetBtn = await screen.findByRole('button', { name: /Reset MK/i })
    fireEvent.click(resetBtn)

    // Modal xác nhận xuất hiện
    expect(screen.getByText(/Tạo mật khẩu ngẫu nhiên mới/i)).toBeInTheDocument()
    const confirmResetBtn = screen.getByRole('button', { name: 'Reset' })
    fireEvent.click(confirmResetBtn)

    await waitFor(() => expect(adminService.resetUserPassword).toHaveBeenCalledWith(42))
    // Modal kết quả hiển thị mật khẩu mới
    expect(await screen.findByText('TempPassword123')).toBeInTheDocument()
  })

  it('BUG-07: Xóa người dùng mở modal xác nhận, gọi deleteAdminUser và điều hướng về /admin/users', async () => {
    adminService.deleteAdminUser.mockResolvedValueOnce({ message: 'Deleted' })
    renderComponent()

    const delBtn = await screen.findByRole('button', { name: 'Xóa' })
    fireEvent.click(delBtn)

    // Modal xác nhận xóa xuất hiện
    expect(screen.getByText(/Xóa người dùng/i)).toBeInTheDocument()
    const confirmDelBtn = screen.getAllByRole('button', { name: 'Xóa' })[1] // button in modal
    fireEvent.click(confirmDelBtn)

    await waitFor(() => expect(adminService.deleteAdminUser).toHaveBeenCalledWith(42))
    expect(await screen.findByText('User List Page')).toBeInTheDocument()
  })
})
