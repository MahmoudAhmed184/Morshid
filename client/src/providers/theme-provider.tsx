import { createContext, useContext, useEffect, useState } from 'react'
import { ScriptOnce } from '@tanstack/react-router'

type ThemeMode = 'dark' | 'light' | 'system'
type ThemeTransitionOrigin = { x: number; y: number }

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  storageKey?: string
}

type ThemeProviderState = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode, origin?: ThemeTransitionOrigin) => void
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
  root.classList.remove('light', 'dark')

  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function runThemeTransition(
  updateTheme: () => void,
  origin?: ThemeTransitionOrigin,
) {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  if (!origin || reduceMotion) {
    updateTheme()
    return
  }

  updateTheme()

  const root = document.documentElement
  const background = getComputedStyle(root)
    .getPropertyValue('--background')
    .trim()
  const ripple = document.createElement('span')
  const maxX = Math.max(origin.x, window.innerWidth - origin.x)
  const maxY = Math.max(origin.y, window.innerHeight - origin.y)
  const radius = Math.hypot(maxX, maxY)

  ripple.className = 'theme-transition-ripple'
  ripple.style.left = `${origin.x}px`
  ripple.style.top = `${origin.y}px`
  ripple.style.background = background
  document.body.append(ripple)

  const animation = ripple.animate(
    [
      {
        opacity: 0.95,
        transform: 'translate(-50%, -50%) scale(0.08)',
      },
      {
        opacity: 0,
        transform: `translate(-50%, -50%) scale(${Math.max(radius / 16, 1)})`,
      },
    ],
    {
      duration: 3000,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  )

  animation.addEventListener('finish', () => {
    ripple.remove()
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

  const setTheme = (next: ThemeMode, origin?: ThemeTransitionOrigin) => {
    runThemeTransition(() => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
      applyTheme(next)
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
