'use client'

import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'

type Theme = 'dark' | 'light'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const current = saved || 'light'
    document.body.dataset.theme = current
    setTheme(current)
  }, [])

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    document.body.dataset.theme = nextTheme
    localStorage.setItem('theme', nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="button-secondary w-full justify-start"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
