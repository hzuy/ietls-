import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useBrowserHistoryGuard — Chặn thao tác nhấn nút Back (<) hoặc Alt+Left Arrow
 * trên trình duyệt khi đang làm bài thi.
 *
 * Thay vì dùng window.confirm (blocking native dialog), hook này trả về
 * { showModal, stay, leave } để caller tự render React Modal đẹp hơn.
 *
 * @param {boolean} enabled — Chỉ kích hoạt khi bài thi đang trong tiến trình làm bài.
 * @param {() => void} [onBeforeExit] — Callback chạy đồng bộ để lưu nháp trước khi rời đi.
 * @returns {{ showModal: boolean, stay: () => void, leave: () => void }}
 */
export function useBrowserHistoryGuard(enabled, onBeforeExit) {
  const [showModal, setShowModal] = useState(false)
  const onBeforeExitRef = useRef(onBeforeExit)
  // Sync ref mỗi render để không cần đưa vào deps effect
  useEffect(() => {
    onBeforeExitRef.current = onBeforeExit
  })

  useEffect(() => {
    if (!enabled) return

    // Đẩy một entry sentinel vào history để bắt sự kiện popstate
    window.history.pushState(null, '', window.location.href)

    const handlePopState = () => {
      // Chèn lại sentinel ngay lập tức để giữ URL hiện tại trong lúc modal hiện
      window.history.pushState(null, '', window.location.href)
      // Lưu nháp ngay khi phát hiện ý định thoát (trước khi user xác nhận)
      try { onBeforeExitRef.current?.() } catch { /* lỗi lưu không chặn modal */ }
      setShowModal(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled])

  // Ở lại: đóng modal, tiếp tục làm bài
  const stay = useCallback(() => {
    setShowModal(false)
  }, [])

  // Thoát: đóng modal, đi ngược về 2 entry (sentinel + entry thật của trang trước)
  const leave = useCallback(() => {
    setShowModal(false)
    // Gỡ sentinel để back thật sự hoạt động
    window.history.go(-2)
  }, [])

  return { showModal, stay, leave }
}
