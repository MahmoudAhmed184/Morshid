import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme/theme-provider'

import { AccountSettingsPage } from './account-settings-page'

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
}))

describe('AccountSettingsPage', () => {
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

  function renderSettings() {
    return render(
      <ThemeProvider
        defaultTheme="light"
        defaultPalette="morshid"
        storageKey="test-theme"
      >
        <AccountSettingsPage />
      </ThemeProvider>,
    )
  }

  it('starts with the Morshid light appearance', () => {
    renderSettings()

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

  it('keeps appearance labels stacked until wide desktop layouts', () => {
    renderSettings()

    expect(
      document.querySelector('[data-slot="appearance-mode-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
    expect(
      document.querySelector('[data-slot="appearance-palette-row"]'),
    ).toHaveClass('xl:grid-cols-[12rem_1fr]')
  })

  it('applies and persists display mode and color palette choices', async () => {
    const user = userEvent.setup()
    renderSettings()

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
