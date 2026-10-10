import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { ThemeContext } from './theme-context.js'
const themeModes = new Set(['light', 'dark', 'system'])
const storageKey = 'poultry-medix-theme'

function getStoredTheme() {
  try {
    const storedTheme = localStorage.getItem(storageKey)
    return themeModes.has(storedTheme) ? storedTheme : 'system'
  } catch (error) {
    console.error('Unable to read the saved theme preference.', error)
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme)
  const [systemDark, setSystemDark] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  ))

  const setTheme = useCallback((nextTheme) => {
    if (!themeModes.has(nextTheme)) return
    setThemeState(nextTheme)
    try {
      localStorage.setItem(storageKey, nextTheme)
    } catch (error) {
      console.error('Unable to save the theme preference.', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => setSystemDark(event.matches)
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
