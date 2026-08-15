import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsShell, SettingsContentSkeleton } from './settings-shell'
import type { SettingsTabDescriptor } from './settings-tab.types'

let currentPathname = '/settings/account'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    'aria-current': ariaCurrent,
  }: {
    to: string
    children: React.ReactNode
    className?: string
    'aria-current'?: React.ComponentProps<'a'>['aria-current']
  }) => (
    <a href={to} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Outlet content</div>,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string
  }) => select({ location: { pathname: currentPathname } }),
}))

const sampleTabs: readonly SettingsTabDescriptor[] = [
  { id: 'account', label: 'Account', to: '/settings/account' },
  { id: 'appearance', label: 'Appearance', to: '/settings/appearance' },
  { id: 'security', label: 'Security', to: '/settings/security' },
]

describe('SettingsShell', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    currentPathname = '/settings/account'
  })

  it('renders page header with accessible title, eyebrow, and description', () => {
    render(<SettingsShell tabs={sampleTabs} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(
      screen.getByText('Manage your profile and workspace preferences.'),
    ).toBeInTheDocument()
  })

  it('renders horizontal navigation with all tabs and marks active item with aria-current="page"', () => {
    currentPathname = '/settings/appearance'
    render(<SettingsShell tabs={sampleTabs} />)

    const nav = screen.getByRole('navigation', { name: 'Settings navigation' })
    expect(nav).toBeInTheDocument()

    const accountLink = screen.getByRole('link', { name: 'Account' })
    const appearanceLink = screen.getByRole('link', { name: 'Appearance' })
    const securityLink = screen.getByRole('link', { name: 'Security' })

    expect(accountLink).not.toHaveAttribute('aria-current')
    expect(appearanceLink).toHaveAttribute('aria-current', 'page')
    expect(securityLink).not.toHaveAttribute('aria-current')
  })

  it('renders children inside the active tab content region', () => {
    render(
      <SettingsShell tabs={sampleTabs}>
        <div data-testid="custom-child">Custom Child Content</div>
      </SettingsShell>,
    )

    expect(screen.getByTestId('custom-child')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Account settings' }),
    ).toBeInTheDocument()
  })

  it('renders outlet when no children are passed', () => {
    render(<SettingsShell tabs={sampleTabs} />)

    expect(screen.getByTestId('outlet-content')).toBeInTheDocument()
  })
})

describe('SettingsContentSkeleton', () => {
  it('renders loading status region for pending routes', () => {
    render(<SettingsContentSkeleton />)

    const skeleton = screen.getByRole('status', {
      name: 'Loading settings content',
    })
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveAttribute('data-slot', 'settings-skeleton')
  })
})
