import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme/theme-provider'
import { AppearanceTabContent } from './appearance-tab-content'

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
}))

describe('AppearanceTabContent', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
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

  function renderAppearance() {
    return render(
      <ThemeProvider
        defaultTheme="light"
        defaultPalette="morshid"
        defaultTextScale="100%"
        defaultDensity="comfortable"
        defaultMotion="system"
        storageKey="test-theme"
      >
        <AppearanceTabContent />
      </ThemeProvider>,
    )
  }

  it('starts with the Morshid default appearance and accessibility settings', () => {
    renderAppearance()

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Morshid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: '100% text scale' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Comfortable density' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Follow system motion' }),
    ).toHaveAttribute('aria-pressed', 'true')

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
  })

  it('applies and persists display mode and color palette choices', async () => {
    const user = userEvent.setup()
    renderAppearance()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    await user.click(screen.getByRole('button', { name: 'Ocean Mist' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'ocean-mist',
    )
    expect(localStorage.getItem('test-theme')).toBe('dark')
    expect(localStorage.getItem('test-theme-palette')).toBe('ocean-mist')
  })

  it('applies and persists text scale choices', async () => {
    const user = userEvent.setup()
    renderAppearance()

    await user.click(screen.getByRole('button', { name: '112% text scale' }))

    expect(
      screen.getByRole('button', { name: '112% text scale' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: '100% text scale' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement).toHaveAttribute('data-text-scale', '112%')

    await user.click(screen.getByRole('button', { name: '90% text scale' }))

    expect(
      screen.getByRole('button', { name: '90% text scale' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-text-scale', '90%')
  })

  it('applies and persists density choices', async () => {
    const user = userEvent.setup()
    renderAppearance()

    await user.click(screen.getByRole('button', { name: 'Compact density' }))

    expect(
      screen.getByRole('button', { name: 'Compact density' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Comfortable density' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement).toHaveAttribute('data-density', 'compact')
  })

  it('applies and persists motion choices', async () => {
    const user = userEvent.setup()
    renderAppearance()

    await user.click(screen.getByRole('button', { name: 'Reduce motion' }))

    expect(
      screen.getByRole('button', { name: 'Reduce motion' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Follow system motion' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce')
    expect(document.documentElement).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
  })

  it('restores default settings when Reset is clicked', async () => {
    const user = userEvent.setup()
    renderAppearance()

    // Change all settings away from defaults
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    await user.click(screen.getByRole('button', { name: 'Dusk' }))
    await user.click(screen.getByRole('button', { name: '112% text scale' }))
    await user.click(screen.getByRole('button', { name: 'Compact density' }))
    await user.click(screen.getByRole('button', { name: 'Reduce motion' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'dusk',
    )
    expect(document.documentElement).toHaveAttribute('data-text-scale', '112%')
    expect(document.documentElement).toHaveAttribute('data-density', 'compact')
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce')

    // Click reset
    const resetButton = screen.getByRole('button', {
      name: /Reset to defaults/i,
    })
    await user.click(resetButton)

    // Verify restored defaults
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Morshid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: '100% text scale' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Comfortable density' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Follow system motion' }),
    ).toHaveAttribute('aria-pressed', 'true')

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
  })

  it('maintains responsive stacked grid layout classes across all setting rows', () => {
    renderAppearance()

    expect(
      document.querySelector('[data-slot="appearance-mode-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
    expect(
      document.querySelector('[data-slot="appearance-palette-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
    expect(
      document.querySelector('[data-slot="appearance-text-scale-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
    expect(
      document.querySelector('[data-slot="appearance-density-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
    expect(
      document.querySelector('[data-slot="appearance-motion-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
  })
})
