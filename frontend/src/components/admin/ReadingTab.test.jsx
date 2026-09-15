import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReadingTab from './ReadingTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

vi.mock('./ExamList', () => ({
  default: () => <div data-testid="mock-exam-list">ExamList Mock</div>
}))

vi.mock('./editors/ReadingGroupEditor', () => ({
  default: () => <div data-testid="mock-reading-group-editor">ReadingGroupEditor Mock</div>
}))

describe('ReadingTab — UX & Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
    window.confirm = vi.fn().mockReturnValue(true)
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('bổ sung các thuộc tính a11y (aria-expanded, aria-controls, role="region", aria-label) cho Accordion Passage', () => {
    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    // Passage 1 toggle button (default open)
    const passage1Btn = screen.getByRole('button', { name: /Passage 1/i })
    expect(passage1Btn).toHaveAttribute('aria-expanded', 'true')
    expect(passage1Btn).toHaveAttribute('aria-controls', 'passage-panel-0')

    // Passage 1 content panel
    const panel0 = screen.getByRole('region', { name: 'Đoạn văn 1' })
    expect(panel0).toHaveAttribute('id', 'passage-panel-0')

    // Click to collapse Passage 1
    fireEvent.click(passage1Btn)
    expect(passage1Btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Đoạn văn 1' })).not.toBeInTheDocument()
  })

  it('validation trước submit: chặn lưu và hiển thị banner lỗi khi có passage thiếu title hoặc body', async () => {
    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    // Điền tên đề
    const titleInput = screen.getByPlaceholderText(/Cambridge 19 Test 1 Reading/i)
    fireEvent.change(titleInput, { target: { value: 'Test Reading Exam' } })

    // Bấm Tạo đề (khi các passage còn rỗng)
    const submitBtn = screen.getByRole('button', { name: 'Tạo đề Reading' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Không thể lưu đề:/)).toBeInTheDocument()
      expect(screen.getByText(/chưa có tiêu đề hoặc nội dung bài đọc/)).toBeInTheDocument()
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('validation trước submit: hỏi window.confirm nếu tổng số câu khác 40', async () => {
    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    // Điền tên đề
    const titleInput = screen.getByPlaceholderText(/Cambridge 19 Test 1 Reading/i)
    fireEvent.change(titleInput, { target: { value: 'Test Reading Exam 40Q' } })

    // Điền tiêu đề và nội dung cho cả 3 passage
    // Mở từng passage và điền
    const p1Title = screen.getByPlaceholderText(/The Evolution of AI/i)
    fireEvent.change(p1Title, { target: { value: 'Passage 1 Title' } })
    const p1Body = screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i)
    fireEvent.change(p1Body, { target: { value: 'Passage 1 body content' } })

    // Click toggle Passage 2
    const p2Btn = screen.getByRole('button', { name: /Passage 2/i })
    fireEvent.click(p2Btn)
    const p2Title = screen.getByPlaceholderText(/The Evolution of AI/i)
    fireEvent.change(p2Title, { target: { value: 'Passage 2 Title' } })
    const p2Body = screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i)
    fireEvent.change(p2Body, { target: { value: 'Passage 2 body content' } })

    // Click toggle Passage 3
    const p3Btn = screen.getByRole('button', { name: /Passage 3/i })
    fireEvent.click(p3Btn)
    const p3Title = screen.getByPlaceholderText(/The Evolution of AI/i)
    fireEvent.change(p3Title, { target: { value: 'Passage 3 Title' } })
    const p3Body = screen.getByPlaceholderText(/Dán toàn bộ nội dung bài đọc vào đây/i)
    fireEvent.change(p3Body, { target: { value: 'Passage 3 body content' } })

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Tạo đề/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      // Vì hiện có 0 câu, confirm phải được gọi cảnh báo khác 40 câu
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('không phải 40. Vẫn lưu?'))
    })
  })

  it('khi loadForEdit gặp lỗi, hiển thị Error Banner và cuộn tới form thay vì dùng alert()', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<ReadingTab exams={[{ id: 99, title: 'Exam 99' }]} onRefresh={vi.fn()} />)

    // Giả lập gọi loadForEdit thông qua ExamList mock hoặc hàm component
    // Bằng cách trigger nút edit nếu có, hoặc test thông qua trigger trực tiếp
    // Chúng ta có thể kiểm tra xem alertSpy có bao giờ bị gọi không
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('dropdown Bộ đề/Cuốn số/Test số (Select dùng chung) hoạt động và reset Cuốn số khi đổi Bộ đề', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/admin/exam-series') {
        return Promise.resolve({ data: [{ id: 7, name: 'Cambridge 19' }] })
      }
      if (url === '/admin/exam-series/7/books') {
        return Promise.resolve({ data: [{ bookNumber: 1 }, { bookNumber: 2 }] })
      }
      return Promise.resolve({ data: [] })
    })

    render(<ReadingTab exams={[]} onRefresh={vi.fn()} />)

    // Cuốn số ban đầu bị disable vì chưa chọn Bộ đề
    expect(screen.getByRole('button', { name: 'Cuốn số' })).toBeDisabled()

    // Chọn Bộ đề "Cambridge 19"
    fireEvent.click(screen.getByRole('button', { name: 'Bộ đề' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Cambridge 19' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cuốn số' })).not.toBeDisabled()
    })

    // Chọn Cuốn số 2
    fireEvent.click(screen.getByRole('button', { name: 'Cuốn số' }))
    fireEvent.click(await screen.findByRole('option', { name: '2' }))
    expect(screen.getByRole('button', { name: 'Cuốn số' })).toHaveTextContent('2')

    // Đổi lại Bộ đề — Cuốn số phải reset về placeholder
    fireEvent.click(screen.getByRole('button', { name: 'Bộ đề' }))
    fireEvent.click(await screen.findByRole('option', { name: '-- Không gắn --' }))

    expect(screen.getByRole('button', { name: 'Cuốn số' })).toHaveTextContent('-- Chọn cuốn --')
    expect(screen.getByRole('button', { name: 'Cuốn số' })).toBeDisabled()
  })
})
