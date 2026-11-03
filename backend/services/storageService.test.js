import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const path = require('path')
const fs = require('fs')
const https = require('node:https')
const dns = require('node:dns').promises
const { EventEmitter } = require('node:events')
const { Readable } = require('node:stream')
const { MAX_AUDIO_BYTES } = require('../lib/safeAudioSource')
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
    it('rejects an untrusted remote source before any network request', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
      await expect(resolveAudioForTranscription('https://127.0.0.1/private.mp3')).rejects.toThrow()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('resolves a managed local file and rejects traversal and missing files', async () => {
      const { uploadsDir } = require('../lib/adminUploads')
      const testFile = path.join(uploadsDir, 'safety-test.mp3')
      fs.writeFileSync(testFile, Buffer.from('test audio'))
      try {
        const resolved = await resolveAudioForTranscription('/uploads/safety-test.mp3')
        expect(resolved.isTemp).toBe(false)
        expect(fs.realpathSync(resolved.filePath)).toBe(fs.realpathSync(testFile))
        await expect(resolveAudioForTranscription('/uploads/..%2fprivate.mp3')).rejects.toThrow()
        await expect(resolveAudioForTranscription('/uploads/missing-safety-test.mp3')).rejects.toThrow('Audio file does not exist on server')
      } finally { fs.unlinkSync(testFile) }
    })

    it('rejects unsupported remote schemes and untrusted hosts', async () => {
      await expect(resolveAudioForTranscription('http://example.com/audio.mp3')).rejects.toThrow()
      await expect(resolveAudioForTranscription('file:///etc/passwd')).rejects.toThrow()
    })

    it('pins managed remote downloads to validated DNS and cleans temporary audio', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mycloud'
      vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
      vi.spyOn(https, 'get').mockImplementation((url, options, onResponse) => {
        const req = new EventEmitter()
        req.setTimeout = vi.fn()
        req.destroy = vi.fn()
        const response = Readable.from([Buffer.alloc(4096, 1)])
        response.statusCode = 200
        response.headers = { 'content-length': '4096' }
        queueMicrotask(() => onResponse(response))
        expect(options.lookup).toBeTypeOf('function')
        expect(url.hostname).toBe('res.cloudinary.com')
        return req
      })

      const resolved = await resolveAudioForTranscription('https://res.cloudinary.com/mycloud/video/upload/ielts-app/audio/test.mp3')
      expect(resolved.isTemp).toBe(true)
      expect(fs.statSync(resolved.filePath).size).toBe(4096)
      resolved.cleanup()
      expect(fs.existsSync(resolved.filePath)).toBe(false)
    })

    it.each([
      ['redirect', 302, { location: 'http://127.0.0.1/latest/meta-data' }],
      ['oversized response', 200, { 'content-length': String(MAX_AUDIO_BYTES + 1) }],
    ])('rejects a managed remote %s without following redirects or buffering oversized files', async (_case, statusCode, headers) => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mycloud'
      vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
      vi.spyOn(https, 'get').mockImplementation((_url, _options, onResponse) => {
        const req = new EventEmitter()
        req.setTimeout = vi.fn()
        req.destroy = vi.fn()
        const response = Readable.from([])
        response.statusCode = statusCode
        response.headers = headers
        queueMicrotask(() => onResponse(response))
        return req
      })
      await expect(resolveAudioForTranscription('https://res.cloudinary.com/mycloud/video/upload/ielts-app/audio/test.mp3')).rejects.toThrow()
    })
  })
})
