import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Trash from './Trash'
import * as adminService from '../../services/adminService'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function render(ui) {
  const queryClient = createTestQueryClient()
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

const SAMPLE = [
  { id: 1, type: 'exam_reading', title: 'Đề Reading A', thumbnailUrl: null, deletedAt: '2026-08-20T00:00:00.000Z' },
  { id: 2, type: 'exam_series', title: 'Bộ đề X', thumbnailUrl: null, deletedAt: '2026-08-25T00:00:00.000Z' },
]

describe('Trash page — P3 modal + a11y + error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(adminService, 'getAdminTrash').mockResolvedValue(structuredClone(SAMPLE))
  })

  it('renders rows and neutral type badges after load', async () => {
    render(<Trash />)
    expect(await screen.findByText('Đề Reading A')).toBeInTheDocument()
    expect(screen.getByText('Bộ đề X')).toBeInTheDocument()
    // auto-purge countdown column
    expect(screen.getAllByText(/tự dọn sau|sắp được dọn/).length).toBeGreaterThan(0)
  })

  it('type filter only lists types present in the trash, with counts, and filters on selection', async () => {
    render(<Trash />)
    await screen.findByText('Đề Reading A')

    fireEvent.click(screen.getByRole('button', { name: 'Lọc theo loại' }))
    const options = await screen.findAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['Tất cả (2)', 'Bộ đề (1)', 'Đề Reading (1)'])

    fireEvent.click(options.find(o => o.textContent === 'Bộ đề (1)'))
    expect(screen.getByText('Bộ đề X')).toBeInTheDocument()
    expect(screen.queryByText('Đề Reading A')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên mục đã xóa...'), { target: { value: 'không có' } })
    expect(screen.getByText('Không có mục nào khớp bộ lọc')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Đặt lại'))
    expect(screen.getByText('Bộ đề X')).toBeInTheDocument()
    expect(screen.getByText('Đề Reading A')).toBeInTheDocument()
  })

  it('sorts by most recently deleted by default and can show the oldest first', async () => {
    render(<Trash />)
    await screen.findByText('Đề Reading A')
    const titles = () => screen.getAllByText(/^(Đề Reading A|Bộ đề X)$/).map(el => el.textContent)

    expect(titles()).toEqual(['Bộ đề X', 'Đề Reading A'])
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp' }))
    fireEvent.click((await screen.findAllByRole('option')).find(o => o.textContent === 'Cũ nhất'))
    expect(titles()).toEqual(['Đề Reading A', 'Bộ đề X'])
  })

  it('hides the filter bar when the trash is empty', async () => {
    adminService.getAdminTrash.mockResolvedValue([])
    render(<Trash />)
    expect(await screen.findByText('Thùng rác trống')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Tìm theo tên mục đã xóa...')).not.toBeInTheDocument()
  })

  it('P3-4: opening the delete confirm mounts a role="dialog"; Escape closes it', async () => {
    render(<Trash />)
    await screen.findByText('Đề Reading A')
    fireEvent.click(screen.getAllByText('Xóa vĩnh viễn')[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // focus moved into the dialog
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('P3-4: Tab inside the dialog keeps focus trapped (never escapes to body)', async () => {
    render(<Trash />)
    await screen.findByText('Đề Reading A')
    fireEvent.click(screen.getAllByText('Xóa vĩnh viễn')[0])
    const dialog = await screen.findByRole('dialog')

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true)
  })

  it('pings notifyTrashChanged after a successful restore (sidebar badge sync)', async () => {
    vi.spyOn(adminService, 'restoreTrashItem').mockResolvedValue({})
    const notify = vi.spyOn(adminService, 'notifyTrashChanged').mockImplementation(() => {})
    render(<Trash />)
    await screen.findByText('Đề Reading A')

    fireEvent.click(screen.getAllByText('Khôi phục')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Khôi phục' }))

    await waitFor(() => expect(notify).toHaveBeenCalled())
  })

  it('pings notifyTrashChanged after "Dọn sạch thùng rác"', async () => {
    vi.spyOn(adminService, 'purgeTrash').mockResolvedValue({})
    const notify = vi.spyOn(adminService, 'notifyTrashChanged').mockImplementation(() => {})
    render(<Trash />)
    await screen.findByText('Đề Reading A')

    fireEvent.click(screen.getByText('Dọn sạch thùng rác'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa tất cả' }))

    await waitFor(() => expect(notify).toHaveBeenCalled())
  })

  it('does NOT ping notifyTrashChanged when the action fails', async () => {
    vi.spyOn(adminService, 'permanentDeleteTrashItem').mockRejectedValue({
      response: { data: { message: 'nope' } },
    })
    const notify = vi.spyOn(adminService, 'notifyTrashChanged').mockImplementation(() => {})
    render(<Trash />)
    await screen.findByText('Đề Reading A')

    fireEvent.click(screen.getAllByText('Xóa vĩnh viễn')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))

    await screen.findAllByText('nope')
    expect(notify).not.toHaveBeenCalled()
  })

  it('P0-3: a failed permanent delete keeps the row and shows the backend message', async () => {
    vi.spyOn(adminService, 'permanentDeleteTrashItem').mockRejectedValue({
      response: { data: { message: 'Bộ đề còn 2 đề/cuốn đang hoạt động — vui lòng xóa các mục con trước.' } },
    })
    render(<Trash />)
    await screen.findByText('Bộ đề X')

    // series row is the 2nd "Xóa vĩnh viễn" button
    fireEvent.click(screen.getAllByText('Xóa vĩnh viễn')[1])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))

    // message surfaces in both the toast and the inline row-error
    expect((await screen.findAllByText(/còn 2 đề\/cuốn đang hoạt động/)).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Bộ đề X')).toBeInTheDocument()          // row still present
    expect(screen.getByText('Thử lại')).toBeInTheDocument()          // retry affordance
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()     // confirm modal closed
  })
})
