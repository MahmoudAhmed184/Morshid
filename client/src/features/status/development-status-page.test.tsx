import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModeToggle } from '@/components/ui/mode-toggle'
import { ThemeProvider } from '@/providers/theme-provider'
import { DevelopmentStatusPage } from './development-status-page'

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
}))

describe('DevelopmentStatusPage', () => {
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
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  function renderStatusPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="test-theme">
          <DevelopmentStatusPage />
        </ThemeProvider>
      </QueryClientProvider>,
    )
  }

  it('renders the scaffold status page', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            status: 'ok',
            details: {},
          }),
        ),
      ),
    )

    renderStatusPage()

    expect(
      screen.getByRole('heading', { name: /morshid development status/i }),
    ).toBeDefined()
    expect(screen.getByText('TanStack Start React')).toBeDefined()
    expect(screen.getByText('http://localhost:4000')).toBeDefined()
  })

  it('renders the theme menu trigger without nesting buttons', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ModeToggle />
      </ThemeProvider>,
    )

    expect(markup).not.toMatch(
      /<button\b(?=[^>]*data-slot="dropdown-menu-trigger")[^>]*>\s*<button\b/,
    )
  })

  it('marks runtime ready when all infrastructure dependencies are healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            status: 'ok',
            details: {
              database: { status: 'up' },
              redis: { status: 'up' },
              pgvector: { status: 'up' },
            },
          }),
        ),
      ),
    )

    renderStatusPage()

    await waitFor(() => expect(screen.getAllByText('ready')).toHaveLength(3))
    expect(screen.queryByText('pending compose')).toBeNull()
  })
})
