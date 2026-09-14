import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Cuộn về đỉnh trang mỗi khi đổi route — tránh giữ nguyên vị trí cuộn của trang trước. */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
