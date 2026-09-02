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

describe('ContentCard — action (3 dạng)', () => {
  it('{ label, onClick } → nút thật, click gọi onClick và KHÔNG bubble lên card', () => {
    const onCardClick = vi.fn()
    const onAction = vi.fn()
    render(<ContentCard {...base} onClick={onCardClick} action={{ label: 'Làm bài', onClick: onAction }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Làm bài' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('{ decorative:true } → pointer-events none, click xuyên xuống onClick của card', () => {
    const onCardClick = vi.fn()
    render(<ContentCard {...base} onClick={onCardClick} action={{ label: 'Làm bài →', decorative: true }} />)
    const btn = screen.getByRole('button', { name: 'Làm bài →' })
    expect(btn.style.pointerEvents).toBe('none')
    fireEvent.click(screen.getByText(base.title))
    expect(onCardClick).toHaveBeenCalledTimes(1)
  })

  it('{ disabled, disabledLabel } → nút disabled + hiển thị disabledLabel', () => {
    render(<ContentCard {...base} action={{ label: 'Làm bài ngay →', disabled: true, disabledLabel: 'Đang cập nhật' }} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Đang cập nhật')
  })

  it('{ decorative:true } → LUÔN tone đặc (primary / #fff), bất kể hoverStyle / hovered', () => {
    const { unmount } = render(<ContentCard {...base} hoverStyle="subtle" action={{ label: 'Làm bài →', decorative: true }} />)
    let btn = screen.getByRole('button', { name: 'Làm bài →' })
    expect(btn.style.background).toBe('var(--primary)')
    expect(btn.style.color).toBe('rgb(255, 255, 255)')
    unmount()

    render(<ContentCard {...base} hoverStyle="showcase" action={{ label: 'Làm bài →', decorative: true }} />)
    btn = screen.getByRole('button', { name: 'Làm bài →' }) // showcase nhưng chưa hover
    expect(btn.style.background).toBe('var(--primary)')
  })

  it('{ onClick } (không decorative) → mềm lúc nghỉ, đặc khi hover showcase', () => {
    const { container } = render(<ContentCard {...base} hoverStyle="showcase" action={{ label: 'X', onClick: () => {} }} />)
    const btn = screen.getByRole('button', { name: 'X' })
    expect(btn.style.background).toBe('var(--primary-light)')
    fireEvent.mouseEnter(container.firstChild)
    expect(btn.style.background).toBe('var(--primary)')
  })

  it('không có meta + có action → nút đẩy xuống đáy (marginTop auto)', () => {
    render(<ContentCard {...base} action={{ label: 'Go', decorative: true }} />)
    expect(screen.getByRole('button').style.marginTop).toBe('auto')
  })

  it('có meta + có action → nút cách meta 12px', () => {
    render(<ContentCard {...base} meta={{ type: 'count', text: '5 câu' }} action={{ label: 'Go', decorative: true }} />)
    expect(screen.getByRole('button').style.marginTop).toBe('12px')
  })
})

describe('ContentCard — hoverStyle', () => {
  it("showcase: mouseEnter → transform lift + accent bar hiện", () => {
    const { container } = render(<ContentCard {...base} hoverStyle="showcase" accentBar />)
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

  it("showcase KHÔNG action: hover đổi màu tiêu đề sang #2563EB", () => {
    render(<ContentCard {...base} hoverStyle="showcase" />)
    const p = screen.getByText(base.title)
    expect(p.style.color).toBe('var(--ink-soft)')
    fireEvent.mouseEnter(p.closest('.card-base'))
    expect(p.style.color).toBe('rgb(37, 99, 235)')
  })

  it("showcase CÓ action: hover KHÔNG đổi màu tiêu đề (feedback ở nút/accent bar)", () => {
    render(<ContentCard {...base} hoverStyle="showcase" action={{ label: 'X', onClick: () => {} }} />)
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
