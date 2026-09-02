import { useState, useEffect, useCallback } from 'react'

const AUTOSAVE_DELAY_MS = 2000

/**
 * BUG-14: Draft an toàn cho form admin content-creation
 * (ReadingPractice · ListeningPractice · SampleManager).
 *
 * @param {string}  key    - localStorage key (đã bao gồm id bản ghi / 'new')
 * @param {object}  form   - state form hiện tại
 * @param {object}  opts
 * @param {boolean} opts.enabled - form đang mở (view === 'form'). Gate cả restore
 *                                 lẫn autosave.
 * @param {boolean} opts.dirty   - form đã khác snapshot lúc mở (derive-snapshot
 *                                 formSig/pristineRef ở phía trang). Chỉ autosave
 *                                 khi dirty → không ghi "nháp ma" cho form vừa mở
 *                                 chưa chỉnh sửa gì.
 *
 * @returns {{
 *   draftBanner: {data: object}|null,
 *   setDraftBanner: Function,
 *   draftSavedAt: string|null,
 *   clearDraft: Function,
 * }}
 */
export function useDraftPersistence(key, form, { enabled, dirty }) {
  const [draftBanner, setDraftBanner] = useState(null)
  const [draftSavedAt, setDraftSavedAt] = useState(null)

  // Restore: đọc nháp đã lưu khi mở form (hoặc khi đổi bản ghi đang sửa → key đổi).
  // Sync trạng thái banner từ localStorage (nguồn ngoài) mỗi khi key/enabled đổi —
  // đúng công dụng của useEffect; set-state-in-effect ở đây là chủ đích.
  useEffect(() => {
    if (!enabled) return
    let next = null
    const saved = localStorage.getItem(key)
    if (saved) {
      try { next = { data: JSON.parse(saved) } }
      catch { localStorage.removeItem(key) }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftBanner(next)
  }, [enabled, key])

  // Autosave (debounce 2s) — chỉ khi form đang mở VÀ đã có thay đổi thực sự.
  useEffect(() => {
    if (!enabled || !dirty) return
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(form))
      const now = new Date()
      setDraftSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [form, enabled, dirty, key])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    setDraftBanner(null)
    setDraftSavedAt(null)
  }, [key])

  return { draftBanner, setDraftBanner, draftSavedAt, clearDraft }
}
