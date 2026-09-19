import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  UserPageSkeleton,
  UserCardGridSkeleton,
  UserExamListSkeleton,
  UserHomeSkeleton,
  UserProfileSkeleton,
  UserHistorySkeleton,
  UserProgressSkeleton,
  UserResultSkeleton,
  SkeletonCard,
} from './index'

describe('User Skeletons Suite', () => {
  describe('UserPageSkeleton', () => {
    it('renders 1-column layout with max-w-6xl and no fake header h-16', () => {
      const { container } = render(<UserPageSkeleton />)
      expect(container.querySelector('.max-w-6xl')).toBeInTheDocument()
      // Không có header giả h-16
      expect(container.querySelector('.h-16.border-b')).not.toBeInTheDocument()
      // Không có dark mode classes gây layout shift
      expect(container.innerHTML).not.toContain('dark:')
      // Có bo góc rounded-2xl cho các card
      expect(container.querySelectorAll('.rounded-2xl').length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('UserCardGridSkeleton', () => {
    it('renders with aspect 3/4 and specified count', () => {
      const { container } = render(<UserCardGridSkeleton aspect="3/4" count={5} />)
      expect(container.querySelectorAll('.aspect-\\[3\\/4\\]').length).toBe(5)
      expect(container.querySelectorAll('.rounded-2xl').length).toBe(5)
      // Không chứa nút CTA giả h-9
      expect(container.querySelector('.h-9.w-full')).not.toBeInTheDocument()
    })

    it('renders with aspect 16/9 and hasPills for SamplesPage', () => {
      const { container } = render(<UserCardGridSkeleton aspect="16/9" count={3} hasPills={true} />)
      expect(container.querySelectorAll('.aspect-video').length).toBe(3)
      // Chứa 2 chip pills rounded-full ở đáy mỗi card
      expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(6)
    })

    it('renders with aspect 160px for practice exams', () => {
      const { container } = render(<UserCardGridSkeleton aspect="160px" count={4} />)
      expect(container.querySelectorAll('.h-40').length).toBe(4)
    })
  })

  describe('UserExamListSkeleton', () => {
    it('renders test card placeholders with rounded-2xl and pill button', () => {
      const { container } = render(<UserExamListSkeleton count={4} />)
      expect(container.querySelectorAll('.rounded-2xl').length).toBe(4)
      // Mỗi thẻ có 1 nút bấm bo viên thuốc rounded-full
      expect(container.querySelectorAll('.h-9.rounded-full').length).toBe(4)
      // Kiểm tra accessibility role
      expect(container.querySelector('[role="status"]')).toBeInTheDocument()
    })
  })

  describe('UserHomeSkeleton', () => {
    it('renders hero, progress widgets, book grid and explore cards', () => {
      const { container } = render(<UserHomeSkeleton />)
      expect(container.querySelector('section')).toBeInTheDocument()
      expect(container.querySelectorAll('.aspect-\\[3\\/4\\]').length).toBe(6)
      expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('UserProfileSkeleton', () => {
    it('renders results variant with 3 stat boxes and 4 skill progress bars', () => {
      const { container } = render(<UserProfileSkeleton variant="results" />)
      // 3 stat cards
      expect(container.querySelectorAll('.h-\\[116px\\]').length).toBe(3)
      // 4 progress bars với rounded-full
      expect(container.querySelectorAll('.h-2.rounded-full').length).toBe(4)
    })

    it('renders full page variant with user avatar and 3 pill inputs', () => {
      const { container } = render(<UserProfileSkeleton variant="full" />)
      // Avatar tròn rounded-full
      expect(container.querySelector('.w-16.h-16.rounded-full')).toBeInTheDocument()
      // 3 inputs bo rounded-full
      expect(container.querySelectorAll('.h-10.rounded-full').length).toBe(4) // 3 inputs + 1 button
    })
  })

  describe('UserHistorySkeleton', () => {
    it('renders history rows with rounded-full skill badge and review button', () => {
      const { container } = render(<UserHistorySkeleton count={5} showFilters={true} />)
      // 5 nút xem lại bo rounded-full
      expect(container.querySelectorAll('.h-8.w-20.rounded-full').length).toBe(5)
      // Có khung bộ lọc
      expect(container.querySelector('.sm\\:grid-cols-3')).toBeInTheDocument()
    })
  })

  describe('UserProgressSkeleton', () => {
    it('renders 4 metric cards and breakdown bars', () => {
      const { container } = render(<UserProgressSkeleton />)
      // 4 metric cards h-[110px]
      expect(container.querySelectorAll('.h-\\[110px\\]').length).toBe(4)
      // 5 thanh tiến độ dạng bài
      expect(container.querySelectorAll('.h-2.rounded-full').length).toBe(5)
    })
  })

  describe('UserResultSkeleton', () => {
    it('renders sticky header, score ring and question breakdown', () => {
      const { container } = render(<UserResultSkeleton />)
      expect(container.querySelector('.sticky.top-0')).toBeInTheDocument()
      expect(container.querySelector('.w-\\[88px\\].h-\\[88px\\]')).toBeInTheDocument()
      expect(container.querySelector('.max-w-4xl')).toBeInTheDocument()
    })
  })

  describe('SkeletonCard backward-compatibility', () => {
    it('renders without fake button by default', () => {
      const { container } = render(<SkeletonCard />)
      expect(container.querySelector('.h-9.bg-zinc-100.rounded-full')).not.toBeInTheDocument()
    })

    it('renders button only when hasButton is true', () => {
      const { container } = render(<SkeletonCard hasButton={true} />)
      expect(container.querySelector('.h-9.bg-zinc-100.rounded-full')).toBeInTheDocument()
    })
  })

  describe('Design tokens & A11y compliance', () => {
    it('all user skeletons have rounded-2xl, rounded-full, animate-pulse, and aria-hidden attributes', () => {
      const components = [
        <UserPageSkeleton key="page" />,
        <UserCardGridSkeleton key="grid" />,
        <UserExamListSkeleton key="exam" />,
        <UserHomeSkeleton key="home" />,
        <UserProfileSkeleton key="prof-res" variant="results" />,
        <UserProfileSkeleton key="prof-full" variant="full" />,
        <UserHistorySkeleton key="hist" showFilters={true} />,
        <UserProgressSkeleton key="prog" />,
        <UserResultSkeleton key="res" />,
      ]

      components.forEach((comp) => {
        const { container } = render(comp)
        // role="status" and aria-busy="true" on root
        expect(container.querySelector('[role="status"]')).toBeInTheDocument()
        expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()

        // rounded-2xl card containers
        expect(container.querySelectorAll('.rounded-2xl').length).toBeGreaterThanOrEqual(1)
        // rounded-full pills / buttons / badges
        expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(1)
        // animate-pulse pulse animation
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
        // aria-hidden="true" decorative containers
        expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(1)
      })
    })
  })
})
