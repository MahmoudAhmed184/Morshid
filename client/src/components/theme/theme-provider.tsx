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
export type TextScale = '90%' | '100%' | '112%'
export type Density = 'comfortable' | 'compact'
export type MotionPreference = 'system' | 'reduce'

export type ThemeTransitionOrigin = { x: number; y: number }
type ResolvedTheme = 'dark' | 'light'

export interface AppearancePreferences {
  theme: ThemeMode
  palette: ThemePalette
  textScale: TextScale
  density: Density
  motion: MotionPreference
}

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  defaultPalette?: ThemePalette
  defaultTextScale?: TextScale
  defaultDensity?: Density
  defaultMotion?: MotionPreference
  storageKey?: string
  userId?: string | null
}

export interface ThemeProviderState {
  theme: ThemeMode
  palette: ThemePalette
  textScale: TextScale
  density: Density
  motion: MotionPreference
  setTheme: (theme: ThemeMode, origin?: ThemeTransitionOrigin) => void
  setPalette: (palette: ThemePalette, origin?: ThemeTransitionOrigin) => void
  setTextScale: (scale: TextScale) => void
  setDensity: (density: Density) => void
  setMotion: (motion: MotionPreference) => void
  resetAppearance: () => void
}

type ViewTransition = {
  ready: Promise<void>
  finished: Promise<void>
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return (
    value === 'morshid' ||
    value === 'ocean-mist' ||
    value === 'slate-blue' ||
    value === 'lavender-gray' ||
    value === 'soft-mint' ||
    value === 'dusk'
  )
}

export function isTextScale(value: unknown): value is TextScale {
  return value === '90%' || value === '100%' || value === '112%'
}

export function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact'
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduce'
}

function getUserScopedKey(storageKey: string, userId?: string | null): string {
  const scope = userId && userId.trim() !== '' ? userId.trim() : 'anonymous'
  return `${storageKey}.${scope}`
}

function parsePreferences(raw: string | null): Partial<AppearancePreferences> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      const p = parsed as Record<string, unknown>
      const result: Partial<AppearancePreferences> = {}
      if (isThemeMode(p.theme)) result.theme = p.theme
      if (isThemePalette(p.palette)) result.palette = p.palette
      if (isTextScale(p.textScale)) result.textScale = p.textScale
      if (isDensity(p.density)) result.density = p.density
      if (isMotionPreference(p.motion)) result.motion = p.motion
      return result
    }
  } catch {
    // If not JSON, ignore and try legacy
  }
  return {}
}

export function getStoredPreferences(
  storageKey: string,
  userId: string | null | undefined,
  defaults: AppearancePreferences,
): AppearancePreferences {
  if (typeof window === 'undefined') return defaults

  try {
    // 1. If explicit userId provided, check user-scoped storage key
    if (userId && userId.trim() !== '') {
      const userScopedKey = getUserScopedKey(storageKey, userId)
      const rawUserScoped = localStorage.getItem(userScopedKey)
      if (rawUserScoped) {
        const parsed = parsePreferences(rawUserScoped)
        return {
          theme: parsed.theme ?? defaults.theme,
          palette: parsed.palette ?? defaults.palette,
          textScale: parsed.textScale ?? defaults.textScale,
          density: parsed.density ?? defaults.density,
          motion: parsed.motion ?? defaults.motion,
        }
      }
      return defaults
    }

    // 2. Unauthenticated / anonymous: check active-user pointer
    const activeUser = localStorage.getItem(`${storageKey}.active-user`)
    if (activeUser) {
      const activeUserKey = getUserScopedKey(storageKey, activeUser)
      const rawActive = localStorage.getItem(activeUserKey)
      if (rawActive) {
        const parsed = parsePreferences(rawActive)
        return {
          theme: parsed.theme ?? defaults.theme,
          palette: parsed.palette ?? defaults.palette,
          textScale: parsed.textScale ?? defaults.textScale,
          density: parsed.density ?? defaults.density,
          motion: parsed.motion ?? defaults.motion,
        }
      }
    }

    // 3. Anonymous scoped key
    const anonKey = getUserScopedKey(storageKey, null)
    const rawAnon = localStorage.getItem(anonKey)
    if (rawAnon) {
      const parsed = parsePreferences(rawAnon)
      return {
        theme: parsed.theme ?? defaults.theme,
        palette: parsed.palette ?? defaults.palette,
        textScale: parsed.textScale ?? defaults.textScale,
        density: parsed.density ?? defaults.density,
        motion: parsed.motion ?? defaults.motion,
      }
    }

    // 4. Legacy flat keys fallback (migration)
    const legacyTheme = localStorage.getItem(storageKey)
    const legacyPalette = localStorage.getItem(`${storageKey}-palette`)
    const legacyScale = localStorage.getItem(`${storageKey}-text-scale`)
    const legacyDensity = localStorage.getItem(`${storageKey}-density`)
    const legacyMotion = localStorage.getItem(`${storageKey}-motion`)

    return {
      theme: isThemeMode(legacyTheme) ? legacyTheme : defaults.theme,
      palette: isThemePalette(legacyPalette) ? legacyPalette : defaults.palette,
      textScale: isTextScale(legacyScale) ? legacyScale : defaults.textScale,
      density: isDensity(legacyDensity) ? legacyDensity : defaults.density,
      motion: isMotionPreference(legacyMotion) ? legacyMotion : defaults.motion,
    }
  } catch {
    return defaults
  }
}

