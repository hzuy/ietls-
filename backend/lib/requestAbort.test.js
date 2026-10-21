'use strict'

import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'

import { bindRequestAbort } from '../lib/requestAbort'

/**
 * HỒI QUY: server phải dừng sinh giải thích khi client ngắt kết nối.
 *
 * Trước đây không có xử lý nào cho sự kiện đóng kết nối ở phía server, nên khi
 * admin đóng tab / bấm "Hủy sinh" / rời trang, server vẫn tiếp tục gọi AI và ghi
 * lời giải vào DB ("ghost writes") dù không còn ai nhận kết quả.
 */

function fakeResponse() {
  const res = new EventEmitter()
  res.writableEnded = false
  res.off = EventEmitter.prototype.removeListener.bind(res)
  return res
}

describe('bindRequestAbort', () => {
  it('abort khi response đóng giữa chừng (client bỏ ngang)', () => {
    const req = {}
    const res = fakeResponse()
    const { signal } = bindRequestAbort(req, res)

    expect(signal.aborted).toBe(false)
    res.emit('close')
    expect(signal.aborted).toBe(true)
  })

  it('KHÔNG abort khi response đã gửi xong bình thường', () => {
    const req = {}
    const res = fakeResponse()
    const { signal } = bindRequestAbort(req, res)

    res.writableEnded = true
    res.emit('close')
    expect(signal.aborted).toBe(false)
  })

  it('dispose() gỡ listener, không abort sau đó', () => {
    const req = {}
    const res = fakeResponse()
    const { signal, dispose } = bindRequestAbort(req, res)

    dispose()
    res.emit('close')
    expect(signal.aborted).toBe(false)
  })
})
