import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'

import { RolePlaceholderPage } from './role-placeholder-page'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const mockSession: AuthSession = {
  user: {
    id: 'mock-admin',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    courses: [],
  },
  tokenType: 'Bearer',
  accessToken: 'mock-access-token:mock-admin',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'mock-refresh-token:mock-admin',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
}

describe('RolePlaceholderPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(mockSession)
    navigateMock.mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    navigateMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the role name and logs out to the login route', async () => {
    render(<RolePlaceholderPage roleName="Admin" />)

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeDefined()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(window.localStorage).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' })
    })
    expect(fetch).toHaveBeenCalledOnce()
    const [requestUrl, requestInit] = vi.mocked(fetch).mock.calls[0]
    const requestHeaders = new Headers(requestInit?.headers)

    expect(requestUrl).toEqual(
      new URL('http://localhost:4000/api/v1/auth/logout'),
    )
    expect(requestInit?.body).toBe(
      JSON.stringify({ refreshToken: mockSession.refreshToken }),
    )
    expect(requestInit?.method).toBe('POST')
    expect(requestHeaders.get('Accept')).toBe('application/json')
    expect(requestHeaders.get('Content-Type')).toBe('application/json')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage).toHaveLength(0)
  })

  it('clears local auth state even when logout revocation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch')
      }),
    )

    render(<RolePlaceholderPage roleName="Admin" />)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' })
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage).toHaveLength(0)
  })
})
