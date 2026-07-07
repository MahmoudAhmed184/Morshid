import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authSessionStorageKey,
  useAuthStore,
} from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'

import { RolePlaceholderPage } from './role-placeholder-page'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const mockSession: AuthSession = {
  user: {
    id: 'mock-admin',
    email: 'admin@morshid.demo',
    name: 'Demo Admin',
    role: 'admin',
  },
  accessToken: 'mock-access-token:mock-admin',
  refreshToken: 'mock-refresh-token:mock-admin',
}

describe('RolePlaceholderPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(mockSession)
    navigateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    navigateMock.mockReset()
    vi.restoreAllMocks()
  })

  it('shows the role name and logs out to the login route', async () => {
    render(<RolePlaceholderPage roleName="Admin" />)

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeDefined()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(window.localStorage.getItem(authSessionStorageKey)).toBe(
      JSON.stringify(mockSession),
    )

    fireEvent.click(screen.getByRole('button', { name: /logout/i }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/login' })
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })
})
