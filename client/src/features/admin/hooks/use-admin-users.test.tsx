import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { adminAuditQueryOptions } from '@/features/admin/data/admin-audit.queries'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'

import { useAdminUserMutations } from './use-admin-users'

const adminId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const createdUser = {
  id: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
} as const

const adminSession: AuthSession = {
  user: {
    id: adminId,
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    courses: [],
  },
  tokenType: 'Bearer',
  accessToken: 'admin-access-token',
  accessTokenExpiresAt: '2027-07-11T12:15:00.000Z',
  refreshToken: 'admin-refresh-token',
  refreshTokenExpiresAt: '2027-07-18T12:00:00.000Z',
}

describe('useAdminUserMutations', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(adminSession)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('invalidates audit data after a successful user operation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const auditQueryKey = adminAuditQueryOptions(adminId).queryKey
    queryClient.setQueryData(auditQueryKey, [])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ user: createdUser })),
    )
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useAdminUserMutations(), { wrapper })

    await act(() =>
      result.current.createUser.mutateAsync({
        email: createdUser.email,
        displayName: createdUser.displayName,
        password: 'StrongPassword123!',
        role: createdUser.role,
      }),
    )

    expect(queryClient.getQueryState(auditQueryKey)?.isInvalidated).toBe(true)
  })
})
