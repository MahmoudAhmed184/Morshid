import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'

import { Navbar } from './navbar'

const mockSession: AuthSession = {
  tokenType: 'Bearer',
  user: {
    id: 'user-1',
    email: 'admin@morshid.demo',
    displayName: 'P0 Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    courses: [],
  },
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    hash,
    to,
    ...props
  }: {
    children?: React.ReactNode
    hash?: string
    to: string
  }) => (
    <a href={`${to}${hash ? `#${hash}` : ''}`} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/ui/mode-toggle', () => ({
  ModeToggle: () => <button type="button">Theme</button>,
}))

describe('Navbar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('shows login actions for guests', () => {
    render(<Navbar />)

    expect(screen.getByRole('button', { name: /log in/i })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(
      screen.getByRole('button', { name: /get started/i }),
    ).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: /dashboard/i })).toBeNull()
  })

  it('shows the current user dashboard action for authenticated users', () => {
    useAuthStore.getState().setSession(mockSession)

    render(<Navbar />)

    expect(screen.getByRole('button', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(screen.queryByRole('button', { name: /log in/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /get started/i })).toBeNull()
  })

  it('shows stable Instructor workspace navigation for Instructor users', () => {
    useAuthStore.getState().setSession({
      ...mockSession,
      user: { ...mockSession.user, role: 'INSTRUCTOR' },
    })

    render(<Navbar />)

    expect(
      screen.getAllByRole('link', { name: 'Overview' })[0],
    ).toHaveAttribute('href', '/instructor')
    expect(
      screen.getAllByRole('link', { name: 'Materials' })[0],
    ).toHaveAttribute('href', '/instructor#materials')
    expect(
      screen.getAllByRole('link', { name: 'Review queue' })[0],
    ).toHaveAttribute('href', '/instructor#reviews')
    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull()
  })
})
