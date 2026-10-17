const {
  getGeminiMaxRpm,
  getMinIntervalMs,
  parseGeminiRetryWaitMs,
  scheduleGeminiCall,
  recordGeminiCooldown,
  resetRateLimiterState,
} = require('./geminiRateLimiter')

describe('geminiRateLimiter', () => {
  const originalEnv = process.env.GEMINI_MAX_RPM

  beforeEach(() => {
    resetRateLimiterState()
    delete process.env.GEMINI_MAX_RPM
  })

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_MAX_RPM = originalEnv
    } else {
      delete process.env.GEMINI_MAX_RPM
    }
  })

  describe('Configuration & RPM calculation', () => {
    it('mặc định là 12 RPM và khoảng nghỉ tối thiểu là 5000ms trong production', () => {
      expect(getGeminiMaxRpm()).toBe(12)
      const prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      expect(getMinIntervalMs()).toBe(5000)
      process.env.NODE_ENV = prevEnv
    })

    it('trả về 0ms trong test environment khi không set GEMINI_MAX_RPM để không làm chậm test', () => {
      const prevEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'
      delete process.env.GEMINI_MAX_RPM
      expect(getMinIntervalMs()).toBe(0)
      process.env.NODE_ENV = prevEnv
    })

    it('đọc giá trị từ GEMINI_MAX_RPM', () => {
      process.env.GEMINI_MAX_RPM = '10'
      expect(getGeminiMaxRpm()).toBe(10)
      expect(getMinIntervalMs()).toBe(6000)

      process.env.GEMINI_MAX_RPM = '30'
      expect(getGeminiMaxRpm()).toBe(30)
      expect(getMinIntervalMs()).toBe(2000)
    })

    it('xử lý giá trị không hợp lệ hoặc vượt ngưỡng', () => {
      process.env.GEMINI_MAX_RPM = '-5'
      expect(getGeminiMaxRpm()).toBe(12)

      process.env.GEMINI_MAX_RPM = 'abc'
      expect(getGeminiMaxRpm()).toBe(12)

      process.env.GEMINI_MAX_RPM = '120'
      expect(getGeminiMaxRpm()).toBe(60) // Giới hạn trần 60
    })
  })

  describe('parseGeminiRetryWaitMs', () => {
    it('đọc từ header retry-after dạng giây', () => {
      const headers = { 'retry-after': '18.5' }
      expect(parseGeminiRetryWaitMs(headers, null)).toBe(18500)
    })

    it('đọc từ header retry-after dạng đối tượng Headers có hàm get', () => {
      const headers = { get: key => (key === 'retry-after' ? '12' : null) }
      expect(parseGeminiRetryWaitMs(headers, null)).toBe(12000)
    })

    it('đọc từ JSON google.rpc.RetryInfo', () => {
      const body = {
        error: {
          code: 429,
          message: 'Resource has been exhausted',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.RetryInfo',
              retryDelay: '14.2s',
            },
          ],
        },
      }
      expect(parseGeminiRetryWaitMs(null, body)).toBe(14200)
    })

    it('đọc từ chuỗi JSON stringified chứa google.rpc.RetryInfo', () => {
      const bodyStr = JSON.stringify({
        error: {
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.RetryInfo',
              retryDelay: '20s',
            },
          ],
        },
      })
      expect(parseGeminiRetryWaitMs(null, bodyStr)).toBe(20000)
    })

    it('đọc từ message lỗi của Google', () => {
      const body = {
        error: {
          message: 'Quota exceeded for metric. Please retry in 16.5s or contact support.',
        },
      }
      expect(parseGeminiRetryWaitMs(null, body)).toBe(16500)
    })

    it('đọc từ raw text nếu body không phải JSON', () => {
      const rawText = 'Error 429: Rate limit exceeded, retry after 25s.'
      expect(parseGeminiRetryWaitMs(null, rawText)).toBe(25000)
    })

    it('trả về null nếu không có thông tin retry', () => {
      expect(parseGeminiRetryWaitMs(null, 'Internal Server Error 500')).toBeNull()
      expect(parseGeminiRetryWaitMs({}, { error: { message: 'Invalid argument' } })).toBeNull()
    })
  })

  describe('scheduleGeminiCall', () => {
    beforeEach(() => {
      process.env.GEMINI_MAX_RPM = '60' // 1000ms interval for tests
    })

    it('thực thi hàm và trả về kết quả chính xác', async () => {
      const res = await scheduleGeminiCall(async () => 'hello-gemini')
      expect(res).toBe('hello-gemini')
    })

    it('lan truyền lỗi đúng cách khi hàm ném lỗi mà không làm kẹt hàng đợi', async () => {
      await expect(
        scheduleGeminiCall(async () => {
          throw new Error('API failure')
        })
      ).rejects.toThrow('API failure')

      // Cuộc gọi tiếp theo vẫn hoạt động bình thường
      const nextRes = await scheduleGeminiCall(async () => 'recovered')
      expect(nextRes).toBe('recovered')
    }, 10000)

    it('điều tiết hàng đợi theo khoảng nghỉ tối thiểu', async () => {
      const timestamps = []

      const task = async id => {
        return scheduleGeminiCall(async () => {
          timestamps.push({ id, time: Date.now() })
          return id
        })
      }

      await Promise.all([task(1), task(2)])
      expect(timestamps.length).toBe(2)
      // Cuộc gọi thứ 2 phải diễn ra sau cuộc gọi 1 ít nhất ~900ms (cho phép lệch timer nhỏ)
      const diff = timestamps[1].time - timestamps[0].time
      expect(diff).toBeGreaterThanOrEqual(900)
    }, 10000)
  })
})
