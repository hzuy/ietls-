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
          expect.objectContaining({ teacherFeedback: 'Giải thích ngắn hơn' })
        )
      })
      expect(handleUpdated).toHaveBeenCalled()
    })

    it('renders banner displaying which answer this explanation explains and warns if mismatched (C.4)', () => {
      // 1. Matching case
      const { rerender } = render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion} // correctAnswer: 'Oxygen'
          initialExplanation={{ ...sampleExplanation, answer: 'Oxygen' }}
        />
      )

      expect(screen.getByText(/Lời giải này giải thích đáp án:/i)).toBeInTheDocument()
      expect(screen.queryByText(/Cảnh báo: Lời giải đang giải thích đáp án/i)).not.toBeInTheDocument()

      // 2. Mismatched case (AI explanation explains 'Nitrogen', stored answer is 'Oxygen')
      rerender(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={{ ...sampleExplanation, answer: 'Nitrogen' }}
        />
      )

      expect(screen.getByText(/Cảnh báo: Lời giải đang giải thích đáp án "Nitrogen", khác với đáp án đang lưu "Oxygen"/i)).toBeInTheDocument()
    })

    it('supports proposing a new answer with confirmation dialog, attempt warning, and updating answer (C.1 & C.2)', async () => {
      // Step 1: regenerate returns requiresConfirmation
      api.post.mockResolvedValueOnce({
        data: {
          ok: true,
          requiresConfirmation: true,
          proposedAnswer: 'Nitrogen',
          currentAnswer: 'Oxygen',
          aiBlindAnswer: 'Nitrogen',
          attemptCount: 15,
          evidence: 'Nitrogen is 78% of the gas.',
          message: 'AI giải độc lập cũng ra "Nitrogen".',
        },
      })

      const handleUpdated = vi.fn()
      const mutableQuestion = { ...sampleQuestion }

      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={mutableQuestion}
          initialExplanation={sampleExplanation}
          onExplanationUpdated={handleUpdated}
        />
      )

      // Go to feedback tab
      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))

      // Check static note exists (C.1)
      expect(screen.getByText(/Góp ý chỉ điều chỉnh cách giải thích, không làm đổi đáp án chuẩn/i)).toBeInTheDocument()

      // Enter proposed answer
      const proposedInput = screen.getByPlaceholderText(/nhập đáp án mới nếu đáp án đang lưu bị sai/i)
      fireEvent.change(proposedInput, { target: { value: 'Nitrogen' } })

      // Click regenerate
      fireEvent.click(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i }))

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/regenerate-explanation',
          expect.objectContaining({
            proposedAnswer: 'Nitrogen',
            confirmChangeAnswer: false,
          })
        )
      })

      // Confirmation dialog appears!
      await waitFor(() => {
        expect(screen.getByText(/Xác nhận đổi đáp án chuẩn/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/AI độc lập đồng thuận với đề xuất của bạn/i)).toBeInTheDocument()
      expect(screen.getByText(/Cảnh báo lượt làm bài của học sinh/i)).toBeInTheDocument()
      expect(screen.getByText('15')).toBeInTheDocument()
      expect(screen.getByText(/"Nitrogen is 78% of the gas\."/i)).toBeInTheDocument()

      // Step 2: Teacher clicks "Xác nhận đổi đáp án & tạo lời giải"
      api.post.mockResolvedValueOnce({
        data: {
          ok: true,
          updatedCorrectAnswer: 'Nitrogen',
          explanation: {
            ...sampleExplanation,
            answer: 'Nitrogen',
            status: 'teacher_reviewed',
            teacher_note: 'Đã đổi đáp án chuẩn từ "Oxygen" sang "Nitrogen"',
          },
        },
      })

      const confirmBtn = screen.getByRole('button', { name: /Xác nhận đổi đáp án & tạo lời giải/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/regenerate-explanation',
          expect.objectContaining({
            proposedAnswer: 'Nitrogen',
            confirmChangeAnswer: true,
          })
        )
      })

      // Modal switches to view tab with updated answer
      await waitFor(() => {
        expect(handleUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ answer: 'Nitrogen', status: 'teacher_reviewed' }),
          1,
          'Nitrogen'
        )
      })
    })

    it('shows conflict dialog with 3 options when AI disagrees with proposed answer (C.2)', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          ok: false,
          conflict: true,
          proposedAnswer: 'Carbon',
          currentAnswer: 'Oxygen',
          aiBlindAnswer: 'Nitrogen',
          evidence: 'Nitrogen is 78% in text.',
          message: 'AI giải độc lập ra "Nitrogen", KHÔNG khớp với đáp án "Carbon" bạn đề xuất.',
        },
      })

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

      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))
      const proposedInput = screen.getByPlaceholderText(/nhập đáp án mới nếu đáp án đang lưu bị sai/i)
      fireEvent.change(proposedInput, { target: { value: 'Carbon' } })
      fireEvent.click(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /AI giải độc lập không khớp/i })).toBeInTheDocument()
      })
      expect(screen.getByText(/Không tự động đổi đáp án khi chưa đồng thuận/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Đồng ý với đáp án của AI \("Nitrogen"\)/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Tự sửa tay ở tab "Sửa trực tiếp"/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Giữ nguyên đáp án đang lưu \("Oxygen"\)/i })).toBeInTheDocument()
    })

    it('handles Flow X (feedback only with AI disagreement) and prompts confirmation when teacher picks AI answer', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          ok: false,
          conflict: true,
          isFeedbackOnly: true,
          currentAnswer: 'Oxygen',
          aiBlindAnswer: 'Nitrogen',
          attemptCount: 5,
          evidence: 'Nitrogen makes up 78% of air.',
          message: 'AI giải độc lập ra đáp án "Nitrogen" (khác với đáp án "Oxygen" đang lưu).',
        },
      })

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

      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))
      const feedbackInput = screen.getByPlaceholderText(/Hãy giải thích rõ hơn/i)
      fireEvent.change(feedbackInput, { target: { value: 'Đáp án hình như là Nitrogen' } })
      fireEvent.click(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /AI giải độc lập không khớp/i })).toBeInTheDocument()
      })
      expect(screen.getByText(/KHÁC/i)).toBeInTheDocument()

      // Teacher clicks "Đồng ý với đáp án của AI ("Nitrogen")"
      const pickAiBtn = screen.getByRole('button', { name: /Đồng ý với đáp án của AI \("Nitrogen"\)/i })
      fireEvent.click(pickAiBtn)

      // It MUST open confirmation dialog with attempt warning
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Xác nhận đổi đáp án chuẩn/i })).toBeInTheDocument()
      })
      expect(screen.getByText(/Cảnh báo lượt làm bài của học sinh/i)).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows retry button when FALLBACK_NOT_ALLOWED or AI busy occurs', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          ok: false,
          error: 'FALLBACK_NOT_ALLOWED',
          message: 'AI chính đang bận, hãy thử lại sau.',
        },
      })

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

      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))
      fireEvent.click(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i }))

      await waitFor(() => {
        expect(screen.getByText(/AI chính đang bận, hãy thử lại sau/i)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument()
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

    it('allows editing all Steps 1-4 (L1) including locate keywords, evidence, and paraphrases', async () => {
      const detailedExplanation = {
        ...sampleExplanation,
        predict: 'Predict something',
        question_chunks: [{ text: 'vital element', label: 'thành phần thiết yếu' }],
        locate: {
          note: 'Locate in paragraph 1',
          keywords: ['vital element', 'core layer'],
          paragraph: 1,
        },
        evidence: {
          parts: [{ text: 'Oxygen is the vital element found in the core layer.', paragraph: 1 }],
          chunks: [{ text: 'vital element', label: 'yếu tố sống còn' }],
        },
        paraphrases: [
          {
            question: 'primary factor',
            question_label: 'yếu tố chính',
            passage: 'vital element',
            passage_label: 'thành phần thiết yếu',
          },
        ],
        full_sentence: 'Oxygen is the vital element.',
        translation: 'Oxy là thành phần sống còn.',
        reasoning: 'Detailed reasoning text.',
        distractors: [
          { option: 'Hydrogen', label: 'Hiđrô', reason: 'Không được nhắc tới.' },
        ],
      }

      api.put.mockResolvedValueOnce({
        data: {
          success: true,
          explanation: {
            ...detailedExplanation,
            status: 'teacher_edited',
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
          initialExplanation={detailedExplanation}
          onExplanationUpdated={handleUpdated}
        />
      )

      // Switch to tab "Sửa trực tiếp"
      fireEvent.click(screen.getByRole('tab', { name: /Sửa trực tiếp/i }))

      // Verify STEP headers are present
      expect(screen.getByText(/Bước 1: Phân tích câu hỏi và dự đoán/i)).toBeInTheDocument()
      expect(screen.getByText(/Bước 2: Định vị thông tin liên quan/i)).toBeInTheDocument()
      expect(screen.getByText(/Bước 3: Đọc thông tin liên quan \(Bằng chứng\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Bước 4: Chọn đáp án & Suy luận/i)).toBeInTheDocument()

      // Edit Step 1 predict
      const predictInput = screen.getByPlaceholderText(/Câu hỏi cần thông tin gì/i)
      fireEvent.change(predictInput, { target: { value: 'Updated prediction note.' } })

      // Edit Step 2 locate note
      const locateNoteInput = screen.getByPlaceholderText(/Ý nào trong câu hỏi giúp tìm vùng cần đọc/i)
      fireEvent.change(locateNoteInput, { target: { value: 'Updated locate strategy note.' } })

      // Add a locate keyword
      const addKeywordBtn = screen.getByRole('button', { name: /Thêm từ khóa/i })
      fireEvent.click(addKeywordBtn)
      const keywordInputs = screen.getAllByPlaceholderText(/Từ khóa nguyên văn trong bài đọc/i)
      fireEvent.change(keywordInputs[keywordInputs.length - 1], { target: { value: 'atmosphere' } })

      // Click save
      const saveBtn = screen.getByRole('button', { name: /Lưu chỉnh sửa/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/practice/admin/reading/10/questions/1/explanation',
          expect.objectContaining({
            predict: 'Updated prediction note.',
            locate: expect.objectContaining({
              note: 'Updated locate strategy note.',
              keywords: expect.arrayContaining(['vital element', 'core layer', 'atmosphere']),
            }),
            evidence: expect.objectContaining({
              parts: expect.any(Array),
              chunks: expect.any(Array),
            }),
            paraphrases: expect.any(Array),
            full_sentence: 'Oxygen is the vital element.',
            translation: 'Oxy là thành phần sống còn.',
            reasoning: 'Detailed reasoning text.',
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

    it('only renders full_sentence and translation inputs for completion questions, hides them for MCQ', () => {
      // 1. MCQ question -> must hide full_sentence & translation
      const mcqQ = {
        number: 2,
        type: 'mcq',
        questionText: 'Which invention revolutionized glassmaking?',
        options: ['A. stained glass', 'B. glassblowing'],
        correctAnswer: 'B',
      }
      const { rerender } = render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={2}
          isPractice={false}
          skill="reading"
          question={mcqQ}
          initialExplanation={{ v: 2, answer: 'B', reasoning: 'Reason' }}
        />
      )

      fireEvent.click(screen.getByRole('tab', { name: /Sửa trực tiếp/i }))
      expect(screen.queryByPlaceholderText(/Câu tiếng Anh đầy đủ sau khi điền đáp án/i)).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/Dịch nghĩa tiếng Việt của câu trên/i)).not.toBeInTheDocument()

      // 2. Completion question -> must show both inputs
      const completionQ = {
        number: 3,
        type: 'fill_blank',
        questionText: 'Amazonian farmers added [GAP].',
        correctAnswer: 'charcoal',
      }
      rerender(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={3}
          isPractice={false}
          skill="reading"
          question={completionQ}
          initialExplanation={{ v: 2, answer: 'charcoal', reasoning: 'Reason' }}
        />
      )

      fireEvent.click(screen.getByRole('tab', { name: /Sửa trực tiếp/i }))
      expect(screen.getByPlaceholderText(/Câu tiếng Anh đầy đủ sau khi điền đáp án/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Dịch nghĩa tiếng Việt của câu trên/i)).toBeInTheDocument()
    })

    it('displays user-friendly Vietnamese error messages and retry button for Gemini failures (429, 503, 504, FALLBACK_NOT_ALLOWED)', async () => {
      const sampleQuestion = {
        number: 1,
        type: 'mcq',
        questionText: 'Test question',
        options: ['A', 'B'],
        correctAnswer: 'A',
      }

      // 1. Test 429 error
      api.post.mockRejectedValueOnce({
        response: { status: 429, data: { error: 'RATE_LIMIT', message: 'Rate limit exceeded' } },
      })

      render(
        <QuestionExplanationModal
          isOpen={true}
          onClose={vi.fn()}
          examId={10}
          questionNumber={1}
          isPractice={true}
          skill="reading"
          question={sampleQuestion}
          initialExplanation={{ v: 2, answer: 'A', reasoning: 'Reason' }}
        />
      )

      fireEvent.click(screen.getByRole('tab', { name: /Góp ý & Tạo lại/i }))
      fireEvent.click(screen.getByRole('button', { name: /Tạo lại lời giải với AI/i }))

      await waitFor(() => {
        expect(screen.getByText(/Hệ thống AI đang quá tải \(giới hạn lượt gọi \/ 429\)/i)).toBeInTheDocument()
      })
      const retryBtn = screen.getByRole('button', { name: /^Thử lại$/i })
      expect(retryBtn).toBeInTheDocument()

      // 2. Click retry with 504 timeout error
      api.post.mockRejectedValueOnce({
        response: { status: 504, data: { error: 'TIMEOUT', message: 'Hết thời gian xử lý AI khi tạo lại giải thích (quá 48s)' } },
      })
      fireEvent.click(retryBtn)

      await waitFor(() => {
        expect(screen.getByText(/Hết thời gian xử lý AI \(quá 48s\)\. Vui lòng bấm Thử lại để AI thực hiện lại\./i)).toBeInTheDocument()
      })

      // 3. Click retry with 503 service unavailable
      api.post.mockRejectedValueOnce({
        response: { status: 503, data: { error: 'SERVICE_UNAVAILABLE', message: 'Service Unavailable' } },
      })
      fireEvent.click(screen.getByRole('button', { name: /^Thử lại$/i }))

      await waitFor(() => {
        expect(screen.getByText(/Dịch vụ AI hiện không khả dụng \(503\)\. Vui lòng thử lại sau\./i)).toBeInTheDocument()
      })

      // 4. Test FALLBACK_NOT_ALLOWED response (ok: false)
      api.post.mockResolvedValueOnce({
        data: {
          ok: false,
          error: 'FALLBACK_NOT_ALLOWED',
          message: 'Không được dùng fallback để đổi đáp án',
        },
      })
      fireEvent.click(screen.getByRole('button', { name: /^Thử lại$/i }))

      await waitFor(() => {
        expect(screen.getByText(/Mô hình dự phòng không được phép quyết định đổi đáp án/i)).toBeInTheDocument()
      })
    })
  })
})

