import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import DragWordBankGroup from './DragWordBankGroup'

// Fixture: 1 group Summary Completion / Word Bank với 2 câu (31, 32) và 4 phương án A-D.
function makeGroup() {
  return {
    qNumberStart: 31,
    qNumberEnd: 32,
    instruction: 'Complete the summary using the word bank.',
    matchingOptions: [
      { optionLetter: 'A', optionText: 'photosynthesis' },
      { optionLetter: 'B', optionText: 'chlorophyll' },
      { optionLetter: 'C', optionText: 'sunlight' },
      { optionLetter: 'D', optionText: 'carbon dioxide' },
    ],
    questions: [
      { id: 101, number: 31 },
      { id: 102, number: 32 },
    ],
    noteSections: [
      {
        title: null,
        lines: [
          { contentWithTokens: 'Plants convert [Q:31] into energy using [Q:32].' },
        ],
      },
    ],
  }
}

// Ô trống (blank) — dùng data-testid để không nhầm với text trùng lặp ở khối
// Word Bank luôn hiển thị bên dưới (và không phụ thuộc role="button" chỉ có khi !previewMode).
const blank = (n) => screen.getByTestId(`blank-${n}`)

describe('DragWordBankGroup — click-to-select popover', () => {
  it('hiển thị số câu hỏi ở ô trống khi chưa có đáp án', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={() => {}} />)
    expect(blank(31)).toHaveTextContent('31')
    expect(blank(32)).toHaveTextContent('32')
  })

  it('click vào ô trống mở popover liệt kê đủ các phương án Word Bank', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={() => {}} />)
    fireEvent.click(blank(31))

    const listbox = screen.getByRole('listbox', { name: 'Chọn đáp án từ Word Bank' })
    expect(listbox).toBeInTheDocument()
    expect(within(listbox).getByText('photosynthesis')).toBeInTheDocument()
    expect(within(listbox).getByText('chlorophyll')).toBeInTheDocument()
    expect(within(listbox).getByText('sunlight')).toBeInTheDocument()
    expect(within(listbox).getByText('carbon dioxide')).toBeInTheDocument()
  })

  it('chọn 1 phương án trong popover → gọi onAnswer(questionId, letter) và đóng popover', () => {
    const onAnswer = vi.fn()
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={onAnswer} />)

    fireEvent.click(blank(31))
    const listbox = screen.getByRole('listbox')
    fireEvent.click(within(listbox).getByText('photosynthesis'))

    expect(onAnswer).toHaveBeenCalledWith(101, 'A')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('click lại vào ô đã có đáp án mở popover với mục "Xóa đáp án"', () => {
    const onAnswer = vi.fn()
    render(<DragWordBankGroup group={makeGroup()} answers={{ 101: 'A' }} onAnswer={onAnswer} />)

    fireEvent.click(blank(31))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getByText('Xóa đáp án')).toBeInTheDocument()

    fireEvent.click(within(listbox).getByText('Xóa đáp án'))
    expect(onAnswer).toHaveBeenCalledWith(101, '')
  })

  it('chưa có đáp án thì popover không có mục "Xóa đáp án"', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={() => {}} />)
    fireEvent.click(blank(31))
    expect(screen.queryByText('Xóa đáp án')).not.toBeInTheDocument()
  })

  it('đáp án đang chọn của ô được highlight trong popover (aria-selected)', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{ 101: 'B' }} onAnswer={() => {}} />)
    fireEvent.click(blank(31))

    const options = screen.getAllByRole('option')
    const current = options.find(o => o.textContent.includes('chlorophyll'))
    expect(current).toHaveAttribute('aria-selected', 'true')
  })

  it('phương án đã dùng ở câu khác bị khóa: không còn chữ "(Đã dùng)", disabled và không chọn được', () => {
    const onAnswer = vi.fn()
    // Câu 31 đã chọn 'A' (photosynthesis) → mở popover cho câu 32 phải thấy A bị khóa
    render(<DragWordBankGroup group={makeGroup()} answers={{ 101: 'A' }} onAnswer={onAnswer} />)

    fireEvent.click(blank(32))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).queryByText('(Đã dùng)')).not.toBeInTheDocument()

    const usedOption = within(listbox).getByRole('option', { name: /photosynthesis/ })
    expect(usedOption).toBeDisabled()

    fireEvent.click(usedOption)
    expect(onAnswer).not.toHaveBeenCalled()

    // Phương án chưa dùng ở câu khác vẫn chọn được bình thường
    fireEvent.click(within(listbox).getByText('chlorophyll'))
    expect(onAnswer).toHaveBeenCalledWith(102, 'B')
  })

  it('click ra ngoài đóng popover mà không gọi onAnswer', () => {
    const onAnswer = vi.fn()
    render(
      <div>
        <div data-testid="outside">outside area</div>
        <DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={onAnswer} />
      </div>
    )
    fireEvent.click(blank(31))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('phím Escape đóng popover', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={() => {}} />)
    fireEvent.click(blank(31))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('click lại đúng ô đang mở sẽ đóng popover (toggle)', () => {
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={() => {}} />)
    fireEvent.click(blank(31))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(blank(31))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('kéo thả (drag & drop) từ Word Bank vào ô trống vẫn hoạt động như cũ', () => {
    const onAnswer = vi.fn()
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={onAnswer} />)

    const wordChip = screen.getByText('sunlight').closest('div')

    fireEvent.dragStart(wordChip)
    fireEvent.dragOver(blank(31))
    fireEvent.drop(blank(31))

    expect(onAnswer).toHaveBeenCalledWith(101, 'C')
  })

  it('click 1 từ trong Word Bank rồi click ô trống → điền ngay không qua popover (flow cũ)', () => {
    const onAnswer = vi.fn()
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={onAnswer} />)

    const wordChip = screen.getByText('sunlight').closest('div')
    fireEvent.click(wordChip)
    fireEvent.click(blank(31))

    expect(onAnswer).toHaveBeenCalledWith(101, 'C')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('previewMode: click vào ô trống không mở popover, không gọi onAnswer', () => {
    const onAnswer = vi.fn()
    render(<DragWordBankGroup group={makeGroup()} answers={{}} onAnswer={onAnswer} previewMode />)
    fireEvent.click(screen.getByText('31'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('previewMode + showAnswers: hiển thị đáp án đúng thay vì đáp án đã chọn', () => {
    const group = makeGroup()
    group.questions[0].correctAnswer = 'D'
    render(<DragWordBankGroup group={group} answers={{}} onAnswer={() => {}} previewMode showAnswers />)
    expect(blank(31)).toHaveTextContent('D')
    expect(blank(31)).toHaveTextContent('carbon dioxide')
  })
})
