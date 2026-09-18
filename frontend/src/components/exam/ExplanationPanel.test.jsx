import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExplanationPanel from './ExplanationPanel'

const EXPLANATION = {
  restatement: 'Câu hỏi kiểm tra điều X',
  evidence: 'Đoạn văn nói "Y"',
  reasoning: 'Vì Y nên Z',
  conclusion: 'Đáp án đúng là Z',
}

describe('ExplanationPanel', () => {
  it('không render gì khi không có explanation (câu chưa sinh giải thích)', () => {
    const { container } = render(<ExplanationPanel explanation={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mặc định thu gọn — không hiện nội dung 4 phần cho tới khi bấm mở', () => {
    render(<ExplanationPanel explanation={EXPLANATION} />)
    expect(screen.getByText('Xem giải thích')).toBeInTheDocument()
    expect(screen.queryByText(EXPLANATION.restatement)).not.toBeInTheDocument()
  })

  it('bấm vào mở ra đủ 4 phần với tiêu đề tương ứng, bấm lại thì thu gọn', async () => {
    const user = userEvent.setup()
    render(<ExplanationPanel explanation={EXPLANATION} />)

    const toggle = screen.getByRole('button', { name: /Xem giải thích/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Câu hỏi kiểm tra điều gì')).toBeInTheDocument()
    expect(screen.getByText(EXPLANATION.restatement)).toBeInTheDocument()
    expect(screen.getByText('Đối chiếu với đoạn văn / bài nghe')).toBeInTheDocument()
    expect(screen.getByText(EXPLANATION.evidence)).toBeInTheDocument()
    expect(screen.getByText('Các bước suy luận')).toBeInTheDocument()
    expect(screen.getByText(EXPLANATION.reasoning)).toBeInTheDocument()
    expect(screen.getByText('Kết luận')).toBeInTheDocument()
    expect(screen.getByText(EXPLANATION.conclusion)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ẩn giải thích/i }))
    expect(screen.queryByText(EXPLANATION.restatement)).not.toBeInTheDocument()
  })

  it('bỏ qua phần rỗng/thiếu thay vì hiện tiêu đề trống', async () => {
    const user = userEvent.setup()
    const partial = { restatement: 'chỉ có phần này', evidence: '', reasoning: null, conclusion: undefined }
    render(<ExplanationPanel explanation={partial} />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('chỉ có phần này')).toBeInTheDocument()
    expect(screen.queryByText('Đối chiếu với đoạn văn / bài nghe')).not.toBeInTheDocument()
    expect(screen.queryByText('Các bước suy luận')).not.toBeInTheDocument()
    expect(screen.queryByText('Kết luận')).not.toBeInTheDocument()
  })
})
