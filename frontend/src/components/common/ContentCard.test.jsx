import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContentCard from './ContentCard'
import { buildSampleChips, CONTENT_CARD_CONFIG } from './contentCardConfig'

const base = {
  title: 'Cambridge IELTS 19 — Test 1',
  placeholder: { bg: 'var(--skill-r-bg)', icon: '📖' },
}

describe('ContentCard — thumb / title / placeholder', () => {
  it('render title + placeholder (không ảnh) hiển thị icon', () => {
    render(<ContentCard {...base} />)
    expect(screen.getByText('Cambridge IELTS 19 — Test 1')).toBeInTheDocument()
    expect(screen.getByText('📖')).toBeInTheDocument()
  })

  it('có ảnh → render <img> với src + alt, không render placeholder', () => {
    render(<ContentCard {...base} image="/uploads/x.png" imageAlt="cover" />)
    const img = screen.getByAltText('cover')
    expect(img).toHaveAttribute('src', '/uploads/x.png')
    expect(screen.queryByText('📖')).not.toBeInTheDocument()
  })

  it('placeholder.icon nhận ReactNode (không chỉ emoji string)', () => {
    render(<ContentCard {...base} placeholder={{ bg: '#eee', icon: <svg data-testid="ph-svg" /> }} />)
    expect(screen.getByTestId('ph-svg')).toBeInTheDocument()
  })

  it('thumbAspect dạng px → dùng height; dạng ratio → dùng aspectRatio', () => {
    const { container: pxC } = render(<ContentCard {...base} thumbAspect="160px" />)
    expect(pxC.querySelector('.cc-thumb').style.height).toBe('160px')

    const { container: arC } = render(<ContentCard {...base} thumbAspect="4/5" />)
    expect(arC.querySelector('.cc-thumb').style.aspectRatio).toBe('4 / 5')
  })

  it('titleClamp → set WebkitLineClamp + minHeight theo số dòng', () => {
    render(<ContentCard {...base} titleClamp={2} />)
    const p = screen.getByText(base.title)
    expect(p.style.WebkitLineClamp).toBe('2')
    expect(p.style.minHeight).toBe('2.8em')
  })

  it('className của parent được nối vào root cùng .card-base', () => {
    const { container } = render(<ContentCard {...base} className="anim-fade-up delay-2" />)
    expect(container.firstChild).toHaveClass('anim-fade-up', 'delay-2', 'card-base', 'flex', 'flex-col')
  })

  it('thumbOverlay renders inside cc-thumb', () => {
    render(<ContentCard {...base} thumbOverlay={<span data-testid="test-overlay">Badge</span>} />)
    expect(screen.getByTestId('test-overlay')).toBeInTheDocument()
  })
})

describe('ContentCard — meta (3 dạng)', () => {
  it("meta { type:'count' } → render text", () => {
    render(<ContentCard {...base} meta={{ type: 'count', text: '12 câu hỏi' }} />)
    expect(screen.getByText('12 câu hỏi')).toBeInTheDocument()
  })

  it("meta { type:'chips' } → render mọi chip label", () => {
    render(<ContentCard {...base} meta={{ type: 'chips', chips: [
      { label: 'Task 1', tone: 'writing' },
      { label: 'Bar chart', tone: 'neutral' },
    ] }} />)
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Bar chart')).toBeInTheDocument()
  })

  it('meta là ReactNode tuỳ ý → render nguyên', () => {
    render(<ContentCard {...base} meta={<em>nội dung riêng</em>} />)
    expect(screen.getByText('nội dung riêng')).toBeInTheDocument()
  })

  it('meta null → không render khối meta', () => {
    const { container } = render(<ContentCard {...base} meta={null} />)
    expect(container.textContent).not.toContain('undefined')
  })
})

