import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ScriptOnce } from '@tanstack/react-router'

export type ThemeMode = 'dark' | 'light' | 'system'
export type ThemeTransitionOrigin = { x: number; y: number }
type ResolvedTheme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  storageKey?: string
}

type ThemeProviderState = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode, origin?: ThemeTransitionOrigin) => void
}

type ViewTransition = {
  ready: Promise<void>
  finished: Promise<void>
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getStoredTheme(
  storageKey: string,
  defaultTheme: ThemeMode,
): ThemeMode {
  if (typeof window === 'undefined') return defaultTheme

  const stored = localStorage.getItem(storageKey)
  return isThemeMode(stored) ? stored : defaultTheme
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme !== 'system') return theme

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getThemeScript(storageKey: string, defaultTheme: ThemeMode) {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const resolved = resolveTheme(theme)

  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function runThemeTransition(
  updateTheme: () => void,
  origin?: ThemeTransitionOrigin,
) {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const hasViewTransition =
    typeof document !== 'undefined' && 'startViewTransition' in document

  if (reduceMotion || !hasViewTransition) {
    updateTheme()
    return
  }

  const root = document.documentElement
  const x =
    origin?.x ?? (typeof window !== 'undefined' ? window.innerWidth - 60 : 0)
  const y = origin?.y ?? (typeof window !== 'undefined' ? 40 : 0)
  const endRadius =
    typeof window !== 'undefined'
      ? Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        )
      : 1000

  // Drive the reveal from CSS custom properties so the compositor path stays
  // stable across Chromium and Firefox View Transitions implementations.
  root.style.setProperty('--theme-transition-x', `${x}px`)
  root.style.setProperty('--theme-transition-y', `${y}px`)
  root.style.setProperty('--theme-transition-r', `${endRadius}px`)
  root.dataset.themeTransition = 'running'

  const transition = (
    document as Document & {
      startViewTransition: (cb: () => void) => ViewTransition
    }
  ).startViewTransition(() => {
    flushSync(() => {
      updateTheme()
    })
  })

  void transition.finished
    .catch(() => {})
    .finally(() => {
      delete root.dataset.themeTransition
      root.style.removeProperty('--theme-transition-x')
      root.style.removeProperty('--theme-transition-y')
      root.style.removeProperty('--theme-transition-r')
    })
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    getStoredTheme(storageKey, defaultTheme),
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (nextTheme: ThemeMode, origin?: ThemeTransitionOrigin) => {
    if (nextTheme === theme) return

    localStorage.setItem(storageKey, nextTheme)

    const currentResolved = resolveTheme(theme)
    const nextResolved = resolveTheme(nextTheme)

    // Preference-only change (e.g. light → system while OS is light): update
    // state without a full-page reveal that would look like a stutter.
    if (currentResolved === nextResolved) {
      setThemeState(nextTheme)
      return
    }

    runThemeTransition(() => {
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    }, origin)
  }

  return (
    <ThemeProviderContext value={{ theme, setTheme }}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
