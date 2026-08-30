import { describe, it, expect } from 'vitest'
import {
  validateImageFile,
  validateAudioFile,
  IMAGE_MAX_BYTES,
  AUDIO_MAX_BYTES,
} from './fileValidation'

// Validator chỉ đọc file.type + file.size → dùng object giả cho gọn/nhanh.
const fakeFile = (type, size) => ({ type, size, name: 'x' })

describe('validateImageFile', () => {
  it('accepts a valid JPEG under the limit', () => {
    expect(validateImageFile(fakeFile('image/jpeg', 1 * 1024 * 1024))).toEqual({ ok: true, error: null })
  })

  it('accepts png / webp', () => {
    expect(validateImageFile(fakeFile('image/png', 100)).ok).toBe(true)
    expect(validateImageFile(fakeFile('image/webp', 100)).ok).toBe(true)
  })

  it('accepts a file exactly at the 5MB boundary', () => {
    expect(validateImageFile(fakeFile('image/png', IMAGE_MAX_BYTES)).ok).toBe(true)
  })

  it('rejects a wrong type', () => {
    const r = validateImageFile(fakeFile('image/gif', 100))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/JPG, PNG/)
  })

  it('rejects a file 1 byte over the limit, with actual size in the message', () => {
    const r = validateImageFile(fakeFile('image/jpeg', IMAGE_MAX_BYTES + 1))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/tối đa 5MB/)
    expect(r.error).toMatch(/5\.0MB/)
  })

  it('allows an empty file.type (browser could not sniff it), size still enforced', () => {
    expect(validateImageFile(fakeFile('', 1000)).ok).toBe(true)
    expect(validateImageFile(fakeFile('', IMAGE_MAX_BYTES + 1)).ok).toBe(false)
  })

  it('rejects a missing file', () => {
    expect(validateImageFile(null)).toEqual({ ok: false, error: 'Chưa chọn file' })
    expect(validateImageFile(undefined).ok).toBe(false)
  })
})

describe('validateAudioFile', () => {
  it('accepts a valid MP3 under the limit', () => {
    expect(validateAudioFile(fakeFile('audio/mpeg', 10 * 1024 * 1024))).toEqual({ ok: true, error: null })
  })

  it('accepts wav / ogg / mp4 / aac / x-m4a', () => {
    for (const t of ['audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a']) {
      expect(validateAudioFile(fakeFile(t, 100)).ok).toBe(true)
    }
  })

  it('accepts a file exactly at the 50MB boundary', () => {
    expect(validateAudioFile(fakeFile('audio/mpeg', AUDIO_MAX_BYTES)).ok).toBe(true)
  })

  it('rejects a wrong type', () => {
    const r = validateAudioFile(fakeFile('video/mp4', 100))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/MP3, WAV/)
  })

  it('rejects a file over the 50MB limit, with actual size in the message', () => {
    const r = validateAudioFile(fakeFile('audio/mpeg', AUDIO_MAX_BYTES + 5 * 1024 * 1024))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/tối đa 50MB/)
    expect(r.error).toMatch(/55\.0MB/)
  })

  it('allows an empty file.type, size still enforced', () => {
    expect(validateAudioFile(fakeFile('', 1000)).ok).toBe(true)
    expect(validateAudioFile(fakeFile('', AUDIO_MAX_BYTES + 1)).ok).toBe(false)
  })

  it('rejects a missing file', () => {
    expect(validateAudioFile(null).ok).toBe(false)
  })
})
