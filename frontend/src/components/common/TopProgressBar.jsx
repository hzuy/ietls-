import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Thanh loading mỏng ở đỉnh trang khi chuyển route. Không có API nào báo khi
 * nào chunk lazy-load thực sự xong nên đây là tiến trình "giả lập" kiểu
 * NProgress: nhảy nhanh tới ~90% rồi hoàn tất về 100% và fade out.
 */
export default function TopProgressBar() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timersRef = useRef([])

  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setVisible(true)
    setProgress(15)

    timersRef.current.push(setTimeout(() => setProgress(65), 80))
    timersRef.current.push(setTimeout(() => setProgress(90), 260))
    timersRef.current.push(
      setTimeout(() => {
        setProgress(100)
        timersRef.current.push(setTimeout(() => setVisible(false), 300))
      }, 420)
    )

    return () => timersRef.current.forEach(clearTimeout)
  }, [location.pathname])

  return (
    <div
      aria-hidden="true"
      className="top-progress-bar bg-zinc-900 dark:bg-zinc-100"
      style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
    />
  )
}
