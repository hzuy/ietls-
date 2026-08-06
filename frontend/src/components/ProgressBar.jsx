import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useProgressBar } from '../context/ProgressBarContext'
import progressBridge from '../utils/progressBridge'
import { getLoadingConfig } from '../utils/themeConfig'

/**
 * Thin fixed-top progress bar.
 * Uses centralized getLoadingConfig for styling and animation attributes.
 */
export default function ProgressBar() {
  const { visible, width, start, done } = useProgressBar()
  const location = useLocation()
  const config = getLoadingConfig('progressBar')

  useEffect(() => {
    progressBridge.register(start, done)
  }, [start, done])

  useEffect(() => {
    start()
    const t = setTimeout(done, config.routeMinDelayMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: config.height,
        width: `${width}%`,
        background: config.gradient,
        zIndex: config.zIndex,
        transition: width === 100
          ? 'width 0.15s ease-out'
          : width < 20
            ? 'width 0.08s ease-out'
            : 'width 0.6s ease-out',
        boxShadow: config.boxShadow,
        borderRadius: '0 2px 2px 0',
        pointerEvents: 'none',
      }}
    />
  )
}
