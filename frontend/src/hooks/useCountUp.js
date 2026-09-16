import { useEffect, useRef, useState } from 'react'

const EASE_OUT_CUBIC = (t) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Đếm số tăng dần từ 0 (hoặc giá trị trước đó) lên `target` bằng
// requestAnimationFrame — chỉ đổi nội dung số, không đụng thuộc tính layout
// (width/height/top/left...). Tôn trọng prefers-reduced-motion như
// `.anim-fade-up`/`.anim-fade-in` ở index.css: nhảy thẳng lên giá trị cuối.
// `target` không phải number (vd '–', undefined) thì trả nguyên trạng, không đếm.
export default function useCountUp(target, { duration = 800, decimals = 0 } = {}) {
  const numericTarget = typeof target === 'number' ? target : parseFloat(target)
  const isNumeric = !Number.isNaN(numericTarget) && typeof target !== 'boolean'
  const [value, setValue] = useState(isNumeric ? 0 : numericTarget)
  const fromRef = useRef(0)

  useEffect(() => {
    if (!isNumeric) return
    if (prefersReducedMotion()) { setValue(numericTarget); return }

    const from = fromRef.current
    const start = performance.now()
    let raf

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = EASE_OUT_CUBIC(progress)
      setValue(from + (numericTarget - from) * eased)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = numericTarget
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [numericTarget, duration, isNumeric])

  if (!isNumeric) return target
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value)
}
