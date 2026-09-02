import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeGroupCard from './PracticeGroupCard'

// Leaf editor có thể gọi service ảnh khi user thao tác — không cần cho smoke render.
vi.mock('../../services/examService', () => ({ uploadImage: vi.fn() }))

const baseGroup = (type, extra = {}) => ({
  _id: 1, type, qNumberStart: 1, qNumberEnd: 3, instruction: 'Do X', questions: [], matchingOptions: [], noteSections: [], ...extra,
})

const noop = () => {}

const renderCard = (skill, group) =>
  render(
    <PracticeGroupCard
      skill={skill} group={group}
      onChange={noop} onRemove={noop} onMoveUp={noop} onMoveDown={noop}
      isFirst isLast={false}
    />,
  )

describe('PracticeGroupCard — merge Reading/Listening group editor', () => {
  it('reading: render mọi loại group.type của Reading không crash + đúng badge', () => {
    const types = [
      ['true_false_ng', 'True / False / Not Given'],
      ['note_completion', 'Note / Form Completion'],
      ['table_completion', 'Table Completion'],
      ['mcq', 'Multiple Choice (1 đáp án)'],
      ['mcq_multi', 'Multiple Choice (chọn TWO)'],
      ['matching_information', 'Matching Information (nối đoạn)'],
      ['drag_word_bank', 'Summary + Word Bank (kéo thả)'],
      ['matching_drag', 'Matching - Kéo thả đáp án'],
      ['diagram_label', 'Diagram Label Completion'],
      ['matching_headings', 'Matching Headings'],
    ]
    for (const [type, label] of types) {
      const { unmount } = renderCard('reading', baseGroup(type))
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(screen.getByText('Câu 1–3')).toBeInTheDocument()
      expect(screen.getByText('Xóa nhóm')).toBeInTheDocument()
      unmount()
    }
  })

  it('listening: render mọi loại group.type của Listening không crash + đúng badge', () => {
    const types = [
      ['note_completion', 'Note / Form Completion'],
      ['table_completion', 'Table Completion'],
      ['mcq', 'Multiple Choice (1 đáp án)'],
      ['mcq_multi', 'Multiple Choice (nhiều đáp án)'],
      ['matching', 'Matching'],
      ['map_diagram', 'Map / Diagram Labeling'],
      ['drag_word_bank', 'Summary + Word Bank (kéo thả)'],
      ['matching_drag', 'Matching - Kéo thả đáp án'],
      ['diagram_label', 'Diagram Label Completion'],
      ['matching_headings', 'Matching Headings'],
    ]
    for (const [type, label] of types) {
      const { unmount } = renderCard('listening', baseGroup(type))
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('drag_word_bank: reading dùng SummaryCompletionEditor (có nút thêm section), listening dùng bản Simple', () => {
    const { container: rc, unmount } = renderCard('reading', baseGroup('drag_word_bank', {
      noteSections: [{ title: '', lines: [{ content: '' }] }],
      matchingOptions: [{ letter: 'A', text: '' }],
    }))
    // bản đầy đủ có nút "+ Đoạn" / addSection — bản Simple không có
    const readingHtml = rc.innerHTML
    unmount()

    const { container: lc } = renderCard('listening', baseGroup('drag_word_bank', {
      noteSections: [{ title: '', lines: [{ content: '' }] }],
      matchingOptions: [{ letter: 'A', text: '' }],
    }))
    expect(readingHtml).not.toBe(lc.innerHTML)
  })

  it('vỏ khác nhau theo skill: reading rounded-lg phẳng, listening rounded-2xl có màu', () => {
    const { container: r, unmount } = renderCard('reading', baseGroup('mcq'))
    expect(r.querySelector('.rounded-lg')).toBeTruthy()
    expect(r.querySelector('.rounded-2xl')).toBeFalsy()
    unmount()

    const { container: l } = renderCard('listening', baseGroup('mcq'))
    expect(l.querySelector('.rounded-2xl')).toBeTruthy()
  })

  const cardProps = (over) => ({
    skill: 'reading', group: baseGroup('mcq'),
    onChange: noop, onRemove: noop, onMoveUp: noop, onMoveDown: noop,
    isFirst: true, isLast: false, onToggle: noop,
    ...over,
  })

  it('collapse: expanded=false → ẩn body (Instruction); header + nút + chevron vẫn hiện', () => {
    const { rerender } = render(<PracticeGroupCard {...cardProps({ expanded: false })} />)

    expect(screen.getByText('Multiple Choice (1 đáp án)')).toBeInTheDocument()
    expect(screen.getByText('Câu 1–3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa nhóm' })).toBeInTheDocument()
    const chevron = screen.getByRole('button', { name: /nhóm Multiple Choice/ })
    expect(chevron).toHaveAttribute('aria-expanded', 'false')
    // body ẩn
    expect(screen.queryByText(/Instruction \(hiển thị cho học sinh\)/)).not.toBeInTheDocument()

    rerender(<PracticeGroupCard {...cardProps({ expanded: true })} />)
    expect(screen.getByText(/Instruction \(hiển thị cho học sinh\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nhóm Multiple Choice/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapse: click chevron VÀ click thân header đều gọi onToggle', () => {
    const onToggle = vi.fn()
    render(<PracticeGroupCard {...cardProps({ expanded: false, onToggle })} />)

    fireEvent.click(screen.getByRole('button', { name: /nhóm Multiple Choice/ }))  // chevron
    fireEvent.click(screen.getByText('Multiple Choice (1 đáp án)'))                 // badge trong header
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('collapse: click ▲▼ / Xóa trong header KHÔNG kích hoạt onToggle (stopPropagation)', () => {
    const onToggle = vi.fn()
    const onRemove = vi.fn()
    render(<PracticeGroupCard {...cardProps({ skill: 'listening', group: baseGroup('note_completion'), expanded: false, onToggle, onRemove })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Xóa nhóm' }))
    fireEvent.click(screen.getByRole('button', { name: '▼' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
  })
})
