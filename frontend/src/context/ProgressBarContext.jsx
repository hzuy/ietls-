import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { getLoadingConfig } from '../utils/themeConfig'

const ProgressBarContext = createContext(null)

/**
 * Counter-based progress bar context.
 * Uses centralized loading config for timing parameters.
 */
export function ProgressBarProvider({ children }) {
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const counter = useRef(0)
  const timerRef = useRef(null)

  const config = getLoadingConfig('progressBar')

  const start = useCallback(() => {
    counter.current += 1
    if (counter.current === 1) {
      setVisible(true)
      setWidth(config.initialPercent)
      timerRef.current = setTimeout(() => setWidth(config.crawlPercent), config.crawlDelayMs)
    }
  }, [config.initialPercent, config.crawlPercent, config.crawlDelayMs])

  const done = useCallback(() => {
    counter.current = Math.max(0, counter.current - 1)
    if (counter.current === 0) {
      setWidth(100)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, config.finishDelayMs)
    }
  }, [config.finishDelayMs])

  return (
    <ProgressBarContext.Provider value={{ visible, width, start, done }}>
      {children}
    </ProgressBarContext.Provider>
  )
}

export function useProgressBar() {
  const ctx = useContext(ProgressBarContext)
  if (!ctx) throw new Error('useProgressBar must be used within ProgressBarProvider')
  return ctx
}
