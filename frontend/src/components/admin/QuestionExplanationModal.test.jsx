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
      const { container } = render(
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
      // Câu trích dẫn có thể bị chia thành nhiều node (gạch chân đáp án) nên so khớp
      // trên textContent của cả cây thay vì một text node duy nhất.
      expect(container.textContent).toContain('Oxygen is the vital element found in the core layer')
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

    it('shows "Duyệt giải thích câu 1" only on view tab, never on edit tab', () => {
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

      // Only 2 tabs remain: "Xem lời giải" and "Sửa trực tiếp"
      expect(screen.getAllByRole('tab')).toHaveLength(2)
      expect(screen.queryByRole('tab', { name: /Góp ý & Tạo lại/i })).not.toBeInTheDocument()

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

  })
})

