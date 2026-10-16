import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from './server'

describe('Server Uploads Middleware & Dev Fallback', () => {
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