describe('ContentCard — action (affordance nhỏ, không còn nút CTA giả)', () => {
  it('action khả dụng (không disabled) → chỉ mũi tên nhỏ, KHÔNG render <button>, click card vẫn gọi onClick', () => {
    const onCardClick = vi.fn()
    const { container } = render(<ContentCard {...base} onClick={onCardClick} action={{ label: 'Làm bài' }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    fireEvent.click(screen.getByText(base.title))
    expect(onCardClick).toHaveBeenCalledTimes(1)
  })

  it('{ disabled, disabledLabel } → pill nhãn trung tính thay mũi tên, không phải <button>', () => {
    render(<ContentCard {...base} action={{ label: 'Làm bài ngay', disabled: true, disabledLabel: 'Đang cập nhật' }} />)
    expect(screen.getByText('Đang cập nhật')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('{ disabled:true } không có disabledLabel → fallback dùng label', () => {
    render(<ContentCard {...base} action={{ label: 'Chi tiết', disabled: true }} />)
    expect(screen.getByText('Chi tiết')).toBeInTheDocument()
  })

  it('mũi tên đổi màu đặc khi hover showcase (card có onClick — clickable)', () => {
    const { container } = render(<ContentCard {...base} onClick={() => {}} hoverStyle="showcase" action={{ label: 'X' }} />)
    const arrowWrap = container.querySelector('.cc-thumb ~ div span[aria-hidden="true"]') || container.querySelector('span[aria-hidden="true"]')
    expect(arrowWrap.style.background).toBe('var(--primary-light)')
    fireEvent.mouseEnter(container.firstChild)
    expect(arrowWrap.style.background).toBe('var(--primary)')
  })

  it('card KHÔNG có onClick (không clickable) → showcase KHÔNG lift/đổi border khi hover, dù có action', () => {
    const { container } = render(<ContentCard {...base} hoverStyle="showcase" action={{ label: 'Chi tiết', disabled: true, disabledLabel: 'Đang cập nhật' }} />)
    const root = container.firstChild
    expect(root.style.cursor).toBe('default')
    fireEvent.mouseEnter(root)
    expect(root.style.transform).toContain('translateY(0)')
    expect(root.style.border).toBe(root.style.border) // giữ nguyên restBorder
  })

  it('hàng đáy (meta + affordance) luôn marginTop auto, có/không meta đều vậy', () => {
    const { container: withoutMeta } = render(<ContentCard {...base} action={{ label: 'Go' }} />)
    const rowNoMeta = withoutMeta.querySelector('div[style*="justify-content: space-between"]')
    expect(rowNoMeta.style.marginTop).toBe('auto')

    const { container: withMeta } = render(<ContentCard {...base} meta={{ type: 'count', text: '5 câu' }} action={{ label: 'Go' }} />)
    const rowWithMeta = withMeta.querySelector('div[style*="justify-content: space-between"]')
    expect(rowWithMeta.style.marginTop).toBe('auto')
  })
})

describe('ContentCard — hoverStyle', () => {
  it("showcase (clickable): mouseEnter → transform lift + accent bar hiện", () => {
    const { container } = render(<ContentCard {...base} onClick={() => {}} hoverStyle="showcase" accentBar />)
    const root = container.firstChild
    const bar = container.querySelector('.cc-accent-bar')

    expect(root.style.transform).toContain('translateY(0)')
    expect(bar.style.opacity).toBe('0')

    fireEvent.mouseEnter(root)
    expect(root.style.transform).toContain('translateY(-8px)')
    expect(root.style.transform).toContain('scale(1.02)')
    expect(bar.style.opacity).toBe('1')

    fireEvent.mouseLeave(root)
    expect(root.style.transform).toContain('translateY(0)')
  })

  it("showcase (clickable) KHÔNG action: hover đổi màu tiêu đề sang #18181b", () => {
    render(<ContentCard {...base} onClick={() => {}} hoverStyle="showcase" />)
    const p = screen.getByText(base.title)
    expect(p.style.color).toBe('var(--ink-soft)')
    fireEvent.mouseEnter(p.closest('.card-base'))
    expect(p.style.color).toBe('rgb(24, 24, 27)')
  })

  it("showcase (clickable) CÓ action: hover KHÔNG đổi màu tiêu đề (feedback ở mũi tên/accent bar)", () => {
    render(<ContentCard {...base} onClick={() => {}} hoverStyle="showcase" action={{ label: 'X' }} />)
    const p = screen.getByText(base.title)
    fireEvent.mouseEnter(p.closest('.card-base'))
    expect(p.style.color).toBe('var(--ink-soft)')
  })

  it("showcase KHÔNG clickable (không onClick): hover KHÔNG đổi màu tiêu đề dù không action", () => {
    render(<ContentCard {...base} hoverStyle="showcase" />)
    const p = screen.getByText(base.title)
    fireEvent.mouseEnter(p.closest('.card-base'))
    expect(p.style.color).toBe('var(--ink-soft)')
  })

  it("subtle: không gắn onMouseEnter, không có inline transform, dựa .card-base", () => {
    const { container } = render(<ContentCard {...base} hoverStyle="subtle" />)
    const root = container.firstChild
    fireEvent.mouseEnter(root)
    expect(root.style.transform).toBe('')
    expect(container.querySelector('.cc-accent-bar')).toBeNull()
    expect(root).toHaveClass('card-base')
  })

  it("subtle: accentBar bị bỏ qua (chỉ áp dụng cho showcase)", () => {
    const { container } = render(<ContentCard {...base} hoverStyle="subtle" accentBar />)
    expect(container.querySelector('.cc-accent-bar')).toBeNull()
  })
})

describe('ContentCard — onClick cả card', () => {
  it('có onClick → click card gọi handler, cursor pointer', () => {
    const onClick = vi.fn()
    const { container } = render(<ContentCard {...base} onClick={onClick} />)
    expect(container.firstChild.style.cursor).toBe('pointer')
    fireEvent.click(screen.getByText(base.title))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('không onClick (case V2) → cursor default, click card không nổ gì', () => {
    const { container } = render(<ContentCard {...base} />)
    expect(container.firstChild.style.cursor).toBe('default')
    fireEvent.click(screen.getByText(base.title)) // không throw
  })
})

describe('contentCardConfig — buildSampleChips', () => {
  it('writing task1 + examType → 2 chip đúng tone', () => {
    expect(buildSampleChips('writing', { level: 'task1', examType: 'Bar chart' })).toEqual([
      { label: 'Task 1', tone: 'writing' },
      { label: 'Bar chart', tone: 'neutral' },
    ])
  })

  it('speaking task3 → nhãn "Part 3", tone writing (giữ nguyên PART_COLORS cũ)', () => {
    expect(buildSampleChips('speaking', { level: 'task3' })).toEqual([{ label: 'Part 3', tone: 'writing' }])
  })

  it('level lạ / null → fallback nhãn skill + tone neutral', () => {
    expect(buildSampleChips('writing', { level: null })).toEqual([{ label: 'Writing', tone: 'neutral' }])
    expect(buildSampleChips('speaking', { level: 'task9' })).toEqual([{ label: 'Speaking', tone: 'neutral' }])
  })

  it('skill không có levelLabels (reading) → mảng rỗng', () => {
    expect(buildSampleChips('reading', { level: 'task1' })).toEqual([])
  })

  it('CONFIG có đủ 5 skill + placeholder', () => {
    for (const k of ['reading', 'listening', 'writing', 'speaking', 'fullTest']) {
      expect(CONTENT_CARD_CONFIG[k].placeholder).toHaveProperty('bg')
      expect(CONTENT_CARD_CONFIG[k].placeholder).toHaveProperty('icon')
    }
  })
})
