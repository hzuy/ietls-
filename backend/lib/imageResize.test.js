import { describe, it, expect, beforeEach, afterEach } from 'vitest'
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')
const { resizeUploadedCover, COVER_WIDTH } = require('./imageResize')

sharp.cache(false) // tránh giữ mmap file trên Windows → rmSync trong afterEach không EBUSY

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgresize-'))
})
afterEach(() => {
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true }); break } catch { /* retry: Windows file lock */ }
  }
})

async function writeFixture(name, { width = 1200, height = 1600, format = 'png' } = {}) {
  const p = path.join(dir, name)
  await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    [format]()
    .toFile(p)
  return { filename: name, path: p }
}

describe('resizeUploadedCover', () => {
  it('PNG lớn → .webp, rộng <= COVER_WIDTH, xoá file gốc, nhẹ hơn', async () => {
    const file = await writeFixture('1234-5678.png', { width: 1600, height: 2000 })
    const before = fs.statSync(file.path).size

    const out = await resizeUploadedCover(file, { dir, urlPrefix: '/uploads/thumbnails' })

    expect(out.filename).toBe('1234-5678.webp')
    expect(out.url).toBe('/uploads/thumbnails/1234-5678.webp')
    expect(fs.existsSync(file.path)).toBe(false)                 // file gốc bị xoá
    const outPath = path.join(dir, out.filename)
    expect(fs.existsSync(outPath)).toBe(true)
    const meta = await sharp(outPath).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBeLessThanOrEqual(COVER_WIDTH)
    expect(fs.statSync(outPath).size).toBeLessThan(before)
  })

  it('ảnh nhỏ hơn COVER_WIDTH → không phóng to', async () => {
    const file = await writeFixture('small.png', { width: 200, height: 260 })
    const out = await resizeUploadedCover(file, { dir, urlPrefix: '/uploads' })
    const meta = await sharp(path.join(dir, out.filename)).metadata()
    expect(meta.width).toBe(200)
  })

  it('input đã là .webp → vẫn xử lý, cùng tên, không mất file', async () => {
    const file = await writeFixture('abc.webp', { width: 1000, height: 1000, format: 'webp' })
    const out = await resizeUploadedCover(file, { dir, urlPrefix: '/uploads' })
    expect(out.filename).toBe('abc.webp')
    const outPath = path.join(dir, 'abc.webp')
    expect(fs.existsSync(outPath)).toBe(true)
    const meta = await sharp(outPath).metadata()
    expect(meta.width).toBeLessThanOrEqual(COVER_WIDTH)
  })

  it('.svg → passthrough, giữ nguyên file gốc', async () => {
    const p = path.join(dir, 'logo.svg')
    fs.writeFileSync(p, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
    const out = await resizeUploadedCover({ filename: 'logo.svg', path: p }, { dir, urlPrefix: '/uploads' })
    expect(out.filename).toBe('logo.svg')
    expect(fs.existsSync(p)).toBe(true)
  })

  it('file hỏng / không đọc được → passthrough, không ném lỗi', async () => {
    const p = path.join(dir, 'broken.png')
    fs.writeFileSync(p, 'not-an-image')
    const out = await resizeUploadedCover({ filename: 'broken.png', path: p }, { dir, urlPrefix: '/uploads' })
    expect(out.filename).toBe('broken.png')
    expect(fs.existsSync(p)).toBe(true)
  })
})
