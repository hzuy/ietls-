import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuestionExplanationModal, {
  getExplanationStatusInfo,
  ExplanationStatusBadge,
} from './QuestionExplanationModal'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('QuestionExplanationModal & Badge Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getExplanationStatusInfo & Badge', () => {
    it('returns "none" info when explanation is null or empty', () => {
      const info = getExplanationStatusInfo(null)
      expect(info.status).toBe('none')
      expect(info.label).toBe('Chưa có lời giải')
    })

    it('treats legacy explanations without status as ai_generated (backward compatibility 3.2)', () => {
      const legacyExp = { v: 2, steps: {} }
      const info = getExplanationStatusInfo(legacyExp)
      expect(info.status).toBe('ai_generated')
      expect(info.label).toBe('AI sinh')
    })

    it('correctly maps teacher_reviewed status', () => {
      const info = getExplanationStatusInfo({ status: 'teacher_reviewed' })
      expect(info.status).toBe('teacher_reviewed')
      expect(info.label).toBe('Đã duyệt')
    })

    it('correctly maps teacher_edited status', () => {
      const info = getExplanationStatusInfo({ status: 'teacher_edited' })
      expect(info.status).toBe('teacher_edited')
      expect(info.label).toBe('Đã sửa')
    })

    it('correctly maps conflict_pending status', () => {
      const info = getExplanationStatusInfo({ status: 'conflict_pending' })
      expect(info.status).toBe('conflict_pending')
      expect(info.label).toBe('Chờ duyệt')
    })

    it('correctly maps needs_regeneration status', () => {
      const info = getExplanationStatusInfo({ status: 'needs_regeneration' })
      expect(info.status).toBe('needs_regeneration')
      expect(info.label).toBe('Cần sinh lại')
    })

    it('correctly maps possibly_stale status', () => {
      const info = getExplanationStatusInfo({ status: 'possibly_stale' })
      expect(info.status).toBe('possibly_stale')
      expect(info.label).toBe('Có thể lỗi thời')
    })

    it('renders ExplanationStatusBadge with correct label', () => {
      render(<ExplanationStatusBadge explanation={{ status: 'teacher_reviewed' }} />)
      expect(screen.getByText('Đã duyệt')).toBeInTheDocument()
    })
  })

  describe('Modal interactions', () => {
    const sampleQuestion = {
      number: 1,
      questionText: 'What is the primary factor?',
      correctAnswer: 'Oxygen',
    }

    const sampleExplanation = {
      v: 2,
      status: 'ai_generated',
      answer: 'Oxygen',
      aiAnswer: 'Oxygen',
      evidence: {
        parts: [{ text: 'Oxygen is the vital element found in the core layer.', paragraph: 1 }],
      },
      reasoning: 'The text directly mentions oxygen as the vital element.',
      predict: 'Look for vital element in the core layer.',
    }

    it('does not render when isOpen is false', () => {
      render(
        <QuestionExplanationModal
          isOpen={false}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
        />
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders view tab by default with question details and explanation', () => {
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getAllByText(/Câu 1/i)[0]).toBeInTheDocument()
      expect(screen.getByText(/Oxygen is the vital element found in the core layer/i)).toBeInTheDocument()
      expect(screen.getByText(/The text directly mentions oxygen/i)).toBeInTheDocument()
    })

    it('calls review API when "Duyệt giải thích" button is clicked', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          explanation: { ...sampleExplanation, status: 'teacher_reviewed' },
        },
      })

      const handleUpdated = vi.fn()
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
          onExplanationUpdated={handleUpdated}
        />
      )

      const reviewBtn = screen.getByRole('button', { name: /Duyệt giải thích/i })
      fireEvent.click(reviewBtn)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/review-explanation',
          {}
        )
      })
      expect(handleUpdated).toHaveBeenCalled()
    })

    it('allows entering feedback and regenerating explanation', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          explanation: {
            ...sampleExplanation,
            reasoning: 'Regenerated with clearer step-by-step logic.',
            feedbackHistory: [{ at: new Date().toISOString(), feedback: 'Giải thích ngắn hơn' }],
          },
        },
      })

      const handleUpdated = vi.fn()
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
          onExplanationUpdated={handleUpdated}
        />
      )

      // Switch to tab "Góp ý & Tạo lại"
      const feedbackTab = screen.getByRole('tab', { name: /Góp ý & Tạo lại/i })
      fireEvent.click(feedbackTab)

      const feedbackInput = screen.getByPlaceholderText(/Hãy giải thích rõ hơn/i)
      fireEvent.change(feedbackInput, { target: { value: 'Giải thích ngắn hơn' } })

      const regenBtn = screen.getByRole('button', { name: /Tạo lại lời giải với AI/i })
      fireEvent.click(regenBtn)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/regenerate-explanation',
          { teacherFeedback: 'Giải thích ngắn hơn' }
        )
      })
      expect(handleUpdated).toHaveBeenCalled()
    })

    it('allows manual editing of fields safely without dangerouslySetInnerHTML', async () => {
      api.put.mockResolvedValueOnce({
        data: {
          success: true,
          explanation: {
            ...sampleExplanation,
            status: 'teacher_edited',
            manualEdit: true,
            reasoning: 'Teacher custom reasoning.',
          },
        },
      })

      const handleUpdated = vi.fn()
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
          onExplanationUpdated={handleUpdated}
        />
      )

      // Switch to tab "Sửa trực tiếp"
      const editTab = screen.getByRole('tab', { name: /Sửa trực tiếp/i })
      fireEvent.click(editTab)

      const reasoningTextarea = screen.getByPlaceholderText(/Lập luận vì sao đáp án này đúng/i)
      fireEvent.change(reasoningTextarea, { target: { value: 'Teacher custom reasoning.' } })

      const saveBtn = screen.getByRole('button', { name: /Lưu chỉnh sửa/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/explanation',
          expect.objectContaining({
            reasoning: 'Teacher custom reasoning.',
          })
        )
      })
      expect(handleUpdated).toHaveBeenCalled()
    })

    it('has fixed dimensions, no "Đóng" button in footer, and only "X" button to close', () => {
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={sampleExplanation}
        />
      )

      // Dialog container has fixed dimensions
      const dialog = screen.getByRole('dialog')
      const modalBox = dialog.querySelector('.bg-white.rounded-3xl')
      expect(modalBox.className).toContain('w-[960px]')
      expect(modalBox.className).toContain('h-[720px]')

      // Only 1 "Đóng" button exists (the "X" icon button in the header), no footer "Đóng" text button
      const closeButtons = screen.getAllByRole('button', { name: /Đóng/i })
      expect(closeButtons).toHaveLength(1)
      expect(closeButtons[0].querySelector('svg')).toBeInTheDocument()
    })

    it('shows "Duyệt giải thích câu 1" only on view tab, never on feedback or edit tabs', () => {
      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={{ ...sampleExplanation, status: 'ai_generated' }}
        />
      )

      // On view tab: shows "Duyệt giải thích câu 1"
      expect(screen.getByRole('button', { name: /Duyệt giải thích câu 1/i })).toBeInTheDocument()

      // Switch to feedback tab: no review button, has regenerate button
      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))
      expect(screen.queryByRole('button', { name: /Duyệt giải thích/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i })).toBeInTheDocument()

      // Switch to edit tab: no review button, has save button and NO "Sửa tay an toàn (3.7)"
      fireEvent.click(screen.getByRole('tab', { name: /Sửa trực tiếp/i }))
      expect(screen.queryByRole('button', { name: /Duyệt giải thích/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Lưu chỉnh sửa/i })).toBeInTheDocument()
      expect(screen.queryByText(/Sửa tay an toàn \(3\.7\)/i)).not.toBeInTheDocument()
    })
  })
})

