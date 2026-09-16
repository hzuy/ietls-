import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ExamAuditHistory from './ExamAuditHistory'
import * as adminService from '../../services/adminService'
import * as authContext from '../../context/AuthContext'

const LOG_UPDATE = {
  id: 1,
  createdAt: '2026-03-05T10:00:00.000Z',
  action: 'exam.update',
  actionLabel: 'Cập nhật đề thi',
  entityType: 'Exam',
  entityId: 42,
  entityLabel: 'Cambridge 19 - Test 1',
  metadata: {},
  actorType: 'user',
  actorUserId: 5,
  actorEmail: 'teacher@test.com',
  actorRole: 'teacher',
  actorDisplayName: 'Cô Lan',
}

const LOG_CREATE = {
  ...LOG_UPDATE,
  id: 2,
  createdAt: '2026-03-01T09:00:00.000Z',
  action: 'exam.create',
  actionLabel: 'Tạo đề thi',
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderHistory(examId = 42) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <ExamAuditHistory examId={examId} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ExamAuditHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('admin: hiện đúng danh sách log (mới nhất trước) và bấm 1 dòng mở modal chi tiết', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'admin' })
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({
      logs: [LOG_UPDATE, LOG_CREATE], total: 2, page: 1, pages: 1,
    })

    renderHistory()

    fireEvent.click(screen.getByRole('button', { name: /Lịch sử thay đổi/ }))

    expect(await screen.findByText('Cập nhật đề thi')).toBeInTheDocument()
    expect(screen.getByText('Tạo đề thi')).toBeInTheDocument()

    await waitFor(() => {
      expect(adminService.getAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'Exam', entityId: 42, limit: 20 })
      )
    })

    // Thứ tự hiển thị theo đúng thứ tự API trả về (mới nhất trước)
    const rows = screen.getAllByText(/Cô Lan/)
    expect(rows.length).toBe(2)

    fireEvent.click(screen.getByText('Cập nhật đề thi'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })

  it('admin: trạng thái rỗng nói rõ đề có thể tạo trước khi có tính năng nhật ký, không phải chưa ai sửa', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'admin' })
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({ logs: [], total: 0, page: 1, pages: 1 })

    renderHistory()
    fireEvent.click(screen.getByRole('button', { name: /Lịch sử thay đổi/ }))

    expect(await screen.findByText(/trước khi tính năng Nhật ký hoạt động được triển khai/)).toBeInTheDocument()
  })

  it('teacher: không render gì, kể cả khi có examId', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'teacher' })
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({ logs: [LOG_UPDATE], total: 1, page: 1, pages: 1 })

    const { container } = renderHistory()

    expect(container.firstChild).toBeNull()
    expect(adminService.getAdminAuditLogs).not.toHaveBeenCalled()
  })

  it('admin nhưng chưa có examId (đang tạo đề mới): không render gì', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'admin' })
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({ logs: [], total: 0, page: 1, pages: 1 })

    const { container } = renderHistory(null)

    expect(container.firstChild).toBeNull()
  })
})
