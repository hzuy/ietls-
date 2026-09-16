import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AuditLogs from './AuditLogs'
import * as adminService from '../../services/adminService'
import * as authContext from '../../context/AuthContext'
import { AdminRoute } from '../../App'

const FILTERS = {
  actions: [
    { value: 'exam.create', label: 'Tạo đề thi' },
    { value: 'sample.delete', label: 'Xóa bài mẫu' },
  ],
  entityTypes: ['Exam', 'WritingSample'],
  actors: [{ id: 5, email: 'teacher@test.com', name: 'Cô Lan' }],
}

const LOG_USER = {
  id: 1,
  createdAt: '2026-03-05T10:00:00.000Z',
  action: 'exam.create',
  actionLabel: 'Tạo đề thi',
  entityType: 'Exam',
  entityId: 101,
  entityLabel: 'Đề Cambridge 19 - Test 1',
  metadata: { title: 'Đề mới', questionsCount: 40 },
  actorType: 'user',
  actorUserId: 5,
  actorEmail: 'teacher@test.com',
  actorRole: 'teacher',
  actorDisplayName: 'Cô Lan',
}

const LOG_SYSTEM = {
  id: 2,
  createdAt: '2026-03-06T08:00:00.000Z',
  action: 'trash.auto_purge',
  actionLabel: 'Tự động xóa vĩnh viễn (hệ thống)',
  entityType: 'Trash',
  entityId: null,
  entityLabel: 'auto purge batch',
  metadata: { writingSample: 2 },
  actorType: 'system',
  actorUserId: null,
  actorEmail: null,
  actorRole: null,
  actorDisplayName: null,
}

const LOG_DELETED_ACTOR = {
  id: 3,
  createdAt: '2026-03-07T09:30:00.000Z',
  action: 'sample.delete',
  actionLabel: 'Xóa bài mẫu',
  entityType: 'WritingSample',
  entityId: 202,
  entityLabel: 'Sample Gamma',
  metadata: null,
  actorType: 'user',
  actorUserId: null,
  actorEmail: 'ghost@test.com',
  actorRole: 'teacher',
  actorDisplayName: 'ghost@test.com',
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderAuditLogs() {
  return rtlRender(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <AuditLogs />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AuditLogs page — bảng + modal chi tiết', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getAdminAuditLogFilters').mockResolvedValue(FILTERS)
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({
      logs: [LOG_USER, LOG_SYSTEM, LOG_DELETED_ACTOR], total: 3, page: 1, pages: 1,
    })
  })

  it('renders actor/action/entity columns, including system actor and a deleted-account actor', async () => {
    renderAuditLogs()

    expect(await screen.findByText('Cô Lan')).toBeInTheDocument()
    expect(screen.getByText('teacher@test.com')).toBeInTheDocument()
    expect(screen.getByText('Tạo đề thi')).toBeInTheDocument()
    expect(screen.getByText('Đề Cambridge 19 - Test 1')).toBeInTheDocument()

    // system actor — clearly labeled, not blank
    expect(screen.getByText('Hệ thống')).toBeInTheDocument()
    expect(screen.getByText('Tác vụ tự động')).toBeInTheDocument()

    // deleted-account actor — email snapshot + a visible "account gone" indicator
    expect(screen.getByText('ghost@test.com')).toBeInTheDocument()
    expect(screen.getByText('Đã xóa')).toBeInTheDocument()
  })

  it('re-queries with actorUserId when the "Người thực hiện" dropdown changes', async () => {
    renderAuditLogs()
    await waitFor(() => expect(adminService.getAdminAuditLogs).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Người thực hiện' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Cô Lan' }))

    await waitFor(() => {
      expect(adminService.getAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: '5' })
      )
    })
  })

  it('re-queries with the selected action when "Loại hành động" dropdown changes', async () => {
    renderAuditLogs()
    await waitFor(() => expect(adminService.getAdminAuditLogs).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Loại hành động' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Xóa bài mẫu' }))

    await waitFor(() => {
      expect(adminService.getAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sample.delete' })
      )
    })
  })

  it('opens the detail modal with readable metadata key/value pairs (no raw JSON dump)', async () => {
    renderAuditLogs()
    await screen.findByText('Cô Lan')

    fireEvent.click(screen.getAllByText('Chi tiết')[0])
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('title')).toBeInTheDocument()
    expect(within(dialog).getByText('Đề mới')).toBeInTheDocument()
    expect(within(dialog).getByText('questionsCount')).toBeInTheDocument()
    expect(within(dialog).getByText('40')).toBeInTheDocument()
    // never dump the raw JSON string
    expect(within(dialog).queryByText(/"title":"Đề mới"/)).not.toBeInTheDocument()
  })

  it('shows a short empty-metadata message instead of blank space when metadata is null', async () => {
    renderAuditLogs()
    await screen.findByText('ghost@test.com')

    fireEvent.click(screen.getAllByText('Chi tiết')[2])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Không có dữ liệu bổ sung')).toBeInTheDocument()
  })

  it('Escape closes the detail modal', async () => {
    renderAuditLogs()
    await screen.findByText('Cô Lan')
    fireEvent.click(screen.getAllByText('Chi tiết')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('AuditLogs page — trạng thái rỗng', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getAdminAuditLogFilters').mockResolvedValue(FILTERS)
  })

  it('shows the feature-rollout empty state when there are no records at all (no filters applied)', async () => {
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({ logs: [], total: 0, page: 1, pages: 1 })
    renderAuditLogs()

    expect(await screen.findByText('Chưa có nhật ký nào')).toBeInTheDocument()
    expect(screen.getByText(/không có dữ liệu lịch sử trước đó/i)).toBeInTheDocument()
  })

  it('shows a plain "no match" message (not the rollout message) when a filter yields zero results', async () => {
    vi.spyOn(adminService, 'getAdminAuditLogs')
      .mockResolvedValueOnce({ logs: [LOG_USER], total: 1, page: 1, pages: 1 })
      .mockResolvedValue({ logs: [], total: 0, page: 1, pages: 1 })
    renderAuditLogs()
    await screen.findByText('Cô Lan')

    fireEvent.click(screen.getByRole('button', { name: 'Nhóm đối tượng' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Bài mẫu Writing' }))

    expect(await screen.findByText('Không có nhật ký nào khớp bộ lọc')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có nhật ký nào')).not.toBeInTheDocument()
  })
})

describe('AuditLogs page — chặn truy cập teacher (route guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getAdminAuditLogFilters').mockResolvedValue(FILTERS)
    vi.spyOn(adminService, 'getAdminAuditLogs').mockResolvedValue({ logs: [], total: 0, page: 1, pages: 1 })
  })

  it('redirects a teacher away from /admin/audit-logs instead of rendering the page', async () => {
    localStorage.setItem('token', 'fake-token')
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'teacher' })

    rtlRender(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/admin/audit-logs']}>
          <Routes>
            <Route path="/" element={<div>Trang chủ</div>} />
            <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('Trang chủ')).toBeInTheDocument()
    expect(screen.queryByText('Nhật ký hoạt động')).not.toBeInTheDocument()
    localStorage.removeItem('token')
  })

  it('lets an admin through to /admin/audit-logs', async () => {
    localStorage.setItem('token', 'fake-token')
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: 'admin' })

    rtlRender(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/admin/audit-logs']}>
          <Routes>
            <Route path="/" element={<div>Trang chủ</div>} />
            <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('Nhật ký hoạt động')).toBeInTheDocument()
    localStorage.removeItem('token')
  })
})
