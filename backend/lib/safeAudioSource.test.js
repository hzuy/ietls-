import { afterEach, describe, expect, it, vi } from 'vitest'

const { isPublicAddress, validateRemoteAudioUrl } = require('./safeAudioSource')

afterEach(() => { vi.clearAllMocks(); delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.REMOTE_UPLOADS_URL })

describe('safe audio source validation', () => {
  it.each(['127.0.0.1', '10.0.0.2', '172.20.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1'])(
    'rejects private address %s', address => expect(isPublicAddress(address)).toBe(false),
  )
  it('allows a public address', () => expect(isPublicAddress('1.1.1.1')).toBe(true))
  it('allows only configured Cloudinary audio assets and resolves DNS before download', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
    const lookup = vi.fn().mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
    const result = await validateRemoteAudioUrl('https://res.cloudinary.com/test-cloud/video/upload/v123/ielts-app/audio/lesson.mp3', lookup)
    expect(result.url.hostname).toBe('res.cloudinary.com')
    expect(result.addresses).toEqual([{ address: '1.1.1.1', family: 4 }])
    expect(lookup).toHaveBeenCalledWith('res.cloudinary.com', { all: true, verbatim: true })
  })
  it('rejects arbitrary hosts, metadata endpoints, mixed public/private DNS, and insecure HTTP', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
    const lookup = vi.fn().mockResolvedValue([{ address: '1.1.1.1' }, { address: '169.254.169.254' }])
    await expect(validateRemoteAudioUrl('https://example.com/audio.mp3', lookup)).rejects.toThrow()
    await expect(validateRemoteAudioUrl('http://res.cloudinary.com/test-cloud/video/upload/ielts-app/audio/lesson.mp3', lookup)).rejects.toThrow()
    await expect(validateRemoteAudioUrl('https://res.cloudinary.com/test-cloud/video/upload/ielts-app/audio/lesson.mp3', lookup)).rejects.toThrow()
  })
  it('rejects unexpected Cloudinary resource folders and non-audio extensions', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
    const lookup = vi.fn().mockResolvedValue([{ address: '1.1.1.1' }])
    await expect(validateRemoteAudioUrl('https://res.cloudinary.com/test-cloud/image/upload/ielts-app/audio/image.png', lookup)).rejects.toThrow()
    await expect(validateRemoteAudioUrl('https://res.cloudinary.com/test-cloud/video/upload/ielts-app/other/audio.mp3', lookup)).rejects.toThrow()
  })
})
