import { useState, useEffect } from 'react'

/**
 * Custom hook to debounce a fast-changing value (e.g. search input).
 * @param {any} value - The input value to debounce
 * @param {number} delay - Delay in milliseconds (default 400ms)
 * @returns {any} debouncedValue
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
