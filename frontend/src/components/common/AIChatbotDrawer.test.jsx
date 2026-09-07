import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AIChatbotDrawer, { askAITutor, detectPageContext } from './AIChatbotDrawer'
import * as chatbotService from '../../services/chatbotService'

// Mock useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Student' } })
}))

describe('AIChatbotDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Floating Action Button (FAB) on non-exam routes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    const fab = screen.getByRole('button', { name: /Mở IELTS AI Tutor/i })
    expect(fab).toBeInTheDocument()
  })

  it('hides during active exam taking without result param', () => {
    render(
      <MemoryRouter initialEntries={['/reading/123']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /Mở IELTS AI Tutor/i })).not.toBeInTheDocument()
  })

  it('shows during result view on exam routes', () => {
    render(
      <MemoryRouter initialEntries={['/reading/123?viewResult=true']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i })).toBeInTheDocument()
  })

  it('opens drawer when FAB is clicked and displays initial welcome message', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    const fab = screen.getByRole('button', { name: /Mở IELTS AI Tutor/i })
    fireEvent.click(fab)

    expect(screen.getByText('IELTS AI Tutor')).toBeInTheDocument()
    expect(screen.getByText(/Llama 3.3/i)).toBeInTheDocument()
    expect(screen.getByText(/Xin chào! Mình là IELTS AI Tutor/i)).toBeInTheDocument()
  })

  it('allows sending a chat message and displays AI reply', async () => {
    vi.spyOn(chatbotService, 'sendChatMessage').mockResolvedValue({
      reply: 'False là thông tin đối lập hoàn toàn, còn Not Given là không được đề cập.'
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    // Open drawer
    fireEvent.click(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i }))

    // Type input
    const input = screen.getByPlaceholderText(/Hỏi AI Tutor/i)
    fireEvent.change(input, { target: { value: 'Phân biệt False và Not Given' } })

    // Send
    const sendBtn = screen.getByRole('button', { name: /Gửi tin nhắn/i })
    fireEvent.click(sendBtn)

    expect(chatbotService.sendChatMessage).toHaveBeenCalledWith('Phân biệt False và Not Given', expect.any(Array))

    await waitFor(() => {
      expect(screen.getByText(/False là thông tin đối lập hoàn toàn/i)).toBeInTheDocument()
    })
  })

  it('opens and triggers prompt when askAITutor helper is invoked', async () => {
    vi.spyOn(chatbotService, 'sendChatMessage').mockResolvedValue({
      reply: 'Chào bạn, đây là phân tích giải thích cho câu hỏi của bạn.'
    })

    render(
      <MemoryRouter initialEntries={['/reading/1/result']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    askAITutor('Giải thích câu 2 giúp tôi')

    await waitFor(() => {
      expect(screen.getByText('IELTS AI Tutor')).toBeInTheDocument()
      expect(chatbotService.sendChatMessage).toHaveBeenCalledWith('Giải thích câu 2 giúp tôi', expect.any(Array))
    })
  })

  it('renders Markdown elements (bold, lists, tables) cleanly instead of raw markdown syntax', async () => {
    vi.spyOn(chatbotService, 'sendChatMessage').mockResolvedValue({
      reply: `Dưới đây là **tiêu chí chấm điểm**:
- Task Achievement
- Coherence and Cohesion

| Tiêu chí | Trọng số |
|---|---|
| Task Response | 25% |
| Coherence | 25% |`
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AIChatbotDrawer />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i }))

    const input = screen.getByPlaceholderText(/Hỏi AI Tutor/i)
    fireEvent.change(input, { target: { value: 'Tiêu chí Writing' } })
    fireEvent.click(screen.getByRole('button', { name: /Gửi tin nhắn/i }))

    await waitFor(() => {
      // Bold element
      const strongEl = screen.getByText('tiêu chí chấm điểm')
      expect(strongEl.tagName.toLowerCase()).toBe('strong')
      expect(strongEl).toHaveClass('font-semibold')

      // List elements
      expect(screen.getByText('Task Achievement').tagName.toLowerCase()).toBe('li')
      expect(screen.getByText('Coherence and Cohesion').tagName.toLowerCase()).toBe('li')

      // Table elements
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Trọng số').tagName.toLowerCase()).toBe('th')
      expect(screen.getByText('Task Response').tagName.toLowerCase()).toBe('td')
    })
  })

  describe('Context Detection & Context-Aware Quick Chips', () => {
    it('detectPageContext correctly identifies sample, result, and general routes', () => {
      const sampleCtx = detectPageContext('/samples/writing/1', '')
      expect(sampleCtx.type).toBe('sample')
      expect(sampleCtx.name).toBe('Bài mẫu Writing')
      expect(sampleCtx.chips).toContain('Phân tích cấu trúc đoạn văn bài mẫu này')
      expect(sampleCtx.chips).toContain('Liệt kê từ vựng và Collocations Band 8.0+')

      const resultCtx = detectPageContext('/progress', '')
      expect(resultCtx.type).toBe('result')
      expect(resultCtx.name).toBe('Tiến độ & Phân tích Năng lực')
      expect(resultCtx.chips).toContain('Giải thích lỗi sai ở câu làm sai nhiều nhất')

      const generalCtx = detectPageContext('/', '')
      expect(generalCtx.type).toBe('general')
      expect(generalCtx.name).toBe('Tổng quan Khảo thí')
      expect(generalCtx.chips).toContain('Phân biệt Not Given và False trong IELTS Reading')
    })

    it('renders Context Banner and Sample chips on /writing-samples route', () => {
      render(
        <MemoryRouter initialEntries={['/writing-samples']}>
          <AIChatbotDrawer />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i }))

      // Context Banner
      expect(screen.getByText(/Đang hỗ trợ ngữ cảnh:/i)).toBeInTheDocument()
      expect(screen.getByText('Bài mẫu Writing')).toBeInTheDocument()

      // Sample chips
      expect(screen.getByText('Phân tích cấu trúc đoạn văn bài mẫu này')).toBeInTheDocument()
      expect(screen.getByText('Liệt kê từ vựng và Collocations Band 8.0+')).toBeInTheDocument()
      expect(screen.getByText('Cách áp dụng ý tưởng này vào đề tương tự')).toBeInTheDocument()
    })

    it('renders Context Banner and Result chips on /progress route', () => {
      render(
        <MemoryRouter initialEntries={['/progress']}>
          <AIChatbotDrawer />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i }))

      // Context Banner
      expect(screen.getByText(/Đang hỗ trợ ngữ cảnh:/i)).toBeInTheDocument()
      expect(screen.getByText('Tiến độ & Phân tích Năng lực')).toBeInTheDocument()

      // Result chips
      expect(screen.getByText('Giải thích lỗi sai ở câu làm sai nhiều nhất')).toBeInTheDocument()
      expect(screen.getByText('Lập kế hoạch khắc phục điểm yếu tiêu chí Lexical Resource')).toBeInTheDocument()
      expect(screen.getByText('Phân biệt cụ thể True / False / Not Given trong bài vừa làm')).toBeInTheDocument()
    })

    it('injects page context into prompt payload when clicking a Quick Chip', async () => {
      vi.spyOn(chatbotService, 'sendChatMessage').mockResolvedValue({
        reply: 'Phân tích cấu trúc đoạn văn của bài mẫu...'
      })

      render(
        <MemoryRouter initialEntries={['/writing-samples']}>
          <AIChatbotDrawer />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: /Mở IELTS AI Tutor/i }))

      const chipBtn = screen.getByText('Phân tích cấu trúc đoạn văn bài mẫu này')
      fireEvent.click(chipBtn)

      await waitFor(() => {
        expect(chatbotService.sendChatMessage).toHaveBeenCalledWith(
          expect.stringContaining('[Ngữ cảnh:'),
          expect.any(Array)
        )
        expect(chatbotService.sendChatMessage).toHaveBeenCalledWith(
          expect.stringContaining('Phân tích cấu trúc đoạn văn bài mẫu này'),
          expect.any(Array)
        )
      })
    })
  })
})

