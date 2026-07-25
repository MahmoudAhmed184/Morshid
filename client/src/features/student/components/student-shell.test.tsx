import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { StudentChromeProvider } from '@/features/student/components/student-chrome-context'
import { StudentShell } from '@/features/student/components/student-shell'
import { ThemeProvider } from '@/providers/theme-provider'

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet-content">Settings</div>,
  ScriptOnce: () => null,
}))

function stubViewport({ isMobile }: { isMobile: boolean }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isMobile && query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

function renderShell({
  expanded = true,
  isMobile = false,
}: { expanded?: boolean; isMobile?: boolean } = {}) {
  stubViewport({ isMobile })

  render(
    <ThemeProvider defaultTheme="system" storageKey="test-theme">
      <SidebarProvider defaultOpen={expanded}>
        <StudentChromeProvider>
          <StudentShell />
        </StudentChromeProvider>
      </SidebarProvider>
    </ThemeProvider>,
  )

  const outlet = document.querySelector('[data-slot="student-outlet"]')

  if (!outlet) {
    throw new Error('Expected the shell to render the student outlet')
  }

  return {
    outlet,
    floatingCluster: document.querySelector('.glass-paper'),
  }
}

describe('StudentShell top inset', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  // Spec finding 7 — the control clusters are `fixed top-3 z-50`, so an outlet
  // that starts its own content at the top edge (the Settings header) would sit
  // underneath them. The shell, not each page, reserves the band. A 390px
  // visual check cannot run in jsdom, so this asserts the reserved inset the
  // layout depends on.
  it('reserves a top band for the floating clusters when the frame is dropped', () => {
    const { outlet, floatingCluster } = renderShell({ expanded: false })

    expect(floatingCluster).not.toBeNull()
    expect(outlet).toHaveClass('pt-16')
  })

  it('reserves the same band on mobile, where the sidebar is always off-canvas', () => {
    const { outlet, floatingCluster } = renderShell({
      expanded: true,
      isMobile: true,
    })

    expect(floatingCluster).not.toBeNull()
    expect(outlet).toHaveClass('pt-16')
  })

  it('drops the inset when the framed layout supplies its own top band', () => {
    const { outlet, floatingCluster } = renderShell({ expanded: true })

    expect(floatingCluster).toBeNull()
    expect(outlet).not.toHaveClass('pt-16')
  })
})
