import { describe, it, expect } from 'vitest'
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from './auditActions'

describe('AUDIT_ACTION_LABELS — tác vụ tự động của hệ thống', () => {
  const autoActions = [AUDIT_ACTIONS.TRASH_AUTO_PURGE, AUDIT_ACTIONS.AUDIT_LOG_AUTO_PURGE]

  it('không còn hậu tố "(hệ thống)" để nhãn không bị dài/truncate trên bảng', () => {
    for (const action of autoActions) {
      const label = AUDIT_ACTION_LABELS[action]
      expect(label).toBeTruthy()
      expect(label).not.toMatch(/\(hệ thống\)/i)
    }
  })

  it('nhãn tác vụ tự động đủ ngắn để hiển thị trọn trong cột Hành động', () => {
    for (const action of autoActions) {
      expect(AUDIT_ACTION_LABELS[action].length).toBeLessThanOrEqual(24)
    }
  })

  it('mọi action đều có nhãn', () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy()
    }
  })
})
