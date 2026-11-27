'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
  }, [mode])

  const value = useMemo(() => ({
    mode,
    toggleMode: () => setMode((currentMode) => currentMode === 'light' ? 'dark' : 'light'),
  }), [mode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeToggle() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('ThemeToggle must be used inside ThemeProvider.')
  }

  const isDark = context.mode === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="theme-toggle"
      onClick={context.toggleMode}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
