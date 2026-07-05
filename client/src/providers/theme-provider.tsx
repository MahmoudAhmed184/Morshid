import { createContext, useContext, useEffect, useState } from 'react'
import { ScriptOnce } from '@tanstack/react-router'

type ThemeMode = 'dark' | 'light' | 'system'
type ThemePreset = 'default' | 'slate' | 'emerald' | 'rose' | 'amber'
type ThemeTransitionOrigin = { x: number; y: number }

const THEME_PRESETS: ThemePreset[] = [
  'default',
  'slate',
  'emerald',
  'rose',
  'amber',
]

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  defaultPreset?: ThemePreset
  storageKey?: string
  presetStorageKey?: string
}

type ThemeProviderState = {
  theme: ThemeMode
  themePreset: ThemePreset
  setTheme: (theme: ThemeMode, origin?: ThemeTransitionOrigin) => void
  setThemePreset: (
    themePreset: ThemePreset,
    origin?: ThemeTransitionOrigin,
  ) => void
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isThemePreset(value: unknown): value is ThemePreset {
  return THEME_PRESETS.includes(value as ThemePreset)
}

function getStoredTheme(
  storageKey: string,
  defaultTheme: ThemeMode,
): ThemeMode {
  if (typeof window === 'undefined') return defaultTheme

  const stored = localStorage.getItem(storageKey)
  return isThemeMode(stored) ? stored : defaultTheme
}

function getStoredThemePreset(
  storageKey: string,
  defaultPreset: ThemePreset,
): ThemePreset {
  if (typeof window === 'undefined') return defaultPreset

  const stored = localStorage.getItem(storageKey)
  return isThemePreset(stored) ? stored : defaultPreset
}

function getThemeScript(
  storageKey: string,
  presetStorageKey: string,
  defaultTheme: ThemeMode,
  defaultPreset: ThemePreset,
) {
  const key = JSON.stringify(storageKey)
  const presetKey = JSON.stringify(presetStorageKey)
  const fallback = JSON.stringify(defaultTheme)
  const presetFallback = JSON.stringify(defaultPreset)
  const presets = JSON.stringify(THEME_PRESETS)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var p=localStorage.getItem(${presetKey});var a=${presets};if(a.indexOf(p)===-1){p=${presetFallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r,'theme-'+p);e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

function applyTheme(theme: ThemeMode, themePreset: ThemePreset) {
  const root = document.documentElement
  root.classList.remove(
    'light',
    'dark',
    ...THEME_PRESETS.map((preset) => `theme-${preset}`),
  )

  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  root.classList.add(resolved, `theme-${themePreset}`)
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
  defaultPreset = 'default',
  storageKey = 'theme',
  presetStorageKey = 'theme-preset',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    getStoredTheme(storageKey, defaultTheme),
  )
  const [themePreset, setThemePresetState] = useState<ThemePreset>(() =>
    getStoredThemePreset(presetStorageKey, defaultPreset),
  )

  useEffect(() => {
    applyTheme(theme, themePreset)
  }, [theme, themePreset])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system', themePreset)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme, themePreset])

  const setTheme = (next: ThemeMode, origin?: ThemeTransitionOrigin) => {
    runThemeTransition(() => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
      applyTheme(next, themePreset)
    }, origin)
  }

  const setThemePreset = (
    next: ThemePreset,
    origin?: ThemeTransitionOrigin,
  ) => {
    runThemeTransition(() => {
      localStorage.setItem(presetStorageKey, next)
      setThemePresetState(next)
      applyTheme(theme, next)
    }, origin)
  }

  return (
    <ThemeProviderContext
      value={{ theme, themePreset, setTheme, setThemePreset }}
    >
      <ScriptOnce>
        {getThemeScript(
          storageKey,
          presetStorageKey,
          defaultTheme,
          defaultPreset,
        )}
      </ScriptOnce>
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
