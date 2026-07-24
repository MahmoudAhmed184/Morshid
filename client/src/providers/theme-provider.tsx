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
  targetTheme: ThemeMode,
  origin?: ThemeTransitionOrigin,
) {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  if (reduceMotion) {
    updateTheme()
    return
  }

  const isGoingDark =
    targetTheme === 'dark' ||
    (targetTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const x =
    origin?.x ??
    (typeof window !== 'undefined' ? window.innerWidth - 60 : 0)
  const y = origin?.y ?? (typeof window !== 'undefined' ? 40 : 0)
  const endRadius =
    typeof window !== 'undefined'
      ? Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        )
      : 1000

  const hasViewTransition =
    typeof document !== 'undefined' && 'startViewTransition' in document

  if (hasViewTransition) {
    const transition = (
      document as unknown as {
        startViewTransition: (cb: () => void) => { ready: Promise<void> }
      }
    ).startViewTransition(() => {
      updateTheme()
    })

    transition.ready.then(() => {
      const glowFilter = isGoingDark
        ? [
            'drop-shadow(0 0 60px #f59e0b) drop-shadow(0 0 120px #ea580c) brightness(1.2)',
            'drop-shadow(0 0 0px transparent) brightness(1)',
          ]
        : [
            'drop-shadow(0 0 60px #fde047) drop-shadow(0 0 120px #fbbf24) brightness(1.25)',
            'drop-shadow(0 0 0px transparent) brightness(1)',
          ]

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
          filter: glowFilter,
        },
        {
          duration: 550,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    return
  }

  updateTheme()
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
    localStorage.setItem(storageKey, next)
    setThemeState(next)
    runThemeTransition(
      () => {
        applyTheme(next)
      },
      next,
      origin,
    )
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
