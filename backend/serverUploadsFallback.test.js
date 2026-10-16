import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import app from './server'

describe('Server Uploads Middleware & Dev Fallback', () => {
  beforeAll(() => {
    const dir = path.join(__dirname, 'uploads', 'thumbnails')
    fs.mkdirSync(dir, { recursive: true })
    const sample = path.join(dir, '1786071827599-845810512.webp')
    if (!fs.existsSync(sample)) {
      fs.writeFileSync(sample, Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
        0x0e, 0x00, 0x00, 0x00, 0xb0, 0x01, 0x00, 0x9d,
        0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
      ]))
    }
  })
  it('serves existing local files directly', async () => {
    // 1786071827599-845810512.webp exists in backend/uploads/thumbnails/
    const res = await request(app).get('/uploads/thumbnails/1786071827599-845810512.webp')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/webp/)
  })

  it('redirects 302 to remote server when file is missing in development', async () => {
    // 1792080214828-46692893.webp exists only on hzuy.net, missing on local disk
    const res = await request(app).get('/uploads/thumbnails/1792080214828-46692893.webp')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://hzuy.net/uploads/thumbnails/1792080214828-46692893.webp')
  })

  it('prevents path traversal attempts from redirecting', async () => {
    const res = await request(app).get('/uploads/..%2F..%2Fetc/passwd')
    // Path traversal contains '..' -> rejected by fallback
    expect(res.status).not.toBe(302)
  })
})
