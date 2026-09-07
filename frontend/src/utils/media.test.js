import { describe, it, expect, vi } from 'vitest'
import {
  isCloudinaryUrl,
  optimizeCloudinaryUrl,
  resolveImg,
  toImgSrc,
  IMG_FALLBACK,
  handleImgError,
} from './media'

describe('media utility functions', () => {
  describe('isCloudinaryUrl', () => {
    it('detects valid cloudinary URLs', () => {
      expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg')).toBe(true)
      expect(isCloudinaryUrl('http://res.cloudinary.com/my-cloud/image/upload/sample.png')).toBe(true)
    })

    it('returns false for non-cloudinary URLs or invalid inputs', () => {
      expect(isCloudinaryUrl('https://example.com/image.jpg')).toBe(false)
      expect(isCloudinaryUrl('/uploads/sample.png')).toBe(false)
      expect(isCloudinaryUrl(null)).toBe(false)
      expect(isCloudinaryUrl('')).toBe(false)
    })
  })

  describe('optimizeCloudinaryUrl', () => {
    it('injects optimization parameters into standard cloudinary upload url', () => {
      const original = 'https://res.cloudinary.com/demo/image/upload/v1234/sample.jpg'
      const optimized = optimizeCloudinaryUrl(original, { width: 600, dpr: '2.0', quality: 'auto:best' })
      expect(optimized).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:best,dpr_2.0,w_600/v1234/sample.jpg')
    })

    it('does not double transform if parameters already exist', () => {
      const alreadyOptimized = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1234/sample.jpg'
      expect(optimizeCloudinaryUrl(alreadyOptimized)).toBe(alreadyOptimized)

      const withWidth = 'https://res.cloudinary.com/demo/image/upload/w_500/v1234/sample.jpg'
      expect(optimizeCloudinaryUrl(withWidth)).toBe(withWidth)
    })

    it('returns original input if not cloudinary', () => {
      expect(optimizeCloudinaryUrl('https://other.com/pic.jpg')).toBe('https://other.com/pic.jpg')
    })
  })

  describe('resolveImg and toImgSrc', () => {
    it('resolves relative URLs with BACKEND_URL', () => {
      const resolved = resolveImg('/uploads/covers/cam19.jpg')
      expect(resolved).toContain('/uploads/covers/cam19.jpg')
      expect(resolved).toMatch(/^https?:\/\//)
    })

    it('returns null for empty resolveImg and empty string for toImgSrc', () => {
      expect(resolveImg(null)).toBeNull()
      expect(resolveImg('')).toBeNull()
      expect(toImgSrc(null)).toBe('')
      expect(toImgSrc('')).toBe('')
    })

    it('automatically optimizes Cloudinary URLs in resolveImg and toImgSrc', () => {
      const cld = 'https://res.cloudinary.com/demo/image/upload/v123/cover.jpg'
      expect(resolveImg(cld)).toContain('f_auto,q_auto:best,dpr_2.0,w_600')
      expect(toImgSrc(cld)).toContain('f_auto,q_auto:best,dpr_2.0,w_600')
    })
  })

  describe('IMG_FALLBACK and handleImgError', () => {
    it('IMG_FALLBACK is a valid SVG data URI', () => {
      expect(IMG_FALLBACK).toContain('data:image/svg+xml;utf8,')
      expect(IMG_FALLBACK).toContain('IELTS%20ACADEMIC')
    })

    it('handleImgError assigns IMG_FALLBACK and resets onerror', () => {
      const mockImg = {
        onerror: vi.fn(),
        src: 'https://broken.link/image.jpg',
      }
      handleImgError({ currentTarget: mockImg })
      expect(mockImg.onerror).toBeNull()
      expect(mockImg.src).toBe(IMG_FALLBACK)
    })
  })
})
