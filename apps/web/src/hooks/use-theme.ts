import { useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const CHANGE_EVENT = 'themechange'
// Kept in memory too, so the toggle still works when storage is blocked.
let chosen: Theme | null = null
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The user's choice if they made one, otherwise the system setting. */
function readTheme(): Theme {
  let stored: string | null = chosen
  try {
    stored = localStorage.getItem(STORAGE_KEY) ?? chosen
  } catch {
    // Storage can be blocked; fall back to the system setting.
  }
  if (stored === 'light' || stored === 'dark') return stored
  return systemDark().matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const media = systemDark()
  media.addEventListener('change', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Light (paper) or dark (chalkboard). index.html applies it before the first paint. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setTheme = (next: Theme) => {
    chosen = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not saved, but still applied for this visit.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return { theme, setTheme }
}
