'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo } from 'react'

interface ThemeContextValue {
  theme: 'light'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({ theme: 'light' }), [])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return context
}
