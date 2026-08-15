import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ThemeProvider,
  getStoredPreferences,
  getThemeScript,
  isDensity,
  isMotionPreference,
  isTextScale,
  isThemeMode,
  isThemePalette,
  useTheme,
} from './theme-provider'
import type { AppearancePreferences } from './theme-provider'

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: ({ children }: { children: string }) => (
    <script dangerouslySetInnerHTML={{ __html: children }} />
  ),
}))

function TestConsumer() {
  const {
    theme,
    palette,
    textScale,
    density,
    motion,
    setTheme,
    setPalette,
    setTextScale,
    setDensity,
    setMotion,
    resetAppearance,
  } = useTheme()

  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <span data-testid="palette-val">{palette}</span>
      <span data-testid="scale-val">{textScale}</span>
      <span data-testid="density-val">{density}</span>
      <span data-testid="motion-val">{motion}</span>

      <button type="button" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        Set System Theme
      </button>
      <button type="button" onClick={() => setPalette('slate-blue')}>
        Set Slate Blue
      </button>
      <button type="button" onClick={() => setTextScale('112%')}>
        Set 112%
      </button>
      <button type="button" onClick={() => setDensity('compact')}>
        Set Compact
      </button>
      <button type="button" onClick={() => setMotion('reduce')}>
        Set Reduce Motion
      </button>
      <button type="button" onClick={() => resetAppearance()}>
        Reset All
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  let mediaListeners: Record<
    string,
    ((event: MediaQueryListEvent) => void)[] | undefined
  > = {}
  let mediaMatches: Record<string, boolean> = {}

  beforeEach(() => {
    mediaListeners = {}
    mediaMatches = {
      '(prefers-color-scheme: dark)': false,
      '(prefers-reduced-motion: reduce)': false,
    }

    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: Boolean(mediaMatches[query]),
        media: query,
        onchange: null,
        addEventListener: vi.fn(
          (_event: string, listener: (ev: MediaQueryListEvent) => void) => {
            const list = mediaListeners[query] ?? []
            list.push(listener)
            mediaListeners[query] = list
          },
        ),
        removeEventListener: vi.fn(
          (_event: string, listener: (ev: MediaQueryListEvent) => void) => {
            const list = mediaListeners[query]
            if (list !== undefined) {
              mediaListeners[query] = list.filter((l) => l !== listener)
            }
          },
        ),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    delete document.documentElement.dataset.themePalette
    delete document.documentElement.dataset.textScale
    delete document.documentElement.dataset.density
    delete document.documentElement.dataset.motion
    delete document.documentElement.dataset.reducedMotion
    document.documentElement.style.removeProperty('color-scheme')
    vi.unstubAllGlobals()
  })

  it('renders default state and applies attributes to document element', () => {
    render(
      <ThemeProvider storageKey="test-appearance">
        <TestConsumer />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-val')).toHaveTextContent('light')
    expect(screen.getByTestId('palette-val')).toHaveTextContent('morshid')
    expect(screen.getByTestId('scale-val')).toHaveTextContent('100%')
    expect(screen.getByTestId('density-val')).toHaveTextContent('comfortable')
    expect(screen.getByTestId('motion-val')).toHaveTextContent('system')

    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'morshid',
    )
    expect(document.documentElement).toHaveAttribute('data-text-scale', '100%')
    expect(document.documentElement).toHaveAttribute(
      'data-density',
      'comfortable',
    )
    expect(document.documentElement).toHaveAttribute('data-motion', 'system')
    expect(document.documentElement).toHaveAttribute(
      'data-reduced-motion',
      'false',
    )
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('updates and persists settings to local storage', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider storageKey="test-appearance" userId="user-123">
        <TestConsumer />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set Dark' }))
    await user.click(screen.getByRole('button', { name: 'Set Slate Blue' }))
    await user.click(screen.getByRole('button', { name: 'Set 112%' }))
    await user.click(screen.getByRole('button', { name: 'Set Compact' }))
    await user.click(screen.getByRole('button', { name: 'Set Reduce Motion' }))

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark')
    expect(screen.getByTestId('palette-val')).toHaveTextContent('slate-blue')
    expect(screen.getByTestId('scale-val')).toHaveTextContent('112%')
    expect(screen.getByTestId('density-val')).toHaveTextContent('compact')
    expect(screen.getByTestId('motion-val')).toHaveTextContent('reduce')

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'slate-blue',
    )
    expect(document.documentElement).toHaveAttribute('data-text-scale', '112%')
    expect(document.documentElement).toHaveAttribute('data-density', 'compact')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce')
    expect(document.documentElement).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
    expect(document.documentElement.style.colorScheme).toBe('dark')

    const rawStored = localStorage.getItem('test-appearance.user-123')
    expect(rawStored).not.toBeNull()
    const stored = JSON.parse(rawStored ?? '{}')
    expect(stored).toEqual({
      theme: 'dark',
      palette: 'slate-blue',
      textScale: '112%',
      density: 'compact',
      motion: 'reduce',
    })
  })

  it('restores all preferences back to defaults on resetAppearance', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider storageKey="test-appearance">
        <TestConsumer />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set Dark' }))
    await user.click(screen.getByRole('button', { name: 'Set 112%' }))
    await user.click(screen.getByRole('button', { name: 'Set Compact' }))
    await user.click(screen.getByRole('button', { name: 'Set Reduce Motion' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-text-scale', '112%')
    expect(document.documentElement).toHaveAttribute('data-density', 'compact')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce')

    await user.click(screen.getByRole('button', { name: 'Reset All' }))

    expect(screen.getByTestId('theme-val')).toHaveTextContent('light')
    expect(screen.getByTestId('palette-val')).toHaveTextContent('morshid')
    expect(screen.getByTestId('scale-val')).toHaveTextContent('100%')
    expect(screen.getByTestId('density-val')).toHaveTextContent('comfortable')
    expect(screen.getByTestId('motion-val')).toHaveTextContent('system')

    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'morshid',
    )
    expect(document.documentElement).toHaveAttribute('data-text-scale', '100%')
    expect(document.documentElement).toHaveAttribute(
      'data-density',
      'comfortable',
    )
    expect(document.documentElement).toHaveAttribute('data-motion', 'system')
    expect(document.documentElement).toHaveAttribute(
      'data-reduced-motion',
      'false',
    )
  })

  it('maintains preferences scoped to different users without leaking', () => {
    const defaults: AppearancePreferences = {
      theme: 'light',
      palette: 'morshid',
      textScale: '100%',
      density: 'comfortable',
      motion: 'system',
    }

    localStorage.setItem(
      'test-app.user-A',
      JSON.stringify({
        theme: 'dark',
        palette: 'dusk',
        textScale: '112%',
        density: 'compact',
        motion: 'reduce',
      }),
    )

    localStorage.setItem(
      'test-app.user-B',
      JSON.stringify({
        theme: 'light',
        palette: 'soft-mint',
        textScale: '90%',
        density: 'comfortable',
        motion: 'system',
      }),
    )

    const userAPrefs = getStoredPreferences('test-app', 'user-A', defaults)
    expect(userAPrefs.theme).toBe('dark')
    expect(userAPrefs.palette).toBe('dusk')
    expect(userAPrefs.textScale).toBe('112%')
    expect(userAPrefs.density).toBe('compact')
    expect(userAPrefs.motion).toBe('reduce')

    const userBPrefs = getStoredPreferences('test-app', 'user-B', defaults)
    expect(userBPrefs.theme).toBe('light')
    expect(userBPrefs.palette).toBe('soft-mint')
    expect(userBPrefs.textScale).toBe('90%')
    expect(userBPrefs.density).toBe('comfortable')
    expect(userBPrefs.motion).toBe('system')

    const anonPrefs = getStoredPreferences('test-app', null, defaults)
    expect(anonPrefs.theme).toBe('light')
  })

  it('falls back safely when localStorage contains corrupt or invalid JSON', () => {
    const defaults: AppearancePreferences = {
      theme: 'light',
      palette: 'morshid',
      textScale: '100%',
      density: 'comfortable',
      motion: 'system',
    }

    localStorage.setItem('test-app.corrupt', '{invalid-json')
    const result = getStoredPreferences('test-app', 'corrupt', defaults)
    expect(result).toEqual(defaults)

    localStorage.setItem(
      'test-app.invalid-fields',
      JSON.stringify({
        theme: 'neon',
        palette: 'rainbow',
        textScale: '500%',
        density: 'ultra',
        motion: 'crazy',
      }),
    )
    const result2 = getStoredPreferences('test-app', 'invalid-fields', defaults)
    expect(result2).toEqual(defaults)
  })

  it('responds to OS media query changes in system mode', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider storageKey="test-appearance">
        <TestConsumer />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set System Theme' }))
    expect(screen.getByTestId('theme-val')).toHaveTextContent('system')
    expect(document.documentElement).toHaveClass('light')

    // Simulate OS switching to dark mode
    mediaMatches['(prefers-color-scheme: dark)'] = true
    const darkListeners = mediaListeners['(prefers-color-scheme: dark)'] ?? []
    for (const listener of darkListeners) {
      listener({ matches: true } as MediaQueryListEvent)
    }

    expect(document.documentElement).toHaveClass('dark')

    // Simulate OS switching to reduced motion
    mediaMatches['(prefers-reduced-motion: reduce)'] = true
    const motionListeners =
      mediaListeners['(prefers-reduced-motion: reduce)'] ?? []
    for (const listener of motionListeners) {
      listener({ matches: true } as MediaQueryListEvent)
    }

    expect(document.documentElement).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
  })

  it('generates valid script content for SSR pre-hydration injection', () => {
    const script = getThemeScript(
      'morshid.appearance',
      'light',
      'morshid',
      '100%',
      'comfortable',
      'system',
    )

    expect(script).toContain('morshid.appearance')
    expect(script).toContain('data-theme-palette')
    expect(script).toContain('data-text-scale')
    expect(script).toContain('data-density')
    expect(script).toContain('data-motion')
    expect(script).toContain('data-reduced-motion')
  })

  it('validates predicates for all theme and accessibility options', () => {
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('system')).toBe(true)
    expect(isThemeMode('other')).toBe(false)

    expect(isThemePalette('morshid')).toBe(true)
    expect(isThemePalette('ocean-mist')).toBe(true)
    expect(isThemePalette('slate-blue')).toBe(true)
    expect(isThemePalette('lavender-gray')).toBe(true)
    expect(isThemePalette('soft-mint')).toBe(true)
    expect(isThemePalette('dusk')).toBe(true)
    expect(isThemePalette('neon')).toBe(false)

    expect(isTextScale('90%')).toBe(true)
    expect(isTextScale('100%')).toBe(true)
    expect(isTextScale('112%')).toBe(true)
    expect(isTextScale('125%')).toBe(false)

    expect(isDensity('comfortable')).toBe(true)
    expect(isDensity('compact')).toBe(true)
    expect(isDensity('spacious')).toBe(false)

    expect(isMotionPreference('system')).toBe(true)
    expect(isMotionPreference('reduce')).toBe(true)
    expect(isMotionPreference('auto')).toBe(false)
  })
})