function persistPreferences(
  storageKey: string,
  userId: string | null | undefined,
  prefs: AppearancePreferences,
): void {
  if (typeof window === 'undefined') return
  try {
    const key = getUserScopedKey(storageKey, userId)
    localStorage.setItem(key, JSON.stringify(prefs))
    if (userId && userId.trim() !== '') {
      localStorage.setItem(`${storageKey}.active-user`, userId.trim())
    }
    // Also mirror to legacy keys for compatibility
    localStorage.setItem(storageKey, prefs.theme)
    localStorage.setItem(`${storageKey}-palette`, prefs.palette)
    localStorage.setItem(`${storageKey}-text-scale`, prefs.textScale)
    localStorage.setItem(`${storageKey}-density`, prefs.density)
    localStorage.setItem(`${storageKey}-motion`, prefs.motion)
  } catch {
    // Storage quota or private browsing
  }
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function isOsReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function resolveReducedMotion(motion: MotionPreference): boolean {
  if (motion === 'reduce') return true
  return isOsReducedMotion()
}

export function applyAppearance(prefs: AppearancePreferences): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const resolved = resolveTheme(prefs.theme)
  const reducedMotion = resolveReducedMotion(prefs.motion)

  // 1. Class
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)

  // 2. Data attributes
  root.dataset.themePalette = prefs.palette
  root.dataset.textScale = prefs.textScale
  root.dataset.density = prefs.density
  root.dataset.motion = prefs.motion
  root.dataset.reducedMotion = reducedMotion ? 'true' : 'false'

  // 3. Color scheme style
  root.style.colorScheme = resolved
}

export function getThemeScript(
  storageKey: string,
  defaultTheme: ThemeMode,
  defaultPalette: ThemePalette,
  defaultTextScale: TextScale = '100%',
  defaultDensity: Density = 'comfortable',
  defaultMotion: MotionPreference = 'system',
): string {
  return `(function() {
    try {
      var d = document.documentElement;
      var activeUser = localStorage.getItem('${storageKey}.active-user');
      var userKey = activeUser ? '${storageKey}.' + activeUser : '${storageKey}.anonymous';
      var raw = localStorage.getItem(userKey);
      var prefs = null;
      if (raw) {
        try { prefs = JSON.parse(raw); } catch (e) {}
      }
      var theme = (prefs && prefs.theme) || localStorage.getItem('${storageKey}') || '${defaultTheme}';
      var palette = (prefs && prefs.palette) || localStorage.getItem('${storageKey}-palette') || '${defaultPalette}';
      var textScale = (prefs && prefs.textScale) || localStorage.getItem('${storageKey}-text-scale') || '${defaultTextScale}';
      var density = (prefs && prefs.density) || localStorage.getItem('${storageKey}-density') || '${defaultDensity}';
      var motion = (prefs && prefs.motion) || localStorage.getItem('${storageKey}-motion') || '${defaultMotion}';

      var validThemes = ['light', 'dark', 'system'];
      var validPalettes = ['morshid', 'ocean-mist', 'slate-blue', 'lavender-gray', 'soft-mint', 'dusk'];
      var validScales = ['90%', '100%', '112%'];
      var validDensities = ['comfortable', 'compact'];
      var validMotions = ['system', 'reduce'];

      if (validThemes.indexOf(theme) === -1) theme = '${defaultTheme}';
      if (validPalettes.indexOf(palette) === -1) palette = '${defaultPalette}';
      if (validScales.indexOf(textScale) === -1) textScale = '${defaultTextScale}';
      if (validDensities.indexOf(density) === -1) density = '${defaultDensity}';
      if (validMotions.indexOf(motion) === -1) motion = '${defaultMotion}';

      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

      var osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var isReduced = motion === 'reduce' || (motion === 'system' && osReduce);

      d.classList.remove('light', 'dark');
      d.classList.add(resolved);
      d.setAttribute('data-theme-palette', palette);
      d.setAttribute('data-text-scale', textScale);
      d.setAttribute('data-density', density);
      d.setAttribute('data-motion', motion);
      d.setAttribute('data-reduced-motion', isReduced ? 'true' : 'false');
      d.style.colorScheme = resolved;
    } catch (e) {}
  })();`
}

