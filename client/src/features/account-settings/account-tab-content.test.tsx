import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import { AccountTabContent } from './account-tab-content'

describe('AccountTabContent', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  it('renders user details and role badge when authenticated', () => {
    const session: AuthSession = {
      tokenType: 'Bearer',
      user: {
        id: 'student-1',
        email: 'student@morshid.demo',
        displayName: 'Amina Al-Mansoor',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
      accessToken: 'student-token',
      accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    }
    useAuthStore.getState().setSession(session)

    render(<AccountTabContent />)

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('Amina Al-Mansoor')).toBeInTheDocument()
    expect(screen.getByText('student@morshid.demo')).toBeInTheDocument()
    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  it('renders administrator role badge for admin accounts', () => {
    const session: AuthSession = {
      tokenType: 'Bearer',
      user: {
        id: 'admin-1',
        email: 'admin@morshid.demo',
        displayName: 'System Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      accessToken: 'admin-token',
      accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    }
    useAuthStore.getState().setSession(session)

    render(<AccountTabContent />)

    expect(screen.getByText('Administrator')).toBeInTheDocument()
  })
})
