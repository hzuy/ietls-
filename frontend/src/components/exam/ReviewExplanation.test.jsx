import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReviewExplanation from './ReviewExplanation'
import { findRange, normalizeText } from '../../utils/textMatch'

const V2 = {
  v: 2,
  question_chunks: [{ text: 'the grandfather', label: 'người ông' }, { text: '1. ___', label: 'nguồn còn thiếu' }],
  predict: 'Cần một danh từ chỉ nguồn của cải.',
  locate: { note: 'Tìm ý gây dựng của cải.', keywords: ['made his fortune'], paragraph: 0 },
  evidence: {
    paragraph: 0,
    parts: [{ text: 'Rhys Davies had settled in Norway and made his fortune there in the timber and shipping trades.', paragraph: 0 }],
    chunks: [
      { text: 'made his fortune', label: 'gây dựng cơ nghiệp', part: 0 },
      { text: 'in the timber and shipping trades', label: 'ngành gỗ và vận tải biển', part: 0 },
    ],
  },
  answer: 'timber',
  full_sentence: 'the grandfather built his wealth on timber',
  translation: 'người ông gây dựng của cải từ gỗ',
  reasoning: 'Bài nêu ngành gỗ và vận tải biển.',
  paraphrases: [{ question: 'built his wealth', question_label: 'gây dựng của cải', passage: 'made his fortune', passage_label: 'tạo dựng cơ nghiệp' }],
  distractors: [{ option: 'shipping', label: 'vận tải biển', reason: 'Đề đã cho ngành này.' }],
}

describe('ReviewExplanation', () => {
  it('câu chưa có giải thích → hiện thông báo, không lỗi', () => {
    render(<ReviewExplanation explanation={null} />)
    expect(screen.getByText('Câu này chưa có giải thích chi tiết.')).toBeInTheDocument()
  })

  it('giải thích mới: đủ 4 bước, nhãn cụm, đoạn văn, đáp án, paraphrase, lựa chọn sai', () => {
    render(<ReviewExplanation explanation={V2} />)
    expect(screen.getAllByText(/^STEP 0[1-4]$/)).toHaveLength(4)
    expect(screen.getByText('người ông')).toBeInTheDocument()
    expect(screen.getAllByText('Đoạn 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Đáp án phù hợp nhất:')).toBeInTheDocument()
    expect(screen.getByText('built his wealth')).toBeInTheDocument()
    expect(screen.queryByText('Những lựa chọn còn lại')).not.toBeInTheDocument()
    expect(screen.getAllByText('(…)').length).toBeGreaterThan(0)
  })

  it('nhãn đoạn dùng hàm paragraphLabel truyền vào (đoạn có chữ cái)', () => {
    render(<ReviewExplanation explanation={V2} paragraphLabel={i => `Đoạn ${String.fromCharCode(65 + i)}`} />)
    expect(screen.getAllByText('Đoạn A').length).toBeGreaterThan(0)
  })

  it('NOT GIVEN không có câu trích → báo bài không nói trực tiếp', () => {
    render(<ReviewExplanation explanation={{ ...V2, answer: 'NOT GIVEN', evidence: null }} question={{ type: 'true_false_not_given' }} />)
    expect(screen.getByText('Bài không có câu nào nói trực tiếp tới thông tin này.')).toBeInTheDocument()
  })

  it('shows unsupported q3 as one incomplete state with its real reasoning, not four empty cards', () => {
    render(<ReviewExplanation explanation={{ v: 2, no_support: true, answer: 'traffic', reasoning: 'The source states businessmen, not traffic.', evidence: { parts: [] } }} />)
    expect(screen.getByText('Lời giải chưa hoàn chỉnh')).toBeInTheDocument()
    expect(screen.getByText('The source states businessmen, not traffic.')).toBeInTheDocument()
    expect(screen.queryByText(/^STEP /)).not.toBeInTheDocument()
    expect(screen.queryByText('Bài không có câu nào nói trực tiếp tới thông tin này.')).not.toBeInTheDocument()
  })
  it('does not render wrong-question q4 content as a valid four-step explanation', () => {
    render(<ReviewExplanation explanation={{ ...V2, contentIssue: { code: 'QUESTION_CONTEXT_MISMATCH', message: 'Lời giải đang nói về câu 2, không phải câu 4.' } }} />)
    expect(screen.getByText('Lời giải đang nói về câu 2, không phải câu 4.')).toBeInTheDocument()
    expect(screen.queryByText(/^STEP /)).not.toBeInTheDocument()
  })
  it.each(['QUESTION_CONTEXT_MISSING', 'ANSWER_NOT_IN_SOURCE'])('keeps invalid-source q4 compact for %s', code => {
    render(<ReviewExplanation explanation={{ ...V2, contentIssue: { code, message: 'Câu 4 chưa có đủ dữ liệu nguồn để xác nhận outskirts.' } }} />)
    expect(screen.getByText('Lời giải chưa hoàn chỉnh')).toBeInTheDocument()
    expect(screen.getByText('Câu 4 chưa có đủ dữ liệu nguồn để xác nhận outskirts.')).toBeInTheDocument()
    expect(screen.queryByText(/^STEP /)).not.toBeInTheDocument()
  })
  it('does not infer NOT GIVEN from a missing evidence quote on a completion question', () => {
    render(<ReviewExplanation explanation={{ ...V2, evidence: null }} question={{ type: 'note_completion' }} />)
    expect(screen.getByText('Chưa có trích dẫn bằng chứng trong lời giải.')).toBeInTheDocument()
    expect(screen.queryByText('Bài không có câu nào nói trực tiếp tới thông tin này.')).not.toBeInTheDocument()
  })

  it('giải thích dạng cũ (4 đoạn chữ) vẫn hiển thị thành các bước', () => {
    render(<ReviewExplanation explanation={{ restatement: 'R', evidence: 'E', reasoning: 'S', conclusion: 'C' }} />)
    expect(screen.getAllByText(/^STEP 0[1-4]$/)).toHaveLength(4)
    expect(screen.getByText('E')).toBeInTheDocument()
  })

  it('dùng correctAnswer truyền vào làm nguồn đáp án duy nhất cho Bước 4', () => {
    render(<ReviewExplanation explanation={V2} correctAnswer="timber." />)
    expect(screen.getByText('timber.')).toBeInTheDocument()
  })
})

describe('textMatch', () => {
  it('tìm đúng vị trí trong văn bản gốc dù khác dấu nháy và khoảng trắng', () => {
    const text = "He said, ‘Wetlands  support well‑being,’ today."
    const r = findRange(text, "'Wetlands support well-being,'")
    expect(r).not.toBeNull()
    expect(text.slice(r.start, r.end)).toContain('Wetlands')
    expect(text.slice(r.start, r.end)).toContain('being')
  })

  it('trả null khi không có trong văn bản', () => {
    expect(findRange('abc def', 'xyz')).toBeNull()
  })

  it('normalizeText khớp cách chuẩn hoá phía backend', () => {
    expect(normalizeText('“Well‑being,”  he said')).toBe('well-being, he said')
  })
})
