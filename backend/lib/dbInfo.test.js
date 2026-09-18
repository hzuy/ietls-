import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDbConnectionInfo, printDbBanner } from './dbInfo'

describe('getDbConnectionInfo', () => {
  it('nhận diện DB local (127.0.0.1)', () => {
    const info = getDbConnectionInfo('postgresql://user:pass@127.0.0.1:5433/ielts_app_dev')
    expect(info).toEqual({ host: '127.0.0.1', port: '5433', database: 'ielts_app_dev', isLocal: true })
  })

  it('nhận diện DB local (localhost)', () => {
    const info = getDbConnectionInfo('postgresql://user:pass@localhost:5432/mydb')
    expect(info.isLocal).toBe(true)
  })

  it('nhận diện DB remote (Supabase) là KHÔNG local', () => {
    const info = getDbConnectionInfo('postgresql://user:pass@db.qtuzysaqftzmveyvrzxz.supabase.co:5432/postgres')
    expect(info).toEqual({ host: 'db.qtuzysaqftzmveyvrzxz.supabase.co', port: '5432', database: 'postgres', isLocal: false })
  })

  it('trả về an toàn khi thiếu DATABASE_URL', () => {
    expect(getDbConnectionInfo('')).toEqual({ host: null, port: null, database: null, isLocal: false })
  })

  it('không gọi tham số mặc định (rawUrl không truyền) thì đọc process.env.DATABASE_URL lúc gọi', () => {
    // Không giả định process.env.DATABASE_URL rỗng — khi chạy qua with-dev-db.js
    // (npm run test:dev-db), biến này CÓ giá trị thật (postgres-dev). Chỉ kiểm
    // tra tham số mặc định trỏ đúng vào process.env.DATABASE_URL tại thời điểm
    // gọi, bằng cách so sánh với gọi tường minh cùng giá trị đó.
    const ORIGINAL = process.env.DATABASE_URL
    try {
      delete process.env.DATABASE_URL
      expect(getDbConnectionInfo()).toEqual({ host: null, port: null, database: null, isLocal: false })

      process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5433/db'
      expect(getDbConnectionInfo()).toEqual(getDbConnectionInfo(process.env.DATABASE_URL))
    } finally {
      if (ORIGINAL === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = ORIGINAL
    }
  })

  it('trả về an toàn khi DATABASE_URL không parse được', () => {
    const info = getDbConnectionInfo('not-a-valid-url')
    expect(info.isLocal).toBe(false)
    expect(info.host).toContain('không đọc được')
  })

  it('không bao giờ trả về user/password trong kết quả', () => {
    const info = getDbConnectionInfo('postgresql://secretuser:secretpass@127.0.0.1:5433/db')
    const serialized = JSON.stringify(info)
    expect(serialized).not.toContain('secretuser')
    expect(serialized).not.toContain('secretpass')
  })
})

describe('printDbBanner', () => {
  let logSpy, warnSpy
  const ORIGINAL_ENV = process.env.NODE_ENV
  const ORIGINAL_URL = process.env.DATABASE_URL

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    process.env.NODE_ENV = ORIGINAL_ENV
    process.env.DATABASE_URL = ORIGINAL_URL
  })

  it('in banner thường, KHÔNG cảnh báo khi DB là local dù ở dev mode', () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5433/ielts_app_dev'
    printDbBanner('test')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:5433/ielts_app_dev'))
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('in cảnh báo nổi bật khi dev mode nhưng DB là remote', () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.supabase.co:5432/postgres'
    printDbBanner('test')
    expect(warnSpy).toHaveBeenCalled()
    const warned = warnSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(warned).toContain('CẢNH BÁO')
    expect(warned).not.toContain('u:p@') // không lộ credentials trong cảnh báo
  })

  it('KHÔNG cảnh báo khi NODE_ENV=production dù DB là remote (đúng chủ đích)', () => {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.supabase.co:5432/postgres'
    printDbBanner('test')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('không bao giờ in user/password ra console, kể cả ở log thường', () => {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgresql://secretuser:secretpass@127.0.0.1:5433/db'
    printDbBanner('test')
    const allOutput = [...logSpy.mock.calls, ...warnSpy.mock.calls].map(c => c.join(' ')).join('\n')
    expect(allOutput).not.toContain('secretuser')
    expect(allOutput).not.toContain('secretpass')
  })
})
