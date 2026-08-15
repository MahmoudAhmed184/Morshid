import { render, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import * as documentNavigation from '@/lib/browser/document-navigation'
import { AuthRefreshSync } from './auth-refresh-sync'

vi.mock('@/lib/browser/document-navigation', () => ({
  replaceDocument: vi.fn(),
}))

vi.mock('@/features/auth/session/interface/authenticated-api-client', () => ({
  restoreAuthSession: vi.fn().mockResolvedValue(null),
}))

const mockStudentSession: AuthSession = {
  tokenType: 'Bearer',
  user: {
    id: 'student-1',
    email: 'student@morshid.demo',
    displayName: 'Demo Student',
    role: 'STUDENT',
    status: 'ACTIVE',
  },
  accessToken: 'valid-access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
}

describe('AuthRefreshSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    vi.restoreAllMocks()
  })

  it('redirects to /login when session is cleared while on a protected route', async () => {
    useAuthStore.getState().setSession(mockStudentSession)
    window.history.pushState({}, '', '/chat')

    render(<AuthRefreshSync />)

    expect(documentNavigation.replaceDocument).not.toHaveBeenCalled()

    // Simulate session revocation (e.g. from 401 terminal auth error)
    act(() => {
      useAuthStore.getState().clearSession()
    })

    expect(documentNavigation.replaceDocument).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login when session is revoked while on a staff protected route', async () => {
    useAuthStore.getState().setSession({
      ...mockStudentSession,
      user: { ...mockStudentSession.user, role: 'INSTRUCTOR' },
    })
    window.history.pushState({}, '', '/instructor/materials')

    render(<AuthRefreshSync />)

    expect(documentNavigation.replaceDocument).not.toHaveBeenCalled()

    act(() => {
      useAuthStore.getState().clearSession()
    })

    expect(documentNavigation.replaceDocument).toHaveBeenCalledWith('/login')
  })

  it('does not redirect when session is cleared on the public landing page', async () => {
    useAuthStore.getState().setSession(mockStudentSession)
    window.history.pushState({}, '', '/')

    render(<AuthRefreshSync />)

    act(() => {
      useAuthStore.getState().clearSession()
    })

    expect(documentNavigation.replaceDocument).not.toHaveBeenCalled()
  })

  it('does not redirect when already on /login', async () => {
    useAuthStore.getState().setSession(mockStudentSession)
    window.history.pushState({}, '', '/login')

    render(<AuthRefreshSync />)

    act(() => {
      useAuthStore.getState().clearSession()
    })

    expect(documentNavigation.replaceDocument).not.toHaveBeenCalled()
  })

  it('does not redirect on initial cold load of a protected route before session restore', async () => {
    // Unauthenticated initial state on /admin before beforeLoad has finished
    window.history.pushState({}, '', '/admin')

    render(<AuthRefreshSync />)

    expect(documentNavigation.replaceDocument).not.toHaveBeenCalled()
  })
})
