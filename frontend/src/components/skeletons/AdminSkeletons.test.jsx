import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  AdminPageSkeleton,
  AdminTableSkeleton,
  AdminAnalyticsSkeleton,
  AdminStatsSkeleton,
  AdminDetailSkeleton,
  AdminGridSkeleton,
  SkeletonTable,
} from './index'

describe('Admin Skeletons Suite', () => {
  describe('AdminPageSkeleton', () => {
    it('renders with max-w-6xl wrapper and animate-pulse without dark mode classes', () => {
      const { container } = render(<AdminPageSkeleton />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('max-w-6xl', 'mx-auto', 'w-full', 'animate-pulse')
      expect(container.innerHTML).not.toContain('dark:')
    })
  })

  describe('AdminTableSkeleton', () => {
    it('renders with default firstColType (text)', () => {
      const { container } = render(<AdminTableSkeleton rows={4} cols={4} />)
      expect(container.querySelector('.rounded-2xl')).toBeInTheDocument()
      expect(container.querySelector('.w-4\\.h-4')).not.toBeInTheDocument()
    })

    it('renders checkbox for firstColType="checkbox"', () => {
      const { container } = render(<AdminTableSkeleton firstColType="checkbox" rows={3} cols={5} />)
      expect(container.querySelectorAll('.w-4.h-4.rounded').length).toBeGreaterThan(0)
    })

    it('renders avatar for firstColType="avatar"', () => {
      const { container } = render(<AdminTableSkeleton firstColType="avatar" rows={3} cols={4} />)
      expect(container.querySelectorAll('.w-8.h-8.rounded-full').length).toBe(3)
    })

    it('renders thumbnail for firstColType="thumbnail"', () => {
      const { container } = render(<AdminTableSkeleton firstColType="thumbnail" rows={3} cols={4} />)
      expect(container.querySelectorAll('.w-14.h-9.rounded-md').length).toBe(3)
    })

    it('backward-compatible SkeletonTable delegates to AdminTableSkeleton', () => {
      const { container } = render(<SkeletonTable rows={2} cols={3} />)
      expect(container.querySelector('.rounded-2xl')).toBeInTheDocument()
      expect(container.querySelectorAll('.w-8.h-8.rounded-full').length).toBe(2)
    })
  })

  describe('AdminAnalyticsSkeleton', () => {
    it('renders KPI cards, chart wrappers and skill breakdown', () => {
      const { container } = render(<AdminAnalyticsSkeleton />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('max-w-6xl', 'mx-auto', 'w-full', 'animate-pulse')
      // 3 KPI cards with h-[88px]
      expect(container.querySelectorAll('.h-\\[88px\\]').length).toBe(3)
      // 2 chart boxes with h-[250px]
      expect(container.querySelectorAll('.h-\\[250px\\]').length).toBe(2)
    })
  })

  describe('AdminStatsSkeleton', () => {
    it('renders responsive grid based on count', () => {
      const { container: c2 } = render(<AdminStatsSkeleton count={2} />)
      expect(c2.firstChild).toHaveClass('grid-cols-2')

      const { container: c3 } = render(<AdminStatsSkeleton count={3} />)
      expect(c3.firstChild).toHaveClass('grid-cols-1', 'sm:grid-cols-3')

      const { container: c4 } = render(<AdminStatsSkeleton count={4} />)
      expect(c4.firstChild).toHaveClass('grid-cols-2', 'sm:grid-cols-4')
    })
  })

  describe('AdminDetailSkeleton', () => {
    it('renders 2-column layout for student detail with profile and history', () => {
      const { container } = render(<AdminDetailSkeleton />)
      expect(container.querySelector('.lg\\:col-span-1')).toBeInTheDocument()
      expect(container.querySelector('.lg\\:col-span-2')).toBeInTheDocument()
      expect(container.querySelectorAll('.rounded-2xl').length).toBeGreaterThan(2)
    })
  })

  describe('AdminGridSkeleton', () => {
    it('renders grid with specified card count and responsive cols', () => {
      const { container } = render(<AdminGridSkeleton count={6} cols={3} />)
      expect(container.querySelectorAll('.border-zinc-200.rounded-2xl').length).toBe(6)
      expect(container.firstChild).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3')
    })
  })
})
