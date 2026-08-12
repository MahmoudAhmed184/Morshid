import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'

import { RolePlaceholderPage } from './role-placeholder-page'

const { replaceDocumentMock } = vi.hoisted(() => ({
  replaceDocumentMock: vi.fn(),
}))

vi.mock('@/lib/browser/document-navigation', () => ({
  replaceDocument: replaceDocumentMock,
}))

const mockSession: AuthSession = {
  user: {
    id: 'mock-admin',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
  tokenType: 'Bearer',
  accessToken: 'mock-access-token:mock-admin',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
}

function renderRolePlaceholderPage() {
  return render(<RolePlaceholderPage roleName="Admin" />)
}

describe('RolePlaceholderPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(mockSession)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    replaceDocumentMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('ends the browser session after logout succeeds', async () => {
    renderRolePlaceholderPage()

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeDefined()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(window.localStorage).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    const confirmation = screen
      .getByRole('heading', { name: 'Sign out of Morshid?' })
      .closest('[data-slot="alert-dialog-content"]')
    expect(confirmation).not.toBeNull()
    fireEvent.click(
      within(confirmation as HTMLElement).getByRole('button', {
        name: 'Sign out',
      }),
    )

    await waitFor(() => {
      expect(replaceDocumentMock).toHaveBeenCalledWith('/login')
    })
    expect(fetch).toHaveBeenCalledOnce()
    const [requestUrl, requestInit] = vi.mocked(fetch).mock.calls[0]
    const requestHeaders = new Headers(requestInit?.headers)

    expect(requestUrl).toEqual(
      new URL('http://localhost:4000/api/v1/auth/logout'),
    )
    expect(requestInit?.body).toBeUndefined()
    expect(requestInit?.method).toBe('POST')
    expect(requestHeaders.get('Accept')).toBe('application/json')
    expect(requestHeaders.get('Content-Type')).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage).toHaveLength(0)
  })

  it('ends the browser session even when logout revocation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch')
      }),
    )

    renderRolePlaceholderPage()

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    const confirmation = screen
      .getByRole('heading', { name: 'Sign out of Morshid?' })
      .closest('[data-slot="alert-dialog-content"]')
    expect(confirmation).not.toBeNull()
    fireEvent.click(
      within(confirmation as HTMLElement).getByRole('button', {
        name: 'Sign out',
      }),
    )

    await waitFor(() => {
      expect(replaceDocumentMock).toHaveBeenCalledWith('/login')
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage).toHaveLength(0)
  })
})
