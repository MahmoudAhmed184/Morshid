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
    document.documentElement.style.removeProperty('color-scheme')
    vi.unstubAllGlobals()
  })

  function renderAppearance() {
    return render(
      <ThemeProvider
        defaultTheme="light"
        defaultPalette="morshid"
        storageKey="test-theme"
      >
        <AppearanceTabContent />
      </ThemeProvider>,
    )
  }

  it('starts with the Morshid light appearance', () => {
    renderAppearance()

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Morshid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).toHaveAttribute(
      'data-theme-palette',
      'morshid',
    )
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
})
