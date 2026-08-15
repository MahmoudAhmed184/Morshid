import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme/theme-provider'

import { SignInPage } from './sign-in-page'

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
  useNavigate: () => vi.fn(),
}))

describe('SignInPage', () => {
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
    document.documentElement.classList.remove('light', 'dark')
    delete document.documentElement.dataset.themePalette
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lets an anonymous user switch to dark mode', async () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey="test-theme">
        <SignInPage />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Dark/ }))

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark')
    })
    expect(localStorage.getItem('test-theme')).toBe('dark')
  })
})