function runThemeTransition(
  origin: ThemeTransitionOrigin | undefined,
  applyUpdate: () => void,
  motion: MotionPreference,
): void {
  const reducedMotion = resolveReducedMotion(motion)

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => ViewTransition
  }

  if (
    reducedMotion ||
    !origin ||
    typeof doc.startViewTransition !== 'function'
  ) {
    applyUpdate()
    return
  }

  const { x, y } = origin
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const transition = doc.startViewTransition(() => {
    flushSync(applyUpdate)
  })

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x.toString()}px ${y.toString()}px)`,
            `circle(${maxRadius.toString()}px at ${x.toString()}px ${y.toString()}px)`,
          ],
        },
        {
          duration: 350,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {
      // Transition interrupted
    })
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  defaultPalette = 'morshid',
  defaultTextScale = '100%',
  defaultDensity = 'comfortable',
  defaultMotion = 'system',
  storageKey = 'vite-ui-theme',
  userId = null,
}: ThemeProviderProps) {
  const defaults: AppearancePreferences = {
    theme: defaultTheme,
    palette: defaultPalette,
    textScale: defaultTextScale,
    density: defaultDensity,
    motion: defaultMotion,
  }

  const [activeUserId, setActiveUserId] = useState(userId)
  const [preferences, setPreferencesState] = useState<AppearancePreferences>(
    () => getStoredPreferences(storageKey, userId, defaults),
  )

  if (activeUserId !== userId) {
    setActiveUserId(userId)
    const loaded = getStoredPreferences(storageKey, userId, defaults)
    setPreferencesState(loaded)
  }

  // Apply on mount and on state changes
  useEffect(() => {
    applyAppearance(preferences)
  }, [preferences])

  // Listen to OS color scheme changes when mode is 'system'
  useEffect(() => {
    if (preferences.theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyAppearance(preferences)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preferences])

  // Listen to OS reduced motion changes when motion is 'system'
  useEffect(() => {
    if (preferences.motion !== 'system') return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => applyAppearance(preferences)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preferences])

  const updatePreferences = (next: AppearancePreferences) => {
    persistPreferences(storageKey, userId, next)
    applyAppearance(next)
    setPreferencesState(next)
  }

  const setTheme = (nextTheme: ThemeMode, origin?: ThemeTransitionOrigin) => {
    if (nextTheme === preferences.theme) return

    const nextPreferences: AppearancePreferences = {
      ...preferences,
      theme: nextTheme,
    }

    runThemeTransition(
      origin,
      () => updatePreferences(nextPreferences),
      preferences.motion,
    )
  }

  const setPalette = (
    nextPalette: ThemePalette,
    origin?: ThemeTransitionOrigin,
  ) => {
    if (nextPalette === preferences.palette) return

    const nextPreferences: AppearancePreferences = {
      ...preferences,
      palette: nextPalette,
    }

    runThemeTransition(
      origin,
      () => updatePreferences(nextPreferences),
      preferences.motion,
    )
  }

  const setTextScale = (scale: TextScale) => {
    if (scale === preferences.textScale) return
    updatePreferences({
      ...preferences,
      textScale: scale,
    })
  }

  const setDensity = (density: Density) => {
    if (density === preferences.density) return
    updatePreferences({
      ...preferences,
      density,
    })
  }

  const setMotion = (motion: MotionPreference) => {
    if (motion === preferences.motion) return
    updatePreferences({
      ...preferences,
      motion,
    })
  }

  const resetAppearance = () => {
    const defaultState: AppearancePreferences = {
      theme: 'light',
      palette: 'morshid',
      textScale: '100%',
      density: 'comfortable',
      motion: 'system',
    }
    updatePreferences(defaultState)
  }

  const value: ThemeProviderState = {
    theme: preferences.theme,
    palette: preferences.palette,
    textScale: preferences.textScale,
    density: preferences.density,
    motion: preferences.motion,
    setTheme,
    setPalette,
    setTextScale,
    setDensity,
    setMotion,
    resetAppearance,
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      <ScriptOnce>
        {getThemeScript(
          storageKey,
          defaultTheme,
          defaultPalette,
          defaultTextScale,
          defaultDensity,
          defaultMotion,
        )}
      </ScriptOnce>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
