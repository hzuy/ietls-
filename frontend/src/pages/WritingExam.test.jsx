import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WritingExam from './WritingExam'
import * as examService from '../services/examService'
import * as draftService from '../services/draftService'

vi.mock('../services/examService', () => ({
  getWritingExam: vi.fn(),
  getWritingMyResults: vi.fn(),
  submitWritingExam: vi.fn(),
  getWritingStatus: vi.fn(),
  getFullTestStatus: vi.fn(() => Promise.resolve({ isComplete: false })),
  retryWritingGrading: vi.fn(),
}))

vi.mock('../services/adminService', () => ({
  getAdminSettings: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock('../services/draftService', () => ({
  saveDraft: vi.fn(),
  loadDraft: vi.fn(() => null),
  clearDraft: vi.fn(),
  isDataEmpty: vi.fn(() => true),
}))

const mockUser = { id: 'u1', name: 'Test User' }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const mockUseBrowserHistoryGuard = vi.fn((enabled) => ({
  showModal: false,
  stay: vi.fn(),
  leave: vi.fn(),
}))

vi.mock('../hooks/useBrowserHistoryGuard', () => ({
  useBrowserHistoryGuard: (...args) => mockUseBrowserHistoryGuard(...args),
}))

const mockTask1 = {
  id: 'task-1',
  number: 1,
  prompt: 'The chart illustrates the exports from 2000 to 2010.',
  timeLimit: 20,
}

const mockTask2 = {
  id: 'task-2',
  number: 2,
  prompt: 'Some people think universities should focus on practical skills. Discuss.',
  timeLimit: 40,
}

describe('WritingExam - KIỂM THỬ BẮT BUỘC: Ca 9 đến Ca 12', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ca 9: bản ghi cũ (chỉ có comment, không có trường mới) hiển thị bình thường, không lỗi', async () => {
    examService.getWritingExam.mockResolvedValue({
      id: 'exam-1',
      title: 'IELTS Academic Writing Test 1',
      writingTasks: [mockTask1],
    })

    const legacyResults = [
      {
        taskId: 'task-1',
        status: 'graded',
        overall: 6.0,
        essayText: 'The chart illustrates the exports across multiple countries between 2000 and 2010 in detail.',
        criteria: {
          task_achievement: { score: 6.0, comment: 'Đã hoàn thành các yêu cầu cơ bản của đề bài.' },
          coherence_cohesion: { score: 6.0, comment: 'Bài viết có tính liên kết tương đối tốt.' },
          lexical_resource: { score: 6.0, comment: 'Từ vựng đáp ứng yêu cầu cơ bản.' },
          grammatical_range: { score: 6.0, comment: 'Cấu trúc câu kết hợp đơn và phức.' },
        },
        corrections: [],
      },
    ]

    examService.getWritingMyResults.mockResolvedValue(legacyResults)

    render(
      <MemoryRouter initialEntries={['/exams/exam-1/writing?viewResult=true&attemptId=att-legacy']}>
        <Routes>
          <Route path="/exams/:id/writing" element={<WritingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Task 1 band score')).toBeInTheDocument()
    })

    // Hiển thị gợi ý tổng quan bình thường ở cột phải
    expect(screen.getAllByText('Đã hoàn thành các yêu cầu cơ bản của đề bài.').length).toBeGreaterThanOrEqual(1)

    // Bấm tab "Chi tiết nhận xét" để xem chi tiết các tiêu chí bản ghi cũ
    fireEvent.click(screen.getByText('Chi tiết nhận xét'))
    const toggleBtns = screen.getAllByRole('button', { name: /^Chi tiết nhận xét .+/i })
    expect(toggleBtns).toHaveLength(4)
    fireEvent.click(toggleBtns[1])
    expect(screen.getByText('Bài viết có tính liên kết tương đối tốt.')).toBeInTheDocument()

    // Ẩn các nhóm Ưu điểm, Nhược điểm, Cách cải thiện vì bản ghi cũ không có
    expect(screen.queryByText('Ưu điểm')).toBeNull()
    expect(screen.queryByText('Nhược điểm')).toBeNull()
    expect(screen.queryByText('Cách cải thiện')).toBeNull()

    // Ẩn tab Bài mẫu nâng band vì không có model_essay, không có tab Bản gốc hay Đã sửa
    expect(screen.queryByText(/Bài mẫu band/)).toBeNull()
    expect(screen.queryByText('Đã sửa')).toBeNull()
    expect(screen.queryByText('Bản gốc')).toBeNull()

    // Header có nút Đóng và useBrowserHistoryGuard không kích hoạt trong trang kết quả
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quay lại/i })).not.toBeInTheDocument()
    expect(mockUseBrowserHistoryGuard).toHaveBeenCalledWith(false, expect.any(Function), expect.any(String))
  })

  it('Ca 10: trang kết quả sửa thẳng lỗi vào bản gốc, có chuyển đổi "Bài làm" và "Bài mẫu band X", hai cột cao bằng nhau, cột trái cuộn riêng', async () => {
    examService.getWritingExam.mockResolvedValue({
      id: 'exam-1',
      title: 'IELTS Academic Writing Test 1',
      writingTasks: [mockTask1],
    })

    const modernResults = [
      {
        taskId: 'task-1',
        status: 'graded',
        overall: 6.5,
        essayText: 'The line graph provides a detailed comparison of automobile production across three countries.',
        criteria: {
          task_achievement: {
            score: 6.5,
            summary: 'Tóm tắt tốt các xu hướng chính.',
            strengths: ['Có số liệu dẫn chứng cụ thể từ năm 2000.'],
            weaknesses: ['Đoạn tổng quan chưa nêu bật điểm giao nhau.'],
            how_to_improve: ['Bổ sung nhận xét so sánh tổng thể trong overview.'],
          },
          coherence_cohesion: {
            score: 6.5,
            summary: 'Bố cục bài viết mạch lạc.',
            strengths: ['Sử dụng liên từ chuyển đoạn hợp lý.'],
            weaknesses: ['Một số câu liên kết còn máy móc.'],
            how_to_improve: ['Đa dạng hóa trạng từ liên kết.'],
          },
          lexical_resource: {
            score: 6.5,
            summary: 'Vốn từ vựng tương đối phong phú.',
            strengths: ['Dùng đúng các động từ mô tả xu hướng.'],
            weaknesses: ['Lặp lại từ car nhiều lần.'],
            how_to_improve: ['Thay thế bằng automobile, motor vehicle.'],
          },
          grammatical_range: {
            score: 6.5,
            summary: 'Đa dạng cấu trúc ngữ pháp.',
            strengths: ['Kết hợp câu ghép và mệnh đề quan hệ.'],
            weaknesses: ['Còn 2 lỗi mạo từ.'],
            how_to_improve: ['Rà soát lại mạo từ xác định the.'],
          },
        },
        model_essay: {
          target_band: 7.5,
          paragraphs: [
            'The line graph provides a comprehensive comparison of automobile production across three nations from 2000 to 2010.',
            'Overall, the United States witnessed a substantial increase in output, eventually surpassing Japan to become the leading manufacturer.',
          ],
          key_changes: [
            'Nâng cấp cụm "go up fast" thành "witnessed a substantial increase"',
            'Bổ sung đoạn overview rõ nét so sánh xu hướng 3 quốc gia',
          ],
        },
        top_priorities: [
          'Viết đoạn overview rõ ràng hơn',
          'Tránh lặp danh từ car',
          'Sửa lỗi mạo từ the',
        ],
        corrections: [
          { original: 'automobile', corrected: 'motor vehicles', type: 'upgrade', explanation: 'Nâng cấp từ vựng' },
          { original: 'comparison', corrected: 'overview', type: 'vocabulary', explanation: 'Từ vựng phù hợp' },
        ],
      },
    ]

    examService.getWritingMyResults.mockResolvedValue(modernResults)

    render(
      <MemoryRouter initialEntries={['/exams/exam-1/writing?viewResult=true&attemptId=att-modern']}>
        <Routes>
          <Route path="/exams/:id/writing" element={<WritingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Task 1 band score')).toBeInTheDocument()
    })

    // 1. Kiểm tra: có các tab "Bài làm", "Chi tiết nhận xét", và "Bài mẫu band 7.5"
    expect(screen.queryByText('Đã sửa')).toBeNull()
    expect(screen.queryByText('Bản gốc')).toBeNull()
    expect(screen.getByText('Bài làm')).toBeInTheDocument()
    expect(screen.getByText('Chi tiết nhận xét')).toBeInTheDocument()
    expect(screen.getByText('Bài mẫu band 7.5')).toBeInTheDocument()

    // 2. Chuyển sang tab "Bài mẫu band 7.5" và kiểm tra nội dung + key_changes
    fireEvent.click(screen.getByText('Bài mẫu band 7.5'))
    expect(screen.getByText(/The line graph provides a comprehensive comparison/)).toBeInTheDocument()
    expect(screen.getByText(/Nâng cấp cụm "go up fast"/)).toBeInTheDocument()

    // 3. Kiểm tra layout: hai cột cao bằng nhau (lg:min-h-[320px], items-stretch) và cột trái cuộn riêng (overflow-y-auto, custom-scrollbar)
    const leftColumnScroll = document.querySelector('.overflow-y-auto.custom-scrollbar')
    expect(leftColumnScroll).not.toBeNull()
  })

  it('Ca 11: tab "Chi tiết nhận xét" hiển thị đủ 4 thẻ với Ưu điểm, Nhược điểm, Cách cải thiện; cột phải có tiêu đề "Tổng quan"', async () => {
    examService.getWritingExam.mockResolvedValue({
      id: 'exam-1',
      title: 'IELTS Academic Writing Test 1',
      writingTasks: [mockTask1],
    })

    const modernResults = [
      {
        taskId: 'task-1',
        status: 'graded',
        overall: 7.0,
        essayText: 'The graph illustrates exports across countries.',
        criteria: {
          task_achievement: {
            score: 7.0,
            summary: 'Đạt yêu cầu Task Achievement.',
            strengths: ['Nêu đủ số liệu chính.'],
            weaknesses: ['Thiếu phân tích một số năm.'],
            how_to_improve: ['Bổ sung thêm mốc 2005.'],
          },
          coherence_cohesion: {
            score: 7.0,
            summary: 'Mạch lạc và rõ ràng.',
            strengths: ['Liên kết tự nhiên.'],
            weaknesses: ['Chuyển đoạn hơi gấp.'],
            how_to_improve: ['Dùng liên từ mở đầu đoạn 2.'],
          },
          lexical_resource: {
            score: 7.0,
            summary: 'Vốn từ học thuật tốt.',
            strengths: ['Từ vựng đa dạng.'],
            weaknesses: ['Có 1 lỗi chọn từ.'],
            how_to_improve: ['Tra lại từ điển collocation.'],
          },
          grammatical_range: {
            score: 7.0,
            summary: 'Ngữ pháp chính xác cao.',
            strengths: ['Cấu trúc phức tốt.'],
            weaknesses: ['Lỗi chia thì ở câu cuối.'],
            how_to_improve: ['Kiểm tra thì quá khứ đơn.'],
          },
        },
        corrections: [],
      },
    ]

    examService.getWritingMyResults.mockResolvedValue(modernResults)

    render(
      <MemoryRouter initialEntries={['/exams/exam-1/writing?viewResult=true&attemptId=att-details']}>
        <Routes>
          <Route path="/exams/:id/writing" element={<WritingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Tổng quan')).toBeInTheDocument()
    })

    // Khối Tổng quan có ở cột phải
    expect(screen.getByText('Tổng quan')).toBeInTheDocument()

    // Bấm tab "Chi tiết nhận xét" ở cột trái để xem 4 tiêu chí
    fireEvent.click(screen.getByText('Chi tiết nhận xét'))

    // Mặc định 4 tiêu chí được thu gọn, có 4 nút V với tooltip/aria-label "Chi tiết nhận xét [Tiêu chí]"
    const toggleBtns = screen.getAllByRole('button', { name: /^Chi tiết nhận xét .+/i })
    expect(toggleBtns).toHaveLength(4)
    expect(screen.queryByText('Ưu điểm')).toBeNull()

    // Bấm mở cả 4 tiêu chí
    toggleBtns.forEach(btn => fireEvent.click(btn))

    expect(screen.getAllByText('Ưu điểm')).toHaveLength(4)
    expect(screen.getAllByText('Nhược điểm')).toHaveLength(4)
    expect(screen.getAllByText('Cách cải thiện')).toHaveLength(4)

    expect(screen.getByText('Nêu đủ số liệu chính.')).toBeInTheDocument()
    expect(screen.getByText('Thiếu phân tích một số năm.')).toBeInTheDocument()
    expect(screen.getByText('Bổ sung thêm mốc 2005.')).toBeInTheDocument()

    // Bấm thu gọn lại thẻ đầu tiên
    const collapseBtns = screen.getAllByRole('button', { name: /^Thu gọn nhận xét .+/i })
    expect(collapseBtns).toHaveLength(4)
    fireEvent.click(collapseBtns[0])
    expect(screen.queryByText('Nêu đủ số liệu chính.')).toBeNull()
  })

  it('Ca 12: ±0.5 xuất hiện dưới điểm Task, điểm Overall, điểm TASK 1 và TASK 2 ở thẻ tổng quan, KHÔNG xuất hiện dưới điểm 4 tiêu chí', async () => {
    examService.getWritingExam.mockResolvedValue({
      id: 'exam-1',
      title: 'IELTS Academic Writing Test 1',
      writingTasks: [mockTask1, mockTask2],
    })

    const fullResults = [
      {
        taskId: 'task-1',
        status: 'graded',
        overall: 6.5,
        essayText: 'Task 1 content here with sufficient words.',
        criteria: {
          task_achievement: { score: 6.5, summary: 'Good' },
          coherence_cohesion: { score: 6.5, summary: 'Good' },
          lexical_resource: { score: 6.5, summary: 'Good' },
          grammatical_range: { score: 6.5, summary: 'Good' },
        },
      },
      {
        taskId: 'task-2',
        status: 'graded',
        overall: 7.0,
        essayText: 'Task 2 content here with sufficient words.',
        criteria: {
          task_achievement: { score: 7.0, summary: 'Good' },
          coherence_cohesion: { score: 7.0, summary: 'Good' },
          lexical_resource: { score: 7.0, summary: 'Good' },
          grammatical_range: { score: 7.0, summary: 'Good' },
        },
      },
    ]

    examService.getWritingMyResults.mockResolvedValue(fullResults)

    render(
      <MemoryRouter initialEntries={['/exams/exam-1/writing?viewResult=true&attemptId=att-full']}>
        <Routes>
          <Route path="/exams/:id/writing" element={<WritingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('FULL TEST')).toBeInTheDocument()
    })

    // Các phần tử chứa ±0.5
    const plusMinusElements = screen.getAllByText('±0.5')

    // 1. Dưới Overall band ở Hero Section (1)
    // 2. Dưới TASK 1 badge ở Hero Section (1)
    // 3. Dưới TASK 2 badge ở Hero Section (1)
    // 4. Dưới Task 1 band score trong TaskAccordion (1)
    // 5. Dưới Task 2 band score trong TaskAccordion (1)
    // Tổng cộng 5 vị trí: Overall, TASK 1, TASK 2 ở Hero, và Task 1, Task 2 score lớn
    expect(plusMinusElements.length).toBe(5)

    // Kiểm tra tooltip chính xác
    plusMinusElements.forEach(el => {
      expect(el).toHaveAttribute('title', 'Điểm do AI ước lượng, có thể chênh khoảng ±0.5 so với giám khảo thật.')
    })

    // KHÔNG xuất hiện dưới điểm 4 tiêu chí (Row 3 của Hero Section)
    const criteriaPills = [
      screen.getByText(/Task Achievement: 6\.8|Task Achievement: 7\.0/),
      screen.getByText(/Coherence & Cohesion: 6\.8|Coherence & Cohesion: 7\.0/),
      screen.getByText(/Lexical Resource: 6\.8|Lexical Resource: 7\.0/),
      screen.getByText(/Grammatical Range: 6\.8|Grammatical Range: 7\.0/),
    ]
    criteriaPills.forEach(pill => {
      expect(pill.textContent).not.toContain('±0.5')
    })
  })
})
