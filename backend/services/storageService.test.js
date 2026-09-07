import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const path = require('path')
const fs = require('fs')
const cloudinary = require('cloudinary').v2
const {
  isCloudConfigured,
  initCloudinary,
  uploadToCloudinary,
  uploadImage,
  uploadAudio,
  uploadOptimizedCover,
  resolveAudioForTranscription,
} = require('./storageService')

describe('Storage Service', () => {
  const originalEnv = process.env
  let uploadSpy
  let configSpy

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.CLOUDINARY_URL
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET

    configSpy = vi.spyOn(cloudinary, 'config').mockImplementation(() => {})
    uploadSpy = vi.spyOn(cloudinary.uploader, 'upload').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg',
      public_id: 'ielts-app/media/sample_123',
      format: 'jpg',
      bytes: 1024,
    })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('isCloudConfigured & initCloudinary', () => {
    it('returns false when no cloudinary env vars are present', () => {
      expect(isCloudConfigured()).toBe(false)
    })

    it('returns true when CLOUDINARY_URL is present', () => {
      process.env.CLOUDINARY_URL = 'cloudinary://123:abc@mycloud'
      expect(isCloudConfigured()).toBe(true)
      initCloudinary()
      expect(configSpy).toHaveBeenCalledWith({ cloudinary_url: 'cloudinary://123:abc@mycloud' })
    })

    it('returns true when individual Cloudinary keys are present', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mycloud'
      process.env.CLOUDINARY_API_KEY = '123'
      process.env.CLOUDINARY_API_SECRET = 'secret'
      expect(isCloudConfigured()).toBe(true)
      initCloudinary()
      expect(configSpy).toHaveBeenCalledWith({
        cloud_name: 'mycloud',
        api_key: '123',
        api_secret: 'secret',
        secure: true,
      })
    })
  })

  describe('Fallback to local disk when Cloud is not configured', () => {
    it('uploadImage falls back to local uploads/questions/', async () => {
      const fakeFile = { path: null, filename: 'test.jpg' }
      const res = await uploadImage(fakeFile, { subdir: 'questions' })
      expect(res.cloud).toBe(false)
      expect(res.url).toBe('/uploads/questions/test.jpg')
      expect(res.filename).toBe('test.jpg')
    })

    it('uploadAudio falls back to local uploads/audio/', async () => {
      const fakeFile = { path: null, filename: 'test.mp3' }
      const res = await uploadAudio(fakeFile, { subdir: 'audio' })
      expect(res.cloud).toBe(false)
      expect(res.url).toBe('/uploads/audio/test.mp3')
      expect(res.filename).toBe('test.mp3')
    })

    it('uploadOptimizedCover handles non-resizable or fallback file gracefully', async () => {
      const tempSvg = path.join(__dirname, 'temp-fallback.svg')
      fs.writeFileSync(tempSvg, '<svg></svg>')
      try {
        const fakeFile = { path: tempSvg, filename: 'temp-fallback.svg' }
        const res = await uploadOptimizedCover(fakeFile, {
          dir: path.join(__dirname, 'test-covers'),
          urlPrefix: '/uploads/covers',
        })
        expect(res.cloud).toBe(false)
        expect(res.url).toContain('/uploads/covers/temp-fallback.svg')
      } finally {
        if (fs.existsSync(tempSvg)) fs.unlinkSync(tempSvg)
        const dest = path.join(__dirname, 'test-covers', 'temp-fallback.svg')
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        const destDir = path.join(__dirname, 'test-covers')
        if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })
      }
    })
  })

  describe('Cloudinary Uploads when configured', () => {
    beforeEach(() => {
      process.env.CLOUDINARY_URL = 'cloudinary://123:abc@mycloud'
    })

    it('uploadToCloudinary calls uploader.upload with proper folder', async () => {
      const tempPath = path.join(__dirname, 'temp-test-file.txt')
      fs.writeFileSync(tempPath, 'dummy data')

      const res = await uploadToCloudinary(tempPath, { folder: 'test', resourceType: 'image' })
      expect(uploadSpy).toHaveBeenCalledWith(tempPath, expect.objectContaining({
        folder: 'ielts-app/test',
        resource_type: 'image',
      }))
      expect(res.url).toBe('https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg')
      expect(fs.existsSync(tempPath)).toBe(false)
    })

    it('uploadAudio calls Cloudinary with resourceType: "video"', async () => {
      const tempAudio = path.join(__dirname, 'temp-test-audio.mp3')
      fs.writeFileSync(tempAudio, 'audio dummy')

      const fakeFile = { path: tempAudio, filename: 'test-audio.mp3' }
      const res = await uploadAudio(fakeFile)
      expect(res.cloud).toBe(true)
      expect(uploadSpy).toHaveBeenCalledWith(tempAudio, expect.objectContaining({
        folder: 'ielts-app/audio',
        resource_type: 'video',
      }))
    })

    it('uploadImage calls Cloudinary with resourceType: "image"', async () => {
      const tempImg = path.join(__dirname, 'temp-test-img.png')
      fs.writeFileSync(tempImg, 'image dummy')

      const fakeFile = { path: tempImg, filename: 'test-img.png' }
      const res = await uploadImage(fakeFile)
      expect(res.cloud).toBe(true)
      expect(uploadSpy).toHaveBeenCalledWith(tempImg, expect.objectContaining({
        folder: 'ielts-app/questions',
        resource_type: 'image',
      }))
    })
  })

  describe('resolveAudioForTranscription', () => {
    it('downloads remote audio via fetch when audioUrl starts with http', async () => {
      const fakeText = 'fake audio data for whisper'
      const fakeAudioBuffer = new TextEncoder().encode(fakeText).buffer
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fakeAudioBuffer),
      })

      try {
        const { filePath, isTemp, cleanup } = await resolveAudioForTranscription('https://res.cloudinary.com/mycloud/audio/test.mp3')
        expect(isTemp).toBe(true)
        expect(fs.existsSync(filePath)).toBe(true)
        expect(fs.readFileSync(filePath).toString()).toBe('fake audio data for whisper')

        cleanup()
        expect(fs.existsSync(filePath)).toBe(false)
      } finally {
        global.fetch = originalFetch
      }
    })

    it('throws error if local file does not exist', async () => {
      await expect(resolveAudioForTranscription('/uploads/audio/non-existent-12345.mp3'))
        .rejects
        .toThrow('File audio không tồn tại trên server')
    })
  })
})
