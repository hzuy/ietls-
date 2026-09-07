import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SampleManager from './SampleManager'
import { ToastProvider } from '../../context/ToastContext'
import * as sampleService from '../../services/sampleService'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

function render(ui) {
  const queryClient = createTestQueryClient()
  const result = rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
  return {
    ...result,
    rerender: (newUi) => result.rerender(
      <QueryClientProvider client={queryClient}>
        {newUi}
      </QueryClientProvider>
    ),
  }
}

// RichTextEditor dùng contentEditable + execCommand (không chạy được trong jsdom).
// Thay bằng textarea đơn giản, giữ đúng hợp đồng value/onChange/placeholder.
vi.mock('../../components/RichTextEditor', () => ({
  default: ({ value, onChange, placeholder }) => (
    <textarea
      aria-label="rich-text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}))

// SampleManager chốt tham chiếu service vào CONFIG lúc load module → phải mock cả
// module (không spyOn được sau khi CONFIG đã "chụp" hàm gốc).
vi.mock('../../services/sampleService', () => {
  const fn = () => vi.fn()
  return {
    getWritingSamples: fn(), getWritingSample: fn(),
    createWritingSample: fn(), updateWritingSample: fn(),
    deleteWritingSample: fn(), uploadWritingSampleThumbnailFile: fn(),
    getSpeakingSamples: fn(), getSpeakingSample: fn(),
    createSpeakingSample: fn(), updateSpeakingSample: fn(),
    deleteSpeakingSample: fn(), uploadSpeakingSampleThumbnailFile: fn(),
  }
})

const KINDS = {
  writing: {
    listFn: 'getWritingSamples',
    createFn: 'createWritingSample',
    otherListFn: 'getSpeakingSamples',
    otherCreateFn: 'createSpeakingSample',
    titlePlaceholder: 'VD: Cambridge IELTS 19 — Task 1 Sample Answer',
    contentPlaceholder: 'Nhập nội dung bài mẫu Writing...',
    listHeading: 'Writing Samples',
  },
  speaking: {
    listFn: 'getSpeakingSamples',
    createFn: 'createSpeakingSample',
    otherListFn: 'getWritingSamples',
    otherCreateFn: 'createWritingSample',
    titlePlaceholder: 'VD: Topic: Technology — Sample Answer Band 8',
    contentPlaceholder: 'Nhập nội dung bài mẫu Speaking (cue card, sample answer, tips...)',
    listHeading: 'Speaking Samples',
  },
}

describe('SampleManager — smoke (Giai đoạn 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sampleService.getWritingSamples.mockResolvedValue([])
    sampleService.getSpeakingSamples.mockResolvedValue([])
    sampleService.createWritingSample.mockResolvedValue({ id: 1 })
    sampleService.createSpeakingSample.mockResolvedValue({ id: 1 })
  })

  it.each(['writing', 'speaking'])(
    '%s: load list dùng đúng service, không đụng kind kia',
    async (kind) => {
      const c = KINDS[kind]
      render(<SampleManager kind={kind} />)

      expect(await screen.findByRole('heading', { name: c.listHeading })).toBeInTheDocument()
      await waitFor(() => expect(sampleService[c.listFn]).toHaveBeenCalledTimes(1))
      expect(sampleService[c.otherListFn]).not.toHaveBeenCalled()
    },
  )

  it.each(['writing', 'speaking'])(
    '%s: điền form tối thiểu → Lưu → gọi đúng create API với đúng body',
    async (kind) => {
      const c = KINDS[kind]
      render(<SampleManager kind={kind} />)

      // list → form
      fireEvent.click(await screen.findByRole('button', { name: '+ Thêm mới' }))

      // Chỉ điền 2 trường bắt buộc: tên + nội dung.
      fireEvent.change(screen.getByPlaceholderText(c.titlePlaceholder), {
        target: { value: '  Bài mẫu test  ' },
      })
      fireEvent.change(screen.getByPlaceholderText(c.contentPlaceholder), {
        target: { value: 'Nội dung bài mẫu tối thiểu.' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

      await waitFor(() => expect(sampleService[c.createFn]).toHaveBeenCalledTimes(1))
      expect(sampleService[c.createFn]).toHaveBeenCalledWith({
        title: 'Bài mẫu test',          // đã trim
        level: null,
        examType: null,
        content: 'Nội dung bài mẫu tối thiểu.',
        thumbnailUrl: null,
      })
      // Tags đã bỏ khỏi cả 2 kind → request không kèm field `tags`.
      expect(sampleService[c.createFn].mock.calls[0][0]).not.toHaveProperty('tags')
      // Không gọi nhầm sang kind kia.
      expect(sampleService[c.otherCreateFn]).not.toHaveBeenCalled()
      // Quay lại list và refetch.
      await waitFor(() => expect(sampleService[c.listFn]).toHaveBeenCalledTimes(2))
    },
  )

  it('chặn Lưu khi thiếu nội dung (BUG-15) — không gọi create', async () => {
    render(
      <ToastProvider>
        <SampleManager kind="writing" />
      </ToastProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: '+ Thêm mới' }))
    fireEvent.change(screen.getByPlaceholderText(KINDS.writing.titlePlaceholder), {
      target: { value: 'Chỉ có tên' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(screen.getByText('Vui lòng nhập nội dung bài mẫu')).toBeInTheDocument())
    expect(sampleService.createWritingSample).not.toHaveBeenCalled()
  })

  it('chặn Lưu khi thiếu tiêu đề — không gọi create', async () => {
    render(
      <ToastProvider>
        <SampleManager kind="writing" />
      </ToastProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: '+ Thêm mới' }))
    fireEvent.change(screen.getByPlaceholderText(KINDS.writing.contentPlaceholder), {
      target: { value: 'Nội dung bài viết nhưng không có tên' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(screen.getByText('Vui lòng nhập tên bài')).toBeInTheDocument())
    expect(sampleService.createWritingSample).not.toHaveBeenCalled()
  })

  it('cảnh báo confirm khi bấm Hủy trong khi form đang có dữ liệu chưa lưu (BUG-13)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SampleManager kind="writing" />)

    fireEvent.click(await screen.findByRole('button', { name: '+ Thêm mới' }))
    fireEvent.change(screen.getByPlaceholderText(KINDS.writing.titlePlaceholder), {
      target: { value: 'Dữ liệu dở dang' },
    })

    // Bấm Hủy khi confirm trả về false -> vẫn ở form
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument()

    // Bấm Hủy khi confirm trả về true -> thoát về list
    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(await screen.findByRole('heading', { name: 'Writing Samples' })).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it.each(['writing', 'speaking'])('Tags: %s form không còn khối Tags', async (kind) => {
    render(<SampleManager kind={kind} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Thêm mới' }))
    expect(screen.queryByText('Tags')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Thêm' })).not.toBeInTheDocument()
  })

  it.each([
    ['writing', 'getWritingSamples', 'Task 1'],
    ['speaking', 'getSpeakingSamples', 'Part 1'],
  ])('Tags: %s list không có cột "Tags", vẫn hiện badge task/part; tag cũ trong DB không render', async (kind, listFn, badge) => {
    sampleService[listFn].mockResolvedValue([
      { id: 5, title: 'Sample cũ', level: 'task1', examType: 'Đề X', tags: ['Band 8.0'], thumbnailUrl: null, createdAt: '2026-01-01T00:00:00Z' },
    ])
    render(<SampleManager kind={kind} />)

    expect(await screen.findByText('Sample cũ')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Tags' })).not.toBeInTheDocument()
    expect(screen.queryByText('Band 8.0')).not.toBeInTheDocument()
    expect(screen.getByText(badge)).toBeInTheDocument()
  })

  it('khi đổi prop kind trên cùng một instance: refetch dữ liệu mới và reset view/form/editing', async () => {
    sampleService.getWritingSamples.mockResolvedValue([
      { id: 1, title: 'Writing Item 1', level: 'task1', examType: '', thumbnailUrl: null, createdAt: '2026-01-01' },
    ])
    sampleService.getSpeakingSamples.mockResolvedValue([
      { id: 2, title: 'Speaking Item 1', level: 'task2', examType: '', thumbnailUrl: null, createdAt: '2026-01-02' },
    ])

    const { rerender } = render(<SampleManager kind="writing" />)

    expect(await screen.findByText('Writing Item 1')).toBeInTheDocument()
    expect(sampleService.getWritingSamples).toHaveBeenCalledTimes(1)
    expect(sampleService.getSpeakingSamples).not.toHaveBeenCalled()

    // Chuyển sang form trên writing
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm mới' }))
    expect(screen.getByRole('heading', { name: 'Thêm Writing Sample mới' })).toBeInTheDocument()

    // Đổi prop kind sang 'speaking' trên cùng instance
    rerender(<SampleManager kind="speaking" />)

    // Xác nhận gọi đúng API speaking
    await waitFor(() => expect(sampleService.getSpeakingSamples).toHaveBeenCalledTimes(1))
    // Xác nhận view được reset về 'list' và hiển thị dữ liệu của speaking
    expect(await screen.findByText('Speaking Item 1')).toBeInTheDocument()
    expect(screen.queryByText('Writing Item 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Thêm Writing Sample mới' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Speaking Samples' })).toBeInTheDocument()
  })

  it('chống race condition khi đổi kind nhanh: response của kind cũ đến muộn không ghi đè kind mới', async () => {
    let resolveWriting
    const writingPromise = new Promise(resolve => { resolveWriting = resolve })
    sampleService.getWritingSamples.mockImplementation(() => writingPromise)
    sampleService.getSpeakingSamples.mockResolvedValue([
      { id: 20, title: 'Speaking Fast Result', level: 'task1', examType: '', thumbnailUrl: null, createdAt: '2026-01-01' },
    ])

    const { rerender } = render(<SampleManager kind="writing" />)

    // Đổi ngay sang speaking khi writing request chưa xong
    rerender(<SampleManager kind="speaking" />)

    // Speaking trả về trước
    expect(await screen.findByText('Speaking Fast Result')).toBeInTheDocument()

    // Bây giờ writing request cũ mới xong
    resolveWriting([
      { id: 10, title: 'Writing Stale Result', level: 'task1', examType: '', thumbnailUrl: null, createdAt: '2026-01-01' },
    ])

    // Chờ 1 chút để xem writing stale result có bị ghi đè không
    await new Promise(r => setTimeout(r, 50))

    // Vẫn hiển thị Speaking, KHÔNG bị Writing đè lên
    expect(screen.getByText('Speaking Fast Result')).toBeInTheDocument()
    expect(screen.queryByText('Writing Stale Result')).not.toBeInTheDocument()
  })
})
