import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReviewExplanation from '../exam/ReviewExplanation'
import QuestionExplanationModal from './QuestionExplanationModal'
import ExplanationQualityFilter from './ExplanationQualityFilter'
import { calculateExamExplanationStats } from '../../utils/examExplanationUtils'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({ default: { put: vi.fn(), post: vi.fn() } }))

const explanation = { v: 2, answer: 'nine', reasoning: 'The library opens at nine.', distractors: [{ option: 'ten', reason: 'The source says nine.' }] }

describe('question-specific explanation sections', () => {
  it.each(['fill_blank', 'short_answer', 'note_completion', 'form_completion', 'table_completion', 'sentence_completion', 'summary_completion', 'flow_chart_completion', 'diagram_label', 'map_diagram'])('hides invented alternatives in %s', type => {
    render(<ReviewExplanation explanation={explanation} question={{ type }} />)
    expect(screen.queryByText('Những lựa chọn còn lại')).not.toBeInTheDocument()
    expect(screen.queryByText('ten')).not.toBeInTheDocument()
  })
  it.each(['mcq', 'mcq_multi', 'choose_title', 'list_selection', 'matching', 'matching_endings', 'matching_headings', 'matching_drag', 'categorisation', 'drag_word_bank', 'diagram_label'])('retains real alternatives in %s', type => {
    render(<ReviewExplanation explanation={explanation} question={{ type, options: ['nine', 'ten'] }} />)
    expect(screen.getByText('Những lựa chọn còn lại')).toBeInTheDocument()
  })
  it.each(['true_false_ng', 'yes_no_ng', 'true_false_not_given', 'yes_no_not_given'])('retains judgment alternatives in %s', type => {
    render(<ReviewExplanation explanation={explanation} question={{ type }} />)
    expect(screen.getByText('Những lựa chọn còn lại')).toBeInTheDocument()
  })
  it('uses group options for a word-bank question stored as fill_blank', () => {
    render(<ReviewExplanation explanation={explanation} question={{ type: 'fill_blank', group: { type: 'drag_word_bank', matchingOptions: [{ optionLetter: 'A', optionText: 'nine' }, { optionLetter: 'B', optionText: 'ten' }] } }} />)
    expect(screen.getByText('Những lựa chọn còn lại')).toBeInTheDocument()
  })
  it('does not invent alternatives for a multiple-choice question with missing options', () => {
    render(<ReviewExplanation explanation={explanation} question={{ type: 'mcq', options: '[]' }} />)
    expect(screen.queryByText('Những lựa chọn còn lại')).not.toBeInTheDocument()
  })
  it('does not classify a valid draft waiting for approval as an error', () => {
    const { container } = render(<ExplanationQualityFilter groups={[{ questions: [{ number: 1, explanation: { status: 'draft_ready' } }] }]} />)
    expect(container).toBeEmptyDOMElement()
    const stats = calculateExamExplanationStats({ passages: [{ questionGroups: [{ type: 'note_completion', questions: [{ number: 1, explanation: { status: 'draft_ready' } }] }] }] })
    expect(stats.hasAttention).toBe(false)
    expect(stats.attentionSlots).toBe(0)
    expect(stats.statusCounts.draft_ready).toBe(1)
  })
  it('shows both conflicting answers and a direct edit action without changing the source answer', () => {
    const close = vi.fn()
    render(<QuestionExplanationModal isOpen onClose={close} examId={10} question={{ id: 1, number: 1, type: 'note_completion', correctAnswer: 'nine' }}
      initialExplanation={{ ...explanation, status: 'conflict_pending', answer: 'ten', aiAnswer: 'ten' }} onGenerateDraft={vi.fn()} />)
    expect(screen.getByText('Đáp án trong lời giải AI:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại sửa đề' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sửa lời giải' }))
    expect(screen.getByRole('button', { name: 'Lưu bản nháp' })).toBeInTheDocument()
    expect(screen.queryByText(/Phân tích các đáp án sai/)).not.toBeInTheDocument()
  })
  it('does not save hidden legacy distractors when editing a free-entry explanation', async () => {
    api.put.mockResolvedValueOnce({ data: { explanation: { ...explanation, status: 'draft_ready', distractors: [] } } })
    render(<QuestionExplanationModal isOpen onClose={vi.fn()} examId={10} question={{ id: 1, number: 1, type: 'form_completion', correctAnswer: 'nine' }} initialExplanation={explanation} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Sửa trực tiếp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/exams/10/questions/1/explanation', expect.objectContaining({ distractors: [] })))
    expect(api.post).not.toHaveBeenCalled()
  })
})
