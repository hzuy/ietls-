import { createContext, useContext, useEffect } from 'react'

const ThemeContext = createContext({
  theme: 'light',
  resolvedTheme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  useEffect(() => {
    try {
      localStorage.removeItem('theme')
      localStorage.removeItem('color-theme')
      document.documentElement.classList.remove('dark')
    } catch {
      // ignore
    }
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        theme: 'light',
        resolvedTheme: 'light',
        isDark: false,
        setTheme: () => {},
        toggleTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
