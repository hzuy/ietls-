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
  const isExitingRef = useRef(false)
  const handlePopStateRef = useRef(null)
  const onBeforeExitRef = useRef(onBeforeExit)
  // Sync ref mỗi render để không cần đưa vào deps effect
  useEffect(() => {
    onBeforeExitRef.current = onBeforeExit
  })

  useEffect(() => {
    if (!enabled) return

    isExitingRef.current = false

    // Đẩy một entry sentinel vào history để bắt sự kiện popstate
    window.history.pushState(null, '', window.location.href)

    const handlePopState = () => {
      // Nếu đang trong quá trình chủ động thoát (kích hoạt bởi leave), bỏ qua hoàn toàn popstate
      if (isExitingRef.current) return

      // Chèn lại sentinel ngay lập tức để giữ URL hiện tại trong lúc modal hiện
      window.history.pushState(null, '', window.location.href)
      // Lưu nháp ngay khi phát hiện ý định thoát (trước khi user xác nhận)
      try { onBeforeExitRef.current?.() } catch { /* lỗi lưu không chặn modal */ }
      setShowModal(true)
    }

    handlePopStateRef.current = handlePopState
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled])

  // Ở lại: đóng modal, tiếp tục làm bài
  const stay = useCallback(() => {
    setShowModal(false)
  }, [])

  // Thoát: đánh dấu cờ thoát, gỡ listener, lưu nháp, đóng modal và đi ngược về 2 entry
  const leave = useCallback(() => {
    // 1. Đánh dấu ngay cờ bypass để các popstate tiếp theo (do history.go kích hoạt) bị bỏ qua
    isExitingRef.current = true
    // 2. Gỡ bỏ listener trên window ngay lập tức
    if (handlePopStateRef.current) {
      window.removeEventListener('popstate', handlePopStateRef.current)
    }
    // 3. Đảm bảo bản nháp mới nhất được lưu trước khi rời phòng thi
    try { onBeforeExitRef.current?.() } catch { /* lỗi lưu không chặn điều hướng */ }
    // 4. Đóng modal và lùi 2 bước về trang trước
    setShowModal(false)
    window.history.go(-2)
  }, [])

  return { showModal, stay, leave }
}
