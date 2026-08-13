import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ScriptOnce } from '@tanstack/react-router'

export type ThemeMode = 'dark' | 'light' | 'system'
export type ThemePalette =
  | 'morshid'
  | 'ocean-mist'
  | 'slate-blue'
  | 'lavender-gray'
  | 'soft-mint'
  | 'dusk'
export type ThemeTransitionOrigin = { x: number; y: number }
type ResolvedTheme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  defaultPalette?: ThemePalette
  storageKey?: string
}

type ThemeProviderState = {
  theme: ThemeMode
  palette: ThemePalette
  setTheme: (theme: ThemeMode, origin?: ThemeTransitionOrigin) => void
  setPalette: (palette: ThemePalette, origin?: ThemeTransitionOrigin) => void
}

type ViewTransition = {
  ready: Promise<void>
  finished: Promise<void>
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isThemePalette(value: unknown): value is ThemePalette {
  return (
    value === 'morshid' ||
    value === 'ocean-mist' ||
    value === 'slate-blue' ||
    value === 'lavender-gray' ||
    value === 'soft-mint' ||
    value === 'dusk'
  )
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

function getStoredPalette(
  storageKey: string,
  defaultPalette: ThemePalette,
): ThemePalette {
  if (typeof window === 'undefined') return defaultPalette

  const stored = localStorage.getItem(`${storageKey}-palette`)
  return isThemePalette(stored) ? stored : defaultPalette
}

function getThemeScript(
  storageKey: string,
  defaultTheme: ThemeMode,
  defaultPalette: ThemePalette,
) {
  const key = JSON.stringify(storageKey)
  const paletteKey = JSON.stringify(`${storageKey}-palette`)
  const fallback = JSON.stringify(defaultTheme)
  const paletteFallback = JSON.stringify(defaultPalette)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var p=localStorage.getItem(${paletteKey});if(p!=='morshid'&&p!=='ocean-mist'&&p!=='slate-blue'&&p!=='lavender-gray'&&p!=='soft-mint'&&p!=='dusk'){p=${paletteFallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r);e.dataset.themePalette=p;e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

function applyTheme(theme: ThemeMode, palette: ThemePalette) {
  const root = document.documentElement
  const resolved = resolveTheme(theme)

  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.dataset.themePalette = palette
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
  defaultTheme = 'light',
  defaultPalette = 'morshid',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    getStoredTheme(storageKey, defaultTheme),
  )
  const [palette, setPaletteState] = useState<ThemePalette>(() =>
    getStoredPalette(storageKey, defaultPalette),
  )

  useEffect(() => {
    applyTheme(theme, palette)
  }, [palette, theme])

  useEffect(() => {
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system', palette)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [palette, theme])

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
      applyTheme(nextTheme, palette)
      setThemeState(nextTheme)
    }, origin)
  }

  const setPalette = (
    nextPalette: ThemePalette,
    origin?: ThemeTransitionOrigin,
  ) => {
    if (nextPalette === palette) return

    localStorage.setItem(`${storageKey}-palette`, nextPalette)
    runThemeTransition(() => {
      applyTheme(theme, nextPalette)
      setPaletteState(nextPalette)
    }, origin)
  }

  return (
    <ThemeProviderContext value={{ theme, palette, setTheme, setPalette }}>
      <ScriptOnce>
        {getThemeScript(storageKey, defaultTheme, defaultPalette)}
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
